// Sujet : vue « Regroupée » d'une requête (spec requetes-avancees, ticket 04).
// Vue proposée pour les lignes de tableaux seulement ; colonnes Y cochées dans la fenêtre de la puce « vue » (une étape « vue modifiée », un Ctrl+Z) ;
// changer de source retombe sur « Tableau » ; à 360 px les fiches s'empilent et le tableau défile dans le bloc, jamais la page.

const LIGNES = [['Adversaire', 'Technique', 'Outil', 'Victime', 'Pays', 'Commentaire long'],
  ['APT28', 'T1059', 'Mimikatz', 'Mairie', 'France', 'une note assez longue pour élargir le tableau'],
  ['Lazarus', 'T1071', 'Cobalt Strike', 'Banque', 'Corée', 'autre note assez longue pour élargir'],
  ['apt28', 'T1071', 'mimikatz', 'Hôpital', 'France', 'encore une note qui prend de la place']];
const DOC = { title: 'Regroupée', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 't1', type: 'table', rows: LIGNES },
  { id: 'q1', type: 'query', title: 'Synthèse', src: 'table', scope: 'doc', view: 'regroupee', regX: 'adversaire', regY: ['technique'] },
] }] };
const MODE = `document.documentElement.classList.contains('is-edit')`;
const basculer = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
const ETAT = `(() => {
  const q = document.querySelector('[data-qid="q1"]'), b = window.ardoise.doc.pages[0].blocks[1];
  return { titres: [...q.querySelectorAll('.q-reg-t')].map((t) => t.textContent.trim()),
    faits: [...q.querySelectorAll('.q-reg .fact')].map((f) => f.textContent.trim()),
    vues: [...document.querySelectorAll('.q-fen [data-qset=view]')].map((o) => o.dataset.v),
    focus: (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.qregy) || null,
    view: b.view, regY: b.regY, annuler: (document.querySelector('#ui [data-ui=undo]') || {}).title || '' };
})()`;
const ouvrir = (cle) => `document.querySelector('.blk[data-id="q1"] [data-qpuce="${cle}"]').click()`;
const choisir = (prop, v) => `(() => { const s = document.querySelector('.q-fen[data-id="q1"] select[data-prop=${prop}]'); s.value = ${JSON.stringify(v)}; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`;

export const nom = 'vue regroupée';
export default async function ({ ecran, charger, evalue, attendre, mesure, echec }) {
  const etat = () => evalue(ETAT);
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };

  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(50);
  if (await evalue(MODE)) { await evalue(basculer); await attendre(50); }
  let e = await etat();
  attendu('lecture : une fiche par adversaire', e.titres.join('|') === 'APT282|Lazarus1' && e.faits[0] === 'TechniqueT1059, T1071', e);
  attendu('lecture : aucun réglage', !(await evalue(`!!document.querySelector('[data-qregy]')`)), 'réglage visible');

  await evalue(basculer); await attendre(80);
  await evalue(ouvrir('view')); await attendre(80);
  e = await etat();
  attendu('édition : vue « regroupé » proposée pour les lignes de tableaux', e.vues.includes('regroupee'), e.vues);

  // cocher Outil : le résultat suit, une étape « vue modifiée », la case garde le focus
  await evalue(`[...document.querySelectorAll('.q-fen[data-id="q1"] input[data-qregy]')].find((c) => c.dataset.qregy === 'outil').click()`); await attendre(80);
  e = await etat();
  attendu('Outil coché : fait ajouté', e.faits[1] === 'OutilMimikatz' && JSON.stringify(e.regY) === '["technique","outil"]', e);
  attendu('Outil coché : libellé d\'Annuler', /Requête « Synthèse » : vue modifiée/.test(e.annuler), e.annuler);
  attendu('Outil coché : focus gardé', e.focus === 'outil', e.focus);
  await evalue(`document.querySelector('#ui [data-ui=undo]').click()`); await attendre(80);
  e = await etat(); attendu('Ctrl+Z : Outil retiré', JSON.stringify(e.regY) === '["technique"]' && e.faits.length === 2, e);

  // téléphone : fiches empilées, puis le tableau défile dans le bloc, jamais la page
  await ecran(360, true); await evalue(basculer); await attendre(120);
  const deborde = () => evalue(`document.documentElement.scrollWidth - innerWidth`);
  let d = await deborde();
  attendu('360 px, fiches : pas de défilement de page', d <= 0 && await evalue(`(() => { const f = document.querySelectorAll('.q-reg-f'); return f.length === 2 && f[1].getBoundingClientRect().top >= f[0].getBoundingClientRect().bottom; })()`), d);
  await evalue(basculer); await attendre(80); await evalue(ouvrir('view')); await attendre(80);
  await evalue(`[...document.querySelectorAll('.q-fen[data-id="q1"] input[data-qregy]')].forEach((c) => { if (!c.checked) c.click(); })`); await attendre(80);
  await evalue(choisir('regForme', 'tableau')); await attendre(80);
  await evalue(basculer); await attendre(120);
  d = await deborde();
  const tw = await evalue(`(() => { const w = document.querySelector('[data-qid="q1"] .tablewrap'); return w ? w.scrollWidth - w.clientWidth : -1; })()`);
  attendu('360 px, tableau : défile dans le bloc, pas la page', d <= 0 && tw > 0, { d, tw });
  await ecran(1000, false); await evalue(basculer); await attendre(80);

  // autre source : la vue retombe sur « Tableau » et « regroupé » n'est plus proposé
  await evalue(ouvrir('src')); await attendre(80);
  await evalue(`document.querySelector('.q-fen [data-qset="src"][data-v="facts"]').click()`); await attendre(80);
  await evalue(ouvrir('view')); await attendre(80);
  e = await etat();
  attendu('fiches de faits : vue Tableau', e.view === 'table' && !e.vues.includes('regroupee'), e);
  await ecran(1000, false);
}
