// Sujet : barre de mise en forme en fenêtre étroite (moins de 600 px). Un bouton « Aa » remplace la barre dans l'ancre du bloc ;
// un appui l'ouvre juste sous lui, la sélection est gardée au toucher. Origine : spec barre-mise-en-forme, ticket 04.

const LONG = 'Un mot ici, puis une phrase assez longue pour remplir plusieurs lignes à quatre cents pixels de large, '
  + 'encore une autre pour descendre sous la barre ouverte, et une dernière pour finir le paragraphe tout en bas.';
const DOC = {
  title: 'Étroite', pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 'pa', type: 'p', html: LONG },
    { id: 'pb', type: 'p', html: 'Un second paragraphe' },
    { id: 't1', type: 'table', rows: [['Nom', 'Note'], ['Alpha', 'Beta']] },
  ] }],
};
// sélection du texte de pa de l'index a à b (texte sans balises)
const SELECTIONNER = (a, b) => `(() => { const el = document.querySelector('.fld[data-b="pa"]'); el.focus({ preventScroll: true });
  const pos = (n) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) { if (n <= t.nodeValue.length) return [t, n]; n -= t.nodeValue.length; } };
  const [t1, o1] = pos(${a}), [t2, o2] = pos(${b}), r = document.createRange(); r.setStart(t1, o1); r.setEnd(t2, o2);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
const HTML = (bid) => `window.ardoise.doc.pages[0].blocks.find((b) => b.id === ${JSON.stringify(bid)}).html.replace(/​/g, '')`;
const RECT = (sel) => `(() => { const x = document.querySelector(${JSON.stringify(sel)}); if (!x || !x.getClientRects().length) return null;
  const r = x.getBoundingClientRect(); return { haut: r.top, bas: r.bottom, gauche: r.left, droite: r.right }; })()`;
// boutons de la barre affichés à l'écran
const BOUTONS = `.bmf button`;

export const nom = 'barre de mise en forme en fenêtre étroite';
export default async function ({ ecran, charger, evalue, cdp, attendre, visibles, mesure, echec }) {
  // appui du doigt au point (x, y), ou au centre de l'élément sel
  const appuiPoint = async (x, y) => {
    await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await attendre(150);
  };
  const appuyer = async (sel) => {
    const r = await evalue(RECT(sel));
    if (!r) { echec(`${sel} absent de l'écran`); return false; }
    await appuiPoint((r.gauche + r.droite) / 2, (r.haut + r.bas) / 2); return true;
  };
  const ouverte = async () => (await visibles(BOUTONS)).length > 1;

  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await ecran(400, true);
  await charger();
  // visite guidée (fichier neuf) : le bouton « Aa » y est présenté
  const tour = await evalue(`document.getElementById('app').innerHTML`); mesure();
  if (!/<b>Aa<\/b>/.test(tour)) echec('visite guidée : le bouton « Aa » n\'est pas présenté');
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(100);

  // « Aa » seul, à côté du menu ou juste au-dessus, jamais dessus
  await evalue(SELECTIONNER(3, 6)); await attendre(100);
  let v = await visibles(BOUTONS); mesure();
  if (JSON.stringify(v) !== '["Aa"]') echec(`400 px : boutons affichés ${JSON.stringify(v)}, attendu le seul « Aa »`);
  const aa = await evalue(RECT('.bmf-aa')), menu = await evalue(RECT('.blk[data-id="pa"] .blk-bar'));
  if (aa && menu) {
    mesure();
    const chev = aa.gauche < menu.droite - 1 && menu.gauche < aa.droite - 1 && aa.haut < menu.bas - 1 && menu.haut < aa.bas - 1;
    if (chev) echec('400 px : « Aa » chevauche le menu du bloc');
  }
  const titre = await evalue(`document.querySelector('.bmf-aa').title`); mesure();
  if (titre !== 'Mise en forme') echec(`infobulle de « Aa » : ${titre}`);

  // l'appui ouvre la barre juste sous le bouton ; la sélection reste, la forme va au bon texte
  await appuyer('.bmf-aa'); mesure();
  if (!(await ouverte())) echec('l\'appui sur « Aa » n\'ouvre pas la barre');
  const sel = await evalue('getSelection().toString()'); mesure();
  if (sel !== 'mot') echec(`sélection après l'appui sur « Aa » : « ${sel} »`);
  const a2 = await evalue(RECT('.bmf-aa')), b = await evalue(RECT('.bmf-b')); mesure();
  if (!b || b.haut < a2.bas - 0.5 || b.haut > a2.bas + 8) echec(`barre ouverte pas juste sous « Aa » (Aa bas ${a2 && a2.bas}, barre haut ${b && b.haut})`);
  await appuyer('.bmf [data-mf="bold"]'); await appuyer('.bmf [data-mf="underline"]'); await attendre(300);
  let h = await evalue(HTML('pa')); mesure();
  if (!/^Un (<b><u>mot<\/u><\/b>|<u><b>mot<\/b><\/u>) ici/.test(h)) echec(`gras et souligné au toucher : ${h.slice(0, 60)}`);
  if (!(await ouverte())) echec('la barre se ferme après un bouton');

  // barre et palettes dans l'écran, sans défilement horizontal
  const dedans = async (quoi, s) => {
    const rs = await evalue(`[...document.querySelectorAll(${JSON.stringify(s)})].filter((x) => x.getClientRects().length).map((x) => { const r = x.getBoundingClientRect(); return [r.left, r.right]; })`);
    mesure();
    if (!rs.length) echec(`${quoi} : rien d'affiché`);
    for (const [g, d] of rs) if (g < -0.5 || d > 400.5) { echec(`${quoi} hors de l'écran (${g.toFixed(1)}-${d.toFixed(1)})`); break; }
  };
  await dedans('barre ouverte', '.bmf-b, .bmf-b button');
  for (const [famille, nomCase, cls] of [['couleur', 'Bleu', 'c-bleu'], ['surlignage', 'Jaune', 's-jaune']]) {
    await evalue(SELECTIONNER(3, 6)); await attendre(100);
    if (!(await ouverte())) await appuyer('.bmf-aa');
    await appuyer(`.bmf [data-mf="${famille}"]`);
    await dedans(`palette ${famille}`, '.bmf-pal, .bmf-pal button');
    await appuyer(`.bmf-pal [aria-label="${nomCase}"]`); await attendre(300);
    h = await evalue(HTML('pa')); mesure();
    if (h.indexOf(`class="${cls}"`) < 0) echec(`${famille} ${nomCase} au toucher : ${h.slice(0, 80)}`);
    if (!(await ouverte())) echec(`${famille} : la barre se ferme après la palette`);
  }
  const large = await evalue('document.documentElement.scrollWidth'); mesure();
  if (large > 400) echec(`défilement horizontal à 400 px (${large})`);

  // fermeture : second appui sur « Aa »
  await appuyer('.bmf-aa'); mesure();
  if (await ouverte()) echec('second appui sur « Aa » : la barre reste ouverte');
  // fermeture : appui ailleurs dans le bloc (dernière ligne du paragraphe, sous la barre ouverte)
  await evalue(SELECTIONNER(3, 6)); await attendre(100);
  await appuyer('.bmf-aa');
  const fin = await evalue(`(() => { const el = document.querySelector('.fld[data-b="pa"]'), t = el.lastChild, r = document.createRange();
    r.setStart(t, t.length - 3); r.setEnd(t, t.length - 1); const q = r.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; })()`);
  const surBarre = await evalue(`(() => { const e = document.elementFromPoint(${fin.x}, ${fin.y}); return !!(e && e.closest('.bmf')); })()`);
  if (surBarre) echec('dernière ligne du paragraphe sous la barre ouverte : cas de fermeture non testable');
  else {
    await appuiPoint(fin.x, fin.y); mesure();
    if (await ouverte()) echec('appui ailleurs dans le bloc : la barre reste ouverte');
  }
  // fermeture : curseur dans un autre bloc
  await evalue(SELECTIONNER(3, 6)); await attendre(100);
  await appuyer('.bmf-aa');
  await evalue(`(() => { const el = document.querySelector('.fld[data-b="pb"]'); el.focus({ preventScroll: true }); const r = document.createRange();
    r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`); await attendre(150);
  v = await visibles(BOUTONS); mesure();
  const bloc = await evalue(`(() => { const x = document.querySelector('.bmf'); const k = x && x.closest('.blk'); return k && k.dataset.id; })()`);
  if (JSON.stringify(v) !== '["Aa"]' || bloc !== 'pb') echec(`curseur dans un autre bloc : ${JSON.stringify(v)} dans le bloc ${bloc}, attendu « Aa » seul dans pb`);

  // rendu du même bloc (ligne ajoutée par Tab dans la dernière cellule) : la barre ouverte reste ouverte, dans ce bloc
  await evalue(`(() => { const el = document.querySelector('.fld[data-b="t1"][data-k="rows.1.1"]'); el.focus({ preventScroll: true });
    const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`); await attendre(150);
  await appuyer('.bmf-aa');
  if (!(await ouverte())) echec('tableau : l\'appui sur « Aa » n\'ouvre pas la barre');
  for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await attendre(200);
  const lignes = await evalue(`window.ardoise.doc.pages[0].blocks.find((b) => b.id === 't1').rows.length`); mesure();
  if (lignes !== 3) echec(`Tab dans la dernière cellule : ${lignes} lignes, attendu 3`);
  const blocT = await evalue(`(() => { const x = document.querySelector('.bmf'); const k = x && x.closest('.blk'); return k && k.dataset.id; })()`); mesure();
  if (!(await ouverte()) || blocT !== 't1') echec(`ligne ajoutée au tableau : barre ${(await ouverte()) ? 'ouverte' : 'fermée'} dans le bloc ${blocT}, attendu ouverte dans t1`);
  await appuyer('.bmf-aa');

  // redimensionnement sans recharger : au-delà de 600 px la barre complète, en deçà « Aa » seul et fermé
  await appuyer('.bmf-aa');
  await ecran(1000, false); await attendre(200);
  v = await visibles(BOUTONS); mesure();
  if (v.length !== 11 || v.indexOf('Aa') >= 0) echec(`1000 px après 400 px : ${v.length} boutons ${JSON.stringify(v)}, attendu les 11 de la barre sans « Aa »`);
  await ecran(400, true); await attendre(200);
  v = await visibles(BOUTONS); mesure();
  if (JSON.stringify(v) !== '["Aa"]') echec(`retour à 400 px : ${JSON.stringify(v)}, attendu « Aa » seul et barre fermée`);

  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  await ecran(1000, false);
}
