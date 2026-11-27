// Sujet : formules dans « Copier pour Office ». Chaque formule part en image PNG à sa place dans le texte, le bloc formule en
// image centrée ; les images, dessinées par le navigateur (SVG foreignObject du MathML), montrent la barre de fraction, le
// radical et les délimiteurs étirés ; l'image en ligne a sa ligne de base en son milieu (align="middle", vu dans Writer) ; une formule
// dans le titre d'une chronologie garde sa barre dans l'image de la chronologie.
// Origine : spec formules, ticket 08. Presse-papier, canvas et MathML ne se voient que dans un vrai navigateur.

const F = (s) => '<span class="formule">' + s + '</span>';
const DOC = { title: 'Formules Office', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'x1', type: 'p', html: 'Moyenne ' + F('\\frac{a+b}{2}') + ', norme ' + F('\\sqrt{x^2+1}') + ', rapport ' + F('\\left( \\frac{a}{\\frac{b}{c}} \\right)') + ' et ' + F('(a)') + ', indice ' + F('x_{n+1}') + ', lettre ' + F('\\alpha') + ' fin' },
  { id: 'fb', type: 'formule', tex: '\\frac{a+b}{2}' },
  { id: 'tl', type: 'timeline', orient: 'v', items: [{ date: '', title: F('\\frac{a}{b}'), text: '', color: 'ok' }] },
  { id: 'vd', type: 'p', html: '' },
] }] };

// image (data URL) → mesures de l'encre (pixels sombres) : traits horizontaux (rangées encrées sur plus du quart de la
// largeur), hauteur de l'encre dans la première colonne encrée (délimiteur ou radical), boîte de l'encre
const MESURER = `async (src, fg) => {
  const im = new Image(); im.src = src; await im.decode();
  const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
  const g = cv.getContext('2d'); g.drawImage(im, 0, 0); const W = cv.width, H = cv.height, d = g.getImageData(0, 0, W, H).data;
  const encre = (x, y) => { const i = (y * W + x) * 4; if (d[i + 3] < 128) return false;
    return fg ? Math.abs(d[i] - fg[0]) < 40 && Math.abs(d[i + 1] - fg[1]) < 40 && Math.abs(d[i + 2] - fg[2]) < 40 : d[i] + d[i + 1] + d[i + 2] < 384; };
  let x0 = W, x1 = -1, y0 = H, y1 = -1, traits = 0, plusLong = 0;
  for (let y = 0; y < H; y++) { let run = 0, best = 0;
    for (let x = 0; x < W; x++) if (encre(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); best = Math.max(best, ++run); } else run = 0;
    if (best > W / 4) traits++; plusLong = Math.max(plusLong, best); }
  // étendue verticale de l'encre sur des colonnes : premier signe (jusqu'à la première colonne vide), sixième gauche de l'encre
  const etendue = (de, a, seul) => { let h0 = H, h1 = -1; for (let x = de; x <= a && x < W; x++) { let vide = true; for (let y = 0; y < H; y++) if (encre(x, y)) { vide = false; h0 = Math.min(h0, y); h1 = Math.max(h1, y); } if (vide && seul && h1 >= 0) break; } return h1 - h0; };
  return { l: W, h: H, encre: [x0, y0, x1, y1], traits, plusLong, premier: etendue(x0, x1, true), gauche: etendue(x0, x0 + Math.round((x1 - x0) / 6)) };
}`;

