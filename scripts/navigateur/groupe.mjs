// Sujet : groupe repliable. Insertion par « + » (paragraphe vide dedans, curseur dans le titre), « + » et Entrée dans un
// bloc du groupe (le nouveau bloc reste dans le groupe, menu sans titres ni groupe), pli d'édition enregistré et annulable
// (compteur), suppression du groupe entier en un Ctrl+Z, pli de lecture libre sans écriture.
// Origine : spec groupe-office-diamant, ticket 01.

const PAGE = [
  { id: 'hd', type: 'header', title: 'Accueil' },
  { id: 's1', type: 'h2', html: 'Section' },
  { id: 'g1', type: 'group', title: 'Détails', folded: false, blocks: [{ id: 'c1', type: 'p', html: 'premier' }, { id: 'c2', type: 'p', html: '' }] },
  { id: 'x1', type: 'p', html: 'après' },
];
const CHARGER = `(() => { const d = JSON.parse(JSON.stringify(window.ardoise.doc)); d.pages = [{ id: 'p1', title: 'Accueil', blocks: ${JSON.stringify(PAGE)} }]; return window.ardoise.load(d); })()`;
const PAGE_IDS = `window.ardoise.doc.pages[0].blocks.map((b) => b.id + (b.blocks ? '[' + b.blocks.map((c) => c.type).join(',') + ']' : '')).join(' ')`;
const GROUPE = `window.ardoise.doc.pages[0].blocks.find((b) => b.id === 'g1')`;
const TOUCHE = (key, opts = {}) => `(() => { const t = document.activeElement || document.body; t.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }, ${JSON.stringify(opts)}))); return true; })()`;
const MENU = `[...document.querySelectorAll('.pop .mi[data-t]')].map((b) => b.dataset.t)`;

