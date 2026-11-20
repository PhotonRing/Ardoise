// Sujet : collage et copie des lignes de texte d'un bloc texte. Texte brut et HTML collés au curseur (coupe de la ligne,
// jonctions, « - » resté du texte), une seule étape d'annulation ; copie en texte brut et HTML (édition, lecture, sélection
// sur plusieurs blocs) ; d'un bloc texte à l'autre, niveaux gardés ; vers un champ d'une ligne, lignes jointes ; couper ;
// plage de tableur dans un bloc texte vide. Vérifié par le document enregistré (window.ardoise.doc). Origine : spec bloc-texte, ticket 03.
import { readFileSync } from 'node:fs';

const L = (html, lv) => (lv ? { html, lv } : { html });
const doc = (blocks) => ({ id: 'doc-collage', title: 'Collage', pages: [{ id: 'p1', title: 'Accueil', blocks }] });
const LIGNES = (bid) => `JSON.stringify(((window.ardoise.doc.pages[0].blocks.find((b) => b.id === ${JSON.stringify(bid)})) || {}).lignes)`;
// position (ligne i, caractère n) dans un bloc texte (édition ou lecture)
const POS = `const champ = (bid) => document.querySelector('.blk[data-id="' + bid + '"] .texte, .texte[data-b="' + bid + '"]') || document.querySelectorAll('.texte')[+bid.slice(1) - 1];
  const pos = (bid, i, n) => { const lg = champ(bid).querySelectorAll('.lg')[i];
  const w = document.createTreeWalker(lg, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) { if (n <= t.length) return [t, n]; n -= t.length; } return [lg, 0]; };`;
