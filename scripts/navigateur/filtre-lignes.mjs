// Sujet : filtre des lignes d'un tableau et de la vue tableau d'une requête (spec saisie-et-tableaux, élément 48).
// Le filtre masque des lignes à l'écran sans toucher au document ; il survit au rendu, au changement de page et à la mise à jour d'une requête.

const pill = (n) => `<span class="pill">${n}</span>`;
const LIGNES = [
  ['Billets de train', pill('Priorité')], ['Hôtel Édimbourg', 'fait'], ['Voiture', ''], ['Assurance', pill('Priorité')],
  ['Valises', ''], ['Passeports', 'à vérifier'], ['Carte routière', ''], ['Restaurants', ''],
  ['Musées', ''], ['Randonnées', ''], ['Cadeaux', ''], ['Retour en ferry', pill('Priorité')]];
const DOC = {
  title: 'Voyage', pages: [
    { id: 'p1', blocks: [
      { id: 'h1', type: 'header', title: 'Voyage' },
      { id: 't1', type: 'table', rows: [['Tâche', 'Statut']].concat(LIGNES) },
      { id: 'q1', type: 'query', src: 'table', scope: 'doc', view: 'table', sortBy: 'c:tâche', sortDir: 'asc', limit: 5 },
      { id: 'q2', type: 'query', src: 'table', scope: 'doc', view: 'list' },
      { id: 'q3', type: 'query', src: 'table', scope: 'doc', view: 'count' }] },
    { id: 'p2', blocks: [{ id: 'h2', type: 'header', title: 'Page 2' }, { id: 'a', type: 'p', html: 'Autre page' }] }] };

const MODE = `document.documentElement.classList.contains('is-edit')`;
const basculer = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
const page = (dir) => `document.dispatchEvent(new KeyboardEvent('keydown', { key: '${dir}', altKey: true, bubbles: true }))`;
// état du filtre d'un bloc : lignes visibles (premier texte), compteur, message, champ, valeur
const ETAT = (id) => `(() => {
  const bar = document.querySelector('.filtre[data-filtre="${id}"]'); if (!bar) return null;
  const host = ${JSON.stringify(id)} === 't1' ? bar.nextElementSibling : bar.parentNode.querySelector('.q-res');
  const trs = [...host.querySelectorAll('tbody > tr')];
  const vis = trs.filter((tr) => !tr.hidden && getComputedStyle(tr).display !== 'none').map((tr) => tr.cells[0].textContent.trim());
  const q = bar.querySelector('.filtre-q'), vide = bar.querySelector('.filtre-vide');
  return { vis, total: trs.length, n: (bar.querySelector('.filtre-n') || {}).textContent || '', vide: !!vide && !vide.hidden,
    champ: !!q, valeur: q ? q.value : null, focus: !!q && document.activeElement === q,
    loupe: getComputedStyle(bar.querySelector('.filtre-b')).opacity, thead: !!host.querySelector('thead tr') && getComputedStyle(host.querySelector('thead tr')).display !== 'none' };
})()`;
const JSONDOC = `JSON.stringify(window.ardoise.doc.pages)`;

