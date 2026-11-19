// Sujet : menus du bloc texte. Clic droit (ou touche Menu) sur une case : « Cochées à la fin de la liste », puis Ctrl+Z en une
// étape ; Ctrl + clic droit, ligne de texte et lecture gardent le menu natif. Menu ⋯ d'une Liste à cocher dans un groupe :
// « Convertir en texte », Ctrl+Z, lien interne vers le bloc qui suit. Liste, Liste à cocher et Sous-titre absents du menu
// d'insertion mais encore modifiables. Origine : spec bloc-texte, ticket 11.

const doc = (blocks) => ({ title: 'Menus', pages: [{ id: 'p1', title: 'Accueil', blocks }] });
const BLOC = (bid) => `(window.ardoise.doc.pages[0].blocks.flatMap((b) => [b].concat(b.blocks || [])).find((b) => b.id === ${JSON.stringify(bid)}) || null)`;
const C = (html, done, lv) => { const o = { html, genre: 'case' }; if (lv) o.lv = lv; if (done) o.done = true; return o; };
const CASES = [{ html: 'titre' }, C('a', true), C('a1', false, 1), C('b'), C('c', true), C('d')];
// centre du texte de la ligne i d'un bloc texte (hors de la marge où la case est dessinée)
const ligneEl = (bid, i) => `document.querySelectorAll('.fld[data-b="${bid}"] > .lg')[${i}]`;
const centreLigne = (bid, i) => `(() => { const r = ${ligneEl(bid, i)}.getBoundingClientRect(); return { x: r.right - 20, y: r.top + r.height / 2 }; })()`;
const MENU = `(() => { const p = document.querySelector('#ui .pop'); return p ? [...p.querySelectorAll('.mi')].map((m) => m.textContent.trim()) : null; })()`;
const ANNULER = `(document.querySelector('#ui [data-ui=undo]') || {}).title || ''`;

