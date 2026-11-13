// Sujet : « Copier pour Office » (menu ⋯ d'un bloc). Un texte ou un tableau part en HTML à styles en ligne, en thème clair
// même sous le thème sombre, avec un texte brut ; une carte (fond hors ligne) ou une chronologie part en image PNG dessinée
// à la largeur de la page imprimée, à dpr 2 ; un presse-papier qui refuse donne un message d'erreur.
// Origine : spec groupe-office-diamant, ticket 04. Presse-papier, canvas et menu ne se voient que dans un vrai navigateur.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const P = (t) => '<span class="pill">' + t + '</span>';
const DOC = { v: 6, id: 'doc-copier-office', title: 'Office', theme: 'dark', tags: { ok: { c: 0 } }, pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'x1', type: 'p', html: 'Statut ' + P('OK') + ' et <a href="#pg-p1">lien interne</a>' },
  { id: 't1', type: 'table', rows: [['Nom', 'État'], ['Serveur', P('OK')]] },
  { id: 'tl', type: 'timeline', orient: 'v', items: [{ date: '2024', title: 'Début', text: '', color: 'ok' }, { date: '2025', title: 'Fin', text: '', color: 'ok' }] },
  { id: 'mp', type: 'map', height: 300, bg: 'vector', view: { lat: 48, lon: 2, z: 4 }, markers: [{ lat: 48.85, lon: 2.35, label: 'Paris', color: 'bad' }], zones: [], routes: [], list: false },
] }] };