export const nom = 'groupe repliable';
export default async function ({ ecran, charger, evalue, attendre, mesure, echec }) {
  await ecran(1000, false);
  await charger(); await evalue(CHARGER); await attendre(100);

  // le groupe ouvert montre ses blocs, chacun avec sa barre
  mesure();
  if (!(await evalue(`!!document.querySelector('.blk[data-id="g1"] .blk[data-id="c1"]')`))) { echec('les blocs du groupe ne sont pas rendus dans le groupe'); return; }

  // « + » d'un bloc du groupe : menu sans titres, étape, en-tête, pied ni groupe ; le paragraphe arrive dans le groupe
  await evalue(`document.querySelector('.blk[data-id="c1"] > .collant [data-act="add-after"]').click(), true`); await attendre(50);
  const menu = await evalue(MENU); mesure();
  for (const t of ['h2', 'h3', 'step', 'header', 'footer', 'group']) if (menu.includes(t)) echec('le menu d\'un bloc du groupe propose ' + t);
  if (!menu.includes('facts')) echec('le menu d\'un bloc du groupe ne propose pas la fiche de faits');
  await evalue(`document.querySelector('.pop .mi[data-t="facts"]').click(), true`); await attendre(50);
  mesure();
  if (await evalue(PAGE_IDS) !== 'hd s1 g1[p,facts,p] x1') echec('« + » dans le groupe : ' + await evalue(PAGE_IDS));

  // Entrée dans le paragraphe vide du groupe : le nouveau paragraphe reste dans le groupe
  await evalue(`(() => { const f = document.querySelector('[data-b="c2"][data-k="html"]'); f.focus(); return true; })()`);
  await evalue(TOUCHE('Enter')); await attendre(50);
  mesure();
  if (await evalue(PAGE_IDS) !== 'hd s1 g1[p,facts,p,p] x1') echec('Entrée dans le groupe : ' + await evalue(PAGE_IDS));
  await evalue(TOUCHE('z', { ctrlKey: true })); await evalue(TOUCHE('z', { ctrlKey: true })); await attendre(50);

  // pli d'édition : enregistré, compteur, blocs non rendus ; Ctrl+Z déplie
  await evalue(`document.querySelector('.blk[data-id="g1"] .grp-v').click(), true`); await attendre(50);
  const plie = await evalue(`({ f: ${GROUPE}.folded, enfants: !!document.querySelector('.blk[data-id="c1"]'), n: (document.querySelector('.blk[data-id="g1"] .grp-n') || {}).textContent, annuler: document.querySelector('#ui [data-ui=undo]').title })`);
  mesure();
  if (plie.f !== true || plie.enfants || plie.n !== '2 blocs') echec('groupe plié en édition : ' + JSON.stringify(plie));
  if (plie.annuler !== 'Annuler : Accueil · Groupe repliable « Détails premier » : groupe plié (Ctrl+Z)') echec('libellé du pli : ' + plie.annuler);
  await evalue(TOUCHE('z', { ctrlKey: true })); await attendre(50);
  if (await evalue(`${GROUPE}.folded`) !== false || !(await evalue(`!!document.querySelector('.blk[data-id="c1"]')`))) echec('Ctrl+Z ne déplie pas le groupe');

  // lecture : <details> ouvert ; le plier ne touche pas au document
  await evalue(TOUCHE('e', { ctrlKey: true })); await attendre(150);
  const lu = await evalue(`(() => { const g = document.querySelector('details.grp'); return g ? { open: g.open, p: !!g.querySelector('[data-bid="c1"]') } : null; })()`);
  mesure();
  if (!lu || !lu.open || !lu.p) echec('lecture : groupe absent, fermé ou sans ses blocs : ' + JSON.stringify(lu));
  await evalue(`document.querySelector('details.grp > summary').click(), true`); await attendre(50);
  const ferme = await evalue(`({ open: document.querySelector('details.grp').open, f: ${GROUPE}.folded })`);
  mesure();
  if (ferme.open || ferme.f !== false) echec('lecture : pli du lecteur ' + JSON.stringify(ferme));
  // adresse d'un bloc du groupe plié : le groupe s'ouvre (lecture), puis se déplie (édition)
  await evalue(`location.hash = '#pg-p1/c1', true`); await attendre(200);
  mesure();
  if (!(await evalue(`document.querySelector('details.grp').open`))) echec('lecture : l\'adresse d\'un bloc d\'un groupe plié n\'ouvre pas le groupe');
  await evalue(`location.hash = '#pg-p1', true`); await attendre(100);
  await evalue(TOUCHE('e', { ctrlKey: true })); await attendre(150);
  await evalue(`document.querySelector('.blk[data-id="g1"] .grp-v').click(), true`); await attendre(50);
  await evalue(`location.hash = '#pg-p1/c1', true`); await attendre(200);
  mesure();
  if (await evalue(`${GROUPE}.folded`) !== false || !(await evalue(`!!document.querySelector('.blk[data-id="c1"]')`))) echec('édition : l\'adresse d\'un bloc d\'un groupe plié ne le déplie pas');
  await evalue(TOUCHE('z', { ctrlKey: true })); await evalue(TOUCHE('z', { ctrlKey: true })); await attendre(50);
  if (await evalue(`${GROUPE}.folded`) !== false) echec('deux Ctrl+Z ne ramènent pas le groupe ouvert');

  // insertion d'un groupe en fin de page : un paragraphe vide dedans, le curseur dans le titre
  await evalue(`document.querySelector('[data-act="add-end"]').click(), true`); await attendre(50);
  await evalue(`document.querySelector('.pop .mi[data-t="group"]').click(), true`); await attendre(80);
  const neuf = await evalue(`(() => { const bl = window.ardoise.doc.pages[0].blocks, g = bl[bl.length - 1], a = document.activeElement; return { t: g.type, k: g.blocks.map((c) => c.type + ':' + c.html).join(), fb: a && a.dataset.b === g.id, fk: a && a.dataset.k }; })()`);
  mesure();
  if (neuf.t !== 'group' || neuf.k !== 'p:' || !neuf.fb || neuf.fk !== 'title') echec('groupe neuf : ' + JSON.stringify(neuf));

  // supprimer le premier groupe : tout son contenu part ; un seul Ctrl+Z le rend entier
  await evalue(`document.querySelector('.blk[data-id="g1"] > .collant .del').click(), true`); await attendre(50);
  mesure();
  if (/g1/.test(await evalue(PAGE_IDS))) echec('le groupe n\'est pas supprimé');
  await evalue(TOUCHE('z', { ctrlKey: true })); await attendre(50);
  if (!(await evalue(PAGE_IDS)).startsWith('hd s1 g1[p,p] x1')) echec('un Ctrl+Z ne rend pas le groupe entier : ' + await evalue(PAGE_IDS));
}
