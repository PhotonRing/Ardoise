// Sujet : barre de mise en forme collée au bloc. Une seule barre, posée en haut du bloc qui a le curseur dans un texte riche,
// à gauche de la bande collée du menu du bloc ; absente hors d'un texte riche et en lecture. Origine : spec barre-mise-en-forme, ticket 01.

const DOC = {
  title: 'Barre', pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 'pa', type: 'p', html: 'Un paragraphe de départ' },
    { id: 'tab', type: 'table', rows: [['Ville', 'Pays'], ['Lyon', 'France'], ['Turin', 'Italie']] },
    { id: 'fa', type: 'facts', items: [{ k: 'Clé', v: 'Valeur' }] },
    { id: 'no', type: 'note', variant: 'info', html: 'Un encadré' },
    { id: 'co', type: 'code', code: 'echo bonjour' },
    { id: 'gr', type: 'group', title: 'Un groupe', blocks: [{ id: 'gp', type: 'p', html: 'Dans le groupe' }] },
    { id: 'pb', type: 'p', html: 'Un second paragraphe' },
  ] }],
};
const CHARGE = `window.ardoise.load(${JSON.stringify(DOC)})`;
// curseur en fin de champ (sélection vide)
const CURSEUR = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.scrollIntoView({ block: "center" }); el.focus({ preventScroll: true });
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
// texte entier du champ sélectionné
const SELECTION = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.scrollIntoView({ block: "center" }); el.focus({ preventScroll: true });
  const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
// barres de mise en forme affichées : bloc qui la porte (le plus proche) et rectangle, comparé au menu de ce bloc
const BARRES = `[...document.querySelectorAll('.bmf')].filter((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden').map((x) => {
  const blk = x.closest('.blk'), a = x.parentElement, m = a && a.querySelector(':scope > .blk-bar'), r = x.getBoundingClientRect(), rm = m ? m.getBoundingClientRect() : null;
  return { bloc: blk && blk.dataset.id, dansAncre: !!a && a.classList.contains('collant') && a.parentElement === blk,
    haut: r.top, bas: r.bottom, gauche: r.left, droite: r.right, mGauche: rm && rm.left, mHaut: rm && rm.top, mBas: rm && rm.bottom }; })`;
const HTML = (bid) => `(() => { const t = (bs) => { for (const b of bs) { if (b.id === ${JSON.stringify(bid)}) return b; const c = t(b.blocks || []); if (c) return c; } };
  return t(window.ardoise.doc.pages[0].blocks).html; })()`;

