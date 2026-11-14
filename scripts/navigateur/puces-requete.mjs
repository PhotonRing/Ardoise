// Sujet : ligne de puces du bloc requête et ses fenêtres (spec requetes-avancees, ticket 03).
// Chaque puce ouvre sa fenêtre sous elle ; second clic, clic ailleurs et Échap la ferment (Échap rend le focus à la puce) ;
// Tab et Entrée au clavier ; poser un filtre par « + Filtre », le retirer par × ; tous les changements d'une fenêtre ouverte
// forment une étape nommée qu'un seul Ctrl+Z défait ; la fenêtre se regarnit après un changement venu d'ailleurs ; 360 px.

const KB = { id: 'kb', type: 'kanban', cols: [
  { id: 'c1', title: 'En cours', cards: [{ id: 'k1', title: 'Écrire', who: 'Alice', prio: 'p1' }, { id: 'k2', title: 'Relire', who: 'Bob', prio: 'p3' }] },
  { id: 'c2', title: 'Fait', cards: [{ id: 'k3', title: 'Valider', prio: 'p2' }] },
] };
const TABLE = { id: 't1', type: 'table', rows: [['Réf', 'Incident', 'Gravité'], ['1', 'Panne <span class="pill">urgent</span>', 'haute'], ['2', 'Lenteur <span class="pill">client</span>', 'basse'], ['3', 'Coupure <span class="pill">urgent</span> <span class="pill">client</span>', 'moyenne']] };
const DOC = { title: 'Puces', pages: [{ id: 'p1', title: 'Accueil', blocks: [TABLE, KB,
  { id: 'q1', type: 'query', title: 'Incidents', src: 'table', scope: 'doc', view: 'table' },
  { id: 'q2', type: 'query', title: 'Cartes', src: 'kanban', scope: 'doc', view: 'table' },
  { id: 'n1', type: 'p', html: 'Note' },
] }] };
const MODE = `document.documentElement.classList.contains('is-edit')`;
const basculer = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
const ETAT = (q) => `(() => {
  const f = document.querySelector('.q-fen'), a = document.activeElement, b = window.ardoise.doc.pages[0].blocks.find((x) => x.id === ${JSON.stringify(q)});
  return { puces: [...document.querySelectorAll('.blk[data-id=${JSON.stringify(q)}] .q-puce')].map((x) => x.textContent.trim()),
    fen: f ? f.dataset.id + ':' + f.querySelector('h4').textContent : null, ouverte: (document.querySelector('.q-puce[aria-expanded="true"]') || {}).textContent || null,
    focus: a && a.dataset ? a.dataset.qpuce || (a.closest && a.closest('.q-fen') ? 'fenêtre' : null) : null,
    lignes: [...document.querySelectorAll('.blk[data-id=${JSON.stringify(q)}] .q-res tbody tr')].map((tr) => tr.cells[0].textContent.trim()),
    bloc: JSON.parse(JSON.stringify(b)), annuler: (document.querySelector('#ui [data-ui=undo]') || {}).title || '' };
})()`;
const puce = (q, cle) => `document.querySelector('.blk[data-id="${q}"] [data-qpuce="${cle}"]')`;

