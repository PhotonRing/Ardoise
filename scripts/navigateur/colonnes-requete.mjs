// Sujet : choix des colonnes d'une requête dans la fenêtre de la puce « colonnes » (spec requetes-avancees, tickets 01 et 03).
// Cases, « Afficher les nouvelles colonnes », ordre au clavier (Alt+↑ / Alt+↓) et à la poignée ; une étape « colonnes modifiées » par geste ; loupe sur la vue
// tableau aux colonnes choisies ; aucun réglage en lecture ; formulaire sans débordement à 360 px.

const DOC = { title: 'Colonnes', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 't1', type: 'table', rows: [['Hôte', 'État', 'Risque'], ['srv1', 'ok', 'bas'], ['srv2', 'ko', 'haut'], ['web3', 'ok', 'moyen']] },
  { id: 'q1', type: 'query', title: 'Incidents', src: 'table', scope: 'doc', view: 'table' },
  { id: 'q2', type: 'query', title: 'En liste', src: 'table', scope: 'doc', view: 'list' },
] }] };
// vue liste de q2 : ordre de la première ligne (Source ou nom de colonne), cases du réglage, focus
const LISTE = `(() => {
  const q = document.querySelector('.blk[data-id="q2"]'), f = document.querySelector('.q-fen[data-id="q2"]'), li = q.querySelector('.q-res li'), a = document.activeElement;
  // ordre à l'écran (le CSS peut réordonner) : ligne par ligne (8 px de tolérance), puis de gauche à droite
  const pos = (x) => { const r = x.getBoundingClientRect(); return [Math.round(r.top), r.left]; };
  return { ligne: [...li.querySelectorAll('.q-src, .q-k')].sort((a, b) => { const p = pos(a), q = pos(b); return Math.abs(p[0] - q[0]) > 8 ? p[0] - q[0] : p[1] - q[1]; }).map((x) => x.classList.contains('q-src') ? 'Source' : x.textContent),
    cases: f ? [...f.querySelectorAll('input[data-qcol]')].map((c) => c.dataset.qcol) : [], focus: a && a.dataset ? a.dataset.qcol || null : null };
})()`;
const MODE = `document.documentElement.classList.contains('is-edit')`;
const basculer = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
// état : en-têtes du résultat, cases du formulaire (clé + cochée), focus, champ colonnes du document, libellé d'Annuler
const ETAT = `(() => {
  const q = document.querySelector('.blk[data-id="q1"]'), f = document.querySelector('.q-fen[data-id="q1"]'), a = document.activeElement;
  return { th: [...q.querySelectorAll('.q-res thead th')].map((t) => t.textContent.replace(/ [↑↓]$/, '').trim()),
    cases: f ? [...f.querySelectorAll('input[data-qcol]')].map((c) => c.dataset.qcol + (c.checked ? '+' : '-')) : [],
    focus: a && a.dataset ? a.dataset.qcol || null : null, colonnes: window.ardoise.doc.pages[0].blocks[1].colonnes || null,
    annuler: (document.querySelector('#ui [data-ui=undo]') || {}).title || '' };
})()`;
const caseDe = (k) => `[...document.querySelectorAll('.q-fen[data-id="q1"] input[data-qcol]')].find((c) => c.dataset.qcol === ${JSON.stringify(k)})`;
// glisser la ligne de la colonne de vers la moitié gauche (avant) de la ligne de la colonne vers
const GLISSER = (de, vers) => `(() => {
  const li = (k) => [...document.querySelectorAll('.q-fen[data-id="q1"] .q-col')].find((x) => x.dataset.qcolk === k);
  const s = li(${JSON.stringify(de)}), t = li(${JSON.stringify(vers)}), dt = new DataTransfer(), r = t.getBoundingClientRect();
  s.querySelector('.q-grip').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  s.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  const o = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 2, clientY: r.top + r.height / 2 };
  t.dispatchEvent(new DragEvent('dragover', o)); t.dispatchEvent(new DragEvent('drop', o));
  s.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  return true; })()`;