export const nom = 'barre de mise en forme';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const barres = () => evalue(BARRES);
  // clic de souris réel au centre d'un bouton de la barre (mousedown compris : la sélection doit survivre)
  const cliquer = async (mf) => {
    const p = await evalue(`(() => { const b = document.querySelector('.bmf [data-mf="${mf}"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!p) { echec(`bouton ${mf} absent`); return; }
    for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await attendre(60);
  };
  const taper = async (t) => { for (const c of t) { await cdp('Input.insertText', { text: c }); await attendre(15); } await attendre(30); };

  for (const w of [1000, 700]) {
    await ecran(w, false);
    await charger(); if (!(await evalue(CHARGE))) throw new Error('document refusé'); await attendre(100);

    // présence : en haut du bloc du curseur, à gauche du menu, même bas, sans chevauchement
    for (const [sel, bloc, quoi] of [['.fld[data-b="pa"]', 'pa', 'un paragraphe'], ['.blk[data-id="tab"] td', 'tab', 'une cellule'],
      ['.fld[data-k="items.0.v"]', 'fa', 'une valeur de fiche'], ['.fld[data-b="no"]', 'no', 'un encadré'], ['.fld[data-b="gp"]', 'gp', 'un bloc dans un groupe']]) {
      await evalue(CURSEUR(sel)); await attendre(80);
      const b = await barres(); mesure();
      if (b.length !== 1) { echec(`${w} px, ${quoi} : ${b.length} barre(s) affichée(s), attendu 1`); continue; }
      const x = b[0];
      if (x.bloc !== bloc || !x.dansAncre) echec(`${w} px, ${quoi} : barre dans le bloc ${x.bloc}, attendu l'ancre du bloc ${bloc}`);
      // même ligne que le menu quand elle tient avant lui (toujours à 1000 px pour ces blocs), sinon juste au-dessus ; jamais dessus
      const ligne = Math.abs(x.bas - x.mBas) <= 1 && x.droite <= x.mGauche - 2, dessus = x.bas <= x.mHaut + 0.5;
      if (!ligne && !dessus) echec(`${w} px, ${quoi} : la barre chevauche le menu (barre ${x.gauche.toFixed(1)}-${x.droite.toFixed(1)} bas ${x.bas.toFixed(1)}, menu à ${x.mGauche.toFixed(1)} haut ${x.mHaut.toFixed(1)})`);
      if (w === 1000 && !ligne) echec(`${w} px, ${quoi} : barre et menu pas sur la même ligne`);
    }
    // absence : clé de fiche, bloc de code
    for (const [sel, quoi] of [['.fld[data-k="items.0.k"]', 'une clé de fiche'], ['.blk[data-id="co"] textarea', 'un bloc de code']]) {
      await evalue(`(() => { document.querySelector(${JSON.stringify(sel)}).focus({ preventScroll: true }); return true; })()`); await attendre(80);
      const b = await barres(); mesure();
      if (b.length) echec(`${w} px, ${quoi} : barre affichée`);
    }
  }
  // une seule barre dans la page, qui suit le curseur ; .itb n'existe plus
  await evalue(CURSEUR('.fld[data-b="pa"]')); await attendre(60);
  await evalue(CURSEUR('.fld[data-b="pb"]')); await attendre(60);
  const n = await evalue(`[document.querySelectorAll('.bmf').length, document.querySelectorAll('.itb').length]`), b = await barres(); mesure();
  if (n[0] !== 1) echec(`${n[0]} barres dans la page, attendu 1`);
  if (n[1]) echec('.itb existe encore');
  if (b.length !== 1 || b[0].bloc !== 'pb') echec('la barre ne suit pas le curseur vers le second paragraphe');

  // la barre prend les couleurs du thème (comme le menu du bloc) : claire en thème clair, sombre en thème sombre, palette comprise
  for (const [theme, palette] of [['light', ''], ['dark', ''], ['light', 'rubis'], ['dark', 'foret']]) {
    const c = await evalue(`(() => { const h = document.documentElement; h.dataset.theme = ${JSON.stringify(theme)}; if (${JSON.stringify(palette)}) h.dataset.palette = ${JSON.stringify(palette)}; else delete h.dataset.palette;
      const t = document.createElement('div'); document.body.appendChild(t); const v = (x) => { t.style.color = 'var(' + x + ')'; return getComputedStyle(t).color; };
      const bmf = document.querySelector('.bmf'), bt = bmf.querySelector('[data-mf="bold"]'), m = document.querySelector('.blk[data-id="pb"] .blk-bar');
      const r = { fond: getComputedStyle(bmf).backgroundColor, bord: getComputedStyle(bmf).borderTopColor, texte: getComputedStyle(bt).color,
        surface: v('--surface'), line: v('--line'), fg: v('--fg'), menu: getComputedStyle(m).backgroundColor }; t.remove(); return r; })()`); mesure();
    if (c.fond !== c.surface || c.fond !== c.menu) echec(`thème ${theme} ${palette} : fond de la barre ${c.fond}, attendu --surface ${c.surface} (menu ${c.menu})`);
    if (c.bord !== c.line) echec(`thème ${theme} ${palette} : bord de la barre ${c.bord}, attendu --line ${c.line}`);
    if (c.texte !== c.fg) echec(`thème ${theme} ${palette} : texte des boutons ${c.texte}, attendu --fg ${c.fg}`);
  }
  await evalue(`(() => { delete document.documentElement.dataset.theme; delete document.documentElement.dataset.palette; return true; })()`);

  // re-rendu : ajouter une ligne au tableau re-rend la page, la barre revient dans le bloc du curseur
  await evalue(CURSEUR('.blk[data-id="tab"] td')); await attendre(60);
  await evalue(`(() => { document.querySelector('.blk[data-id="tab"] [data-act="row-add"]').click(); return true; })()`); await attendre(150);
  await evalue(CURSEUR('.blk[data-id="tab"] td')); await attendre(60);
  const r = await barres(); mesure();
  if (r.length !== 1 || r[0].bloc !== 'tab') echec('après un re-rendu, la barre n\'est pas dans le tableau');

  // Souligné et Barré : <u> et <s> enregistrés, second clic retire
  for (const [mf, tag] of [['underline', 'u'], ['strikeThrough', 's']]) {
    await evalue(SELECTION('.fld[data-b="pb"]')); await attendre(40);
    await cliquer(mf); await attendre(300);
    let h = await evalue(HTML('pb')); mesure();
    if (!new RegExp(`<${tag}>Un second paragraphe</${tag}>`).test(h)) echec(`${mf} : texte enregistré ${h}`);
    await cliquer(mf); await attendre(300);
    h = await evalue(HTML('pb')); mesure();
    if (new RegExp(`<${tag}>`).test(h)) echec(`${mf}, second clic : forme non retirée (${h})`);
  }
  // sans sélection : la frappe suivante prend la forme
  for (const [mf, tag, bid] of [['underline', 'u', 'pa'], ['strikeThrough', 's', 'gp']]) {
    await evalue(CURSEUR(`.fld[data-b="${bid}"]`)); await attendre(40);
    await cliquer(mf); await taper('xy'); await attendre(300);
    const h = await evalue(HTML(bid)); mesure();
    if (!new RegExp(`<${tag}>xy</${tag}>$`).test(h)) echec(`${mf} sans sélection : frappe suivante ${h}`);
  }
  // Gras puis Italique enchaînés : la sélection et le curseur restent dans le texte
  await evalue(SELECTION('.fld[data-b="no"]')); await attendre(40);
  await cliquer('bold'); await cliquer('italic'); await attendre(300);
  const g = await evalue(HTML('no')), focus = await evalue(`document.activeElement.dataset.b`); mesure();
  if (!/<b><i>Un encadré<\/i><\/b>|<i><b>Un encadré<\/b><\/i>/.test(g)) echec(`Gras puis Italique : ${g}`);
  if (focus !== 'no') echec(`après les boutons, le curseur a quitté l'encadré (${focus})`);

  // mode lecture (Ctrl+E) depuis un texte riche : aucune barre
  await evalue(CURSEUR('.fld[data-b="pa"]')); await attendre(60);
  await evalue(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`); await attendre(200);
  const lect = await evalue(`[document.documentElement.classList.contains('is-edit'), (${BARRES}).length]`); mesure();
  if (lect[0]) echec('Ctrl+E ne passe pas en lecture');
  else if (lect[1]) echec('mode lecture : barre affichée');

  // tableau de 80 lignes, curseur en bas : la bande collée (barre et menu) reste sous le haut d'écran, sans chevauchement,
  // et une ligne cachée dessous est dégagée au mouvement du curseur
  for (const w of [1000, 700]) {
    await ecran(w, false);
    await charger(); await evalue(LONG); await attendre(100);
    await evalue(CELLULE(78)); await attendre(150);
    await evalue(`(() => { const b = document.querySelector('.blk[data-id="tab"]'); scrollBy(0, b.getBoundingClientRect().top + 600); return true; })()`); await attendre(150);
    const o = await evalue(BANDE); mesure();
    if (!o.barre || !o.menu) { echec(`${w} px, long tableau : barre ${!!o.barre}, menu ${!!o.menu}`); continue; }
    const chev = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    if (o.barre.top < o.haut - 0.5) echec(`${w} px, long tableau : barre au-dessus du haut d'écran (${o.barre.top.toFixed(1)} < ${o.haut.toFixed(1)})`);
    if (o.menu.top < o.haut - 0.5) echec(`${w} px, long tableau : menu au-dessus du haut d'écran (${o.menu.top.toFixed(1)} < ${o.haut.toFixed(1)})`);
    if (o.barre.top > o.haut + 1) echec(`${w} px, long tableau : bande pas collée contre le haut d'écran (${o.barre.top.toFixed(1)}, haut ${o.haut.toFixed(1)})`);
    if (chev(o.barre, o.menu)) echec(`${w} px, long tableau : la barre chevauche le menu`);
    if (w === 1000 && Math.abs(o.barre.bottom - o.menu.bottom) > 1) echec(`${w} px, long tableau : barre et menu pas bas contre bas`);
    // ligne cachée sous la bande : le curseur y va, la page la dégage
    const sous = await evalue(SOUS_BANDE);
    if (!sous) { echec(`${w} px : aucune ligne sous la bande collée`); continue; }
    await evalue(CELLULE(sous)); await attendre(200);
    const c = await evalue(`(() => { const r = document.activeElement.getBoundingClientRect(), b = document.querySelector('.bmf').getBoundingClientRect(), m = document.querySelector('.blk[data-id="tab"] .blk-bar').getBoundingClientRect();
      return { ligne: r.top, bande: Math.max(b.bottom, m.bottom) }; })()`); mesure();
    if (c.ligne < c.bande - 0.5) echec(`${w} px : ligne du curseur cachée sous la bande (${c.ligne.toFixed(1)} < ${c.bande.toFixed(1)})`);
  }

  // frappe au milieu de l'écran dans un sous-titre, une sous-section, un paragraphe : la page ne défile pas (lot 8)
  await ecran(1000, false);
  await charger(); await evalue(TEXTES); await attendre(100);
  for (const id of ['st', 'ss', 'pa']) {
    await evalue(`(() => { const b = document.querySelector('.blk[data-id="${id}"]'), f = b.querySelector('.fld');
      scrollBy(0, b.getBoundingClientRect().top - innerHeight / 2); f.focus({ preventScroll: true });
      const s = getSelection(), rg = document.createRange(); rg.selectNodeContents(f); rg.collapse(false); s.removeAllRanges(); s.addRange(rg); return true; })()`); await attendre(100);
    const avant = await evalue('scrollY'), vue = (await barres()).length;
    await taper('abcdef'); await attendre(100);
    const apres = await evalue('scrollY'); mesure();
    if (!vue) echec(`frappe dans ${id} : barre absente`);
    if (apres !== avant) echec(`taper dans ${id} fait défiler la page (scrollY ${avant} → ${apres})`);
  }
}
const LONG = `(() => { const d = JSON.parse(JSON.stringify(window.ardoise.doc)), rows = [['Ville', 'Pays', 'Note']];
  for (let i = 1; i <= 80; i++) rows.push(['Ville ' + i, 'Pays ' + i, 'Note ' + i]);
  d.pages[0].blocks = [{ id: 'avant', type: 'p', html: 'Avant' }, { id: 'tab', type: 'table', rows }, { id: 'apres', type: 'p', html: 'Après' }];
  return window.ardoise.load(d); })()`;
