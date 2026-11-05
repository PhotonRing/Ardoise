#!/usr/bin/env node
// Relais de synchronisation d'Ardoise — un seul fichier, aucune dépendance (Node.js 18 ou plus).
//
// Le relais ne voit que des données chiffrées : il range les modifications envoyées par les copies d'un même
// document (un « salon ») et les transmet aux autres copies, en direct ou à leur prochaine connexion. Il ne
// connaît ni la clé, ni le contenu, ni les noms des personnes. Il voit : un identifiant de salon (empreinte de la
// clé), la taille et l'heure des envois, et les adresses IP.
//
//   node relais.mjs                       écoute sur le port 8787, données dans ./donnees
//   PORT=9000 DONNEES=/var/lib/ardoise node relais.mjs
//
// Variables : PORT (8787), HOTE (0.0.0.0), DONNEES (./donnees), MAX_TRAME (Mo, 20), MAX_SALON (Mo, 200).
// Mettez-le derrière un proxy HTTPS (Caddy, nginx…) pour une adresse en wss:// (voir relais/README.md).
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const VERSION = 1;
const PORT = +(process.env.PORT || 8787);
const HOTE = process.env.HOTE || '0.0.0.0';
const DONNEES = path.resolve(process.env.DONNEES || './donnees');
const MAX_TRAME = (+(process.env.MAX_TRAME || 20)) * 1024 * 1024;
const MAX_SALON = (+(process.env.MAX_SALON || 200)) * 1024 * 1024;
const ID = /^[A-Za-z0-9_-]{16,64}$/;

// ---------- Salons : journal des trames (fichier ligne par ligne) et dernier instantané ----------
const salons = new Map();
function salon(id) {
  let s = salons.get(id);
  if (s) return s;
  const dir = path.join(DONNEES, id);
  s = { id, dir, cle: null, log: [], snap: null, seq: 0, taille: 0, connexions: new Set() };
  try { s.cle = fs.readFileSync(path.join(dir, 'cle'), 'utf8').trim(); } catch {}
  try { s.snap = JSON.parse(fs.readFileSync(path.join(dir, 'instantane.json'), 'utf8')); s.seq = s.snap.s; s.taille += s.snap.d.length; } catch {}
  try {
    for (const l of fs.readFileSync(path.join(dir, 'journal.jsonl'), 'utf8').split('\n')) {
      if (!l) continue;
      try { const t = JSON.parse(l); if (t.s > s.seq || !s.snap || t.s > s.snap.s) { s.log.push(t); s.seq = Math.max(s.seq, t.s); s.taille += t.d.length; } } catch {}
    }
  } catch {}
  salons.set(id, s);
  return s;
}
function ecrire(s, nom, contenu, ajout) {
  fs.mkdirSync(s.dir, { recursive: true });
  const f = path.join(s.dir, nom);
  if (ajout) fs.appendFileSync(f, contenu);
  else { fs.writeFileSync(f + '.tmp', contenu); fs.renameSync(f + '.tmp', f); }
}
const empreinte = (x) => crypto.createHash('sha256').update(String(x)).digest('base64url');

