// Sujet : format 8, les paragraphes deviennent des blocs texte. Un ancien document (format 7) s'ouvre avec ses lignes et
// niveaux, identifiants gardés ; un lien vers un ancien paragraphe mène encore au bloc ; page neuve, document neuf, groupe
// neuf et Entrée dans un titre donnent un bloc texte ; Paragraphe n'est plus proposé ; un taquet collé est défait.
// Origine : spec bloc-texte, ticket 04.

const TAB = '<span class="tab">\t</span>';
const ANCIEN = { v: 7, id: 'doc-format-7', title: 'Ancien', pages: [
  { id: 'p1', title: 'Accueil', blocks: [
    { id: 'hd', type: 'header', title: 'Accueil' },
    { id: 'x1', type: 'p', indent: 1, html: 'Première<br>' + TAB + 'en retrait<br><b>gras<br>suite</b>' },
    { id: 'l1', type: 'p', html: 'Voir <a href="#pg-p2/x9">le paragraphe visé</a>.' },
    { id: 's1', type: 'h2', html: 'Section' }, { id: 's2', type: 'h3', html: 'Sous-section' }, { id: 'st', type: 'subtitle', html: 'Sous-titre' },
    { id: 'e1', type: 'step', title: 'Étape' },
    { id: 'g1', type: 'group', title: 'Groupe', blocks: [{ id: 'gp', type: 'p', html: 'dans le groupe' }] },
  ] },
  { id: 'p2', title: 'Suite', blocks: [{ id: 'hd2', type: 'header', title: 'Suite' }].concat(
    Array.from({ length: 30 }, (_, k) => ({ id: 'r' + k, type: 'p', html: 'Remplissage ' + k + ', assez long pour occuper la largeur de la colonne de texte.' })),
    [{ id: 'x9', type: 'p', html: 'Le paragraphe visé' }]) },
] };
const BLOC = (id) => `(() => { const t = (bs) => { for (const b of bs) { if (b.id === ${JSON.stringify(id)}) return b; const c = t(b.blocks || []); if (c) return c; } }; for (const p of window.ardoise.doc.pages) { const b = t(p.blocks); if (b) return b; } return null; })()`;
const TOUCHE = (key) => `(() => { const t = document.activeElement || document.body; t.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true })); return true; })()`;
const SUIVANT = (id) => `(() => { const bl = window.ardoise.doc.pages[0].blocks, i = bl.findIndex((b) => b.id === ${JSON.stringify(id)}); return bl[i + 1] ? bl[i + 1].type : null; })()`;

