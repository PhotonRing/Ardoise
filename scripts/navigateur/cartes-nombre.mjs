// Sujet : ligne de puces des cartes de nombre (spec filtres-logiques, ticket 04). Le « + Filtre » d'une carte ouvre la même fenêtre
// que les filtres de la requête, sous la puce de cette carte ; cocher pose le filtre sur la carte (compte mis à jour, puce avec ×) ;
// la fenêtre suit sa carte quand une carte d'avant disparaît (modification reçue) ; total « un autre filtre… » au clavier ;
// une fenêtre = une étape, × = une étape ; 360 px sans défilement de page.

const KB = { id: 'kb', type: 'kanban', cols: [
  { id: 'c1', title: 'En cours', cards: [{ id: 'k1', title: 'Écrire', who: 'Alice', prio: 'p1' }, { id: 'k2', title: 'Relire', who: 'Bob', prio: 'p3' }] },
  { id: 'c2', title: 'Fait', cards: [{ id: 'k3', title: 'Valider', who: 'Alice', prio: 'p2' }] },
] };
const DOC = { title: 'Nombres', pages: [{ id: 'p1', title: 'Accueil', blocks: [KB,
  { id: 'q', type: 'query', title: 'Suivi', src: 'kanban', scope: 'doc', view: 'count', cards: [{ id: 'n1', label: 'Première', total: 'none' }, { id: 'n2', label: '', total: 'filter' }] },
] }] };
const MODE = `document.documentElement.classList.contains('is-edit')`;
const basculer = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
const ETAT = `(() => {
  const f = document.querySelector('.q-fen'), a = document.activeElement, b = window.ardoise.doc.pages[0].blocks.find((x) => x.id === 'q');
  const cartes = [...document.querySelectorAll('.blk[data-id=q] .q-count')].map((c) => ({ n: c.querySelector('b').textContent, ph: (c.querySelector('.q-lab') || {}).dataset.ph,
    puces: [...c.querySelectorAll('.q-cpuces .q-puce')].map((x) => x.textContent.trim()) }));
  const o = document.querySelector('.q-puce[aria-expanded="true"]');
  return { cartes, fen: f ? f.querySelector('h4').textContent : null, ouverte: o ? o.dataset.qpuce : null,
    focus: a && a.dataset ? a.dataset.qpuce || a.dataset.qretirer && 'x:' + a.dataset.qretirer || (a.closest && a.closest('.q-fen') ? 'fenêtre' : null) : null,
    bloc: JSON.parse(JSON.stringify(b)), annuler: (document.querySelector('#ui [data-ui=undo]') || {}).title || '' };
})()`;
const puce = (cle) => `document.querySelector('.blk[data-id="q"] [data-qpuce="${cle}"]')`;
const caseV = (v) => `document.querySelector('.q-fen input[data-qval][data-v=${JSON.stringify(v)}]')`;