export const nom = 'copier pour Office';
export default async function ({ ecran, cdp, evalue, attendre, mesure, echec }) {
  const dir = mkdtempSync(join(tmpdir(), 'ardoise-office-'));
  try {
    const source = readFileSync(new URL('../../dist/ardoise.html', import.meta.url), 'utf8');
    const balise = '<script id="ardoise-doc" type="application/json">{}</script>';
    if (!source.includes(balise)) throw new Error('document embarqué introuvable dans dist/ardoise.html');
    const fichier = join(dir, 'office.html');
    writeFileSync(fichier, source.replace(balise, balise.replace('{}', JSON.stringify(DOC).replace(/<\//g, '<\\/'))));
    await ecran(1000, false);
    await cdp('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
    await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp('Page.navigate', { url: 'file://' + fichier });
    for (let i = 0; i < 100 && !(await evalue('document.readyState === "complete" && !!document.querySelector("#app .tl")')); i++) await attendre(50);
    for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, modifiers: 2, key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69 });
    for (let i = 0; i < 40 && !(await evalue('!!document.querySelector(".blk[data-id=x1] [data-act=menu-bloc]")')); i++) await attendre(50);
    if (!(await evalue('document.documentElement.dataset.theme === "dark"'))) echec('le document n\'est pas en thème sombre : l\'essai du thème clair ne prouverait rien');

    // ⋯ puis « Copier pour Office » au vrai clic (geste de l'utilisateur), presse-papier vidé avant
    const copier = async (id) => {
      await evalue('navigator.clipboard.writeText("vide").then(() => true)');
      await evalue(`(() => { const t = document.querySelector('.toast'); if (t) t.style.display = 'none'; const b = document.querySelector('.blk[data-id="${id}"] [data-act="menu-bloc"]'); b.scrollIntoView({ block: 'center' }); b.click(); return true; })()`);
      const p = await evalue(`(() => { const x = [...document.querySelectorAll('.menu-bloc .mi')].find((m) => m.textContent.includes('Copier pour Office')); if (!x) return null; const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (!p) { echec('« Copier pour Office » absent du menu ⋯ de ' + id); return null; }
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
      for (let i = 0; i < 60 && !(await evalue('(() => { const t = document.querySelector(".toast"); return !!t && t.style.display === "block"; })()')); i++) await attendre(100);
      return evalue('document.querySelector(".toast") && document.querySelector(".toast").textContent');
    };
    const presse = () => evalue(`(async () => { const o = {}; for (const i of await navigator.clipboard.read()) for (const t of i.types) o[t] = t === 'image/png' ? 'png' : await (await i.getType(t)).text(); return o; })()`);
    // image du presse-papier : taille et nombre de pixels proches (écart ≤ e par canal) de chaque couleur cherchée
    const image = (couleurs, e = 40) => evalue(`(async () => {
      for (const i of await navigator.clipboard.read()) if (i.types.includes('image/png')) {
        const bm = await createImageBitmap(await i.getType('image/png')), cv = document.createElement('canvas'); cv.width = bm.width; cv.height = bm.height;
        const g = cv.getContext('2d'); g.drawImage(bm, 0, 0); const px = g.getImageData(0, 0, bm.width, bm.height).data, n = {};
        for (const c of ${JSON.stringify(couleurs)}) { const r = parseInt(c.slice(1, 3), 16), v = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); let k = 0;
          for (let j = 0; j < px.length; j += 4) if (Math.abs(px[j] - r) <= ${e} && Math.abs(px[j + 1] - v) <= ${e} && Math.abs(px[j + 2] - b) <= ${e}) k++; n[c] = k; }
        return { l: bm.width, h: bm.height, n };
      }
      return null; })()`);

    // paragraphe : HTML à styles en ligne en thème clair, lien interne sans adresse, texte brut à côté
    mesure();
    const t1 = await copier('x1'), p1 = await presse();
    if (t1 !== 'Copié pour Office') echec('message après la copie : ' + t1);
    if (Object.keys(p1).sort().join() !== 'text/html,text/plain') echec('types du presse-papier (paragraphe) : ' + Object.keys(p1));
    else {
      if (!p1['text/html'].includes('background:#e3f3ea;color:#1f7a4d')) echec('pastille hors du thème clair : ' + p1['text/html']);
      if (/class=/.test(p1['text/html'].replace(/<meta[^>]*>/, ''))) echec('classe dans le HTML copié : ' + p1['text/html']);
      if (p1['text/html'].includes('#pg-p1') || !p1['text/html'].includes('<u>lien interne</u>')) echec('lien interne : ' + p1['text/html']);
      if (p1['text/plain'] !== 'Statut #OK et lien interne') echec('texte brut : ' + JSON.stringify(p1['text/plain']));
    }

    // tableau : vrai tableau à en-tête
    mesure();
    await copier('t1'); const p2 = await presse();
    if (!/<table[\s\S]*<th[\s\S]*Nom/.test(p2['text/html'] || '')) echec('tableau copié : ' + p2['text/html']);
    if (p2['text/plain'] !== 'Nom\tÉtat\nServeur\t#OK') echec('texte brut du tableau : ' + JSON.stringify(p2['text/plain']));

    // carte au fond hors ligne : image/png de 680 px utiles (+ 2 × 8 de marge) à dpr 2, mer et épingle en couleurs claires
    mesure();
    await copier('mp'); const p3 = await presse();
    if (Object.keys(p3).sort().join() !== 'image/png,text/plain') echec('types du presse-papier (carte) : ' + Object.keys(p3));
    if (p3['text/plain'] !== 'Carte\n- Paris (48.8500, 2.3500)') echec('texte brut de la carte : ' + JSON.stringify(p3['text/plain']));
    const i3 = await image(['#d9e5ec', '#b42318', '#0a1117'], 4);
    if (!i3 || i3.l !== 1392) echec('image de la carte : ' + JSON.stringify(i3));
    else if (i3.n['#d9e5ec'] < 1000 || i3.n['#b42318'] < 50 || i3.n['#0a1117'] > 0) echec('couleurs de la carte (mer claire, épingle rouge, pas de mer sombre) : ' + JSON.stringify(i3.n));

    // chronologie : image/png, points verts du thème clair
    mesure();
    await copier('tl'); const i4 = await image(['#1f7a4d', '#5fd09a'], 4);
    if (!i4 || i4.l !== 1392) echec('image de la chronologie : ' + JSON.stringify(i4));
    else if (i4.n['#1f7a4d'] < 100 || i4.n['#5fd09a'] > 0) echec('points de la chronologie hors du thème clair : ' + JSON.stringify(i4.n));

    // presse-papier qui refuse : message d'erreur, pas « Copié »
    mesure();
    await evalue('(() => { navigator.clipboard.write = () => Promise.reject(new DOMException("refus", "NotAllowedError")); return true; })()');
    const t5 = await copier('x1');
    if (t5 !== 'Le presse-papier a refusé la copie') echec('message d\'un refus : ' + t5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