export const nom = 'filtre des lignes';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const touche = async (key, code, mods = 0) => { for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: { Escape: 27, Tab: 9, ArrowDown: 40, Enter: 13 }[key], modifiers: mods }); await attendre(30); };
  const taper = async (t) => { await cdp('Input.insertText', { text: t }); await attendre(30); };
  const toutSelectionner = () => evalue(`document.activeElement.select ? document.activeElement.select() : document.execCommand('selectAll')`);
  const attendu = (cas, cond, detail) => { mesure(); if (!cond) echec(`${cas} : ${JSON.stringify(detail)}`); };
  const etat = (id) => evalue(ETAT(id));
  const ouvrir = (id) => evalue(`document.querySelector('.filtre[data-filtre="${id}"] .filtre-b').click()`);

  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(50);
  if (await evalue(MODE)) { await evalue(basculer); await attendre(50); }
  const avant = await evalue(JSONDOC);

  // lecture : la loupe ouvre le champ, le filtre suit chaque lettre, sans casse ni accents, pastilles comprises
  let e = await etat('t1');
  attendu('lecture : loupe sur le tableau, champ fermé', e && !e.champ && e.vis.length === 12, e);
  await ouvrir('t1'); await attendre(30);
  e = await etat('t1'); attendu('lecture : le clic sur la loupe ouvre le champ et lui donne le focus', e.champ && e.focus, e);
  await taper('PRIO');
  e = await etat('t1');
  attendu('lecture : « PRIO » garde les 3 lignes à pastille Priorité, en-tête visible', e.vis.join('|') === 'Billets de train|Assurance|Retour en ferry' && e.thead && e.n === '3 lignes sur 12', e);
  await toutSelectionner(); await taper('edim');
  e = await etat('t1'); attendu('lecture : « edim » trouve « Hôtel Édimbourg »', e.vis.join('|') === 'Hôtel Édimbourg' && e.n === '1 ligne sur 12', e);
  await toutSelectionner(); await taper('zzz');
  e = await etat('t1'); attendu('lecture : rien ne correspond, message affiché', !e.vis.length && e.vide && e.n === '0 ligne sur 12', e);
  await touche('Escape', 'Escape');
  e = await etat('t1'); attendu('lecture : Échap vide et ferme le filtre', !e.champ && e.vis.length === 12, e);
  attendu('le filtre ne modifie pas le document', (await evalue(JSONDOC)) === avant, 'document modifié');

  // changement de page puis retour : le filtre de la session reste
  await ouvrir('t1'); await taper('prio');
  await evalue(page('PageDown')); await attendre(50); await evalue(page('PageUp')); await attendre(50);
  e = await etat('t1'); attendu('retour sur la page : terme et filtre gardés', e.valeur === 'prio' && e.vis.length === 3, e);

  // impression : toutes les lignes ; après, le filtre revient
  await evalue(`window.dispatchEvent(new Event('beforeprint'))`);
  e = await etat('t1'); attendu('impression : toutes les lignes', e.vis.length === 12, e);
  await evalue(`window.dispatchEvent(new Event('afterprint'))`); await attendre(50);
  e = await etat('t1'); attendu('après l\'impression : filtre réappliqué', e.vis.length === 3, e);

  // requête en vue tableau : filtre après tri et limite ; liste et nombre sans loupe
  e = await etat('q1'); attendu('requête : 5 lignes affichées (limite)', e && e.total === 5, e);
  attendu('requête : pas de loupe en vue liste ni nombre', !(await evalue(`!!document.querySelector('.filtre[data-filtre="q2"], .filtre[data-filtre="q3"]')`)), 'loupe présente');
  await ouvrir('q1'); await taper('a');
  e = await etat('q1');
  const premiers = ['Assurance', 'Billets de train', 'Cadeaux', 'Carte routière', 'Hôtel Édimbourg'];
  attendu('requête : filtre sur les 5 premiers résultats triés', e.vis.join('|') === premiers.filter((t) => /a/i.test(t.normalize('NFD').replace(/[̀-ͯ]/g, '') + (t === 'Hôtel Édimbourg' ? ' fait' : ''))).join('|') && e.n.endsWith('sur 5'), e);
  await toutSelectionner(); await taper('priorite');
  e = await etat('q1'); attendu('requête : pastilles comprises', e.vis.join('|') === 'Assurance|Billets de train' && e.n === '2 lignes sur 5', e);
  // mise à jour des résultats pendant la saisie : saisie, focus et filtre gardés
  const D2 = JSON.parse(JSON.stringify(DOC)); D2.pages[0].blocks[1].rows.push(['Achats', pill('Priorité')]);
  await evalue(`window.ardoise.load(${JSON.stringify(D2)})`); await attendre(50);
  e = await etat('q1'); attendu('requête mise à jour : champ, focus et filtre gardés', e.valeur === 'priorite' && e.focus && e.vis.join('|') === 'Achats|Assurance|Billets de train' && e.n === '3 lignes sur 5', e);
  await touche('Escape', 'Escape');
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(50);

  // édition : le filtre se réapplique ; une ligne prise ou ajoutée pendant le filtre reste jusqu'au prochain terme
  await evalue(basculer); await attendre(80);
  attendu('passage en édition', await evalue(MODE), 'mode lecture');
  e = await etat('t1'); attendu('édition : filtre réappliqué', e.vis.length === 3 && e.valeur === 'prio', e);
  const cellule = (r, c) => `document.querySelector('[data-b="t1"][data-k="rows.${r}.${c}"]')`;
  const curseurFin = (r, c) => evalue(`(() => { const el = ${cellule(r, c)}; el.focus(); const rg = document.createRange(); rg.selectNodeContents(el); rg.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); return true; })()`);
  // flèche bas depuis « Billets de train » (ligne 1) : saute les lignes masquées jusqu'à « Assurance » (ligne 4)
  await curseurFin(1, 0); await touche('ArrowDown', 'ArrowDown');
  attendu('flèche bas : lignes masquées sautées', await evalue(`document.activeElement.dataset.k`) === 'rows.4.0', await evalue(`document.activeElement.dataset.k`));
  // la ligne qui a le focus ne correspond plus après saisie : elle reste visible, même après un rendu (ajout d'une ligne)
  await curseurFin(4, 1); await evalue(`document.execCommand('selectAll')`); await taper('rien');
  await curseurFin(12, 1); await touche('Tab', 'Tab'); await attendre(80);
  e = await etat('t1');
  attendu('édition : ligne modifiée et ligne ajoutée restent visibles', e.total === 13 && e.vis.join('|') === 'Billets de train|Assurance|Retour en ferry|' && !/Priorit/.test(await evalue('window.ardoise.doc.pages[0].blocks[1].rows[4][1]')), e);
  attendu('édition : le focus est dans la ligne ajoutée', await evalue(`document.activeElement.dataset.k`) === 'rows.13.0', await evalue(`document.activeElement.dataset.k`));
  // nouveau terme : elles disparaissent
  await evalue(`document.querySelector('.filtre[data-filtre="t1"] .filtre-q').focus()`); await toutSelectionner(); await taper('priorit');
  e = await etat('t1'); attendu('nouveau terme : lignes gardées oubliées', e.vis.join('|') === 'Billets de train|Retour en ferry', e);

  // glisser-déposer pendant un filtre : agit sur les vraies lignes (« Retour en ferry », ligne 12, posée avant « Billets de train », ligne 1)
  const rect = (sel) => evalue(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: r.top }; })()`);
  await evalue(`${cellule(12, 0)}.scrollIntoView({ block: 'center' })`); await attendre(50);
  const souris = (type, x, y, extra = {}) => cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra });
  const c12 = await rect('[data-b="t1"][data-k="rows.12.0"]');
  await souris('mouseMoved', c12.x, c12.y, { button: 'none' }); await attendre(50);
  const g = await rect('.tgrip-row');
  const c1 = await rect('[data-b="t1"][data-k="rows.1.0"]');
  await souris('mouseMoved', g.x, g.y, { button: 'none' }); await souris('mousePressed', g.x, g.y, { clickCount: 1 });
  await souris('mouseMoved', g.x, c1.t + 2, { buttons: 1 }); await attendre(30); await souris('mouseReleased', g.x, c1.t + 2, { clickCount: 1 }); await attendre(80);
  const premieres = await evalue(`window.ardoise.doc.pages[0].blocks[1].rows.slice(1, 3).map((r) => r[0])`);
  attendu('glisser-déposer : la vraie ligne est déplacée', premieres[0] === 'Retour en ferry' && premieres[1] === 'Billets de train', premieres);

  // écran tactile, 360 px : loupe visible sans survol, page sans débordement
  await evalue(basculer); await attendre(50);
  await ecran(360, true);
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }] });
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(50);   // sans rechargement : la page modifiée demanderait de confirmer la sortie
  if (await evalue(MODE)) { await evalue(basculer); await attendre(50); }
  await evalue(`(document.querySelector('.filtre[data-filtre="t1"] .filtre-x') || { click() {} }).click()`);   // filtre de la session fermé : loupe seule
  if (await evalue(`matchMedia('(hover: none)').matches`)) {
    e = await etat('t1'); attendu('360 px tactile : loupe visible sans survol', e && e.loupe === '1', e);
  } else echec('émulation de (hover: none) indisponible');
  await ouvrir('t1'); await taper('prio');
  attendu('360 px : la page ne déborde pas avec le filtre ouvert', (await evalue(`document.documentElement.scrollWidth - innerWidth`)) <= 0, 'débordement');
  await cdp('Emulation.setEmulatedMedia', { features: [] });
}