export const nom = 'puces des cartes de nombre';
export default async function ({ ecran, charger, evalue, cdp, attendre, visibles, mesure, echec }) {
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  const touche = async (key, code, mods = 0) => { for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: { Escape: 27, Enter: 13, Tab: 9 }[key], modifiers: mods, ...(key === 'Enter' && type === 'keyDown' ? { text: '\r' } : {}) }); await attendre(70); };
  const cliquer = async (expr) => {
    const p = await evalue(`(() => { const el = ${expr}; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
    await attendre(90);
  };
  const etat = () => evalue(ETAT);

  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(50);
  if (!(await evalue(MODE))) { await evalue(basculer); await attendre(80); }

  // « + Filtre » de la 2e carte : même fenêtre « Ajouter un filtre », accrochée sous la puce de cette carte
  await cliquer(puce('plus:n2:filtres'));
  let e = await etat();
  attendu('fenêtre « Ajouter un filtre » sous le « + Filtre » de la carte', e.fen === 'Ajouter un filtre' && e.ouverte === 'plus:n2:filtres', e);
  attendu('tous les filtres de la source proposés', (await visibles('.q-fen [data-qfiltre]')).join('|') === 'Pastilles|Colonne du kanban|Responsable|Priorité|Échéance|BloquéesAttendent une carte pas finie', await visibles('.q-fen [data-qfiltre]'));
  await cliquer(`document.querySelector('.q-fen [data-qfiltre="kbWho"]')`);
  await cliquer(caseV('alice'));
  e = await etat();
  const fid = (e.bloc.cards[1].filtres || [{}])[0].id;
  attendu('Alice cochée : filtre posé sur la 2e carte seulement, compte et texte par défaut à jour, fenêtre sous sa puce',
    e.bloc.cards[1].filtres.length === 1 && !e.bloc.cards[0].filtres && !e.bloc.filtres && e.cartes[1].n.startsWith('2') && e.cartes[1].ph === 'cartes · Responsable : Alice' &&
    e.cartes[1].puces.join('|').startsWith('Responsable : Alice|+ Filtre') && e.ouverte === 'f:' + fid, e);
  // fermée : un seul Ctrl+Z défait la fenêtre
  await touche('Escape', 'Escape');
  e = await etat(); attendu('Échap : la puce reprend le focus', e.focus === 'f:' + fid && /filtres modifiés/.test(e.annuler), e);
  await touche('z', 'KeyZ', 2);
  e = await etat(); attendu('un Ctrl+Z : plus de filtre sur la carte', !e.bloc.cards[1].filtres && e.cartes[1].n.startsWith('3'), e);

  // modification reçue pendant que la fenêtre d'une carte est ouverte : la carte d'avant disparaît, la fenêtre vise toujours la sienne
  await cliquer(puce('plus:n2:filtres'));
  await cliquer(`document.querySelector('.q-fen [data-qfiltre="kbWho"]')`);
  await cliquer(caseV('alice'));
  const fid2 = (await etat()).bloc.cards[1].filtres[0].id;
  const recu = await evalue(`(() => { const d = JSON.parse(JSON.stringify(window.ardoise.doc)); d.pages[0].blocks[1].cards.shift(); return d; })()`);
  await evalue(`window.ardoise.load(${JSON.stringify(recu)})`); await attendre(120);
  e = await etat();
  attendu('après la modification reçue : fenêtre encore ouverte sous la puce de la même carte', e.cartes.length === 1 && e.fen === 'Responsable' && e.ouverte === 'f:' + fid2, e);
  await cliquer(caseV('bob'));
  e = await etat();
  attendu('Bob coché : sur la bonne carte', e.bloc.cards.length === 1 && e.bloc.cards[0].id === 'n2' && e.bloc.cards[0].filtres[0].vals.join() === 'alice,bob' && e.cartes[0].puces[0] === 'Responsable : Alice ou Bob', e);
  await touche('Escape', 'Escape');

  // total « un autre filtre… » au clavier : Entrée ouvre la fenêtre, « Bloquées » se pose ; × au clavier retire, focus au « + Filtre »
  await evalue(`${puce('plus:n2:tfiltres')}.focus()`); await touche('Enter', 'Enter');
  e = await etat(); attendu('Entrée : fenêtre du total ouverte, focus dedans', e.fen === 'Ajouter un filtre' && e.ouverte === 'plus:n2:tfiltres' && e.focus === 'fenêtre', e);
  await cliquer(`document.querySelector('.q-fen [data-qfiltre="bloquees"]')`);
  await cliquer(`document.querySelector('.q-fen [data-qset="bloquees"][data-v="non"]')`);
  e = await etat();
  const tid = e.bloc.cards[0].tfiltres[0].id;
  attendu('Non bloquées sur le total : compte / total, texte par défaut sans le total', e.cartes[0].n === '3 / 3' && e.cartes[0].ph === 'cartes · Responsable : Alice ou Bob' && e.cartes[0].puces.includes('Non bloquées'), e);
  await touche('Escape', 'Escape');
  await evalue(`document.querySelector('.blk[data-id="q"] [data-qretirer="${tid}"]').focus()`); await touche('Enter', 'Enter');
  e = await etat();
  attendu('× au clavier : filtre du total retiré, une étape, focus au « + Filtre » du total', !e.bloc.cards[0].tfiltres && e.focus === 'plus:n2:tfiltres' && /filtres modifiés/.test(e.annuler), e);
  await touche('z', 'KeyZ', 2);
  e = await etat(); attendu('Ctrl+Z : le × seul est défait', e.bloc.cards[0].tfiltres.length === 1 && e.bloc.cards[0].filtres.length === 1, e);

  // 360 px : puces des cartes dans la carte, fenêtre de la largeur du bloc, jamais de défilement de page
  await ecran(360, true); await evalue(basculer); await attendre(60); await evalue(basculer); await attendre(120);
  await cliquer(puce('plus:n2:filtres'));
  await cliquer(`document.querySelector('.q-fen [data-qfiltre="kbPrio"]')`);
  const m = await evalue(`(() => { const f = document.querySelector('.q-fen').getBoundingClientRect(), c = document.querySelector('.blk[data-id="q"] .q-count').getBoundingClientRect();
    const dans = (sel, r) => [...document.querySelectorAll(sel)].every((x) => { const h = x.getBoundingClientRect(); return h.width > 0 && h.left >= r.left - 1 && h.right <= r.right + 1; });
    return { page: document.documentElement.scrollWidth - innerWidth, puces: dans('.blk[data-id="q"] .q-cpuces .q-puce, .blk[data-id="q"] .q-cpuces .q-puce-x', c), fen: dans('.q-fen .q-case, .q-fen [data-qmode]', f), droite: Math.round(f.right) }; })()`);
  attendu('360 px : puces dans la carte, fenêtre entière, sans défilement de page', m.page <= 0 && m.puces && m.fen && m.droite <= 360, m);
  await touche('Escape', 'Escape');
  await ecran(1000, false);
}
