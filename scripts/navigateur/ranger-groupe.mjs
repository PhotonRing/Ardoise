// Sujet : ranger les blocs d'un groupe repliable. Glisser un bloc dans un groupe puis hors du groupe, un titre qui ne peut
// pas y entrer, Monter qui sort du groupe, Descendre qui saute le groupe entier, menu ⋯ (Mettre dans un groupe, Sortir du
// groupe, Dégrouper) ; chaque geste est une étape au libellé complet, qu'un Ctrl+Z défait.
// Origine : spec groupe-office-diamant, ticket 02.

const PAGE = [
  { id: 'hd', type: 'header', title: 'Accueil' },
  { id: 's1', type: 'h2', html: 'Section' },
  { id: 'a1', type: 'p', html: 'avant' },
  { id: 'g1', type: 'group', title: 'Détails', folded: false, blocks: [{ id: 'c1', type: 'p', html: 'premier' }, { id: 'c2', type: 'p', html: 'second' }] },
  { id: 'x1', type: 'p', html: 'après' },
];
const CHARGER_PAGE = (blocs) => `(() => { const d = JSON.parse(JSON.stringify(window.ardoise.doc)); d.pages = [{ id: 'p1', title: 'Accueil', blocks: ${JSON.stringify(blocs)} }]; return window.ardoise.load(d); })()`;
const CHARGER = CHARGER_PAGE(PAGE);
// page qui finit par un groupe ouvert, sans pied de page ; puis un groupe suivi d'un titre plié, dernier bloc visible
const FIN_GROUPE = [
  { id: 'hd', type: 'header', title: 'Accueil' },
  { id: 'a1', type: 'p', html: 'haut' },
  { id: 'g1', type: 'group', title: 'Détails', folded: false, blocks: [{ id: 'c1', type: 'p', html: 'premier' }, { id: 'c2', type: 'p', html: 'second' }] },
];
const FIN_PLIEE = [
  { id: 'hd', type: 'header', title: 'Accueil' },
  { id: 'g1', type: 'group', title: 'Détails', folded: false, blocks: [{ id: 'c1', type: 'p', html: 'premier' }, { id: 'c2', type: 'p', html: 'second' }] },
  { id: 's1', type: 'h2', html: 'Section', folded: true },
  { id: 'a1', type: 'p', html: 'masqué' },
  { id: 'x1', type: 'p', html: 'masqué aussi' },
];
const IDS = `window.ardoise.doc.pages[0].blocks.map((b) => b.id + (b.type === 'group' ? '[' + b.blocks.map((c) => c.id).join(',') + ']' : '')).join(' ')`;
const ANNULER = `document.querySelector('#ui [data-ui=undo]').title`;
const TOUCHE = (key, opts = {}) => `(() => { const t = document.activeElement || document.body; t.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }, ${JSON.stringify(opts)}))); return true; })()`;
// glisser le bloc id par sa poignée et le lâcher à la hauteur y (expression évaluée dans la page, en pixels de l'écran)
const GLISSER = (id, y) => `(() => {
  const blk = document.querySelector('.blk[data-id="${id}"]'), dt = new DataTransfer();
  blk.querySelector(':scope > .blk-gut .g-drag').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  blk.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  const app = document.querySelector('#app'), cy = ${y};
  app.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: cy, dataTransfer: dt }));
  const ligne = document.querySelector('.drop-line').getBoundingClientRect().top;
  app.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: cy, dataTransfer: dt }));
  blk.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  return ligne;
})()`;
const RECT = (sel) => `document.querySelector('${sel}').getBoundingClientRect()`;
const CLIC = (sel) => `(() => { const b = document.querySelector('${sel}'); if (!b) return false; b.click(); return true; })()`;
const MENU_BLOC = (id) => `(() => { document.querySelector('.blk[data-id="${id}"] > .collant [data-act="menu-bloc"]').click(); return [...document.querySelectorAll('.pop.menu-bloc .mi')].map((b) => b.textContent.slice(1)); })()`;
const CHOISIR = (label) => `(() => { const b = [...document.querySelectorAll('.pop.menu-bloc .mi')].find((x) => x.textContent.endsWith(${JSON.stringify(label)})); if (!b) return false; b.click(); return true; })()`;