export const nom = 'ligne de puces de requête';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  const touche = async (key, code, mods = 0) => { for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: { Escape: 27, Enter: 13, Tab: 9 }[key], modifiers: mods, ...(key === 'Enter' && type === 'keyDown' ? { text: '\r' } : {}) }); await attendre(60); };
  // vrai clic de souris au centre d'un élément (ou en un point), ramené au milieu de l'écran s'il est caché (barre du bloc collante)
  const cliquer = async (expr) => {
    const p = typeof expr === 'string' ? await evalue(`(() => { const el = ${expr}, h = el.getBoundingClientRect(), d = document.elementFromPoint(h.left + h.width / 2, h.top + h.height / 2); if (h.top < 0 || h.bottom > innerHeight || !d || !el.contains(d)) el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`) : expr;
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
    await attendre(90);
  };
  const etat = (q = 'q1') => evalue(ETAT(q));

  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(50);
  if (await evalue(MODE)) { await evalue(basculer); await attendre(50); }
  attendu('lecture : aucune puce', !(await evalue(`!!document.querySelector('.q-puces')`)), 'puces en lecture');
  await evalue(basculer); await attendre(80);

  let e = await etat();
  attendu('édition : la ligne se lit comme une phrase', e.puces.join('|') === 'Chercher Lignes de tableaux|dans Tout le document|+ Filtre|Tableau|Toutes les colonnes|Sans tri', e.puces);

  // chaque puce ouvre sa fenêtre sous elle ; un second clic la ferme
  const titres = { src: 'Chercher', scope: 'Chercher dans', plus: 'Ajouter un filtre', view: 'Vue', cols: 'Colonnes affichées', sort: 'Trier' };
  for (const [cle, titre] of Object.entries(titres)) {
    await cliquer(puce('q1', cle));
    e = await etat();
    const sous = await evalue(`(() => { const p = ${puce('q1', cle)}.getBoundingClientRect(), f = document.querySelector('.q-fen').getBoundingClientRect(); return (f.top >= p.bottom && f.top - p.bottom < 20) || (f.bottom <= p.top && p.top - f.bottom < 20); })()`);
    attendu('puce ' + cle + ' : fenêtre ouverte contre elle (dessous, ou dessus faute de place)', e.fen === 'q1:' + titre && sous && e.ouverte, e);
    await cliquer(puce('q1', cle));
    attendu('puce ' + cle + ' : second clic ferme', !(await evalue(`!!document.querySelector('.q-fen')`)), cle);
  }

  // + Filtre → Pastilles : recherche, deux pastilles, « toutes » ; la fenêtre reste ouverte ; une étape, un Ctrl+Z
  await cliquer(puce('q1', 'plus'));
  attendu('« + Filtre » sur des lignes de tableaux : seulement les pastilles', (await evalue(`[...document.querySelectorAll('.q-fen [data-qfiltre]')].map((x) => x.dataset.qfiltre).join()`)) === 'tags', 'filtres proposés');
  await cliquer(`document.querySelector('.q-fen [data-qfiltre="tags"]')`);
  await cliquer(`document.querySelector('.q-fen .q-fen-q')`);
  await cdp('Input.insertText', { text: 'urg' }); await attendre(80);
  attendu('recherche : seule « urgent » reste', (await evalue(`[...document.querySelectorAll('.q-fen .q-chip')].filter((c) => c.getClientRects().length > 0).map((c) => c.textContent).join()`)) === 'urgent', 'recherche');
  await cliquer(`document.querySelector('.q-fen .q-chip[data-tag="urgent"]')`);
  e = await etat();
  attendu('pastille posée : puce du filtre, résultat filtré, fenêtre ouverte sous la nouvelle puce', e.puces[2] === 'urgent' && e.lignes.join() === '1,3' && e.fen === 'q1:Pastilles' && e.ouverte === 'urgent', e);
  attendu('recherche gardée après le rendu', (await evalue(`document.querySelector('.q-fen .q-fen-q').value`)) === 'urg', 'recherche');
  await evalue(`(() => { const q = document.querySelector('.q-fen .q-fen-q'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await cliquer(`document.querySelector('.q-fen .q-chip[data-tag="client"]')`);
  await cliquer(`document.querySelector('.q-fen [data-qset="match"][data-v="all"]')`);
  e = await etat();
  attendu('« toutes » : urgent et client', e.puces[2] === 'urgent et client' && e.lignes.join() === '3' && e.bloc.match === 'all', e);
  attendu('une seule étape nommée pour la fenêtre', /^Annuler : Accueil · Requête « Incidents » : filtres modifiés \(/.test(e.annuler), e.annuler);
  // clic ailleurs : fermée ; un seul Ctrl+Z défait toute la fenêtre
  await cliquer({ x: 990, y: 740 });
  attendu('clic ailleurs : fenêtre fermée', !(await evalue(`!!document.querySelector('.q-fen')`)), 'fenêtre');
  await touche('z', 'KeyZ', 2);
  e = await etat();
  attendu('un Ctrl+Z : plus aucun filtre', !(e.bloc.tags || []).length && e.lignes.join() === '1,2,3' && e.puces[2] === '+ Filtre', e);
  await touche('z', 'KeyZ', 10);   // Ctrl+Maj+Z : rétablit le filtre
  e = await etat(); attendu('rétablir : filtre revenu', e.puces[2] === 'urgent et client', e.puces);

  // × retire le filtre : champ supprimé
  await cliquer(`document.querySelector('.blk[data-id="q1"] [data-qretirer="tags"]')`);
  e = await etat(); attendu('× : champ supprimé', !('tags' in e.bloc) && !('match' in e.bloc) && e.puces[2] === '+ Filtre', e.bloc);

  // clavier : Tab jusqu'à la puce du tri, Entrée ouvre (focus dans la fenêtre), Échap ferme et rend le focus à la puce
  await evalue(`${puce('q1', 'cols')}.focus()`); await touche('Tab', 'Tab');
  attendu('Tab : puce suivante', (await etat()).focus === 'sort', 'focus');
  await touche('Enter', 'Enter');
  e = await etat(); attendu('Entrée : fenêtre du tri ouverte, focus dedans', e.fen === 'q1:Trier' && e.focus === 'fenêtre', e);
  await evalue(`(() => { const s = document.querySelector('.q-fen select[data-prop=sortBy]'); s.value = 'c:gravité'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await attendre(80);
  await cliquer(`document.querySelector('.q-fen [data-qset="sortDir"][data-v="desc"]')`);
  e = await etat(); attendu('tri : puce et résultat suivent, fenêtre ouverte', e.puces[5] === 'Tri : Gravité ↓' && e.lignes.join() === '3,1,2' && e.fen === 'q1:Trier', e);
  await touche('Escape', 'Escape');
  e = await etat(); attendu('Échap : fermée, focus sur la puce', !e.fen && e.focus === 'sort', e);
  attendu('tri : une étape « tri modifié »', /Requête « Incidents » : tri modifié \(/.test(e.annuler), e.annuler);

  // changement venu d'ailleurs pendant que la fenêtre est ouverte : elle se regarnit sans se fermer
  await cliquer(puce('q1', 'cols'));
  const d2 = JSON.parse(JSON.stringify(DOC)); d2.pages[0].blocks[0].rows.forEach((r, i) => r.push(i ? 'x' : 'Service'));
  d2.pages[0].blocks[2].sortBy = 'c:gravité'; d2.pages[0].blocks[2].sortDir = 'desc';
  await evalue(`window.ardoise.load(${JSON.stringify(d2)})`); await attendre(100);
  e = await etat();
  attendu('changement externe : fenêtre regarnie, toujours ouverte', e.fen === 'q1:Colonnes affichées' && (await evalue(`[...document.querySelectorAll('.q-fen input[data-qcol]')].map((c) => c.dataset.qcol).join()`)).includes('service') && e.puces[4] === 'Toutes les colonnes', e);
  await touche('Escape', 'Escape');

  // cartes de kanban : « + Filtre » propose les filtres de la source ; priorité posée puis retirée
  await cliquer(puce('q2', 'plus'));
  attendu('kanban : filtres proposés', (await evalue(`[...document.querySelectorAll('.q-fen [data-qfiltre]')].map((x) => x.dataset.qfiltre).join()`)) === 'tags,col,kbWho,kbPrio,kbDue,bloquees', 'filtres');
  await cliquer(`document.querySelector('.q-fen [data-qfiltre="kbPrio"]')`);
  await cliquer(`document.querySelector('.q-fen [data-qset="kbPrio"][data-v="p12"]')`);
  e = await etat('q2');
  attendu('priorité P1 ou P2 : puce et cartes', e.puces[2] === 'P1 ou P2' && e.lignes.join() === 'Écrire,Valider' && e.ouverte === 'P1 ou P2', e);
  await touche('Escape', 'Escape');
  attendu('Échap après « + Filtre » : focus sur la puce posée', (await etat('q2')).focus === 'f:kbPrio', 'focus');
  await cliquer(`document.querySelector('.blk[data-id="q2"] [data-qretirer="kbPrio"]')`);
  e = await etat('q2'); attendu('× : priorité retirée', !('kbPrio' in e.bloc) && e.lignes.length === 3, e.bloc);

  // dernière pastille décochée : le filtre est retiré (ni tableau vide, ni « toutes » laissé), la fenêtre reste sous « + Filtre »
  await cliquer(puce('q1', 'plus'));
  await cliquer(`document.querySelector('.q-fen [data-qfiltre="tags"]')`);
  await cliquer(`document.querySelector('.q-fen .q-chip[data-tag="urgent"]')`);
  await cliquer(`document.querySelector('.q-fen .q-chip[data-tag="client"]')`);
  await cliquer(`document.querySelector('.q-fen [data-qset="match"][data-v="all"]')`);
  await cliquer(`document.querySelector('.q-fen .q-chip[data-tag="urgent"]')`);
  await cliquer(`document.querySelector('.q-fen .q-chip[data-tag="client"]')`);
  e = await etat();
  attendu('dernière pastille décochée : filtre retiré', !('tags' in e.bloc) && !('match' in e.bloc) && e.puces[2] === '+ Filtre' && e.lignes.join() === '3,1,2' && e.fen === 'q1:Pastilles', e);
  await touche('Escape', 'Escape');

  // fenêtre ouverte puis glisser d'une ligne de tableau par sa poignée : la fenêtre se ferme au début du geste, qui est sa propre
  // étape ; un Ctrl+Z défait le glisser seul et garde les colonnes choisies
  const visible = `(() => { const f = document.querySelector('.q-fen'); return !!f && f.getClientRects().length > 0; })()`;
  const cellules = `[...document.querySelectorAll('.blk[data-id="t1"] tr')].map((tr) => tr.cells[0].textContent.trim()).join()`;
  await cliquer(puce('q1', 'cols'));
  await cliquer(`document.querySelector('.q-fen input[data-qcol="gravité"]')`);
  e = await etat(); attendu('colonne Gravité décochée', e.puces[4] !== 'Toutes les colonnes' && /colonnes modifiées/.test(e.annuler), e);
  const c1 = await evalue(`(() => { const c = document.querySelector('.blk[data-id="t1"] [data-k="rows.1.1"]'); c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(), r3 = document.querySelector('.blk[data-id="t1"] [data-k="rows.3.1"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, y3: r3.bottom - 2 }; })()`);
  await attendre(60);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c1.x, y: c1.y, button: 'none' }); await attendre(60);
  const g = await evalue(`(() => { const g = document.querySelector('.tgrip-row'), r = g.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`);
  if (!g) echec('poignée de ligne invisible');
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: g.x, y: g.y, button: 'none' }); await attendre(40);
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: g.x, y: g.y, button: 'left', clickCount: 1 }); await attendre(60);
  attendu('glisser commencé : fenêtre fermée à l\'écran', !(await evalue(visible)), 'fenêtre visible');
  for (const y of [g.y + 20, c1.y3]) { await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: g.x, y, button: 'left', buttons: 1 }); await attendre(40); }
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: g.x, y: c1.y3, button: 'left', clickCount: 1 }); await attendre(80);
  attendu('ligne glissée en bas', (await evalue(cellules)) === 'Réf,2,3,1', await evalue(cellules));
  await touche('z', 'KeyZ', 2);
  e = await etat();
  attendu('Ctrl+Z : le glisser seul est défait, Gravité reste masquée', (await evalue(cellules)) === 'Réf,1,2,3' && e.puces[4] !== 'Toutes les colonnes' && JSON.stringify(e.bloc.colonnes || null).includes("gravité"), { c: await evalue(cellules), e });
  await touche('z', 'KeyZ', 2);
  e = await etat(); attendu('second Ctrl+Z : colonnes rendues', e.puces[4] === 'Toutes les colonnes', e.puces);

  // fenêtre ouverte, frappe hors d'elle (focus dans un paragraphe sans passer par la fenêtre) : l'étape de la fenêtre est close avant
  await cliquer(puce('q1', 'cols'));
  await cliquer(`document.querySelector('.q-fen input[data-qcol="gravité"]')`);
  await evalue(`(() => { document.activeElement.blur(); const n = document.querySelector('.blk[data-id="n1"] [contenteditable]'); n.focus(); return true; })()`);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38, modifiers: 1 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38, modifiers: 1 }); await attendre(80);
  const ordre = `window.ardoise.doc.pages[0].blocks.map((b) => b.id).join()`;
  attendu('Alt+↑ : paragraphe monté, fenêtre fermée', (await evalue(ordre)) === 't1,kb,q1,n1,q2' && !(await evalue(visible)), await evalue(ordre));
  await touche('z', 'KeyZ', 2);
  e = await etat();
  attendu('Ctrl+Z : seul le déplacement est défait', (await evalue(ordre)) === 't1,kb,q1,q2,n1' && e.puces[4] !== 'Toutes les colonnes', { o: await evalue(ordre), p: e.puces });
  await touche('z', 'KeyZ', 2);

  // téléphone : la ligne passe à la ligne, la fenêtre prend la largeur du bloc, jamais de défilement de page
  await ecran(360, true); await evalue(basculer); await attendre(60); await evalue(basculer); await attendre(120);
  await cliquer(puce('q2', 'view'));
  const m = await evalue(`(() => { const f = document.querySelector('.q-fen').getBoundingClientRect(), q = document.querySelector('.blk[data-id="q2"] .q-blk').getBoundingClientRect();
    return { page: document.documentElement.scrollWidth - innerWidth, f: [Math.round(f.left), Math.round(f.width)], q: [Math.round(q.left), Math.round(q.width)] }; })()`);
  attendu('360 px : fenêtre de la largeur du bloc, sans défilement de page', m.page <= 0 && Math.abs(m.f[0] - m.q[0]) <= 1 && Math.abs(m.f[1] - m.q[1]) <= 1, m);
  await touche('Escape', 'Escape');
  await ecran(1000, false);
}
