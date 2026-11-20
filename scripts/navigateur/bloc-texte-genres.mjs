// Sujet : genres de ligne d'un bloc texte (puce, numéro, case, sous-titre). Raccourcis puis Ctrl+Z, Entrée et Retour arrière
// selon le genre, sélecteur de genre de la barre de mise en forme, clic sur une case, marque hors du texte, lecture.
// Vérifié par le document enregistré (window.ardoise.doc) et par ce qui est visible. Origine : spec bloc-texte, ticket 05.

const doc = (blocks) => ({ title: 'Genres', pages: [{ id: 'p1', title: 'Accueil', blocks }] });
const LIGNES = (bid) => `JSON.stringify(((window.ardoise.doc.pages[0].blocks.find((b) => b.id === ${JSON.stringify(bid)})) || {}).lignes)`;
const POS = `const pos = (bid, i, n) => { const el = document.querySelector('.fld[data-b="' + bid + '"]'), lg = el.querySelectorAll('.lg')[i];
  const w = document.createTreeWalker(lg, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) { if (n <= t.length) return [t, n]; n -= t.length; } return [lg, 0]; };`;
const curseur = (bid, i, n) => `(() => { ${POS} document.querySelector('.fld[data-b="${bid}"]').focus(); const p = pos('${bid}', ${i}, ${n}), r = document.createRange();
  r.setStart(p[0], p[1]); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
const choisir = (bid, i0, n0, i1, n1) => `(() => { ${POS} document.querySelector('.fld[data-b="${bid}"]').focus(); const a = pos('${bid}', ${i0}, ${n0}), b = pos('${bid}', ${i1}, ${n1}), r = document.createRange();
  r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return s.toString(); })()`;
// centre d'un élément visible, ou null
const centre = (sel) => `(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || !b.getClientRects().length) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`;
// point dans la marge (marque) de la ligne i d'un bloc texte
const marque = (sel, i) => `(() => { const lg = document.querySelectorAll(${JSON.stringify(sel)} + ' > .lg')[${i}]; if (!lg) return null; const r = lg.getBoundingClientRect(); return { x: r.left + 6, y: r.top + Math.min(10, r.height / 2) }; })()`;

// pour visibles() : '' si le libellé du bouton (icône comprise) tient dans le bouton, en largeur et en hauteur, sur une seule
// rangée, sinon le libellé et les mesures. Vérification c62 : la largeur seule ne voyait pas un libellé passé sous son icône.
export const LIBELLE_ENTIER = `const r = document.createRange(); r.selectNodeContents(x); const t = r.getBoundingClientRect(), b = x.getBoundingClientRect();
  const m = [...r.getClientRects()].filter((q) => q.width > 0).map((q) => q.top + q.height / 2).sort((a, z) => a - z), rangees = m.filter((v, i) => !i || v - m[i - 1] > 4).length;
  const dedans = t.left >= b.left - 0.5 && t.right <= b.right + 0.5 && t.top >= b.top - 0.5 && t.bottom <= b.bottom + 0.5;
  return dedans && rangees <= 1 ? '' : x.textContent.trim() + ' (' + t.width.toFixed(0) + 'x' + t.height.toFixed(0) + ' dans ' + b.width.toFixed(0) + 'x' + b.height.toFixed(0) + ', ' + rangees + ' rangées)'`;

export const nom = 'genres de ligne';
export default async function ({ ecran, charger, evalue, cdp, attendre, visibles, mesure, echec }) {
  const touche = async (key, code, vk, modifiers = 0) => {
    for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers });
    await attendre(80);
  };
  const ENTREE = ['Enter', 'Enter', 13], RETOUR = ['Backspace', 'Backspace', 8], CTRL_Z = ['z', 'KeyZ', 90, 2];
  const charge = async (blocks) => { if (!(await evalue(`window.ardoise.load(${JSON.stringify(doc(blocks))})`))) throw new Error('document refusé'); await attendre(120); };
  const lignes = async (bid) => JSON.parse((await evalue(LIGNES(bid))) || 'null');
  const verifie = async (cas, bid, attendu) => { mesure(); const l = await lignes(bid); if (JSON.stringify(l) !== JSON.stringify(attendu)) echec(cas + ' : ' + JSON.stringify(l) + ' au lieu de ' + JSON.stringify(attendu)); };
  const clic = async (p) => { for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 }); await attendre(150); };
  await ecran(1000, false);
  await charger();

  // raccourcis au début d'une ligne de texte : genre posé, caractères retirés ; Ctrl+Z rend les caractères
  for (const [tape, genre] of [['- ', 'puce'], ['* ', 'puce'], ['7. ', 'numero'], ['[] ', 'case'], ['[ ] ', 'case'], ['## ', 'soustitre']]) {
    await charge([{ id: 't1', type: 'texte', lignes: [{ html: 'avant' }, { html: '' }] }]);
    await evalue(curseur('t1', 1, 0));
    for (const c of tape) { await cdp('Input.insertText', { text: c }); await attendre(30); }
    await attendre(80);
    await verifie('raccourci « ' + tape + '»', 't1', [{ html: 'avant' }, { html: '', genre }]);
    await cdp('Input.insertText', { text: 'x' }); await attendre(80);
    await verifie('raccourci « ' + tape + '» puis saisie', 't1', [{ html: 'avant' }, { html: 'x', genre }]);
    await charge([{ id: 't1', type: 'texte', lignes: [{ html: 'avant' }, { html: '' }] }]);
    await evalue(curseur('t1', 1, 0));
    for (const c of tape) { await cdp('Input.insertText', { text: c }); await attendre(30); }
    await attendre(80);
    await touche(...CTRL_Z); await attendre(150);
    mesure();
    const l = await lignes('t1');
    if (!(l && l.length === 2 && !l[1].genre && l[1].html.replace(/&nbsp;/g, ' ') === tape)) echec('raccourci « ' + tape + '» puis Ctrl+Z : ' + JSON.stringify(l));
  }
  // raccourci dans un bloc texte vide : le texte grisé (data-vide) disparaît dès que la ligne prend un genre (vérification c51)
  for (const tape of ['- ', '1. ', '[ ] ']) {
    await charge([{ id: 't1', type: 'texte', lignes: [{ html: '' }] }]);
    await evalue(curseur('t1', 0, 0));
    for (const c of tape) { await cdp('Input.insertText', { text: c }); await attendre(30); }
    await attendre(80);
    mesure();
    if (await evalue(`document.querySelector('.fld[data-b="t1"]').hasAttribute('data-vide')`)) echec('raccourci « ' + tape + '» dans un bloc vide : texte grisé encore affiché');
  }
  // dans une puce, « 1. » reste du texte
  await charge([{ id: 't1', type: 'texte', lignes: [{ html: '', genre: 'puce' }] }]);
  await evalue(curseur('t1', 0, 0));
  for (const c of '1. ') { await cdp('Input.insertText', { text: c }); await attendre(30); }
  await attendre(80);
  mesure();
  { const l = await lignes('t1'); if (!(l[0].genre === 'puce' && /^1\.( |&nbsp;)$/.test(l[0].html))) echec('raccourci dans une puce : ' + JSON.stringify(l)); }

  // Entrée : même genre ; une case naît non cochée ; après un sous-titre, du texte ; numéros recalculés à l'écran
  await charge([{ id: 't1', type: 'texte', lignes: [{ html: 'a', genre: 'puce' }, { html: 'b', genre: 'case', done: true, lv: 1 }, { html: 'c', genre: 'soustitre' }, { html: 'd', genre: 'numero' }] }]);
  await evalue(curseur('t1', 0, 1)); await touche(...ENTREE);
  await evalue(curseur('t1', 2, 1)); await touche(...ENTREE);
  await evalue(curseur('t1', 4, 1)); await touche(...ENTREE);
  await evalue(curseur('t1', 6, 1)); await touche(...ENTREE);
  await verifie('Entrée selon le genre', 't1', [{ html: 'a', genre: 'puce' }, { html: '', genre: 'puce' }, { html: 'b', lv: 1, genre: 'case', done: true }, { html: '', lv: 1, genre: 'case' },
    { html: 'c', genre: 'soustitre' }, { html: '' }, { html: 'd', genre: 'numero' }, { html: '', genre: 'numero' }]);
  mesure();
  { const n = await evalue(`[...document.querySelectorAll('.fld[data-b="t1"] > .lg[data-g="numero"]')].map((x) => getComputedStyle(x, '::before').content)`);
    if (JSON.stringify(n) !== JSON.stringify(['"1."', '"2."'])) echec('numéros à l\'écran après Entrée : ' + JSON.stringify(n)); }

  // Entrée sur une puce vide de niveau 2 : niveau 1, niveau 0, puis ligne de texte (même au milieu du bloc)
  await charge([{ id: 't1', type: 'texte', lignes: [{ html: 'a', genre: 'puce' }, { html: '', genre: 'puce', lv: 2 }, { html: 'z' }] }]);
  await evalue(curseur('t1', 1, 0));
  await touche(...ENTREE); await verifie('puce vide, Entrée 1', 't1', [{ html: 'a', genre: 'puce' }, { html: '', lv: 1, genre: 'puce' }, { html: 'z' }]);
  await touche(...ENTREE); await verifie('puce vide, Entrée 2', 't1', [{ html: 'a', genre: 'puce' }, { html: '', genre: 'puce' }, { html: 'z' }]);
  await touche(...ENTREE); await verifie('puce vide, Entrée 3', 't1', [{ html: 'a', genre: 'puce' }, { html: '' }, { html: 'z' }]);

  // Retour arrière au début d'une case : ligne de texte, niveau gardé
  await charge([{ id: 't1', type: 'texte', lignes: [{ html: 'a' }, { html: 'b', genre: 'case', done: true, lv: 2 }] }]);
  await evalue(curseur('t1', 1, 0)); await touche(...RETOUR);
  await verifie('Retour arrière au début d\'une case', 't1', [{ html: 'a' }, { html: 'b', lv: 2 }]);

  // sélecteur de genre : cinq puces sélectionnées → cases, sélection gardée, une seule étape d'historique
  const cinq = ['un', 'deux', 'trois', 'quatre', 'cinq'].map((html) => ({ html, genre: 'puce' }));
  await charge([{ id: 't1', type: 'texte', lignes: [{ html: 'titre', genre: 'soustitre' }].concat(cinq) }, { id: 'tb', type: 'table', rows: [['A', 'B'], ['c', 'd']] }]);
  await evalue(curseur('t1', 0, 2)); await attendre(250);
  mesure();
  if ((await visibles('.bmf [data-mf="genre"]')).join() !== 'Sous-titre') echec('sélecteur : genre de la ligne du curseur ' + JSON.stringify(await visibles('.bmf [data-mf="genre"]')));
  const sel = await evalue(choisir('t1', 1, 1, 5, 2)); await attendre(250);
  mesure();
  if ((await visibles('.bmf [data-mf="genre"]')).join() !== 'Puce') echec('sélecteur sur la sélection : ' + JSON.stringify(await visibles('.bmf [data-mf="genre"]')));
  const bg = await evalue(centre('.bmf [data-mf="genre"]'));
  if (!bg) echec('sélecteur de genre absent de l\'écran');
  else {
    await clic(bg);
    mesure();
    if ((await visibles('.pop [data-choix]')).join() !== 'Texte,Puce,Numéro,Case,Sous-titre') echec('fenêtre du sélecteur : ' + JSON.stringify(await visibles('.pop [data-choix]')));
    // libellés en entier dans la fenêtre (vérification c51 : fenêtre « ratatinée »)
    const coupes = (await visibles('.pop [data-choix]', LIBELLE_ENTIER)).filter((x) => x);
    if (coupes.length) echec('fenêtre du sélecteur : libellés coupés ' + JSON.stringify(coupes));
    const bc = await evalue(centre('.pop [data-choix="case"]'));
    await clic(bc); await attendre(150);
    await verifie('sélecteur : cinq puces en cases', 't1', [{ html: 'titre', genre: 'soustitre' }].concat(cinq.map((l) => ({ html: l.html, genre: 'case' }))));
    mesure();
    if ((await evalue('getSelection().toString()')) !== sel) echec('sélecteur : sélection perdue (' + JSON.stringify(await evalue('getSelection().toString()')) + ')');
    if ((await visibles('.bmf [data-mf="genre"]')).join() !== 'Case') echec('sélecteur après le choix : ' + JSON.stringify(await visibles('.bmf [data-mf="genre"]')));
    await touche(...CTRL_Z); await attendre(150);
    await verifie('sélecteur puis un seul Ctrl+Z', 't1', [{ html: 'titre', genre: 'soustitre' }].concat(cinq));
  }
  // absent dans une cellule
  await evalue(`(() => { const c = document.querySelector('.blk[data-id="tb"] .fld'); c.focus(); const r = document.createRange(); r.selectNodeContents(c); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); })()`);
  await attendre(250);
  mesure();
  if ((await visibles('.bmf [data-mf="bold"]')).length !== 1) echec('cellule : barre de mise en forme absente');
  if ((await visibles('.bmf [data-mf="genre"]')).length) echec('cellule : sélecteur de genre visible');

  // clic sur une case : cochée (doc), le curseur ne bouge pas ; Ctrl+Z la décoche
  await charge([{ id: 't1', type: 'texte', lignes: [{ html: 'puce', genre: 'puce' }, { html: 'à faire', genre: 'case' }] }]);
  await evalue(curseur('t1', 0, 2));
  await clic(await evalue(marque('.fld[data-b="t1"]', 1)));
  await verifie('clic sur une case', 't1', [{ html: 'puce', genre: 'puce' }, { html: 'à faire', genre: 'case', done: true }]);
  mesure();
  if (!(await evalue(`document.querySelectorAll('.fld[data-b="t1"] > .lg')[1].hasAttribute('data-done')`))) echec('clic sur une case : coche invisible');
  await touche(...CTRL_Z); await attendre(150);
  await verifie('clic sur une case puis Ctrl+Z', 't1', [{ html: 'puce', genre: 'puce' }, { html: 'à faire', genre: 'case' }]);
  // clic sur la marque d'une puce : curseur au début du texte, la marque n'est ni texte ni sélection
  await clic(await evalue(marque('.fld[data-b="t1"]', 0)));
  mesure();
  const c = await evalue(`(() => { const s = getSelection(), lg = document.querySelectorAll('.fld[data-b="t1"] > .lg')[0], r = document.createRange(); r.selectNodeContents(lg); r.setEnd(s.anchorNode, s.anchorOffset);
    return { avant: r.toString(), dans: lg.contains(s.anchorNode), texte: lg.textContent }; })()`);
  if (!(c.dans && c.avant === '' && c.texte === 'puce')) echec('clic sur la marque d\'une puce : ' + JSON.stringify(c));
  await evalue(`(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('.fld[data-b="t1"]')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); })()`);
  mesure();
  if ((await evalue('getSelection().toString()')).replace(/\n/g, '') !== 'puceà faire') echec('sélection du bloc : ' + JSON.stringify(await evalue('getSelection().toString()')));

  // lecture : numéros et cases visibles, aucune commande ; une case s'y coche
  await charge([{ id: 't1', type: 'texte', lignes: [{ html: 'un', genre: 'numero' }, { html: 'sous', genre: 'puce', lv: 1 }, { html: 'deux', genre: 'numero' }, { html: 'faite', genre: 'case', done: true }, { html: 'à faire', genre: 'case' }] }]);
  await evalue(`document.querySelector('#ui [data-ui="mode"]').click()`); await attendre(150);
  mesure();
  const lec = await evalue(`[...document.querySelectorAll('.texte > .lg')].map((x) => { const b = getComputedStyle(x, '::before'); return b.content + '|' + (b.borderTopStyle !== 'none' ? 'cadre' : ''); })`);
  if (JSON.stringify(lec) !== JSON.stringify(['"1."|', '"◦"|', '"2."|', '"✓"|cadre', '""|cadre'])) echec('lecture : marques ' + JSON.stringify(lec));
  if ((await visibles('.texte[contenteditable], .texte .fld, .texte button, .bmf')).length) echec('lecture : commande visible');
  await clic(await evalue(marque('.texte', 4)));
  await verifie('lecture : clic sur une case', 't1', [{ html: 'un', genre: 'numero' }, { html: 'sous', genre: 'puce', lv: 1 }, { html: 'deux', genre: 'numero' }, { html: 'faite', genre: 'case', done: true }, { html: 'à faire', genre: 'case', done: true }]);
  await evalue(`document.querySelector('#ui [data-ui="mode"]').click()`); await attendre(100);
}