export const nom = 'menus du bloc texte';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const touche = async (key, code, vk, modifiers = 0) => {
    for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers });
    await attendre(100);
  };
  const CTRL_Z = ['z', 'KeyZ', 90, 2], ECHAP = ['Escape', 'Escape', 27];
  const charge = async (blocks) => {
    if (!(await evalue(`window.ardoise.load(${JSON.stringify(doc(blocks))})`))) throw new Error('document refusé');
    await attendre(120);
    await evalue(`window.__natif = null; if (!window.__ecoute) { window.__ecoute = 1; window.addEventListener('contextmenu', (e) => { window.__natif = !e.defaultPrevented; }); } true`);
  };
  const bloc = async (bid) => evalue(`JSON.parse(JSON.stringify(${BLOC(bid)}))`);
  const textes = async (bid) => ((await bloc(bid)) || { lignes: [] }).lignes.map((l) => l.html);
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  const clicDroit = async (p, modifiers = 0) => {
    for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'right', clickCount: 1, modifiers });
    await attendre(100);
  };
  const choisir = (libelle) => evalue(`(() => { const m = [...document.querySelectorAll('#ui .pop .mi')].find((x) => x.textContent.trim() === ${JSON.stringify(libelle)}); if (m) m.click(); return !!m; })()`);
  await ecran(1000, false);
  await charger();

  // ---------- Cochées à la fin de la liste ----------
  await charge([{ id: 't1', type: 'texte', lignes: CASES }]);
  await clicDroit(await evalue(centreLigne('t1', 3)));
  let menu = await evalue(MENU);
  attendu('clic droit sur une case : le menu', JSON.stringify(menu) === JSON.stringify(['Cochées à la fin de la liste']), menu);
  attendu('clic droit sur une case : menu natif remplacé', (await evalue('window.__natif')) === false, await evalue('window.__natif'));
  attendu('le clic droit ne coche pas', !(await bloc('t1')).lignes[3].done, await bloc('t1'));
  attendu('entrée trouvée', await choisir('Cochées à la fin de la liste'), null);
  await attendre(150);
  let t = await textes('t1');
  attendu('rangement : cochées à la fin, sous-arbre avec sa case', JSON.stringify(t) === JSON.stringify(['titre', 'b', 'd', 'a', 'a1', 'c']), t);
  attendu('menu fermé, curseur dans le bloc', (await evalue(MENU)) === null && (await evalue(`document.activeElement.dataset.b`)) === 't1', await evalue(MENU));
  const lib = await evalue(ANNULER);
  attendu('libellé d\'annulation', /lignes réordonnées/.test(lib), lib);
  await touche(...CTRL_Z); await attendre(150);
  t = await textes('t1');
  attendu('un seul Ctrl+Z rend l\'ordre saisi', JSON.stringify(t) === JSON.stringify(CASES.map((l) => l.html)), t);

  // suite déjà rangée : entrée présente, sans effet ni étape
  await charge([{ id: 't1', type: 'texte', lignes: [C('x'), C('y', true)] }]);
  const avant = await evalue(ANNULER);
  await clicDroit(await evalue(centreLigne('t1', 0)));
  await choisir('Cochées à la fin de la liste'); await attendre(150);
  attendu('suite déjà rangée : sans effet', JSON.stringify(await textes('t1')) === '["x","y"]' && (await evalue(ANNULER)) === avant, [await textes('t1'), await evalue(ANNULER)]);

  // Ctrl + clic droit sur une case, clic droit sur une ligne de texte : menu natif
  await charge([{ id: 't1', type: 'texte', lignes: CASES }]);
  await clicDroit(await evalue(centreLigne('t1', 3)), 2);
  attendu('Ctrl + clic droit : menu natif', (await evalue(MENU)) === null && (await evalue('window.__natif')) === true, await evalue(MENU));
  await clicDroit(await evalue(centreLigne('t1', 0)));
  attendu('ligne de texte : menu natif', (await evalue(MENU)) === null && (await evalue('window.__natif')) === true, await evalue(MENU));

  // touche Menu, curseur dans une case : même menu, focus sur l'entrée ; Échap rend le curseur au bloc
  await evalue(`(() => { const lg = ${ligneEl('t1', 5)}; lg.parentNode.focus(); const r = document.createRange(); r.setStart(lg.firstChild, 1); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  await touche('ContextMenu', 'ContextMenu', 93);
  menu = await evalue(MENU);
  attendu('touche Menu : le menu', JSON.stringify(menu) === JSON.stringify(['Cochées à la fin de la liste']) && (await evalue(`!!document.activeElement.closest('#ui .pop')`)), menu);
  await touche(...ECHAP);
  attendu('Échap : menu fermé, curseur dans le bloc', (await evalue(MENU)) === null && (await evalue(`document.activeElement.dataset.b`)) === 't1', await evalue(MENU));
  await touche('F10', 'F10', 121, 8);
  attendu('Maj+F10 : le menu', JSON.stringify(await evalue(MENU)) === JSON.stringify(['Cochées à la fin de la liste']), await evalue(MENU));
  await touche(...ECHAP);
  await evalue(`(() => { const lg = ${ligneEl('t1', 0)}; const r = document.createRange(); r.setStart(lg.firstChild, 1); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  await touche('ContextMenu', 'ContextMenu', 93);
  attendu('touche Menu sur une ligne de texte : pas de menu d\'Ardoise', (await evalue(MENU)) === null, await evalue(MENU));

  // lecture : menu natif
  await evalue(`document.querySelector('#ui [data-ui="mode"]').click()`); await attendre(150);
  await clicDroit(await evalue(`(() => { const r = document.querySelectorAll('[data-tx="t1"] > .lg')[3].getBoundingClientRect(); return { x: r.right - 20, y: r.top + r.height / 2 }; })()`));
  attendu('lecture : menu natif', (await evalue(MENU)) === null && (await evalue('window.__natif')) === true, await evalue(MENU));
  await evalue(`document.querySelector('#ui [data-ui="mode"]').click()`); await attendre(150);

  // ---------- Convertir en texte ----------
  const LISTES = [
    { id: 'lien', type: 'texte', lignes: [{ html: '<a href="#pg-p1/c1">vers la liste</a>' }] },
    { id: 'g1', type: 'group', title: 'Courses', blocks: [{ id: 'av', type: 'texte', lignes: [{ html: 'avant' }] },
      { id: 'c1', type: 'check', order: 'doneLast', items: [{ html: 'Pain', done: true }, { html: 'complet', done: false, lv: 1 }, { html: 'Lait', done: false }] }] },
    { id: 's1', type: 'subtitle', html: 'Sous-titre' },
    { id: 'l1', type: 'list', ordered: true, items: [{ html: 'un' }, { html: 'deux', lv: 1 }] },
  ];
  await charge(LISTES);
  const convertir = () => evalue(`(() => { const m = [...document.querySelectorAll('#ui .pop .mi')].find((x) => /Convertir en texte$/.test(x.textContent)); if (m) m.click(); return !!m; })()`);
  const menuBloc = async (bid) => { await evalue(`document.querySelector('.blk[data-id="${bid}"] [data-act="menu-bloc"]').click(), true`); await attendre(100); return evalue(MENU); };
  menu = await menuBloc('c1');
  attendu('menu ⋯ d\'une Liste à cocher : Convertir en texte', menu && menu.some((x) => /Convertir en texte$/.test(x)), menu);
  await convertir();
  await attendre(150);
  let c1 = await bloc('c1');
  attendu('Liste à cocher → bloc texte, même identifiant, ordre saisi, coches', JSON.stringify(c1) === JSON.stringify({ id: 'c1', type: 'texte',
    lignes: [{ html: 'Pain', genre: 'case', done: true }, { html: 'complet', lv: 1, genre: 'case' }, { html: 'Lait', genre: 'case' }] }), c1);
  const ids = await evalue(`window.ardoise.doc.pages[0].blocks[1].blocks.map((b) => b.id).join()`);
  attendu('à sa place dans le groupe', ids === 'av,c1', ids);
  attendu('curseur dans le nouveau bloc', (await evalue(`document.activeElement.dataset.b`)) === 'c1', await evalue(`document.activeElement.dataset.b`));
  const libc = await evalue(ANNULER);
  attendu('libellé d\'annulation', /converti en texte/.test(libc), libc);
  // un lien interne vers le bloc le retrouve (Ctrl + clic en édition)
  await evalue(`location.hash = ''; document.querySelector('.fld[data-b="lien"] a').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })), true`);
  await attendre(200);
  const toastTxt = await evalue(`(() => { const t = document.querySelector('#ui .toast'); return t && t.style.display !== 'none' ? t.textContent : ''; })()`);
  attendu('lien interne : bloc trouvé', !/introuvable/.test(toastTxt) && (await evalue('location.hash')) === '#pg-p1/c1', [toastTxt, await evalue('location.hash')]);
  await evalue(`document.querySelector('.fld[data-b="c1"]').focus(), true`);
  await touche(...CTRL_Z); await attendre(150);
  c1 = await bloc('c1');
  attendu('Ctrl+Z rend la Liste à cocher', c1 && c1.type === 'check' && c1.order === 'doneLast' && c1.items.length === 3, c1);

  // Sous-titre et Liste numérotée
  await menuBloc('s1');
  await convertir(); await attendre(150);
  const s1 = await bloc('s1');
  attendu('Sous-titre → une ligne de sous-titre', JSON.stringify(s1) === JSON.stringify({ id: 's1', type: 'texte', lignes: [{ html: 'Sous-titre', genre: 'soustitre' }] }), s1);
  await menuBloc('l1');
  await convertir(); await attendre(150);
  const l1 = await bloc('l1');
  attendu('Liste numérotée → numéros', JSON.stringify(l1 && l1.lignes) === JSON.stringify([{ html: 'un', genre: 'numero' }, { html: 'deux', lv: 1, genre: 'numero' }]), l1);
  menu = await menuBloc('lien');
  attendu('pas de Convertir en texte sur un bloc texte', menu && !menu.some((x) => /Convertir en texte/.test(x)), menu);
  await touche(...ECHAP);

  // ---------- Menu d'insertion ----------
  await charge([{ id: 'v', type: 'texte', lignes: [{ html: '' }] }, { id: 'c2', type: 'check', items: [{ html: 'Pain', done: false }] }]);
  await evalue(`document.querySelector('.fld[data-b="v"]').focus(), true`);
  await cdp('Input.insertText', { text: '/' }); await attendre(150);
  const types = await evalue(`[...document.querySelectorAll('#ui .pop .mi[data-t]')].map((x) => x.dataset.t)`);
  attendu('menu d\'insertion sans Liste, Liste à cocher ni Sous-titre', types.length > 5 && !types.some((x) => ['list', 'check', 'subtitle', 'p'].includes(x)) && types[0] === 'texte', types);
  await evalue(`(() => { const q = document.querySelector('#ui .pop .menu-q'); q.value = 'liste'; q.dispatchEvent(new Event('input')); return true; })()`); await attendre(80);
  const liste = await evalue(`[...document.querySelectorAll('#ui .pop .mi[data-t]')].map((x) => x.dataset.t)`);
  attendu('« liste » propose Texte', liste[0] === 'texte', liste);
  await touche(...ECHAP);
  // une Liste à cocher existante reste modifiable
  await evalue(`(() => { const f = document.querySelector('.fld[data-b="c2"][data-k="items.0.html"]'); f.focus(); const r = document.createRange(); r.selectNodeContents(f); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  await cdp('Input.insertText', { text: ' complet' }); await attendre(150);
  const c2 = await bloc('c2');
  attendu('Liste à cocher existante modifiable', c2 && c2.items[0].html === 'Pain complet', c2);
}