const curseur = (bid, i, n) => `(() => { ${POS} champ('${bid}').focus(); const p = pos('${bid}', ${i}, ${n}), r = document.createRange();
  r.setStart(p[0], p[1]); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
const choisir = (bid, i0, n0, i1, n1) => `(() => { ${POS} const c = champ('${bid}'); if (c.isContentEditable) c.focus(); const a = pos('${bid}', ${i0}, ${n0}), b = pos('${bid}', ${i1}, ${n1}), r = document.createRange();
  r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return s.toString(); })()`;
const CALC = readFileSync(new URL('../fixtures/presse-papier/calc/presse.html', import.meta.url), 'utf8');
const WRITER = readFileSync(new URL('../fixtures/presse-papier/writer-liste/presse.html', import.meta.url), 'utf8');   // vraie capture (LibreOffice 26.8)
const G = (html, genre, lv, done) => { const o = lv ? { html, lv, genre } : { html, genre }; if (done) o.done = true; return o; };

export const nom = 'bloc texte : collage et copie';
export default async function ({ ecran, charger, evalue, cdp, attendre, visibles, mesure, echec }) {
  const charge = async (blocks) => { if (!(await evalue(`window.ardoise.load(${JSON.stringify(doc(blocks))})`))) throw new Error('document refusé'); await attendre(120); };
  const lignes = async (bid) => JSON.parse((await evalue(LIGNES(bid))) || 'null');
  const verifie = async (cas, bid, attendu) => { mesure(); const l = await lignes(bid); if (JSON.stringify(l) !== JSON.stringify(attendu)) echec(cas + ' : ' + JSON.stringify(l) + ' au lieu de ' + JSON.stringify(attendu)); };
  // collage synthétique dans l'élément qui a le focus
  const coller = async (html, texte) => {
    await evalue(`(() => { const dt = new DataTransfer(); if (${JSON.stringify(html)}) dt.setData('text/html', ${JSON.stringify(html || '')}); dt.setData('text/plain', ${JSON.stringify(texte || '')});
      (document.activeElement || document.body).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return true; })()`);
    await attendre(150);
  };
  // copie (ou coupe) synthétique de la sélection : ce qu'Ardoise met dans le presse-papier
  const copier = async (type = 'copy') => JSON.parse(await evalue(`(() => { const dt = new DataTransfer(), s = getSelection(), n = s.anchorNode, c = n && (n.nodeType === 1 ? n : n.parentElement);
    const ev = new ClipboardEvent('${type}', { clipboardData: dt, bubbles: true, cancelable: true }); (c || document.body).dispatchEvent(ev);
    return JSON.stringify({ annulee: ev.defaultPrevented, html: dt.getData('text/html'), texte: dt.getData('text/plain') }); })()`));
  const ctrl = async (k) => {
    for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, modifiers: 2, key: k, code: 'Key' + k.toUpperCase(), windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) });
    await attendre(150);
  };
  await ecran(1000, false);
  await charger();

  // texte brut sur trois lignes au milieu d'une ligne en retrait : la ligne est coupée, « - » reste du texte
  await charge([{ id: 't1', type: 'texte', lignes: [L('a'), L('début fin', 1), L('z')] }]);
  await evalue(curseur('t1', 1, 6));
  await coller('', 'X\n- Y\r\nZ');
  await verifie('texte brut au milieu d\'une ligne', 't1', [L('a'), L('début X', 1), L('- Y'), L('Zfin'), L('z')]);
  // annuler : le collage en une étape
  await ctrl('z');
  await verifie('annuler le collage', 't1', [L('a'), L('début fin', 1), L('z')]);
  // curseur à la fin de la dernière ligne collée
  await evalue(curseur('t1', 1, 6));
  await coller('', 'X\n- Y\r\nZ');
  await cdp('Input.insertText', { text: 'Q' }); await attendre(120);
  await verifie('curseur après le collage', 't1', [L('a'), L('début X', 1), L('- Y'), L('ZQfin'), L('z')]);

  // HTML : <p>, <div> et <br> en lignes de texte ; formes gardées, pastille d'un autre document à la couleur du registre
  await charge([{ id: 't1', type: 'texte', lignes: [L('')] }]);
  await evalue(curseur('t1', 0, 0));
  await coller('<meta charset="utf-8"><p>un <strong>gras</strong> <span class="pill pc-5" data-ad="autre">OK</span></p><div>deux</div>trois<br>quatre<p style="color:red">cinq</p>', 'ignoré');
  await verifie('collage HTML', 't1', [L('un <b>gras</b> <span class="pill">OK</span>'), L('deux'), L('trois'), L('quatre'), L('cinq')]);
  mesure();
  if (!(await evalue(`(() => { const p = document.querySelector('.texte span.pill'); return !!p && getComputedStyle(p).backgroundColor !== 'rgba(0, 0, 0, 0)'; })()`))) echec('collage HTML : pastille non peinte');

  // une seule ligne collée : insérée dans la ligne du curseur
  await charge([{ id: 't1', type: 'texte', lignes: [L('ab', 2)] }]);
  await evalue(curseur('t1', 0, 1));
  await coller('<p>mot</p>', 'mot');
  await verifie('une seule ligne collée', 't1', [L('amotb', 2)]);

  // copie d'une sélection sur deux lignes : texte brut à deux espaces par niveau, HTML en <p> à data-lv
  await charge([{ id: 'h', type: 'h2', html: 'Titre' }, { id: 't1', type: 'texte', lignes: [L('a <span class="pill">OK</span>'), L('bb', 2), L('c')] }, { id: 't2', type: 'texte', lignes: [L('x')] }, { id: 'h2', type: 'h2', html: 'Cible' }]);
  await evalue(choisir('t1', 0, 0, 1, 2));
  const cp = await copier();
  mesure();
  if (!cp.annulee) echec('copie : la copie du navigateur n\'est pas remplacée');
  if (cp.texte !== 'a #OK\n    bb') echec('copie : texte brut ' + JSON.stringify(cp.texte));
  if (!/^<p>a <span class="pill" data-ad="[^"]+">OK<\/span><\/p><p data-lv="2" style="margin-left:4em">bb<\/p>$/.test(cp.html)) echec('copie : HTML ' + cp.html);
  // recollée dans un autre bloc texte : mêmes lignes et mêmes niveaux
  await evalue(curseur('t2', 0, 1));
  await coller(cp.html, cp.texte);
  await verifie('copier-coller d\'un bloc texte à l\'autre', 't2', [L('xa <span class="pill">OK</span>'), L('bb', 2)]);
  // recollée dans un titre : lignes jointes par une espace
  await evalue(`(() => { const f = document.querySelector('.fld[data-b="h2"]'); f.focus(); const r = document.createRange(); r.selectNodeContents(f); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  await coller(cp.html, cp.texte);
  mesure();
  const titre = await evalue(`window.ardoise.doc.pages[0].blocks.find((b) => b.id === 'h2').html`);
  if (!/^Ciblea <span class="pill">OK<\/span> bb$/.test(titre)) echec('collage dans un titre : ' + JSON.stringify(titre));

  // sélection sur plusieurs blocs : le titre par son texte, le bloc texte par ses lignes
  await evalue(`(() => { ${POS} const t = document.querySelector('.fld[data-b="h"]').firstChild, b = pos('t1', 1, 2), r = document.createRange();
    r.setStart(t, 0); r.setEnd(b[0], b[1]); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  const mb = await copier();
  mesure();
  if (!mb.annulee || mb.texte !== 'Titre\na #OK\n    bb') echec('copie sur plusieurs blocs : texte brut ' + JSON.stringify(mb.texte));
  if (!/Titre/.test(mb.html) || !/<p data-lv="2" style="margin-left:4em">bb<\/p>$/.test(mb.html) || /<button|g-drag|blk-bar/.test(mb.html)) echec('copie sur plusieurs blocs : HTML ' + mb.html);

  // couper sur deux lignes : lignes cohérentes, passage dans le presse-papier
  await charge([{ id: 't1', type: 'texte', lignes: [L('ab'), L('cd', 1)] }]);
  await evalue(choisir('t1', 0, 1, 1, 1));
  const cut = await copier('cut'); await attendre(120);
  mesure();
  if (cut.texte !== 'b\n  c') echec('couper : texte brut ' + JSON.stringify(cut.texte));
  await verifie('couper sur deux lignes', 't1', [L('ad')]);

  // plage de tableur collée dans un bloc texte vide : un tableau à sa place ; dans un bloc texte non vide : après lui
  await charge([{ id: 't1', type: 'texte', lignes: [L('')] }, { id: 't2', type: 'texte', lignes: [L('garde')] }]);
  await evalue(curseur('t1', 0, 0));
  await coller(CALC, 'a\tb\nc\td');
  mesure();
  let types = JSON.parse(await evalue(`JSON.stringify(window.ardoise.doc.pages[0].blocks.map((b) => b.type))`));
  if (JSON.stringify(types) !== '["table","texte"]') echec('plage dans un bloc texte vide : ' + JSON.stringify(types));
  await evalue(curseur('t2', 0, 5));
  await coller(CALC, 'a\tb\nc\td');
  mesure();
  types = JSON.parse(await evalue(`JSON.stringify(window.ardoise.doc.pages[0].blocks.map((b) => b.id === 't2' ? 't2' : b.type))`));
  if (JSON.stringify(types) !== '["table","t2","table"]') echec('plage dans un bloc texte non vide : ' + JSON.stringify(types));

  // copie en mode lecture
  await charge([{ id: 't1', type: 'texte', lignes: [L('un'), L('deux', 1)] }]);
  await ctrl('e');
  for (let i = 0; i < 40 && (await evalue('!!document.querySelector(".texte.fld")')); i++) await attendre(50);
  await evalue(choisir('t1', 0, 0, 1, 4));
  const lu = await copier();
  mesure();
  if (lu.texte !== 'un\n  deux' || !/<p data-lv="1" style="margin-left:2em">deux<\/p>/.test(lu.html)) echec('copie en lecture : ' + JSON.stringify(lu));
  await ctrl('e');

  // vrai presse-papier (Ctrl+C, Ctrl+V au clavier) : le collage part de la ligne du curseur (cible de l'événement : la div.lg,
  // pas le champ). Vérification c32 du propriétaire : niveaux perdus et pastille grise, puis tout à gauche après Entrée.
  await cdp('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  const raccourci = async (k, commande) => {
    for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, modifiers: 2, key: k, code: 'Key' + k.toUpperCase(), windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0), commands: type === 'rawKeyDown' ? [commande] : [] });
    await attendre(200);
  };
  await charge([{ id: 't1', type: 'texte', lignes: [L('Serveurs <span class="pill">OK</span>'), L('Sauvegardes', 1), L('Restauration <b>testée</b>', 2)] }, { id: 't3', type: 'texte', lignes: [L('')] }]);
  await evalue(choisir('t1', 0, 0, 2, 19));
  await raccourci('c', 'copy');
  await evalue(curseur('t3', 0, 0));
  await raccourci('v', 'paste');
  const colle = [L('Serveurs <span class="pill">OK</span>'), L('Sauvegardes', 1), L('Restauration <b>testée</b>', 2)];
  await verifie('Ctrl+C puis Ctrl+V dans un bloc texte vide', 't3', colle);
  mesure();
  if (!(await evalue(`(() => { const p = document.querySelector('.texte[data-b="t3"] span.pill'); return !!p && getComputedStyle(p).backgroundColor === getComputedStyle(document.querySelector('.texte[data-b="t1"] span.pill')).backgroundColor; })()`))) echec('Ctrl+V : pastille sans la couleur du registre');
  await evalue(curseur('t3', 2, 19));
  for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await attendre(150);
  await verifie('Entrée après Ctrl+V', 't3', colle.concat([L('', 2)]));

  // ---- genres (ticket 07) ----
  // vraie liste de Writer collée dans un bloc vide : puces et numéros à leurs niveaux, la ligne vide prend le genre de la première
  await charge([{ id: 't1', type: 'texte', lignes: [L('')] }]);
  await evalue(curseur('t1', 0, 0));
  await coller(WRITER, 'ignoré');
  await verifie('liste de Writer collée', 't1', [G('Puce niv1', 'puce'), G('numéro niv2', 'numero', 1), G('numéro niv2', 'numero', 1), G('puce niv1', 'puce'),
    G('numéro niv1', 'numero'), G('puce niv2', 'puce', 1), G('puce niv3', 'puce', 2)]);
  mesure();
  const marques = await visibles('.texte[data-b="t1"] .lg', 'return getComputedStyle(x, "::before").content');
  if (marques.join(' ') !== '"•" "1." "2." "•" "1." "◦" "▪"') echec('liste de Writer : marques affichées ' + JSON.stringify(marques));
  await ctrl('z');
  await verifie('annuler le collage de la liste', 't1', [L('')]);

  // liste de cases (case à cocher HTML, ☑ en tête) ; texte brut « - a », « ☐ b » resté du texte
  await charge([{ id: 't1', type: 'texte', lignes: [L('')] }, { id: 't2', type: 'texte', lignes: [L('')] }]);
  await evalue(curseur('t1', 0, 0));
  await coller('<ul><li><input type="checkbox" checked> a</li><li><input type="checkbox"> b</li></ul><p>☑ c</p>', '');
  await verifie('liste de cases collée', 't1', [G('a', 'case', 0, true), G('b', 'case'), G('c', 'case', 0, true)]);
  await evalue(curseur('t2', 0, 0));
  await coller('', '- a\n☐ b');
  await verifie('texte brut resté du texte', 't2', [L('- a'), L('☐ b')]);

  // collage au milieu d'une puce : la première ligne collée garde la puce de la ligne du curseur, les suivantes leur genre
  await charge([{ id: 't1', type: 'texte', lignes: [G('ab', 'puce', 1)] }]);
  await evalue(curseur('t1', 0, 1));
  await coller('<ol><li>x</li><li>y</li></ol>', '');
  await verifie('collage au milieu d\'une puce', 't1', [G('ax', 'puce', 1), G('yb', 'numero')]);

  // copie d'un passage mêlé : texte brut et HTML ; numéros affichés ; recollé dans un autre bloc texte, puis dans un titre
  const MELE = [L('intro'), G('p0', 'puce'), G('p1', 'puce', 1), G('n1', 'numero'), G('n2', 'numero'), G('n3', 'numero'), G('à faire', 'case'), G('fait', 'case', 1, true), G('Sous', 'soustitre')];
  await charge([{ id: 't1', type: 'texte', lignes: MELE }, { id: 't2', type: 'texte', lignes: [L('')] }, { id: 'h2', type: 'h2', html: 'Cible' }]);
  await evalue(choisir('t1', 0, 0, 8, 4));
  const mc = await copier();
  mesure();
  if (mc.texte !== 'intro\n- p0\n  - p1\n1. n1\n2. n2\n3. n3\n☐ à faire\n  ☑ fait\nSous') echec('copie mêlée : texte brut ' + JSON.stringify(mc.texte));
  if (mc.html !== '<p>intro</p><ul><li>p0<ul><li>p1</li></ul></li></ul><ol><li>n1</li><li>n2</li><li>n3</li></ol><p data-g="case">☐ à faire</p><p data-g="case" data-done data-lv="1" style="margin-left:2em">☑ fait</p><h3 data-g="soustitre">Sous</h3>') echec('copie mêlée : HTML ' + mc.html);
  await evalue(curseur('t2', 0, 0));
  await coller(mc.html, mc.texte);
  await verifie('copier-coller mêlé d\'un bloc texte à l\'autre', 't2', MELE);
  await evalue(`(() => { const f = document.querySelector('.fld[data-b="h2"]'); f.focus(); const r = document.createRange(); r.selectNodeContents(f); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  await coller(mc.html, mc.texte);
  mesure();
  const t2 = await evalue(`window.ardoise.doc.pages[0].blocks.find((b) => b.id === 'h2').html`);
  if (t2 !== 'Cibleintro p0 p1 n1 n2 n3 à faire fait Sous') echec('copie mêlée collée dans un titre : ' + JSON.stringify(t2));
  // lignes 2 et 3 d'une liste numérotée : « 2. », « 3. », <ol start="2"> ; une seule ligne entière garde son genre, une partie non
  await evalue(choisir('t1', 4, 0, 5, 2));
  const nc = await copier();
  mesure();
  if (nc.texte !== '2. n2\n3. n3' || nc.html !== '<ol start="2"><li>n2</li><li>n3</li></ol>') echec('copie des numéros 2 et 3 : ' + JSON.stringify(nc));
  await evalue(choisir('t1', 7, 0, 7, 4));
  const un = await copier();
  await evalue(choisir('t1', 7, 1, 7, 3));
  const part = await copier();
  mesure();
  if (un.texte !== '  ☑ fait' || part.texte !== '  ai') echec('copie dans une seule ligne : ' + JSON.stringify([un.texte, part.texte]));

  // copie en lecture : mêmes genres
  await ctrl('e');
  for (let i = 0; i < 40 && (await evalue('!!document.querySelector(".texte.fld")')); i++) await attendre(50);
  await evalue(choisir('t1', 1, 0, 3, 2));
  const lg = await copier();
  mesure();
  if (lg.texte !== '- p0\n  - p1\n1. n1') echec('copie mêlée en lecture : ' + JSON.stringify(lg.texte));
  await ctrl('e');
}