const CELLULE = (ligne) => `(() => { const c = document.querySelector('.blk[data-id="tab"] tbody tr:nth-child(${ligne}) td'); c.focus({ preventScroll: true });
  const s = getSelection(), rg = document.createRange(); rg.selectNodeContents(c); rg.collapse(false); s.removeAllRanges(); s.addRange(rg); return true; })()`;
// haut d'écran mesuré indépendamment du code : bas de la barre du haut et des onglets de pages affichés
const BANDE = `(() => { const vis = (e) => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0;
  const tb = document.querySelector('.tb'), on = document.querySelector('.pnav-tabs');
  const haut = Math.max(vis(tb) ? tb.getBoundingClientRect().bottom : 0, vis(on) ? on.getBoundingClientRect().bottom : 0);
  const r = (e) => { if (!e || !e.getClientRects().length) return null; const x = e.getBoundingClientRect(); return { top: x.top, bottom: x.bottom, left: x.left, right: x.right }; };
  return { haut, barre: r(document.querySelector('.blk[data-id="tab"] .bmf')), menu: r(document.querySelector('.blk[data-id="tab"] .blk-bar')) }; })()`;
const SOUS_BANDE = `(() => { const b = document.querySelector('.bmf').getBoundingClientRect();
  const tr = [...document.querySelectorAll('.blk[data-id="tab"] tbody tr')].find((t) => { const r = t.getBoundingClientRect(); return r.top < b.bottom - 2 && r.bottom > b.top + 2; });
  return tr ? [...tr.parentNode.children].indexOf(tr) + 1 : 0; })()`;
const TEXTES = `(() => {
  const d = JSON.parse(JSON.stringify(window.ardoise.doc)), rem = (i) => ({ id: 'r' + i, type: 'p', html: 'Remplissage ' + i + '. Texte courant pour donner de la hauteur à la page. '.repeat(6) });
  d.pages[0].blocks = [rem(1), rem(2), rem(3), { id: 'st', type: 'subtitle', html: 'Un sous-titre' }, rem(4), rem(5),
    { id: 'ss', type: 'h3', html: 'Une sous-section' }, rem(6), rem(7), { id: 'pa', type: 'p', html: 'Un paragraphe' }, rem(8), rem(9), rem(10), rem(11)];
  return window.ardoise.load(d); })()`;
