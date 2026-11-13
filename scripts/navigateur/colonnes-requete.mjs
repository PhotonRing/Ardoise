// Sujet : choix des colonnes d'une requête dans le formulaire d'édition (spec requetes-avancees, ticket 01).
// Cases, mode, ordre au clavier (Alt+↑ / Alt+↓) et à la poignée ; une étape « colonnes modifiées » par geste ; loupe sur la vue
// tableau aux colonnes choisies ; aucun réglage en lecture ; formulaire sans débordement à 360 px.

const DOC = { title: 'Colonnes', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 't1', type: 'table', rows: [['Hôte', 'État', 'Risque'], ['srv1', 'ok', 'bas'], ['srv2', 'ko', 'haut'], ['web3', 'ok', 'moyen']] },
  { id: 'q1', type: 'query', title: 'Incidents', src: 'table', scope: 'doc', view: 'table' },
  { id: 'q2', type: 'query', title: 'En liste', src: 'table', scope: 'doc', view: 'list' },
] }] };
// vue liste de q2 : ordre de la première ligne (Source ou nom de colonne), cases du réglage, focus
const LISTE = `(() => {
  const q = document.querySelector('.blk[data-id="q2"]'), li = q.querySelector('.q-res li'), a = document.activeElement;
  // ordre à l'écran (le CSS peut réordonner) : ligne par ligne (8 px de tolérance), puis de gauche à droite
  const pos = (x) => { const r = x.getBoundingClientRect(); return [Math.round(r.top), r.left]; };
  return { ligne: [...li.querySelectorAll('.q-src, .q-k')].sort((a, b) => { const p = pos(a), q = pos(b); return Math.abs(p[0] - q[0]) > 8 ? p[0] - q[0] : p[1] - q[1]; }).map((x) => x.classList.contains('q-src') ? 'Source' : x.textContent),
    cases: [...q.querySelectorAll('input[data-qcol]')].map((c) => c.dataset.qcol), focus: a && a.dataset ? a.dataset.qcol || null : null };
})()`;
const MODE = `document.documentElement.classList.contains('is-edit')`;
const basculer = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
// état : en-têtes du résultat, cases du formulaire (clé + cochée), focus, champ colonnes du document, libellé d'Annuler
const ETAT = `(() => {
  const q = document.querySelector('.blk[data-id="q1"]'), a = document.activeElement;
  return { th: [...q.querySelectorAll('.q-res thead th')].map((t) => t.textContent.replace(/ [↑↓]$/, '').trim()),
    cases: [...q.querySelectorAll('input[data-qcol]')].map((c) => c.dataset.qcol + (c.checked ? '+' : '-')),
    focus: a && a.dataset ? a.dataset.qcol || null : null, colonnes: window.ardoise.doc.pages[0].blocks[1].colonnes || null,
    annuler: (document.querySelector('#ui [data-ui=undo]') || {}).title || '' };
})()`;
const caseDe = (k) => `[...document.querySelectorAll('.blk[data-id="q1"] input[data-qcol]')].find((c) => c.dataset.qcol === ${JSON.stringify(k)})`;
// glisser la ligne de la colonne de vers la moitié gauche (avant) de la ligne de la colonne vers
const GLISSER = (de, vers) => `(() => {
  const li = (k) => [...document.querySelectorAll('.blk[data-id="q1"] .q-col')].find((x) => x.dataset.qcolk === k);
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
  const touche = async (key, code, mods = 0) => { for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: { ArrowUp: 38, ArrowDown: 40, ' ': 32 }[key], modifiers: mods }); await attendre(50); };

  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(50);
  if (await evalue(MODE)) { await evalue(basculer); await attendre(50); }
  attendu('lecture : aucun réglage de colonnes', !(await evalue(`!!document.querySelector('[data-qcol], [data-qcolmode]')`)), 'réglage visible');
  await evalue(basculer); await attendre(80);

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

  // vue liste : Source en tête du réglage et de la ligne ; Alt+↑ sur Risque ne la déplace pas
  let l = await evalue(LISTE);
  attendu('liste : Source en tête du réglage et des lignes', l.cases.join() === '#source,hôte,état,risque' && l.ligne.join() === 'Source,Hôte,État,Risque', l);
  await evalue(`[...document.querySelectorAll('.blk[data-id="q2"] input[data-qcol]')].find((c) => c.dataset.qcol === 'risque').focus()`);
  await touche('ArrowUp', 'ArrowUp', 1); await touche('ArrowUp', 'ArrowUp', 1);
  l = await evalue(LISTE);
  attendu('liste, Alt+↑ deux fois sur Risque : Source reste en tête', l.cases.join() === '#source,risque,hôte,état' && l.ligne.join() === 'Source,Risque,Hôte,État' && l.focus === 'risque', l);

  // poignée : Source glissée avant Hôte
  await evalue(GLISSER('#source', 'hôte')); await attendre(80);
  e = await etat(); attendu('poignée : Source en tête', e.th.join('|') === 'Source|Hôte|Risque' && e.cases[0] === '#source+', e);

  // mode « Seulement… » : mêmes colonnes ; une case cochée ensuite s'ajoute
  await evalue(`(() => { const s = document.querySelector('.blk[data-id="q1"] select[data-qcolmode]'); s.value = 'seulement'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await attendre(80);
  e = await etat(); attendu('« Seulement… » : résultat inchangé', e.th.join('|') === 'Source|Hôte|Risque' && e.colonnes.mode === 'seulement', e);

  // un Ctrl+Z défait un geste
  await evalue(`document.querySelector('#ui [data-ui=undo]').click()`); await attendre(80);
  e = await etat(); attendu('Ctrl+Z : retour à « Toutes sauf… »', e.colonnes && e.colonnes.mode === 'sauf', e.colonnes);

  // Source masquée : la loupe filtre toujours la vue tableau, en lecture
  await evalue(`${caseDe('#source')}.click()`); await attendre(80);
  await evalue(basculer); await attendre(80);
  await evalue(`document.querySelector('.filtre[data-filtre="q1"] .filtre-b').click()`); await attendre(50);
  await cdp('Input.insertText', { text: 'srv' }); await attendre(80);
  const vis = await evalue(`[...document.querySelector('.filtre[data-filtre="q1"]').parentNode.querySelectorAll('.q-res tbody tr')].filter((tr) => !tr.hidden && getComputedStyle(tr).display !== 'none').map((tr) => tr.cells[0].textContent.trim())`);
  const th = await evalue(`[...document.querySelector('.filtre[data-filtre="q1"]').parentNode.querySelectorAll('.q-res thead th')].map((t) => t.textContent.trim())`);
  attendu('loupe : filtre la vue tableau aux colonnes choisies', vis.join('|') === 'srv1|srv2' && th.join('|') === 'Hôte|Risque', { vis, th });

  // téléphone : formulaire sans défilement de côté
  await ecran(360, true); await evalue(basculer); await attendre(120);
  const deborde = await evalue(`document.documentElement.scrollWidth - innerWidth`);
  attendu('360 px : la page ne défile pas de côté avec le choix des colonnes', deborde <= 0 && await evalue(`!!document.querySelector('.q-cols')`), deborde);
  await ecran(1000, false);
}