export const nom = 'colonnes de requête';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const etat = () => evalue(ETAT);
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  const touche = async (key, code, mods = 0) => { for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: { ArrowUp: 38, ArrowDown: 40, ' ': 32, Escape: 27 }[key], modifiers: mods }); await attendre(50); };

  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(50);
  if (await evalue(MODE)) { await evalue(basculer); await attendre(50); }
  attendu('lecture : aucun réglage de colonnes', !(await evalue(`!!document.querySelector('[data-qcol], [data-qcolmode]')`)), 'réglage visible');
  await evalue(basculer); await attendre(80);
  const ouvrir = async (q) => { await evalue(`document.querySelector('.blk[data-id="${q}"] [data-qpuce="cols"]').click()`); await attendre(80); };
  const fermer = async () => { await touche('Escape', 'Escape'); await attendre(50); };

  await ouvrir('q1');
  let e = await etat();
  attendu('édition : toutes les colonnes, Source en dernier, toutes cochées', e.th.join('|') === 'Hôte|État|Risque|Source' && e.cases.join() === 'hôte+,état+,risque+,#source+', e);

  // décocher État : « Toutes sauf… », une étape nommée, la case garde le focus
  await evalue(`${caseDe('état')}.focus()`); await touche(' ', 'Space');
  e = await etat();
  attendu('décocher État : colonne retirée du résultat', e.th.join('|') === 'Hôte|Risque|Source' && e.cases.join() === 'hôte+,état-,risque+,#source+', e);
  attendu('décocher État : mode « Toutes sauf… »', JSON.stringify(e.colonnes) === '{"mode":"sauf","noms":["état"],"ordre":[]}', e.colonnes);
  attendu('décocher État : libellé d\'Annuler', /Requête « Incidents » : colonnes modifiées/.test(e.annuler), e.annuler);
  attendu('décocher État : focus gardé sur la case', e.focus === 'état', e.focus);

  // Alt+↑ sur Risque : Risque passe avant État et Hôte (deux fois), focus gardé
  await evalue(`${caseDe('risque')}.focus()`);
  await touche('ArrowUp', 'ArrowUp', 1); await touche('ArrowUp', 'ArrowUp', 1);
  e = await etat();
  attendu('Alt+↑ : Risque en tête', e.th.join('|') === 'Risque|Hôte|Source' && e.cases.join() === 'risque+,hôte+,état-,#source+', e);
  attendu('Alt+↑ : focus gardé sur la case déplacée', e.focus === 'risque', e.focus);
  await touche('ArrowDown', 'ArrowDown', 1);
  e = await etat(); attendu('Alt+↓ : Risque après Hôte', e.cases.join() === 'hôte+,risque+,état-,#source+' && e.focus === 'risque', e);
  attendu('fenêtre ouverte : une seule étape pour tous ses gestes', /Requête « Incidents » : colonnes modifiées \(/.test(e.annuler), e.annuler);
  await fermer();
  attendu('Échap : fenêtre fermée, focus sur la puce', await evalue(`!document.querySelector('.q-fen') && document.activeElement.dataset.qpuce === 'cols'`), 'fenêtre ou focus');
  await ouvrir('q2');

  // vue liste : Source en tête du réglage et de la ligne ; Alt+↑ sur Risque ne la déplace pas
  let l = await evalue(LISTE);
  attendu('liste : Source en tête du réglage et des lignes', l.cases.join() === '#source,hôte,état,risque' && l.ligne.join() === 'Source,Hôte,État,Risque', l);
  await evalue(`[...document.querySelectorAll('.q-fen[data-id="q2"] input[data-qcol]')].find((c) => c.dataset.qcol === 'risque').focus()`);
  await touche('ArrowUp', 'ArrowUp', 1); await touche('ArrowUp', 'ArrowUp', 1);
  l = await evalue(LISTE);
  attendu('liste, Alt+↑ deux fois sur Risque : Source reste en tête', l.cases.join() === '#source,risque,hôte,état' && l.ligne.join() === 'Source,Risque,Hôte,État' && l.focus === 'risque', l);

  // poignée : Source glissée avant Hôte (la fenêtre de q2 se ferme en ouvrant celle de q1)
  await ouvrir('q1');
  await evalue(GLISSER('#source', 'hôte')); await attendre(80);
  e = await etat(); attendu('poignée : Source en tête', e.th.join('|') === 'Source|Hôte|Risque' && e.cases[0] === '#source+', e);

  // plus de sélecteur de mode : les cases, puis « Afficher les nouvelles colonnes », cochée, sous la dernière à l'écran
  const nouv = await evalue(`(() => { const f = document.querySelector('.q-fen[data-id="q1"]'), c = f.querySelector('input[data-qcolnouv]'), l = c && c.closest('label');
    const vis = (x) => !!x && x.getClientRects().length > 0, cs = [...f.querySelectorAll('input[data-qcol]')], der = cs[cs.length - 1].closest('label').getBoundingClientRect();
    return { mode: [...f.querySelectorAll('select')].filter(vis).length, case: vis(c) && c.checked, texte: l ? l.textContent.trim() : '', dessous: !!l && l.getBoundingClientRect().top >= der.bottom - 1 }; })()`);
  attendu('fenêtre des colonnes : cases et « Afficher les nouvelles colonnes » cochée en bas, sans sélecteur', nouv.mode === 0 && nouv.case && nouv.texte === 'Afficher les nouvelles colonnes' && nouv.dessous, nouv);
  // la décocher : résultat inchangé, réglage « Seulement… »
  const pt = await evalue(`(() => { const c = document.querySelector('.q-fen[data-id="q1"] input[data-qcolnouv]'), r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: pt.x, y: pt.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
  await attendre(80);
  e = await etat(); attendu('« Afficher les nouvelles colonnes » décochée : résultat inchangé', e.th.join('|') === 'Source|Hôte|Risque' && e.colonnes.mode === 'seulement', e);
  attendu('case décochée à l\'écran, focus gardé', await evalue(`(() => { const c = document.querySelector('.q-fen[data-id="q1"] input[data-qcolnouv]'); return !!c && !c.checked && document.activeElement === c; })()`), 'case');

  // un Ctrl+Z défait toute la fenêtre (poignée et case des nouvelles colonnes) : retour au réglage de la première fenêtre
  await fermer();
  await evalue(`document.querySelector('#ui [data-ui=undo]').click()`); await attendre(80);
  e = await etat(); attendu('Ctrl+Z : retour à « Toutes sauf… », Hôte en tête', e.colonnes && e.colonnes.mode === 'sauf' && e.th.join('|') === 'Hôte|Risque|Source', e);

  // Source masquée : la loupe filtre toujours la vue tableau, en lecture
  await ouvrir('q1');
  await evalue(`${caseDe('#source')}.click()`); await attendre(80);
  await fermer();
  await evalue(basculer); await attendre(80);
  await evalue(`document.querySelector('.filtre[data-filtre="q1"] .filtre-b').click()`); await attendre(50);
  await cdp('Input.insertText', { text: 'srv' }); await attendre(80);
  const vis = await evalue(`[...document.querySelector('.filtre[data-filtre="q1"]').parentNode.querySelectorAll('.q-res tbody tr')].filter((tr) => tr.getClientRects().length > 0).map((tr) => tr.cells[0].textContent.trim())`);
  const th = await evalue(`[...document.querySelector('.filtre[data-filtre="q1"]').parentNode.querySelectorAll('.q-res thead th')].map((t) => t.textContent.trim())`);
  attendu('loupe : filtre la vue tableau aux colonnes choisies', vis.join('|') === 'srv1|srv2' && th.join('|') === 'Hôte|Risque', { vis, th });

  // d7 : requête sur les cartes sans réglage ; décocher Priorité ne fait pas apparaître « Attend » à l'écran
  const KB = { title: 'Cartes', pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 'kb', type: 'kanban', cols: [{ id: 'c1', title: 'À faire', cards: [{ id: 'k1', title: 'Écrire', prio: 'p1', dep: ['k2'] }, { id: 'k2', title: 'Relire' }] }] },
    { id: 'q1', type: 'query', title: 'Cartes', src: 'kanban', scope: 'doc', view: 'table' },
  ] }] };
  await evalue(`window.ardoise.load(${JSON.stringify(KB)})`); await attendre(80);
  if (!(await evalue(MODE))) { await evalue(basculer); await attendre(80); }
  const entetes = `[...document.querySelectorAll('.blk[data-id="q1"] .q-res thead th')].filter((t) => t.getClientRects().length > 0).map((t) => t.textContent.replace(/ [↑↓]$/, '').trim()).join('|')`;
  attendu('cartes : Attend masquée par défaut', !(await evalue(entetes)).includes('Attend'), await evalue(entetes));
  await ouvrir('q1');
  await evalue(`${caseDe('priorité')}.click()`); await attendre(80);
  attendu('Priorité décochée : Attend toujours masquée', (await evalue(entetes)) === 'Titre|Colonne|Échéance|Responsable|Source', await evalue(entetes));
  await evalue(`${caseDe('#attend')}.click()`); await attendre(80);
  attendu('Attend cochée : affichée', (await evalue(entetes)).includes('Attend'), await evalue(entetes));
  await fermer(); await evalue(basculer); await attendre(80);   // retour en lecture, comme avant cette partie

  // téléphone : ligne de puces et fenêtre sans défilement de côté
  await ecran(360, true); await evalue(basculer); await attendre(120); await ouvrir('q1');
  const deborde = await evalue(`document.documentElement.scrollWidth - innerWidth`);
  attendu('360 px : la page ne défile pas de côté avec le choix des colonnes', deborde <= 0 && await evalue(`!!document.querySelector('.q-cols')`), deborde);
  await ecran(1000, false);
}
