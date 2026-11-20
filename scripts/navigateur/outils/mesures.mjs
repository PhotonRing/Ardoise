// Mesures partagées par les sujets du banc navigateur (dossier hors de la liste des sujets : le lanceur ne lit que
// les fichiers .mjs de scripts/navigateur/). Chacune est le corps d'une fonction de l'élément `x`, pour visibles().

// pour visibles() : '' si le libellé du bouton (icône comprise) tient dans le bouton, en largeur et en hauteur, sur une seule
// rangée, sinon le libellé et les mesures. Vérification c62 : la largeur seule ne voyait pas un libellé passé sous son icône.
export const LIBELLE_ENTIER = `const r = document.createRange(); r.selectNodeContents(x); const t = r.getBoundingClientRect(), b = x.getBoundingClientRect();
  const m = [...r.getClientRects()].filter((q) => q.width > 0).map((q) => q.top + q.height / 2).sort((a, z) => a - z), rangees = m.filter((v, i) => !i || v - m[i - 1] > 4).length;
  const dedans = t.left >= b.left - 0.5 && t.right <= b.right + 0.5 && t.top >= b.top - 0.5 && t.bottom <= b.bottom + 0.5;
  return dedans && rangees <= 1 ? '' : x.textContent.trim() + ' (' + t.width.toFixed(0) + 'x' + t.height.toFixed(0) + ' dans ' + b.width.toFixed(0) + 'x' + b.height.toFixed(0) + ', ' + rangees + ' rangées)'`;

// Dessin centré en hauteur : capture de chaque bouton visible de `sel` et centre vertical de son encre (pixels qui
// diffèrent du fond du bouton, bordure exclue), comparé au centre du bouton, à 3 px près (le « A » souligné de la couleur du texte est décalé de 2 px par dessin, et les polices de la CI diffèrent). Mesure ce que l'œil voit :
// l'icône d'alignement du lot 4b avait une boîte bien centrée (22 px) mais ses traits dessinés en haut (c62, interruption).
// Rend la liste des boutons décalés, '' pour chacun s'il est centré.
import { inflateSync } from 'node:zlib';
const pixels = (png) => {   // PNG 8 bits de Chromium (RVB ou RVBA), sans entrelacement ; rend des pixels de `k` octets
  let o = 8, w = 0, h = 0, k = 4; const idat = [];
  while (o < png.length) { const n = png.readUInt32BE(o), t = png.toString('ascii', o + 4, o + 8), d = png.subarray(o + 8, o + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); k = { 2: 3, 6: 4 }[d[9]]; if (d[8] !== 8 || !k) throw new Error('PNG inattendu'); }
    if (t === 'IDAT') idat.push(d); o += 12 + n; }
  const brut = inflateSync(Buffer.concat(idat)), L = w * k, px = Buffer.alloc(h * L);
  for (let y = 0; y < h; y++) { const f = brut[y * (L + 1)], src = brut.subarray(y * (L + 1) + 1, (y + 1) * (L + 1));
    for (let x = 0; x < L; x++) { const a = x >= k ? px[y * L + x - k] : 0, b = y ? px[(y - 1) * L + x] : 0, c = x >= k && y ? px[(y - 1) * L + x - k] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      px[y * L + x] = src[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]; } }
  return { w, h, px, k };
};
export async function encreCentree({ cdp, evalue }, sel) {
  const boites = await evalue(`[...document.querySelectorAll(${JSON.stringify(sel)})].filter((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden')
    .map((x) => { const r = x.getBoundingClientRect();
      // colonnes de chaque élément du bouton (icône, case), mesurées à part : le texte d'un libellé couvrirait une icône décalée
      const parts = [...x.children].filter((e) => e.getClientRects().length && !e.classList.contains('bmf-cache')).map((e) => { const q = e.getBoundingClientRect(); return [q.left - r.left, q.right - r.left]; });
      return { x: r.left, y: r.top, width: r.width, height: r.height, parts: parts.length ? parts : [[0, r.width]], nom: x.textContent.trim() || x.getAttribute('aria-label') || x.title }; })`);
  const res = [];
  for (const b of boites) {
    const shot = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: b.x, y: b.y, width: b.width, height: b.height, scale: 1 } });
    const { w, h, px, k } = pixels(Buffer.from(shot.result.data, 'base64')), dpr = w / b.width, bord = Math.ceil(3 * dpr), at = (x, y) => (y * w + x) * k;
    const fond = px.subarray(at(bord, bord), at(bord, bord) + 3);
    const ecarts = b.parts.map(([g, d]) => {
      let somme = 0, n = 0;
      for (let y = bord; y < h - bord; y++) for (let x = Math.max(bord, Math.floor(g * dpr)); x < Math.min(w - bord, Math.ceil(d * dpr)); x++) { const i = at(x, y);
        if (Math.abs(px[i] - fond[0]) + Math.abs(px[i + 1] - fond[1]) + Math.abs(px[i + 2] - fond[2]) > 60) { somme += y + 0.5; n++; } }
      return n ? (somme / n - h / 2) / dpr : 0;   // en px CSS (écran mobile : 2,6 pixels par px)
    }).filter((e) => Math.abs(e) > 3);
    res.push(ecarts.length ? `${b.nom} (encre décalée de ${ecarts.map((e) => e.toFixed(1)).join(', ')} px)` : '');
  }
  return res;
}
