// Sujet : bloc texte (lignes de texte). Insertion par le menu et par « / », clavier des lignes (Entrée, Maj+Entrée,
// Tab et Maj+Tab sur une sélection, Retour arrière, Suppr), sélection sur plusieurs lignes, lecture.
// Vérifié par le document enregistré (window.ardoise.doc). Origine : spec bloc-texte, ticket 02.

const L = (html, lv) => (lv ? { html, lv } : { html });
const doc = (blocks) => ({ title: 'Texte', pages: [{ id: 'p1', title: 'Accueil', blocks }] });
const LIGNES = (bid) => `JSON.stringify(((window.ardoise.doc.pages[0].blocks.find((b) => b.id === ${JSON.stringify(bid)})) || {}).lignes)`;
const BLOCS = `JSON.stringify(window.ardoise.doc.pages[0].blocks.map((b) => b.type === 'texte' ? ['texte', b.lignes] : [b.type, b.html]))`;
// position (ligne i, caractère n) dans le champ d'un bloc texte
const POS = `const pos = (bid, i, n) => { const el = document.querySelector('.fld[data-b="' + bid + '"]'), lg = el.querySelectorAll('.lg')[i];
  const w = document.createTreeWalker(lg, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) { if (n <= t.length) return [t, n]; n -= t.length; } return [lg, 0]; };`;
