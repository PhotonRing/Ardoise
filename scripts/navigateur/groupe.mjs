// Sujet : groupe repliable. Insertion par « + » (paragraphe vide dedans, curseur dans le titre), « + » et Entrée dans un
// bloc du groupe (le nouveau bloc reste dans le groupe, menu sans titres ni groupe), pli d'édition enregistré et annulable
// (compteur), suppression du groupe entier en un Ctrl+Z, pli de lecture libre sans écriture.
// Origine : spec groupe-office-diamant, ticket 01.

import { jusqua } from './outils/attente.mjs';

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
export default async function ({ ecran, charger, evalue, mesure, echec }) {
  await ecran(1000, false);
  await charger(); await evalue(CHARGER);

  // le groupe ouvert montre ses blocs, chacun avec sa barre
  const rendu = await jusqua(evalue, `!!document.querySelector('.blk[data-id="g1"] .blk[data-id="c1"]')`);
  mesure();
  if (!rendu) { echec('les blocs du groupe ne sont pas rendus dans le groupe'); return; }

  // « + » d'un bloc du groupe : menu sans titres, étape, en-tête, pied ni groupe ; le paragraphe arrive dans le groupe
  await evalue(`document.querySelector('.blk[data-id="c1"] > .collant [data-act="add-after"]').click(), true`); await jusqua(evalue, `!!document.querySelector('.pop .mi[data-t]')`);
  const menu = await evalue(MENU); mesure();
  for (const t of ['h2', 'h3', 'step', 'header', 'footer', 'group']) if (menu.includes(t)) echec('le menu d\'un bloc du groupe propose ' + t);
  if (!menu.includes('facts')) echec('le menu d\'un bloc du groupe ne propose pas la fiche de faits');
  await evalue(`document.querySelector('.pop .mi[data-t="facts"]').click(), true`); await jusqua(evalue, `${PAGE_IDS} === 'hd s1 g1[texte,facts,texte] x1'`);
  mesure();
  if (await evalue(PAGE_IDS) !== 'hd s1 g1[texte,facts,texte] x1') echec('« + » dans le groupe : ' + await evalue(PAGE_IDS));

  // Entrée dans le paragraphe vide du groupe : le nouveau paragraphe reste dans le groupe
  await evalue(`(() => { const f = document.querySelector('[data-b="c2"][data-k="lignes"]'); f.focus(); return true; })()`);
  await evalue(TOUCHE('Enter')); await jusqua(evalue, `${PAGE_IDS} === 'hd s1 g1[texte,facts,texte,texte] x1'`);
  mesure();
  if (await evalue(PAGE_IDS) !== 'hd s1 g1[texte,facts,texte,texte] x1') echec('Entrée dans le groupe : ' + await evalue(PAGE_IDS));
  await evalue(TOUCHE('z', { ctrlKey: true })); await evalue(TOUCHE('z', { ctrlKey: true })); await jusqua(evalue, `${PAGE_IDS} === 'hd s1 g1[texte,texte] x1'`);

  // pli d'édition : enregistré, compteur, blocs non rendus ; Ctrl+Z déplie
  await evalue(`document.querySelector('.blk[data-id="g1"] .grp-v').click(), true`); await jusqua(evalue, `${GROUPE}.folded === true && !document.querySelector('.blk[data-id="c1"]')`);
  const plie = await evalue(`({ f: ${GROUPE}.folded, enfants: !!document.querySelector('.blk[data-id="c1"]'), n: (document.querySelector('.blk[data-id="g1"] .grp-n') || {}).textContent, annuler: document.querySelector('#ui [data-ui=undo]').title })`);
  mesure();
  if (plie.f !== true || plie.enfants || plie.n !== '2 blocs') echec('groupe plié en édition : ' + JSON.stringify(plie));
  if (plie.annuler !== 'Annuler : Accueil · Groupe repliable « Détails » : groupe plié (Ctrl+Z)') echec('libellé du pli : ' + plie.annuler);
  await evalue(TOUCHE('z', { ctrlKey: true }));
  if (!(await jusqua(evalue, `${GROUPE}.folded === false && !!document.querySelector('.blk[data-id="c1"]')`))) echec('Ctrl+Z ne déplie pas le groupe');

  // lecture : <details> ouvert ; le plier ne touche pas au document
  await evalue(TOUCHE('e', { ctrlKey: true })); await jusqua(evalue, `!!document.querySelector('details.grp [data-bid="c1"]')`);
  const lu = await evalue(`(() => { const g = document.querySelector('details.grp'); return g ? { open: g.open, p: !!g.querySelector('[data-bid="c1"]') } : null; })()`);
  mesure();
  if (!lu || !lu.open || !lu.p) echec('lecture : groupe absent, fermé ou sans ses blocs : ' + JSON.stringify(lu));
  await evalue(`document.querySelector('details.grp > summary').click(), true`); await jusqua(evalue, `!document.querySelector('details.grp').open`);
  const ferme = await evalue(`({ open: document.querySelector('details.grp').open, f: ${GROUPE}.folded })`);
  mesure();
  if (ferme.open || ferme.f !== false) echec('lecture : pli du lecteur ' + JSON.stringify(ferme));
  // adresse d'un bloc du groupe plié : le groupe s'ouvre (lecture), puis se déplie (édition)
  await evalue(`location.hash = '#pg-p1/c1', true`);
  const ouvert = await jusqua(evalue, `document.querySelector('details.grp').open`);
  mesure();
  if (!ouvert) echec('lecture : l\'adresse d\'un bloc d\'un groupe plié n\'ouvre pas le groupe');
  // pas d'état visible à attendre : on attend que l'application ait traité le changement d'adresse (écouteur posé après le sien)
  await evalue(`(() => { window.__adresse = false; addEventListener('hashchange', () => { window.__adresse = true; }, { once: true }); location.hash = '#pg-p1'; return true; })()`);
  await jusqua(evalue, 'window.__adresse');
  await evalue(TOUCHE('e', { ctrlKey: true })); await jusqua(evalue, `!!document.querySelector('.blk[data-id="g1"] .grp-v')`);
  await evalue(`document.querySelector('.blk[data-id="g1"] .grp-v').click(), true`); await jusqua(evalue, `${GROUPE}.folded === true`);
  await evalue(`location.hash = '#pg-p1/c1', true`);
  const deplie = await jusqua(evalue, `${GROUPE}.folded === false && !!document.querySelector('.blk[data-id="c1"]')`);
  mesure();
  if (!deplie) echec('édition : l\'adresse d\'un bloc d\'un groupe plié ne le déplie pas');
  // l'état d'arrivée est celui de départ (déplié) : on attend que Rétablir propose le pli, donc les deux Ctrl+Z faits
  await evalue(TOUCHE('z', { ctrlKey: true })); await evalue(TOUCHE('z', { ctrlKey: true })); await jusqua(evalue, `/groupe plié/.test(document.querySelector('#ui [data-ui=redo]').title)`);
  if (await evalue(`${GROUPE}.folded`) !== false) echec('deux Ctrl+Z ne ramènent pas le groupe ouvert');

  // insertion d'un groupe en fin de page : un bloc texte vide dedans, le curseur dans le titre
  await evalue(`document.querySelector('[data-act="add-end"]').click(), true`); await jusqua(evalue, `!!document.querySelector('.pop .mi[data-t="group"]')`);
  await evalue(`document.querySelector('.pop .mi[data-t="group"]').click(), true`);
  await jusqua(evalue, `(() => { const bl = window.ardoise.doc.pages[0].blocks, g = bl[bl.length - 1], a = document.activeElement; return g.type === 'group' && a && a.dataset.b === g.id && a.dataset.k === 'title'; })()`);
  const neuf = await evalue(`(() => { const bl = window.ardoise.doc.pages[0].blocks, g = bl[bl.length - 1], a = document.activeElement; return { t: g.type, k: g.blocks.map((c) => c.type + ':' + JSON.stringify(c.lignes)).join(), fb: a && a.dataset.b === g.id, fk: a && a.dataset.k }; })()`);
  mesure();
  if (neuf.t !== 'group' || neuf.k !== 'texte:[{"html":""}]' || !neuf.fb || neuf.fk !== 'title') echec('groupe neuf : ' + JSON.stringify(neuf));

  // supprimer le premier groupe : tout son contenu part ; un seul Ctrl+Z le rend entier
  await evalue(`document.querySelector('.blk[data-id="g1"] > .collant .del').click(), true`);
  const supprime = await jusqua(evalue, `!/g1/.test(${PAGE_IDS})`);
  mesure();
  if (!supprime) echec('le groupe n\'est pas supprimé');
  await evalue(TOUCHE('z', { ctrlKey: true })); await jusqua(evalue, `${PAGE_IDS}.startsWith('hd s1 g1[texte,texte] x1')`);
  if (!(await evalue(PAGE_IDS)).startsWith('hd s1 g1[texte,texte] x1')) echec('un Ctrl+Z ne rend pas le groupe entier : ' + await evalue(PAGE_IDS));
}
