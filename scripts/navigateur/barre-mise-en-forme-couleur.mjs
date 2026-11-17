// Sujet : couleur du texte et surlignage de la barre de mise en forme. Palettes fixes ouvertes depuis la barre, classes
// enregistrées dans le texte riche (alert = Rouge, c-*, s-*), au plus une couleur et un surlignage. Origine : spec barre-mise-en-forme, ticket 02.

const DOC = {
  title: 'Couleurs', pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 'pa', type: 'p', html: 'Un paragraphe' },
  ] }],
};
// paragraphe pa remis à html, puis sélection de son texte de l'index a à b (texte sans balises)
const PREPARER = (html, a, b) => `(async () => {
  const d = JSON.parse(JSON.stringify(window.ardoise.doc)); d.pages[0].blocks = [{ id: 'pa', type: 'p', html: ${JSON.stringify(html)} }, { id: 'pb', type: 'p', html: 'Autre' }];
  window.ardoise.load(d); await new Promise((r) => setTimeout(r, 80));
  const el = document.querySelector('.fld[data-b="pa"]'); el.focus({ preventScroll: true });
  const pos = (n) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) { if (n <= t.nodeValue.length) return [t, n]; n -= t.nodeValue.length; } return [el, el.childNodes.length]; };
  const fin = ${b === undefined ? 'el.textContent.length' : b};
  const r = document.createRange(), [t1, o1] = pos(${a}), [t2, o2] = pos(fin); r.setStart(t1, o1); r.setEnd(t2, o2);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
const HTML = (bid) => `window.ardoise.doc.pages[0].blocks.find((b) => b.id === ${JSON.stringify(bid)}).html`;
const COULEURS = [['alert', 'Rouge'], ['c-orange', 'Orange'], ['c-vert', 'Vert'], ['c-bleu', 'Bleu'], ['c-violet', 'Violet'], ['c-gris', 'Gris']];
const SURLIGNAGES = [['s-jaune', 'Jaune'], ['s-vert', 'Vert'], ['s-bleu', 'Bleu'], ['s-rose', 'Rose'], ['s-gris', 'Gris']];

export const nom = 'barre de mise en forme : couleur et surlignage';
export default async function ({ ecran, charger, evalue, cdp, attendre, visibles, mesure, echec }) {
  // clic de souris réel (mousedown compris : la sélection doit survivre)
  const clic = async (sel) => {
    const p = await evalue(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || !b.getClientRects().length) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!p) { echec(`${sel} absent de l'écran`); return false; }
    for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await attendre(60); return true;
  };
  // ouvre la palette de la famille (couleur, surlignage) et clique la case nommée
  const teinte = async (famille, nomCase) => {
    if (!(await clic(`.bmf [data-mf="${famille}"]`))) return;
    await clic(`.bmf-pal [aria-label="${nomCase}"]`); await attendre(250);
  };
  const html = async () => (await evalue(HTML('pa'))).replace(/​/g, '');

  await ecran(1000, false);
  await charger();
  // visite guidée (document d'un fichier neuf) : un exemple de texte coloré et surligné, gardé par l'assainissement à l'affichage
  const tour = await evalue(`document.getElementById('app').innerHTML`); mesure();
  if (!/<span class="c-[a-z]+/.test(tour) || !/<span class="s-[a-z]+/.test(tour)) echec('visite guidée : aucun exemple de couleur ou de surlignage');
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(100);

  // chaque couleur et chaque surlignage posent leur classe dans le texte enregistré
  for (const [famille, liste] of [['couleur', COULEURS], ['surlignage', SURLIGNAGES]]) {
    for (const [cls, n] of liste) {
      await evalue(PREPARER('Un mot', 3)); await attendre(60);
      await teinte(famille, n);
      const h = await html(); mesure();
      if (h !== `Un <span class="${cls}">mot</span>`) echec(`${famille} ${n} : ${h}`);
    }
  }

  // [html de départ, début et fin de la sélection, gestes, html enregistré attendu, quoi]
  const cas = [
    ['Un mot', 3, 6, [['couleur', 'Vert'], ['couleur', 'Bleu']], 'Un <span class="c-bleu">mot</span>', 'une nouvelle couleur remplace l\'ancienne'],
    ['Un mot', 3, 6, [['surlignage', 'Jaune'], ['surlignage', 'Rose']], 'Un <span class="s-rose">mot</span>', 'un nouveau surlignage remplace l\'ancien'],
    ['Un mot', 3, 6, [['couleur', 'Vert'], ['surlignage', 'Jaune']], 'Un <span class="c-vert"><span class="s-jaune">mot</span></span>', 'couleur et surlignage ensemble'],
    ['Un <span class="c-vert s-jaune">mot</span>', 3, 6, [['couleur', 'Bleu']], 'Un <span class="c-bleu"><span class="s-jaune">mot</span></span>', 'couleur changée sur un span qui porte aussi un surlignage'],
    ['Un <b><span class="c-vert">mot</span></b>', 3, 6, [['couleur', 'Sans couleur']], 'Un <b>mot</b>', '« Sans couleur » garde le gras'],
    ['Un <span class="s-jaune"><span class="c-vert">mot</span></span>', 3, 6, [['couleur', 'Sans couleur']], 'Un <span class="s-jaune">mot</span>', '« Sans couleur » de la couleur garde le surlignage'],
    ['<span class="c-vert">Un mot</span> fin', 0, 3, [['couleur', 'Gris']], '<span class="c-gris">Un </span><span class="c-vert">mot</span> fin', 'début d\'un texte coloré recoloré : coupé en deux'],
    ['<span class="alert">Un mot rouge</span>', 3, 6, [['couleur', 'Vert']], '<span class="alert">Un </span><span class="c-vert">mot</span><span class="alert"> rouge</span>', 'partie d\'un texte rouge recolorée : coupé en trois'],
    ['<span class="alert">Un <b>mot</b> rouge</span>', 4, 6, [['couleur', 'Sans couleur']], '<span class="alert">Un <b>m</b></span><b>ot</b><span class="alert"> rouge</span>', '« Sans couleur » sur une partie : coupé, le gras suit'],
    ['<span class="s-jaune">Un mot surligné</span>', 3, 6, [['surlignage', 'Bleu']], '<span class="s-jaune">Un </span><span class="s-bleu">mot</span><span class="s-jaune"> surligné</span>', 'partie d\'un surlignage changée : coupé en trois'],
    ['Un <span class="alert">mot</span>', 3, 6, [['couleur', 'Rouge']], 'Un <span class="alert">mot</span>', 'ancien texte rouge : Rouge de la palette, un seul span'],
    ['Un <span class="alert">mot</span>', 3, 6, [['couleur', 'Vert']], 'Un <span class="c-vert">mot</span>', 'ancien texte rouge recoloré en vert'],
    ['Un <b><span class="c-vert"><span class="s-jaune">mot</span></span></b>', 3, 6, [['mf', 'clear']], 'Un mot', 'Effacer retire tout'],
    ['Un mot', 6, 6, [['couleur', 'Vert'], ['surlignage', 'Jaune']], 'Un mot', 'sans sélection : rien'],
  ];
  for (const [depart, a, b, gestes, attendu, quoi] of cas) {
    await evalue(PREPARER(depart, a, b)); await attendre(60);
    for (const [famille, n] of gestes) { if (famille === 'mf') { await clic(`.bmf [data-mf="${n}"]`); await attendre(250); } else await teinte(famille, n); }
    const h = await html(); mesure();
    if (h !== attendu) echec(`${quoi} : ${h}, attendu ${attendu}`);
  }

  // une pastille dans la sélection : gardée, et ni la couleur ni le surlignage ne s'y voient
  await evalue(PREPARER('A <span class="pill">OK</span> B', 0)); await attendre(60);
  await teinte('couleur', 'Bleu'); await teinte('surlignage', 'Jaune');
  const pil = await evalue(`(() => { const p = document.querySelector('.fld[data-b="pa"] span.pill'); if (!p) return null;
    const t = p.cloneNode(true); document.querySelector('.fld[data-b="pb"]').appendChild(t);
    const a = getComputedStyle(p), b = getComputedStyle(t), r = [a.color, a.backgroundColor, b.color, b.backgroundColor, !!p.closest('.c-bleu'), !!p.closest('.s-jaune')]; t.remove(); return r; })()`);
  const hp = await html(); mesure();
  if (!pil) echec(`pastille défaite par la couleur : ${hp}`);
  else {
    if (!pil[4] || !pil[5]) echec(`pastille hors de la couleur ou du surlignage : ${hp}`);
    if (pil[0] !== pil[2] || pil[1] !== pil[3]) echec(`pastille colorée par le texte : ${pil[0]} sur ${pil[1]}, seule ${pil[2]} sur ${pil[3]}`);
  }
  // pastille posée sur un texte coloré : la couleur du texte ne s'y voit pas
  await evalue(PREPARER('Un <span class="c-vert">mot</span>', 3, 6)); await attendre(60);
  await clic('.bmf [data-mf="pill"]'); await attendre(250);
  const pc = await evalue(`(() => { const p = document.querySelector('.fld[data-b="pa"] span.pill'); return p && [getComputedStyle(p).color, getComputedStyle(p.firstElementChild || p).color]; })()`); mesure();
  if (!pc || pc[0] !== pc[1]) echec(`pastille sur un texte vert : ${JSON.stringify(pc)} (${await html()})`);

  // ouvrir une palette garde le curseur et la sélection ; chaque case est nommée ; un second clic la referme
  for (const [famille, liste] of [['couleur', COULEURS], ['surlignage', SURLIGNAGES]]) {
    await evalue(PREPARER('Un mot', 3, 6)); await attendre(60);
    await clic(`.bmf [data-mf="${famille}"]`);
    const etat = await evalue(`[document.activeElement.dataset.b, getSelection().toString()]`);
    const noms = await visibles('.bmf-pal [data-teinte]', `return x.title + '|' + x.getAttribute('aria-label')`); mesure();
    if (etat[0] !== 'pa' || etat[1] !== 'mot') echec(`palette ${famille} : focus ${etat[0]}, sélection « ${etat[1]} »`);
    const voulu = liste.map((x) => x[1]).concat('Sans couleur').map((x) => x + '|' + x);
    if (JSON.stringify(noms) !== JSON.stringify(voulu)) echec(`palette ${famille} : cases ${JSON.stringify(noms)}`);
    await clic(`.bmf [data-mf="${famille}"]`);
    if ((await visibles('.bmf-pal')).length) echec(`palette ${famille} : un second clic sur le bouton ne la ferme pas`);
  }

  // Ctrl+Z retire la couleur
  await evalue(PREPARER('Un mot', 3, 6)); await attendre(60);
  await teinte('couleur', 'Violet'); await attendre(400);
  for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2 });
  await attendre(300);
  const hz = await html(); mesure();
  if (hz !== 'Un mot') echec(`Ctrl+Z après Violet : ${hz}`);

  // flèche au bord d'un texte surligné ou coloré : la frappe suivante est hors de la mise en forme
  for (const cls of ['s-jaune', 'c-bleu']) {
    await evalue(PREPARER(`Un <span class="${cls}">mot</span>`, 6, 6)); await attendre(60);
    for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await cdp('Input.insertText', { text: 'x' }); await attendre(300);
    const hf = await html(); mesure();
    if (hf !== `Un <span class="${cls}">mot</span>x`) echec(`flèche au bord de ${cls} : ${hf}`);
  }


  // copier puis coller dans Ardoise : la couleur suit (presse-papier réel de Chromium), avec ou sans pastille
  for (const [depart, quoi] of [['Un <span class="c-vert">mot</span> <span class="s-rose">rose</span>', 'texte coloré'], ['Un <span class="c-vert">mot <span class="pill">OK</span></span>', 'texte coloré avec une pastille']]) {
    await evalue(PREPARER(depart, 0)); await attendre(60);
    for (const [key, code, vk] of [['c', 'KeyC', 67]]) for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, modifiers: 2 });
    await evalue(`(() => { const el = document.querySelector('.fld[data-b="pb"]'); el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
    for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, modifiers: 2, commands: type === 'rawKeyDown' ? ['paste'] : [] });
    await attendre(300);
    const hc = (await evalue(HTML('pb'))).replace(/\u200B/g, ''); mesure();
    if (!/<span class="c-vert">mot/.test(hc)) echec(`copier-coller d'un ${quoi} : ${hc}`);
    if (depart.includes('s-rose') && !/<span class="s-rose">rose<\/span>/.test(hc)) echec(`copier-coller : surlignage perdu (${hc})`);
  }
  // collage HTML (assainissement) : nouvelles classes gardées ; classe inconnue et couleurs en style venues d'ailleurs défaites, texte gardé
  await evalue(PREPARER('Un mot', 6, 6)); await attendre(60);
  await evalue(`(() => { const dt = new DataTransfer(); dt.setData('text/html', '<span class="c-vert s-rose">a</span><span class="x-rouge">b</span><span style="color:#ff0000;background-color:yellow">rouge</span>'); dt.setData('text/plain', 'abrouge');
    document.querySelector('.fld[data-b="pa"]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return true; })()`); await attendre(300);
  const he = await html(); mesure();
  if (he !== 'Un mot<span class="c-vert s-rose">a</span>brouge') echec(`collage assaini : ${he}`);

  // lecture et thème sombre : la couleur et le surlignage se voient
  await evalue(PREPARER('Un <span class="c-vert">mot</span> <span class="s-jaune">jaune</span>', 0, 0)); await attendre(60);
  await evalue(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`); await attendre(200);
  const vu = () => evalue(`(() => { const c = document.querySelector('#app .c-vert'), s = document.querySelector('#app .s-jaune'); return c && s ? [getComputedStyle(c).color, getComputedStyle(s).backgroundColor] : null; })()`);
  const lc = await vu(); mesure();
  if (!lc || lc[0] !== 'rgb(24, 121, 78)' || lc[1] !== 'rgb(255, 240, 166)') echec(`lecture, thème clair : ${JSON.stringify(lc)}`);
  await evalue(`document.documentElement.setAttribute('data-theme', 'dark')`); await attendre(60);
  const ls = await vu(); mesure();
  if (!ls || ls[0] !== 'rgb(95, 208, 154)' || ls[1] !== 'rgb(87, 73, 26)') echec(`lecture, thème sombre : ${JSON.stringify(ls)}`);
}
