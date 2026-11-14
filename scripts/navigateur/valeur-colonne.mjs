// Sujet : filtre « Valeur d'une colonne » (spec filtres-logiques, ticket 03). « + Filtre » le propose sur des lignes de tableaux ;
// sa fenêtre montre la liste des colonnes en tête, puis le mode, la recherche et les valeurs ; cocher pose le filtre, changer de
// colonne efface ses valeurs (puce retirée, fenêtre en attente sous « + Filtre », même mode) ; un Ctrl+Z défait la fenêtre ; 360 px.

const P = (...t) => t.map((x) => `<span class="pill">${x}</span>`).join(' ');
const TABLE = { id: 't1', type: 'table', rows: [['Réf', 'Statut', 'Groupe'], ['1', 'Ouvert', P('APT28', 'APT29')], ['2', 'clos', P('APT28')], ['3', '', 'aucun'], ['4', 'Clos ', ''], ['5', 'En cours', '']] };
const DOC = { title: 'Valeurs', pages: [{ id: 'p1', title: 'Accueil', blocks: [TABLE, { id: 'q1', type: 'query', title: 'Incidents', src: 'table', scope: 'doc', view: 'table' }] }] };
const MODE = `document.documentElement.classList.contains('is-edit')`;
const basculer = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
const ETAT = `(() => {
  const f = document.querySelector('.q-fen'), b = window.ardoise.doc.pages[0].blocks.find((x) => x.id === 'q1'), s = f && f.querySelector('select[data-qcolonne]');
  return { puces: [...document.querySelectorAll('.blk[data-id=q1] .q-puce')].map((x) => x.textContent.trim()),
    fen: f ? f.querySelector('h4').textContent : null, ouverte: (document.querySelector('.q-puce[aria-expanded="true"]') || {}).textContent || null,
    colonne: s ? s.options[s.selectedIndex].text : null, focus: document.activeElement === s,
    lignes: [...document.querySelectorAll('.blk[data-id=q1] .q-res tbody tr')].map((tr) => tr.cells[0].textContent.trim()),
    bloc: JSON.parse(JSON.stringify(b)) };
})()`;
const puce = (cle) => `document.querySelector('.blk[data-id="q1"] [data-qpuce="${cle}"]')`;
const caseV = (v) => `document.querySelector('.q-fen input[data-qval][data-v=${JSON.stringify(v)}]')`;
const mode = (m) => `document.querySelector('.q-fen [data-qmode="${m}"]')`;

