// Sujet : fenêtre de la formule. En édition, un clic sur une formule ouvre sous elle une fenêtre avec sa source et l'aperçu
// en direct ; la fermeture (Entrée, Échap, clic ailleurs) écrit la source modifiée en une étape d'historique, retire la
// formule dont la source est vidée et remet le curseur juste après la formule. Rien en lecture. Origine : spec formules, ticket 03.

const F = (s) => '<span class="formule">' + s + '</span>';
const DOC = { title: 'Fenêtre', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 't', type: 'texte', lignes: [{ html: 'Aire ' + F('\\pi r^2') + ' fin' }, { html: 'Autre ' + F('x') + ' ligne' }] },
  { id: 'tb', type: 'table', rows: [['Nom', 'Valeur'], ['a', F('E=mc^2')]] },
] }] };
const BLOC = (id) => `window.ardoise.doc.pages[0].blocks.find((b) => b.id === ${JSON.stringify(id)})`;
const FORMULE = (sel) => `document.querySelector(${JSON.stringify(sel)})`;
const T0 = '.blk[data-id="t"] .lg:first-child .formule', T1 = '.blk[data-id="t"] .lg:nth-child(2) .formule', TB = '.blk[data-id="tb"] .formule';
// fenêtre affichée : source du champ, source de l'aperçu, boîte à l'écran, et position par rapport à la formule
const FEN = (sel) => `(() => { const p = document.querySelector('.formule-pop'); if (!p || !p.getClientRects().length) return null;
  const r = p.getBoundingClientRect(), f = ${FORMULE(sel)}, rf = f && f.getBoundingClientRect(), a = p.querySelector('.f-apercu annotation');
  return { src: p.querySelector('[data-fsrc]').value, apercu: a ? a.textContent : null, focus: document.activeElement === p.querySelector('[data-fsrc]'),
    dessous: rf ? r.top >= rf.bottom - 1 : null, dedans: r.left >= 0 && r.right <= innerWidth }; })()`;
// curseur : replié, dans le champ, juste après la formule (seul un espace sans chasse peut les séparer)
const APRES = (sel) => `(() => { const s = getSelection(), f = ${FORMULE(sel)}; if (!f || !s.rangeCount || !s.isCollapsed) return false;
  const r = document.createRange(); r.setStartAfter(f); if (r.comparePoint(s.anchorNode, s.anchorOffset) < 0) return false; r.setEnd(s.anchorNode, s.anchorOffset);
  return r.toString().replace(/\\u200B/g, '') === '' && document.activeElement.contains(f); })()`;