export const nom = 'format 8 : paragraphes en blocs texte';
export default async function ({ ecran, charger, evalue, attendre, visibles, mesure, echec }) {
  await ecran(1000, false);
  await charger();
  if (!(await evalue(`window.ardoise.load(${JSON.stringify(ANCIEN)})`))) { echec('l\'ancien document ne s\'ouvre pas'); return; }
  await attendre(100);

  // lignes et niveaux, identifiant gardé, rien de perdu ; le paragraphe d'un groupe aussi
  const x1 = await evalue(BLOC('x1')); mesure();
  const attendu = { id: 'x1', type: 'texte', lignes: [{ html: 'Première', lv: 1 }, { html: 'en retrait', lv: 2 }, { html: '<b>gras</b>', lv: 1 }, { html: '<b>suite</b>', lv: 1 }] };
  if (JSON.stringify({ id: x1.id, type: x1.type, lignes: x1.lignes }) !== JSON.stringify(attendu) || 'html' in x1 || 'indent' in x1) echec('ancien paragraphe : ' + JSON.stringify(x1));
  const gp = await evalue(BLOC('gp')); mesure();
  if (!gp || gp.type !== 'texte' || gp.lignes[0].html !== 'dans le groupe') echec('paragraphe du groupe : ' + JSON.stringify(gp));
  const vus = await visibles('.blk[data-id="x1"] .lg'); mesure();
  if (JSON.stringify(vus) !== JSON.stringify(['Première', 'en retrait', 'gras', 'suite'])) echec('lignes affichées : ' + JSON.stringify(vus));
  if (await evalue('window.ardoise.doc.v') !== 9) echec('format après ouverture : ' + await evalue('window.ardoise.doc.v'));

  // un lien vers un ancien paragraphe d'une autre page mène encore au bloc, à l'écran
  await evalue(`document.querySelector('#app a[href="#pg-p2/x9"]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }))`);
  await attendre(400);
  const cible = await evalue(`(() => { const e = document.querySelector('.blk[data-id="x9"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { haut: r.top, bas: r.bottom, h: innerHeight, t: e.textContent.trim() }; })()`);
  mesure();
  if (!cible || cible.bas < 0 || cible.haut > cible.h || !/Le paragraphe visé/.test(cible.t)) echec('lien vers un ancien paragraphe : ' + JSON.stringify(cible));

  // retour à la première page ; Entrée dans un titre de section, une sous-section, un sous-titre, une étape : un bloc texte après
  await evalue(`window.ardoise.load(${JSON.stringify(ANCIEN)})`); await attendre(100);
  await evalue(`document.querySelector('[data-pg="0"]').click(), true`); await attendre(150);
  for (const [id, k] of [['s1', 'html'], ['s2', 'html'], ['st', 'html'], ['e1', 'title']]) {
    await evalue(`(() => { const f = document.querySelector('[data-b="${id}"][data-k="${k}"]'); f.focus(); const r = document.createRange(); r.selectNodeContents(f); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
    await evalue(TOUCHE('Enter')); await attendre(60);
    const t = await evalue(SUIVANT(id)); mesure();
    if (t !== 'texte') echec(`Entrée dans ${id} : bloc suivant ${t}`);
    const ok = await evalue(`(() => { const a = document.activeElement; return !!a && a.hasAttribute('data-texte'); })()`); mesure();
    if (!ok) echec(`Entrée dans ${id} : le curseur n'est pas dans le nouveau bloc texte`);
  }

  // menu d'insertion : Texte proposé, Paragraphe absent (affiché à l'écran)
  await evalue(`document.querySelector('.blk[data-id="x1"] > .collant [data-act="add-after"]').click(), true`); await attendre(60);
  const menu = await visibles('.pop .mi[data-t]', 'return x.dataset.t'); mesure();
  if (!menu.includes('texte') || menu.includes('p')) echec('menu d\'insertion : ' + JSON.stringify(menu));
  const libelles = await visibles('.pop .mi[data-t]'); mesure();
  if (libelles.some((l) => /Paragraphe/.test(l))) echec('menu d\'insertion : Paragraphe affiché');
  // groupe neuf : un bloc texte vide dedans
  await evalue(`document.querySelector('.pop .mi[data-t="group"]').click(), true`); await attendre(80);
  const grp = await evalue(`(() => { const bl = window.ardoise.doc.pages[0].blocks, g = bl[bl.findIndex((b) => b.id === 'x1') + 1]; return g && { t: g.type, b: g.blocks.map((c) => c.type + ':' + JSON.stringify(c.lignes)) }; })()`);
  mesure();
  if (!grp || grp.t !== 'group' || JSON.stringify(grp.b) !== JSON.stringify(['texte:[{"html":""}]'])) echec('groupe neuf : ' + JSON.stringify(grp));

  // un taquet collé (copie d'une ancienne version) est défait par l'assainissement
  await evalue(`(() => { const f = document.querySelector('.fld[data-b="gp"]'); f.focus(); const r = document.createRange(); r.selectNodeContents(f.querySelector('.lg')); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); const dt = new DataTransfer(); dt.setData('text/html', 'a${TAB}b'); dt.setData('text/plain', 'a b');   // une tabulation en texte brut ferait une plage de tableur
    f.querySelector('.lg').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return true; })()`);
  await attendre(400);
  const colle = await evalue(BLOC('gp')); mesure();
  if (/class="tab"|<span/.test(JSON.stringify(colle.lignes)) || !/dans le groupea\s*b/.test(colle.lignes[0].html)) echec('taquet collé : ' + JSON.stringify(colle.lignes));

  // page neuve : en-tête et bloc texte vide
  await evalue(`document.querySelector('[data-pgadd]').click(), true`); await attendre(150);
  const page = await evalue(`window.ardoise.doc.pages[window.ardoise.doc.cur].blocks.map((b) => b.type + (b.lignes ? ':' + JSON.stringify(b.lignes) : '')).join(' ')`); mesure();
  if (page !== 'header texte:[{"html":""}]') echec('page neuve : ' + page);

  // document neuf (Fichier → Page vierge) : en-tête et bloc texte vide
  await evalue(`document.querySelector('[data-ui="file"]').click(), true`); await attendre(60);
  await evalue(`document.querySelector('.pop [data-f="new-vide"]').click(), true`); await attendre(200);
  const neuf = await evalue(`window.ardoise.doc.pages[0].blocks.map((b) => b.type + (b.lignes ? ':' + JSON.stringify(b.lignes) : '')).join(' ')`); mesure();
  if (neuf !== 'header texte:[{"html":""}]') echec('document neuf : ' + neuf);
}
