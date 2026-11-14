// Sujet : champs des cartes d'une requête en vue kanban et filtre « Bloquées » (spec requetes-avancees, tickets 02 et 03).
// Cases des champs dans la fenêtre de la puce, ordre au clavier (Alt+↑) et à la poignée, une étape nommée par fenêtre, « Bloquées » par « + Filtre »,
// pointillés de la carte bloquée ; aucun réglage en lecture ; formulaire sans débordement à 360 px.

const DOC = { title: 'Champs', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'kb', type: 'kanban', cols: [
    { id: 'c1', title: 'À faire', cards: [
      { id: 'k1', title: 'Écrire', html: 'le plan', due: '', who: 'Alice', dep: ['k2'] },
      { id: 'k2', title: 'Relire', html: '', due: '', who: '' },
    ] },
    { id: 'c2', title: 'Fait', cards: [{ id: 'k3', title: 'Valider', html: '', due: '', who: '' }] },
  ] },
  { id: 'q1', type: 'query', title: 'Suivi', src: 'kanban', scope: 'doc', view: 'kanban' },
] }] };
const MODE = `document.documentElement.classList.contains('is-edit')`;
const basculer = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
// état : cartes du résultat (titre et champs dans l'ordre, pointillés), cases des champs, focus, réglages du document, libellé d'Annuler
const ETAT = `(() => {
  const q = document.querySelector('.blk[data-id="q1"], .q-blk[data-qid="q1"]'), a = document.activeElement, b = window.ardoise.doc.pages[0].blocks[1];
  return { cartes: [...q.querySelectorAll('.q-res .kb-card')].map((c) => c.querySelector('.kb-ct').textContent.trim() + ':' + [...c.querySelectorAll('.kb-tx, .kb-wait, .kb-who, .q-src')].map((x) => x.className.split(' ')[0]).join(',') + (c.classList.contains('kb-blocked') ? ':bloquée' : '')),
    cases: [...document.querySelectorAll('.q-fen[data-id="q1"] input[data-qchamp]')].map((c) => c.dataset.qchamp + (c.checked ? '+' : '-')),
    focus: a && a.dataset ? a.dataset.qchamp || null : null, champs: b.champs || null, bloquees: (b.filtres || []).some((f) => f.prop === 'bloquees'),
    annuler: (document.querySelector('#ui [data-ui=undo]') || {}).title || '' };
})()`;
const caseDe = (k) => `[...document.querySelectorAll('.q-fen[data-id="q1"] input[data-qchamp]')].find((c) => c.dataset.qchamp === ${JSON.stringify(k)})`;
const GLISSER = (de, vers) => `(() => {
  const li = (k) => [...document.querySelectorAll('.q-fen[data-id="q1"] .q-col')].find((x) => x.dataset.qcolk === k);
  const s = li(${JSON.stringify(de)}), t = li(${JSON.stringify(vers)}), dt = new DataTransfer(), r = t.getBoundingClientRect();
  s.querySelector('.q-grip').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  s.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  const o = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 2, clientY: r.top + r.height / 2 };
  t.dispatchEvent(new DragEvent('dragover', o)); t.dispatchEvent(new DragEvent('drop', o));
  s.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  return true; })()`;

export const nom = 'champs des cartes de requête';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const etat = () => evalue(ETAT);
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  const touche = async (key, code, mods = 0) => { for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: { ArrowUp: 38, ArrowDown: 40, ' ': 32, Escape: 27 }[key], modifiers: mods }); await attendre(50); };

  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(50);
  if (await evalue(MODE)) { await evalue(basculer); await attendre(50); }
  attendu('lecture : aucun réglage', !(await evalue(`!!document.querySelector('.q-puces, [data-qchamp]')`)), 'réglage visible');
  let e = await etat();
  attendu('lecture : champs d\'avant, sans Attend ; Écrire en pointillés', e.cartes.join('|') === 'Écrire:kb-tx,kb-who,q-src:bloquée|Relire:q-src|Valider:q-src', e.cartes);
  await evalue(basculer); await attendre(80);
  const ouvrir = async (cle) => { await evalue(`document.querySelector('.blk[data-id="q1"] [data-qpuce="${cle}"]').click()`); await attendre(80); };
  attendu('édition : puce des champs', await evalue(`document.querySelector('.blk[data-id="q1"] [data-qpuce="cols"]').textContent`) === 'Cartes : 5 champs', 'puce');
  await ouvrir('cols');

  e = await etat();
  attendu('édition : champs dans l\'ordre, Attend décoché', e.cases.join() === 'texte+,priorite+,echeance+,responsable+,source+,attend-', e.cases);

  // cocher Attend au clavier : une étape nommée, focus gardé
  await evalue(`${caseDe('attend')}.focus()`); await touche(' ', 'Space');
  e = await etat();
  attendu('cocher Attend : ligne Attend sur la carte', e.cartes[0] === 'Écrire:kb-tx,kb-who,q-src,kb-wait:bloquée', e.cartes);
  attendu('cocher Attend : champ champs', JSON.stringify(e.champs) === '{"masques":[],"ordre":[]}', e.champs);
  attendu('cocher Attend : libellé d\'Annuler', /Requête « Suivi » : champs des cartes modifiés/.test(e.annuler), e.annuler);
  attendu('cocher Attend : focus gardé', e.focus === 'attend', e.focus);

  // Alt+↑ sur Attend : passe avant Source ; puis poignée : Source avant Texte
  await touche('ArrowUp', 'ArrowUp', 1);
  e = await etat(); attendu('Alt+↑ : Attend avant Source', e.cartes[0] === 'Écrire:kb-tx,kb-who,kb-wait,q-src:bloquée' && e.focus === 'attend', e);
  await evalue(GLISSER('source', 'texte')); await attendre(80);
  e = await etat(); attendu('poignée : Source en tête', e.cartes[0] === 'Écrire:q-src,kb-tx,kb-who,kb-wait:bloquée' && e.cases[0] === 'source+', e);

  // « + Filtre » → Bloquées : un filtre posé tout de suite, une étape « filtres modifiés », un Ctrl+Z le retire
  await touche('Escape', 'Escape');
  await ouvrir('plus');
  await evalue(`document.querySelector('.q-fen [data-qfiltre="bloquees"]').click()`); await attendre(80);
  attendu('Bloquées : puce posée, sa fenêtre ouverte', await evalue(`document.querySelector('.q-fen h4').textContent === 'Bloquées' && document.querySelector('.blk[data-id="q1"] [data-qpuce^="f:"]').textContent === 'Bloquées'`), 'puce');
  await touche('Escape', 'Escape');
  e = await etat();
  attendu('bloquées seulement : Écrire seule', e.bloquees && e.cartes.length === 1 && e.cartes[0].startsWith('Écrire:'), e);
  attendu('bloquées seulement : libellé', /Requête « Suivi » : filtres modifiés/.test(e.annuler), e.annuler);
  await evalue(`document.querySelector('#ui [data-ui=undo]').click()`); await attendre(80);
  e = await etat(); attendu('Ctrl+Z : filtre retiré', !e.bloquees && e.cartes.length === 3, e);

  // téléphone : ligne de puces et fenêtre des champs sans défilement de côté
  await ecran(360, true); await attendre(120); await ouvrir('cols');
  const deborde = await evalue(`document.documentElement.scrollWidth - innerWidth`);
  attendu('360 px : la page ne défile pas de côté avec les champs des cartes', deborde <= 0 && await evalue(`!!document.querySelector('[data-qchamp]')`), deborde);
  await ecran(1000, false);
}