export const nom = 'ranger les blocs d\'un groupe';
export default async function ({ ecran, charger, evalue, attendre, mesure, echec }) {
  await ecran(1000, false);
  await charger(); await evalue(CHARGER); await attendre(100);
  const DEPART = 'hd s1 a1 g1[c1,c2] x1';
  // un geste : la page attendue, le libellé d'Annuler, puis un Ctrl+Z qui rend la page de départ
  async function geste(nom, attendu, libelle) {
    await attendre(60); mesure();
    const ids = await evalue(IDS), ann = await evalue(ANNULER);
    if (ids !== attendu) echec(nom + ' : ' + ids);
    if (libelle && ann !== 'Annuler : Accueil · ' + libelle + ' (Ctrl+Z)') echec(nom + ', libellé : ' + ann);
    await evalue(TOUCHE('z', { ctrlKey: true })); await attendre(60);
    if (await evalue(IDS) !== DEPART) echec(nom + ' : un Ctrl+Z ne rend pas la page : ' + await evalue(IDS));
  }

  // glisser un paragraphe de la page entre les deux blocs du groupe : il y entre
  await evalue(GLISSER('x1', `${RECT('.blk[data-id="c2"]')}.top + 2`));
  await geste('glisser dans le groupe', 'hd s1 a1 g1[c1,x1,c2]', 'Groupe repliable « Détails » : bloc ajouté au groupe');

  // glisser un bloc du groupe sous le dernier bloc de la page : il sort du groupe
  await evalue(GLISSER('c1', `${RECT('.blk[data-id="x1"]')}.bottom - 2`));
  await geste('glisser hors du groupe', 'hd s1 a1 g1[c2] x1 c1', 'Groupe repliable « Détails » : bloc sorti du groupe');

  // un titre lâché au milieu du groupe : la ligne de dépôt n'est pas dans le groupe, le titre reste dans la page
  const corps = await evalue(`(() => { const r = ${RECT('.blk[data-id="g1"] .grp-body')}; return { top: r.top, bottom: r.bottom }; })()`);
  const ligne = await evalue(GLISSER('s1', `${RECT('.blk[data-id="c2"]')}.top + 2`));
  mesure();
  if (ligne > corps.top && ligne < corps.bottom) echec('titre glissé : la ligne de dépôt est dans le groupe');
  const apresTitre = await evalue(IDS);
  if (!/g1\[c1,c2\]/.test(apresTitre) || /\[[^\]]*s1/.test(apresTitre)) echec('titre glissé dans le groupe : ' + apresTitre);
  if (apresTitre !== DEPART) { await evalue(TOUCHE('z', { ctrlKey: true })); await attendre(60); }

  // Monter sur le premier bloc du groupe : il sort juste au-dessus ; Descendre sur le dernier : juste en dessous
  await evalue(CLIC('.blk[data-id="c1"] > .collant [data-act="up"]'));
  await geste('Monter qui sort du groupe', 'hd s1 a1 c1 g1[c2] x1', 'Groupe repliable « Détails » : bloc sorti du groupe');
  await evalue(CLIC('.blk[data-id="c2"] > .collant [data-act="down"]'));
  await geste('Descendre qui sort du groupe', 'hd s1 a1 g1[c1] c2 x1', 'Groupe repliable « Détails » : bloc sorti du groupe');
  // un bloc de la page saute le groupe entier
  await evalue(CLIC('.blk[data-id="a1"] > .collant [data-act="down"]'));
  await geste('Descendre par-dessus le groupe', 'hd s1 g1[c1,c2] a1 x1');

  // un titre plié emporte sa section, groupe compris
  await evalue(CLIC('.blk[data-id="s1"] > .fold-t')); await attendre(60);
  await evalue(CLIC('.blk[data-id="s1"] > .collant [data-act="up"]')); await attendre(60);
  mesure();
  if (await evalue(IDS) !== 's1 a1 g1[c1,c2] x1 hd') echec('titre plié monté : ' + await evalue(IDS));
  await evalue(TOUCHE('z', { ctrlKey: true })); await evalue(TOUCHE('z', { ctrlKey: true })); await attendre(60);
  if (await evalue(IDS) !== DEPART) echec('titre plié : deux Ctrl+Z ' + await evalue(IDS));

  // menu ⋯ : un bloc de la page se met dans un groupe (curseur dans son titre), un bloc du groupe en sort, le groupe se défait
  const menuPage = await evalue(MENU_BLOC('x1')); mesure();
  if (!menuPage.includes('Mettre dans un groupe') || menuPage.includes('Sortir du groupe') || menuPage.includes('Dégrouper')) echec('menu d\'un bloc de la page : ' + menuPage);
  await evalue(CHOISIR('Mettre dans un groupe')); await attendre(80);
  const neuf = await evalue(`(() => { const bl = window.ardoise.doc.pages[0].blocks, g = bl[bl.length - 1], a = document.activeElement; return { t: g.type, k: g.blocks.map((c) => c.id).join(), fb: a && a.dataset.b === g.id, fk: a && a.dataset.k }; })()`);
  if (neuf.t !== 'group' || neuf.k !== 'x1' || !neuf.fb || neuf.fk !== 'title') echec('Mettre dans un groupe : ' + JSON.stringify(neuf));
  await evalue(TOUCHE('z', { ctrlKey: true })); await attendre(60);
  if (await evalue(IDS) !== DEPART) echec('Mettre dans un groupe : Ctrl+Z ' + await evalue(IDS));

  const menuEnfant = await evalue(MENU_BLOC('c1')); mesure();
  if (!menuEnfant.includes('Sortir du groupe') || menuEnfant.includes('Mettre dans un groupe')) echec('menu d\'un bloc du groupe : ' + menuEnfant);
  await evalue(CHOISIR('Sortir du groupe'));
  await geste('Sortir du groupe', 'hd s1 a1 g1[c2] c1 x1', 'Groupe repliable « Détails » : bloc sorti du groupe');

  const menuGroupe = await evalue(MENU_BLOC('g1')); mesure();
  if (!menuGroupe.includes('Dégrouper') || menuGroupe.includes('Mettre dans un groupe')) echec('menu du groupe : ' + menuGroupe);
  await evalue(CHOISIR('Dégrouper'));
  await geste('Dégrouper', 'hd s1 a1 c1 c2 x1', 'Groupe repliable « Détails » : groupe défait');

  // sous « + Ajouter dans le groupe » d'un groupe ouvert placé en dernier : on dépose après le groupe
  const BAS = `document.querySelector('#app').getBoundingClientRect().bottom - 2`;
  await evalue(CHARGER_PAGE(FIN_GROUPE)); await attendre(100);
  await evalue(GLISSER('a1', BAS)); await attendre(60); mesure();
  if (await evalue(IDS) !== 'hd g1[c1,c2] a1') echec('glisser tout en bas, après un groupe final : ' + await evalue(IDS));
  await evalue(TOUCHE('z', { ctrlKey: true })); await attendre(60);
  await evalue(GLISSER('c2', BAS)); await attendre(60); mesure();
  if (await evalue(IDS) !== 'hd a1 g1[c1] c2') echec('glisser un bloc du groupe final tout en bas : ' + await evalue(IDS));

  // un bloc sorti du groupe et déposé après un titre plié arrive après sa section, comme un bloc de la page
  await evalue(CHARGER_PAGE(FIN_PLIEE)); await attendre(100);
  await evalue(GLISSER('c1', BAS)); await attendre(60); mesure();
  if (await evalue(IDS) !== 'hd g1[c2] s1 a1 x1 c1') echec('bloc du groupe déposé après un titre plié : ' + await evalue(IDS));
}