export const nom = 'formules dans Copier pour Office';
export default async function ({ ecran, charger, cdp, evalue, attendre, mesure, echec }) {
  await ecran(1000, false);
  await charger();
  await cdp('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(150);
  // en édition (menu ⋯ des blocs) : Ctrl+E si le document s'est ouvert en lecture
  if (!(await evalue('!!document.querySelector(".blk[data-id=x1] [data-act=menu-bloc]")'))) for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, modifiers: 2, key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69 });
  for (let i = 0; i < 40 && !(await evalue('!!document.querySelector(".blk[data-id=x1] [data-act=menu-bloc]")')); i++) await attendre(50);

  // ⋯ puis « Copier pour Office » au vrai clic, presse-papier vidé avant
  const copier = async (id) => {
    await evalue('navigator.clipboard.writeText("vide").then(() => true)');
    await evalue(`(() => { const t = document.querySelector('.toast'); if (t) t.style.display = 'none'; const b = document.querySelector('.blk[data-id="${id}"] [data-act="menu-bloc"]'); b.scrollIntoView({ block: 'center' }); b.click(); return true; })()`);
    const p = await evalue(`(() => { const x = [...document.querySelectorAll('.menu-bloc .mi')].find((m) => m.textContent.includes('Copier pour Office')); if (!x) return null; const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!p) { echec('« Copier pour Office » absent du menu ⋯ de ' + id); return {}; }
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
    for (let i = 0; i < 60 && !(await evalue('(() => { const t = document.querySelector(".toast"); return !!t && t.style.display === "block"; })()')); i++) await attendre(100);
    return evalue(`(async () => { const o = {}; for (const i of await navigator.clipboard.read()) for (const t of i.types) o[t] = t === 'image/png' ? await new Promise((ok) => { i.getType(t).then((b) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); }); }) : await (await i.getType(t)).text(); return o; })()`);
  };
  const images = (html) => [...html.matchAll(/<img src="([^"]*)" alt="([^"]*)" width="(\d+)" height="(\d+)"([^>]*)>/g)].map((m) => ({ src: m[1], alt: m[2].replace(/&amp;/g, '&'), l: +m[3], h: +m[4], reste: m[5] }));
  const mesurer = (src, fg) => evalue(`(${MESURER})(${JSON.stringify(src)}, ${JSON.stringify(fg || null)})`);

  // paragraphe : une image par formule, à sa place, source en texte de remplacement ; texte brut en $source$
  mesure();
  const p1 = await copier('x1'), h1 = p1['text/html'] || '', i1 = images(h1);
  if (p1['text/plain'] !== 'Moyenne $\\frac{a+b}{2}$, norme $\\sqrt{x^2+1}$, rapport $\\left( \\frac{a}{\\frac{b}{c}} \\right)$ et $(a)$, indice $x_{n+1}$, lettre $\\alpha$ fin') echec('texte brut : ' + JSON.stringify(p1['text/plain']));
  if (i1.map((x) => x.alt).join(' | ') !== '\\frac{a+b}{2} | \\sqrt{x^2+1} | \\left( \\frac{a}{\\frac{b}{c}} \\right) | (a) | x_{n+1} | \\alpha') echec('images du paragraphe : ' + h1.slice(0, 600));
  else {
    if (!/Moyenne <img[^>]*>, norme <img[^>]*>, rapport <img[^>]*> et <img[^>]*>, indice <img[^>]*>, lettre <img[^>]*> fin/.test(h1)) echec('images hors de leur place : ' + h1.slice(0, 600));
    if (!i1.every((x) => /^data:image\/png;base64,/.test(x.src) && / align="middle"/.test(x.reste))) echec('images en PNG, align="middle" : ' + JSON.stringify(i1.map((x) => [x.src.slice(0, 30), x.reste])));
    // décalage pour Google Docs (ticket 12) : vertical-align d'une demi-hauteur, et l'aperçu Chromium du collage reste centré sur le
    // texte : milieu de chaque image sur la ligne de base (repère en ligne de hauteur nulle), à la même place qu'avec align="middle" seul
    mesure();
    if (!i1.every((x) => x.reste.includes(' style="vertical-align:-' + x.h / 2 + 'px"'))) echec('vertical-align d\'une demi-hauteur : ' + JSON.stringify(i1.map((x) => [x.h, x.reste])));
    const place = (html) => evalue(`(async () => { const z = document.createElement('div'); z.style.cssText = 'position:absolute;left:0;top:0;width:680px;background:#fff';
      z.innerHTML = ${JSON.stringify(html)}; document.body.appendChild(z);
      await Promise.all([...z.querySelectorAll('img')].map((im) => im.decode().catch(() => null)));
      const r = [...z.querySelectorAll('img')].map((im) => { const b = document.createElement('span'); b.style.cssText = 'display:inline-block;width:0;height:0'; im.after(b);
        const ri = im.getBoundingClientRect(), base = b.getBoundingClientRect().bottom; b.remove(); return { haut: ri.top, ecart: ri.top + ri.height / 2 - base }; });
      z.remove(); return r; })()`);
    const [avec, sans] = [await place(h1), await place(h1.replace(/ style="vertical-align:[^"]*"/g, ''))];
    if (!avec.every((x) => Math.abs(x.ecart) <= 1)) echec('aperçu Chromium : milieu des images hors de la ligne de base : ' + JSON.stringify(avec));
    if (avec.some((x, i) => Math.abs(x.haut - sans[i].haut) > 0.5)) echec('aperçu Chromium déplacé par vertical-align : ' + JSON.stringify({ avec, sans }));
    // à la hauteur du texte (15 px, ligne de 24 px) : une parenthèse simple tient dans la ligne, une fraction un peu plus
    const [fr, rac, del, par] = i1;
    if (!(par.h >= 15 && par.h <= 30 && fr.h <= 50 && fr.l < 60)) echec('tailles des images en ligne : ' + JSON.stringify(i1.map((x) => [x.alt, x.l, x.h])));
        const [mf, mr, md, mp] = [await mesurer(fr.src), await mesurer(rac.src), await mesurer(del.src), await mesurer(par.src)];
    // rien de coupé : l'encre ne touche aucun bord de l'image (une petite formule n'est pas poussée vers le bas)
    mesure();
    for (const x of i1) { const m = await mesurer(x.src); if (m.encre[1] < 3 || m.encre[3] > m.h - 4 || m.encre[0] < 3 || m.encre[2] > m.l - 4) echec('encre coupée au bord de l\'image de ' + x.alt + ' : ' + JSON.stringify(m)); }
    // ligne de base au milieu de l'image : une lettre sans jambage (α) s'y pose, à une demi-unité près (image à l'échelle 4)
    mesure();
    const al = i1.find((x) => x.alt === '\\alpha'), ma = al && await mesurer(al.src);
    if (!ma || Math.abs(ma.encre[3] - ma.h / 2) > 3) echec('α hors de la ligne de base (bas de l\'encre, milieu) : ' + JSON.stringify(ma && [ma.encre[3], ma.h / 2]));
    mesure();
    if (mf.traits < 1) echec('barre de fraction absente : ' + JSON.stringify(mf));
    mesure();
    // radical : trait du haut, et le signe à gauche descend sur l'essentiel de la hauteur de l'encre
    if (mr.traits < 1 || mr.gauche < 0.6 * (mr.encre[3] - mr.encre[1])) echec('radical absent : ' + JSON.stringify(mr));
    mesure();
    if (md.premier < 1.4 * mp.premier) echec('délimiteur de \\left( non étiré : ' + JSON.stringify({ etire: md.premier, simple: mp.premier }));

  }

  // bloc formule : image centrée, plus grande que la même formule en ligne, avec sa barre
  mesure();
  const p2 = await copier('fb'), h2 = p2['text/html'] || '', i2 = images(h2);
  if (p2['text/plain'] !== '$$\\frac{a+b}{2}$$') echec('texte brut du bloc : ' + JSON.stringify(p2['text/plain']));
  if (i2.length !== 1 || !/<p align="center" style="[^"]*text-align:center"><img /.test(h2)) echec('bloc formule copié : ' + h2.slice(0, 400));
  else {
    const fr = i1[0], m2 = await mesurer(i2[0].src);
    if (fr && !(i2[0].h > 1.3 * fr.h)) echec('bloc pas plus grand qu\'en ligne : ' + JSON.stringify([i2[0].h, fr.h]));
    if (m2.traits < 1) echec('barre de fraction du bloc absente : ' + JSON.stringify(m2));
  }

  // chronologie : la barre de la fraction du titre (encre du texte #17212b, trait d'au moins 10 px à l'échelle 2)
  mesure();
  const p3 = await copier('tl');
  if (!p3['image/png']) echec('chronologie sans image : ' + Object.keys(p3));
  else {
    const m3 = await mesurer(p3['image/png'], [0x17, 0x21, 0x2b]);
    if (m3.plusLong < 10) echec('barre de fraction absente de la chronologie : ' + JSON.stringify(m3));
  }
}