// ---------- WebSocket (RFC 6455), le strict nécessaire ----------
function trame(op, data) {
  const n = data.length, h = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : Buffer.alloc(10);
  if (n >= 65536) { h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([h, data]);
}
function connexion(sock) {
  const c = { sock, id: crypto.randomBytes(6).toString('base64url'), salon: null, pres: null, tampon: Buffer.alloc(0), morceaux: [], vivant: true };
  c.envoyer = (o) => { if (!sock.destroyed) sock.write(trame(1, Buffer.from(JSON.stringify(o)))); };
  c.fermer = (code = 1000) => { if (!sock.destroyed) { const b = Buffer.alloc(2); b.writeUInt16BE(code); sock.write(trame(8, b)); sock.end(); } };
  sock.on('data', (d) => {
    c.tampon = Buffer.concat([c.tampon, d]);
    for (;;) {
      const b = c.tampon; if (b.length < 2) return;
      const fin = b[0] & 0x80, op = b[0] & 15, masque = b[1] & 0x80; let n = b[1] & 127, o = 2;
      if (n === 126) { if (b.length < 4) return; n = b.readUInt16BE(2); o = 4; }
      else if (n === 127) { if (b.length < 10) return; n = Number(b.readBigUInt64BE(2)); o = 10; }
      if (n > 2 * MAX_TRAME + 65536) { c.envoyer({ t: 'erreur', code: 'trop-gros', msg: 'Envoi trop volumineux pour ce relais' }); return c.fermer(1009); }
      if (!masque) return c.fermer(1002);
      if (b.length < o + 4 + n) return;
      const k = b.subarray(o, o + 4), p = Buffer.from(b.subarray(o + 4, o + 4 + n));
      for (let i = 0; i < n; i++) p[i] ^= k[i & 3];
      c.tampon = b.subarray(o + 4 + n);
      if (op === 8) return c.fermer();
      if (op === 9) { sock.write(trame(10, p)); continue; }
      if (op === 10) { c.vivant = true; continue; }
      if (op === 1 || op === 2 || op === 0) {
        c.morceaux.push(p);
        if (!fin) continue;
        const msg = Buffer.concat(c.morceaux).toString('utf8'); c.morceaux = [];
        let m; try { m = JSON.parse(msg); } catch { continue; }
        try { message(c, m); } catch (e) { console.error('message', e); }
      }
    }
  });
  const fin = () => { if (c.salon) { c.salon.connexions.delete(c); diffuser(c.salon, { t: 'depart', de: c.id }, c); } };
  sock.on('close', fin); sock.on('error', () => sock.destroy());
  return c;
}
function diffuser(s, o, sauf) { for (const x of s.connexions) if (x !== sauf) x.envoyer(o); }

// ---------- Protocole ----------
// → {t:'rejoindre', salon, auth, depuis}       ← {t:'bienvenue', v, seq, snap?, trames:[{s,d}], presents:[{de,d}]}
// → {t:'envoi', id, d}                         ← {t:'recu', id, s} à l'expéditeur, {t:'trame', s, d} aux autres
// → {t:'instantane', jusqua, d}                (remplace les trames jusqu'à « jusqua », qu'il contient)
// → {t:'presence', d}                          ← {t:'presence', de, d} aux autres ; {t:'depart', de} à la déconnexion
function message(c, m) {
  if (m.t === 'rejoindre') {
    if (c.salon || !ID.test(m.salon || '') || !ID.test(m.auth || '')) return c.envoyer({ t: 'erreur', code: 'demande', msg: 'Demande invalide' });
    const s = salon(m.salon), a = empreinte(m.auth);
    if (s.cle && s.cle !== a) return c.envoyer({ t: 'erreur', code: 'cle', msg: 'Clé refusée pour ce salon' });
    if (!s.cle) { s.cle = a; ecrire(s, 'cle', a); }
    c.salon = s; s.connexions.add(c);
    const depuis = Math.max(0, +m.depuis || 0), out = { t: 'bienvenue', v: VERSION, seq: s.seq, trames: [], presents: [] };
    // copie trop en retard (trames déjà remplacées par l'instantané) : instantané, puis la suite
    const debut = s.snap && depuis < s.snap.s ? (out.snap = s.snap, s.snap.s) : depuis;
    for (const t of s.log) if (t.s > debut) out.trames.push(t);
    for (const x of s.connexions) if (x !== c && x.pres) out.presents.push({ de: x.id, d: x.pres });
    return c.envoyer(out);
  }
  const s = c.salon; if (!s) return c.envoyer({ t: 'erreur', code: 'salon', msg: 'Rejoignez d’abord un salon' });
  if (m.t === 'envoi' && typeof m.d === 'string') {
    if (m.d.length > MAX_TRAME) return c.envoyer({ t: 'erreur', code: 'trop-gros', id: m.id, msg: 'Envoi trop volumineux pour ce relais' });
    if (s.taille + m.d.length > MAX_SALON) return c.envoyer({ t: 'erreur', code: 'plein', id: m.id, msg: 'Le relais est plein pour ce document' });
    const t = { s: ++s.seq, d: m.d };
    s.log.push(t); s.taille += t.d.length;
    ecrire(s, 'journal.jsonl', JSON.stringify(t) + '\n', true);
    c.envoyer({ t: 'recu', id: m.id, s: t.s });
    return diffuser(s, { t: 'trame', s: t.s, d: t.d }, c);
  }
  if (m.t === 'instantane' && typeof m.d === 'string') {
    const j = +m.jusqua;
    if (!(j > 0 && j <= s.seq) || (s.snap && j <= s.snap.s) || m.d.length > MAX_TRAME) return;
    s.snap = { s: j, d: m.d };
    s.log = s.log.filter((t) => t.s > j);
    s.taille = s.snap.d.length + s.log.reduce((n, t) => n + t.d.length, 0);
    ecrire(s, 'instantane.json', JSON.stringify(s.snap));
    ecrire(s, 'journal.jsonl', s.log.map((t) => JSON.stringify(t) + '\n').join(''));
    return;
  }
  if (m.t === 'presence' && typeof m.d === 'string' && m.d.length < 4096) { c.pres = m.d; return diffuser(s, { t: 'presence', de: c.id, d: m.d }, c); }
}

// ---------- Serveur ----------
const serveur = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/sante') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`Relais de synchronisation d'Ardoise (protocole ${VERSION}).\nIndiquez l'adresse de ce relais (ws:// ou wss://) dans Fichier → Synchronisation.\n`);
});
serveur.on('upgrade', (req, sock) => {
  const k = req.headers['sec-websocket-key'];
  if (!k || (req.headers.upgrade || '').toLowerCase() !== 'websocket') return sock.destroy();
  const acc = crypto.createHash('sha1').update(k + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  sock.setNoDelay(true);
  const c = connexion(sock);
  c.minuterie = setInterval(() => { if (!c.vivant) return sock.destroy(); c.vivant = false; if (!sock.destroyed) sock.write(trame(9, Buffer.alloc(0))); }, 30000);
  sock.on('close', () => clearInterval(c.minuterie));
});
fs.mkdirSync(DONNEES, { recursive: true });
serveur.listen(PORT, HOTE, () => console.log(`Relais Ardoise : ws://${HOTE}:${PORT} · données dans ${DONNEES}`));