const curseur = (bid, i, n) => `(() => { ${POS} document.querySelector('.fld[data-b="${bid}"]').focus(); const p = pos('${bid}', ${i}, ${n}), r = document.createRange();
  r.setStart(p[0], p[1]); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
const choisir = (bid, i0, n0, i1, n1) => `(() => { ${POS} document.querySelector('.fld[data-b="${bid}"]').focus(); const a = pos('${bid}', ${i0}, ${n0}), b = pos('${bid}', ${i1}, ${n1}), r = document.createRange();
  r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return s.toString(); })()`;

export const nom = 'bloc texte';
export default async function ({ ecran, charger, evalue, cdp, attendre, visibles, ordreEcran, mesure, echec }) {
  const touche = async (key, code, vk, modifiers = 0) => {
    for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers });
    await attendre(80);
  };
  const ENTREE = ['Enter', 'Enter', 13], TAB = ['Tab', 'Tab', 9], RETOUR = ['Backspace', 'Backspace', 8], SUPPR = ['Delete', 'Delete', 46];
  const charge = async (blocks) => { if (!(await evalue(`window.ardoise.load(${JSON.stringify(doc(blocks))})`))) throw new Error('document refusé'); await attendre(120); };
  const lignes = async (bid) => JSON.parse((await evalue(LIGNES(bid))) || 'null');
  const verifie = async (cas, bid, attendu) => { mesure(); const l = await lignes(bid); if (JSON.stringify(l) !== JSON.stringify(attendu)) echec(cas + ' : ' + JSON.stringify(l) + ' au lieu de ' + JSON.stringify(attendu)); };
  await ecran(1000, false);
  await charger();

  // insertion par le menu « + » : « Texte » est le premier bloc proposé
  await charge([{ id: 't1', type: 'texte', lignes: [L('a')] }]);
  await evalue(`document.querySelector('#ui [data-ui="add"]').click()`); await attendre(150);
  mesure();
  const menu = await ordreEcran('.pop .mi');
  if (!/^≡\s*Texte/.test(menu[0] || '')) echec('menu d\'insertion : premier bloc ' + JSON.stringify(menu[0]));
  await touche(...ENTREE); await attendre(100);
  mesure();
  const types = JSON.parse(await evalue(BLOCS)).map((b) => b[0]);
  if (types.filter((t) => t === 'texte').length !== 2) echec('menu d\'insertion : blocs ' + JSON.stringify(types));

  // « / » dans un bloc texte vide : menu d'insertion, au clavier puis au clavier virtuel ; choisir un titre remplace le bloc
  for (const virtuel of [false, true]) {
    await charge([{ id: 't1', type: 'texte', lignes: [L('a')] }, { id: 't2', type: 'texte', lignes: [L('')] }]);
    await evalue(curseur('t2', 0, 0));
    if (virtuel) { await cdp('Input.insertText', { text: '/' }); await attendre(120); } else await touche('/', 'Slash', 191);
    mesure();
    const m = await ordreEcran('.pop .mi');
    if (!/^≡\s*Texte/.test(m[0] || '')) { echec('« / »' + (virtuel ? ' (clavier virtuel)' : '') + ' : menu ' + JSON.stringify(m.slice(0, 2))); continue; }
    await evalue(`(() => { const q = document.querySelector('.pop .menu-q'); q.value = 'Titre de section'; q.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await attendre(80); await touche(...ENTREE);
    mesure();
    const bl = JSON.parse(await evalue(BLOCS));
    if (bl.length !== 2 || bl[1][0] !== 'h2') echec('« / »' + (virtuel ? ' (clavier virtuel)' : '') + ' : blocs ' + JSON.stringify(bl));
  }
  // « / » dans un bloc texte non vide : un caractère comme un autre
  await charge([{ id: 't1', type: 'texte', lignes: [L('a'), L('')] }]);
  await evalue(curseur('t1', 1, 0)); await cdp('Input.insertText', { text: '/' }); await attendre(100);
  mesure();
  if (await evalue(`!!document.querySelector('.pop .mi')`)) echec('« / » dans un bloc non vide : le menu s\'ouvre');
  await verifie('« / » dans un bloc non vide', 't1', [L('a'), L('/')]);
  // « / » au clavier virtuel sur une puce ou une case seule et vide : un caractère, comme au clavier physique (revue du lot)
  for (const genre of ['puce', 'case']) {
    await charge([{ id: 't1', type: 'texte', lignes: [{ html: '', genre }] }]);
    await evalue(curseur('t1', 0, 0)); await cdp('Input.insertText', { text: '/' }); await attendre(120);
    mesure();
    if ((await visibles('.pop .mi')).length) echec('« / » au clavier virtuel dans une ' + genre + ' vide : le menu s\'ouvre');
    await verifie('« / » au clavier virtuel dans une ' + genre + ' vide', 't1', [{ html: '/', genre }]);
  }

  // Entrée au milieu d'une ligne en retrait : deux lignes du même niveau ; la saisie continue dans la seconde
  await charge([{ id: 't1', type: 'texte', lignes: [L('abcdef', 2)] }]);
  await evalue(curseur('t1', 0, 3)); await touche(...ENTREE);
  await cdp('Input.insertText', { text: 'X' }); await attendre(80);
  await verifie('Entrée au milieu', 't1', [L('abc', 2), L('Xdef', 2)]);

  // Entrée sur une ligne vide en retrait, en dernière ligne : elle remonte d'un niveau, puis crée un bloc texte neuf
  await charge([{ id: 't1', type: 'texte', lignes: [L('a'), L('', 1)] }]);
  await evalue(curseur('t1', 1, 0)); await touche(...ENTREE);
  await verifie('Entrée sur une ligne vide en retrait', 't1', [L('a'), L('')]);
  await touche(...ENTREE);
  await verifie('Entrée sur la ligne vide finale', 't1', [L('a')]);
  mesure();
  let bl = JSON.parse(await evalue(BLOCS));
  if (bl.length !== 2 || bl[1][0] !== 'texte' || JSON.stringify(bl[1][1]) !== '[{"html":""}]') echec('Entrée sur la ligne vide finale : blocs ' + JSON.stringify(bl));
  if (!(await evalue(`document.activeElement.dataset.b === window.ardoise.doc.pages[0].blocks[1].id`))) echec('Entrée sur la ligne vide finale : curseur hors du bloc neuf');
  // bloc d'une seule ligne vide : un bloc neuf, sans rien retirer
  await charge([{ id: 't1', type: 'texte', lignes: [L('')] }]);
  await evalue(curseur('t1', 0, 0)); await touche(...ENTREE);
  await verifie('Entrée dans un bloc vide', 't1', [L('')]);
  mesure();
  if (JSON.parse(await evalue(BLOCS)).length !== 2) echec('Entrée dans un bloc vide : pas de bloc neuf');

  // Maj+Entrée : saut dans la ligne
  await charge([{ id: 't1', type: 'texte', lignes: [L('ab')] }]);
  await evalue(curseur('t1', 0, 1)); await touche(...ENTREE, 8);
  await verifie('Maj+Entrée', 't1', [L('a<br>b')]);

  // Tab deux fois puis Maj+Tab sur trois lignes sélectionnées : un niveau ; la quatrième ne bouge pas ; sélection gardée
  await charge([{ id: 't1', type: 'texte', lignes: [L('un'), L('deux', 1), L('trois'), L('quatre')] }]);
  const avant = await evalue(choisir('t1', 0, 1, 2, 2));
  await touche(...TAB); await touche(...TAB); await touche(...TAB, 8);
  await verifie('Tab, Tab, Maj+Tab', 't1', [L('un', 1), L('deux', 2), L('trois', 1), L('quatre')]);
  mesure();
  const apres = await evalue('getSelection().toString()');
  if (apres !== avant) echec('Tab : sélection ' + JSON.stringify(apres) + ' au lieu de ' + JSON.stringify(avant));
  // sélection qui finit au début de la ligne suivante (Maj+↓ depuis le début d'une ligne) : Tab ne touche pas cette ligne
  await charge([{ id: 't1', type: 'texte', lignes: [L('un'), L('deux'), L('trois')] }]);
  await evalue(curseur('t1', 0, 0)); await touche('ArrowDown', 'ArrowDown', 40, 8); await touche(...TAB);
  await verifie('Tab après Maj+↓', 't1', [L('un', 1), L('deux'), L('trois')]);
  // plafond à 6, plancher à 0
  await charge([{ id: 't1', type: 'texte', lignes: [L('a', 6), L('b')] }]);
  await evalue(choisir('t1', 0, 0, 1, 1)); await touche(...TAB);
  await verifie('Tab au niveau 6', 't1', [L('a', 6), L('b', 1)]);
  await touche(...TAB, 8); await touche(...TAB, 8);
  await verifie('Maj+Tab au niveau 0', 't1', [L('a', 4), L('b')]);

  // Retour arrière au début d'une ligne en retrait : un niveau de moins
  await charge([{ id: 't1', type: 'texte', lignes: [L('a'), L('b', 2)] }]);
  await evalue(curseur('t1', 1, 0)); await touche(...RETOUR);
  await verifie('Retour arrière en retrait', 't1', [L('a'), L('b', 1)]);
  // au niveau 0 : jonction à la ligne du dessus, qui garde ses réglages ; curseur à la jointure
  await charge([{ id: 't1', type: 'texte', lignes: [L('a', 1), L('b')] }]);
  await evalue(curseur('t1', 1, 0)); await touche(...RETOUR);
  await cdp('Input.insertText', { text: 'X' }); await attendre(80);
  await verifie('Retour arrière au niveau 0', 't1', [L('aXb', 1)]);
  // au début du bloc : jonction au bloc texte du dessus
  await charge([{ id: 't0', type: 'texte', lignes: [L('a'), L('b', 1)] }, { id: 't1', type: 'texte', lignes: [L('c'), L('d', 2)] }]);
  await evalue(curseur('t1', 0, 0)); await touche(...RETOUR);
  await cdp('Input.insertText', { text: 'X' }); await attendre(80);
  await verifie('Retour arrière vers un bloc texte', 't0', [L('a'), L('bXc', 1), L('d', 2)]);
  mesure();
  if (JSON.parse(await evalue(BLOCS)).length !== 1) echec('Retour arrière vers un bloc texte : le bloc reste');
  // vers un titre : seulement si le bloc n'a qu'une ligne
  await charge([{ id: 'h', type: 'h2', html: 'Titre' }, { id: 't1', type: 'texte', lignes: [L('c'), L('d')] }]);
  await evalue(curseur('t1', 0, 0)); await touche(...RETOUR);
  mesure();
  bl = JSON.parse(await evalue(BLOCS));
  if (bl.length !== 2 || bl[0][1] !== 'Titre') echec('Retour arrière vers un titre, deux lignes : ' + JSON.stringify(bl));
  await charge([{ id: 'h', type: 'h2', html: 'Titre' }, { id: 't1', type: 'texte', lignes: [L(' fin')] }]);
  await evalue(curseur('t1', 0, 0)); await touche(...RETOUR);
  mesure();
  bl = JSON.parse(await evalue(BLOCS));
  if (bl.length !== 1 || bl[0][1] !== 'Titre fin') echec('Retour arrière vers un titre, une ligne : ' + JSON.stringify(bl));
  // bloc vide : supprimé
  await charge([{ id: 't0', type: 'texte', lignes: [L('a')] }, { id: 't1', type: 'texte', lignes: [L('')] }]);
  await evalue(curseur('t1', 0, 0)); await touche(...RETOUR);
  mesure();
  bl = JSON.parse(await evalue(BLOCS));
  if (bl.length !== 1) echec('Retour arrière dans un bloc vide : ' + JSON.stringify(bl));

  // Suppr en fin de ligne : la ligne suivante est jointe
  await charge([{ id: 't1', type: 'texte', lignes: [L('a', 1), L('b', 2), L('c')] }]);
  await evalue(curseur('t1', 0, 1)); await touche(...SUPPR);
  await verifie('Suppr en fin de ligne', 't1', [L('ab', 1), L('c')]);

  // sélection sur plusieurs lignes : supprimer, couper, tout supprimer
  await charge([{ id: 't1', type: 'texte', lignes: [L('abc'), L('def', 1), L('ghi')] }]);
  await evalue(choisir('t1', 0, 1, 2, 1)); await touche(...RETOUR);
  await verifie('sélection supprimée', 't1', [L('ahi')]);
  await charge([{ id: 't1', type: 'texte', lignes: [L('abc'), L('def', 1), L('ghi')] }]);
  // couper : la commande d'édition du navigateur, lancée comme par un geste de l'utilisateur
  await evalue(choisir('t1', 1, 1, 2, 1)); await cdp('Runtime.evaluate', { expression: 'document.execCommand("cut")', userGesture: true }); await attendre(80);
  await verifie('sélection coupée', 't1', [L('abc'), L('dhi', 1)]);
  await charge([{ id: 't1', type: 'texte', lignes: [L('abc'), L('def', 1), L('ghi')] }]);
  await evalue(choisir('t1', 0, 0, 2, 3)); await touche(...SUPPR);
  await verifie('tout supprimé', 't1', [L('')]);
  await cdp('Input.insertText', { text: 'Z' }); await attendre(80);
  await verifie('saisie après tout supprimé', 't1', [L('Z')]);
  mesure();
  if (!(await evalue(`(() => { const el = document.querySelector('.fld[data-b="t1"]'); return [...el.childNodes].every((n) => n.nodeType === 1 && n.classList.contains('lg')); })()`))) echec('tout supprimé : nœuds hors des lignes');

  // Effacer (ticket 01) sur une sélection de deux lignes : le gras part de la sélection seule, les lignes et leurs niveaux restent
  await charge([{ id: 't1', type: 'texte', lignes: [L('<b>abc</b>'), L('<b>def</b>', 1)] }]);
  await evalue(choisir('t1', 0, 1, 1, 2)); await attendre(250);
  const bouton = await evalue(`(() => { const b = document.querySelector('.bmf [data-mf="clear"]'); if (!b || !b.getClientRects().length) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!bouton) echec('Effacer : bouton absent de l\'écran');
  else {
    for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: bouton.x, y: bouton.y, button: 'left', clickCount: 1 });
    await attendre(300);
    await verifie('Effacer sur deux lignes', 't1', [L('<b>a</b>bc'), L('de<b>f</b>', 1)]);
  }

  // lecture : retrait visible, aucune commande d'édition
  await charge([{ id: 't1', type: 'texte', lignes: [L('zéro'), L('deux', 2)] }]);
  await evalue(`document.querySelector('#ui [data-ui="mode"]').click()`); await attendre(150);
  mesure();
  const x = await evalue(`[...document.querySelectorAll('.texte .lg')].map((l) => l.getBoundingClientRect().left)`);
  if (!(x.length === 2 && x[1] - x[0] > 20)) echec('lecture : positions des lignes ' + JSON.stringify(x));
  if ((await visibles('.texte[contenteditable], .texte .fld')).length) echec('lecture : champ éditable');
  await evalue(`document.querySelector('#ui [data-ui="mode"]').click()`); await attendre(100);
}