const SOURCES = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})].map((x) => (x.querySelector('annotation') || {}).textContent)`;
const ANNULER = `(() => { const b = document.querySelector('#ui [data-ui=undo]'); return b ? { actif: !b.disabled, titre: b.title } : null; })()`;
const BASCULER = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;

export const nom = 'fenêtre de la formule';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  const souris = async (type, x, y) => cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  const cliquer = async (sel) => {
    const p = await evalue(`(() => { const r = ${FORMULE(sel)}.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    await souris('mousePressed', p[0], p[1]); await souris('mouseReleased', p[0], p[1]); await attendre(120);
  };
  const touche = async (key, code, mod = 0) => {
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: { Enter: 13, Escape: 27, KeyZ: 90, KeyY: 89, Backspace: 8 }[code], modifiers: mod });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers: mod }); await attendre(120);
  };
  const remplacer = async (texte) => { await evalue(`document.querySelector('.formule-pop [data-fsrc]').select(), true`); if (texte) await cdp('Input.insertText', { text: texte }); else await touche('Backspace', 'Backspace'); await attendre(80); };

  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(150);

  // clic : la fenêtre s'ouvre sous la formule, avec sa source dans le champ et dans l'aperçu
  await cliquer(T0);
  const f0 = await evalue(FEN(T0));
  attendu('clic : fenêtre ouverte sous la formule avec sa source', f0 && f0.src === '\\pi r^2' && f0.apercu === '\\pi r^2' && f0.focus && f0.dessous && f0.dedans, f0);

  // fermeture sans modification : aucune étape, curseur juste après la formule
  const h0 = await evalue(ANNULER);
  await touche('Escape', 'Escape');
  const n0 = { fen: await evalue(FEN(T0)), apres: await evalue(APRES(T0)), annuler: await evalue(ANNULER) };
  attendu('sans modification : fermée, aucune étape', !n0.fen && n0.apres && JSON.stringify(n0.annuler) === JSON.stringify(h0), { h0, n0 });

  // frappe : l'aperçu suit, le document attend la validation ; Entrée écrit la source dans le texte
  await cliquer(T0);
  await remplacer('\\frac{a}{b}');
  const f1 = { fen: await evalue(FEN(T0)), doc: await evalue(BLOC('t') + '.lignes[0].html') };
  attendu('frappe : aperçu en direct, document inchangé', f1.fen && f1.fen.apercu === '\\frac{a}{b}' && f1.doc === 'Aire ' + F('\\pi r^2') + ' fin', f1);
  await touche('Enter', 'Enter');
  const v1 = { fen: await evalue(FEN(T0)), doc: await evalue(BLOC('t') + '.lignes[0].html'), ecran: await evalue(SOURCES(T0)), apres: await evalue(APRES(T0)) };
  attendu('Entrée : source écrite, fenêtre fermée, curseur après', !v1.fen && v1.doc === 'Aire ' + F('\\frac{a}{b}') + ' fin' && v1.ecran[0] === '\\frac{a}{b}' && v1.apres, v1);

  // une modification = une étape : Ctrl+Z rend l'ancienne source, Ctrl+Y la remet
  await touche('z', 'KeyZ', 2);
  const u1 = await evalue(BLOC('t') + '.lignes[0].html');
  attendu('Ctrl+Z : ancienne source', u1 === 'Aire ' + F('\\pi r^2') + ' fin', u1);
  await touche('y', 'KeyY', 2);
  const r1 = await evalue(BLOC('t') + '.lignes[0].html');
  attendu('Ctrl+Y : nouvelle source', r1 === 'Aire ' + F('\\frac{a}{b}') + ' fin', r1);

  // Échap après modification : valide aussi
  await cliquer(T1);
  await remplacer('y^2');
  await touche('Escape', 'Escape');
  const e1 = { fen: await evalue(FEN(T1)), doc: await evalue(BLOC('t') + '.lignes[1].html'), apres: await evalue(APRES(T1)) };
  attendu('Échap après modification : source écrite, curseur après', !e1.fen && e1.doc === 'Autre ' + F('y^2') + ' ligne' && e1.apres, e1);

  // clic ailleurs après modification (formule d'une cellule de tableau) : valide
  await cliquer(TB);
  await remplacer('E=mc^3');
  await souris('mousePressed', 900, 700); await souris('mouseReleased', 900, 700); await attendre(150);
  const c1 = { fen: await evalue(FEN(TB)), doc: await evalue(BLOC('tb') + '.rows[1][1]') };
  attendu('clic ailleurs : fenêtre fermée, source de la cellule écrite', !c1.fen && c1.doc === F('E=mc^3'), c1);

  // une source qui contient des `$` (saisie $…$, ticket 02) reste une seule formule : pas de formule imbriquée
  await cliquer(TB);
  await remplacer('a$b$');
  await touche('Enter', 'Enter');
  const s1 = { doc: await evalue(BLOC('tb') + '.rows[1][1]'), ecran: await evalue(SOURCES(TB)), imbriquees: await evalue(`document.querySelectorAll(${JSON.stringify(TB + ' .formule')}).length`) };
  attendu('source avec `$` : une seule formule, sans formule imbriquée', s1.doc === F('a$b$') && JSON.stringify(s1.ecran) === '["a$b$"]' && s1.imbriquees === 0, s1);

  // source vidée : la formule disparaît du texte et de l'écran
  await cliquer(T1);
  await remplacer('');
  const vide = await evalue(`(document.querySelector('.formule-pop .f-apercu') || {}).textContent`);
  await touche('Enter', 'Enter');
  const d1 = { doc: await evalue(BLOC('t') + '.lignes[1].html'), ecran: await evalue(SOURCES('.blk[data-id="t"] .lg:nth-child(2) .formule')) };
  attendu('source vidée : formule retirée', vide === 'La formule sera retirée' && d1.doc === 'Autre  ligne' && d1.ecran.length === 0, { vide, d1 });

  // téléphone : la fenêtre tient dans l'écran
  await ecran(380, true);
  await attendre(150);
  await cliquer(T0);
  const m1 = await evalue(FEN(T0));
  attendu('écran étroit : fenêtre dans l\'écran', m1 && m1.dedans, m1);
  await touche('Escape', 'Escape');
  await ecran(1000, false); await attendre(150);

  // lecture : pas de fenêtre
  await evalue(BASCULER); await attendre(200);
  await cliquer('#b-t .formule');
  const l1 = await evalue(`!!document.querySelector('.formule-pop')`);
  attendu('lecture : aucune fenêtre', !l1, l1);
  await evalue(BASCULER); await attendre(200);
}