export const nom = 'filtre valeur d\'une colonne';
export default async function ({ ecran, charger, evalue, cdp, attendre, visibles, ordreEcran, mesure, echec }) {
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  const touche = async (key, code, mods = 0) => { for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: { Escape: 27 }[key], modifiers: mods }); await attendre(60); };
  const cliquer = async (expr) => {
    const p = await evalue(`(() => { const el = ${expr}; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
    await attendre(90);
  };
  // choix dans la liste des colonnes, comme au clavier : focus, nouvelle valeur, change
  const choisirColonne = async (cle) => { await evalue(`(() => { const s = document.querySelector('.q-fen select[data-qcolonne]'); s.focus(); s.value = ${JSON.stringify(cle)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await attendre(90); };
  const chercher = async (t) => { await evalue(`(() => { const q = document.querySelector('.q-fen .q-fen-q'); q.focus(); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); })()`); if (t) await cdp('Input.insertText', { text: t }); await attendre(80); };
  const etat = () => evalue(ETAT);

  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(50);
  if (!(await evalue(MODE))) { await evalue(basculer); await attendre(80); }

  // + Filtre → Valeur d'une colonne : en attente sur la première colonne, liste des colonnes en tête
  await cliquer(puce('plus'));
  await cliquer(`document.querySelector('.q-fen [data-qfiltre="valeur"]')`);
  let e = await etat();
  attendu('fenêtre en attente sous « + Filtre », première colonne', e.fen === 'Valeur d’une colonne' && e.ouverte === '+ Filtre' && e.colonne === 'Réf' && !e.bloc.filtres, e);
  await choisirColonne('statut');
  e = await etat();
  const ordre = await ordreEcran('.q-fen select[data-qcolonne], .q-fen [data-qmode], .q-fen .q-fen-q, .q-fen .q-case', 'return x.matches("select") ? "[colonne]" : x.matches("input") ? "[recherche]" : x.textContent.trim()');
  attendu('colonne en tête, puis mode (sans « toutes »), recherche, valeurs avec « (vide) » en premier', ordre.join('|') === '[colonne]|l\'une de|aucune de|[recherche]|(vide)|Ouvert|clos|En cours' && e.colonne === 'Statut' && e.focus, { ordre, e });

  // chercher et cocher : le filtre se pose, le résultat suit aussitôt
  await chercher('ouv');
  attendu('recherche : seule « Ouvert » reste', (await visibles('.q-fen .q-case')).join() === 'Ouvert', await visibles('.q-fen .q-case'));
  await cliquer(caseV('ouvert'));
  await chercher('');
  await cliquer(caseV('en cours'));
  e = await etat();
  attendu('deux valeurs : « Statut : Ouvert ou En cours », lignes 1 et 5, fenêtre sous la puce', e.puces[2] === 'Statut : Ouvert ou En cours' && e.lignes.join() === '1,5' && e.ouverte === 'Statut : Ouvert ou En cours', e);
  await cliquer(mode('aucun'));
  e = await etat();
  attendu('aucune de : « Statut : sauf Ouvert, En cours »', e.puces[2] === 'Statut : sauf Ouvert, En cours' && e.lignes.join() === '2,3,4', e);

  // changer de colonne : valeurs effacées, puce retirée, fenêtre en attente sous « + Filtre » sur la nouvelle colonne, même mode
  await choisirColonne('groupe');
  e = await etat();
  attendu('nouvelle colonne : puce retirée, résultat complet, en attente, « aucune de » gardé, « toutes » proposé',
    !e.bloc.filtres && e.lignes.join() === '1,2,3,4,5' && e.ouverte === '+ Filtre' && e.colonne === 'Groupe' && e.focus &&
    (await visibles('.q-fen [data-qmode][aria-pressed="true"]')).join() === 'aucune de' && (await visibles('.q-fen [data-qmode]')).join('|') === 'l\'une de|toutes|aucune de', e);
  attendu('valeurs de la nouvelle colonne : une par pastille', (await visibles('.q-fen .q-case')).join('|') === '(vide)|APT28|APT29|aucun', await visibles('.q-fen .q-case'));
  await cliquer(caseV('apt28'));
  e = await etat();
  attendu('première case : la puce revient en fin de ligne', e.puces[2] === 'Groupe : sauf APT28' && e.puces[3] === '+ Filtre' && e.lignes.join() === '3,4,5', e);

  // fermée (Échap) : un seul Ctrl+Z défait toute la fenêtre
  await touche('Escape', 'Escape');
  await touche('z', 'KeyZ', 2);
  e = await etat();
  attendu('un Ctrl+Z : plus aucun filtre', !e.bloc.filtres && e.puces[2] === '+ Filtre' && e.lignes.join() === '1,2,3,4,5', e);

  // 360 px : liste des colonnes, segments et cases dans la fenêtre, sans défilement de page
  await ecran(360, true); await evalue(basculer); await attendre(60); await evalue(basculer); await attendre(120);
  await cliquer(puce('plus'));
  await cliquer(`document.querySelector('.q-fen [data-qfiltre="valeur"]')`);
  await choisirColonne('groupe');
  const m = await evalue(`(() => { const f = document.querySelector('.q-fen').getBoundingClientRect(); return { page: document.documentElement.scrollWidth - innerWidth, dedans: [...document.querySelectorAll('.q-fen select, .q-fen .q-case, .q-fen [data-qmode], .q-fen .q-fen-q')].every((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.left >= f.left - 1 && r.right <= f.right + 1; }) }; })()`);
  attendu('360 px : fenêtre entière visible, sans défilement de page', m.page <= 0 && m.dedans, m);
  await touche('Escape', 'Escape');
}
