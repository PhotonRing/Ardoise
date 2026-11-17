// Sujet : « Copier pour Office » (menu ⋯ d'un bloc). Un texte ou un tableau part en trois formats : HTML à styles en ligne
// marqué d'Ardoise, image PNG du bloc et texte brut, en thème clair même sous le thème sombre ; une carte (fond hors ligne) ou
// une chronologie part en image PNG avec son texte brut. Images dessinées à la largeur de la page imprimée, à dpr 2. Une image
// d'une autre origine dans le bloc : copie sans image. Recollé dans Ardoise, le bloc copié reste du texte ; une image venue
// d'ailleurs reste un bloc image. Un presse-papier qui refuse donne un message d'erreur.
// Origine : spec groupe-office-diamant, ticket 04 ; spec copie-office-style, ticket 02. Presse-papier, canvas et menu ne se
// voient que dans un vrai navigateur.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEklEQVR4nGP4z8AARwzEcQAAh5gP8Y7Dc3sAAAAASUVORK5CYII=';   // 4 × 4 px
const P = (t) => '<span class="pill">' + t + '</span>';
const DOC = { v: 6, id: 'doc-copier-office', title: 'Office', theme: 'dark', tags: { ok: { c: 0 } }, pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'x1', type: 'p', indent: 1, html: 'Statut ' + P('OK') + ' et <a href="#pg-p1">lien interne</a>' },
  { id: 'fa', type: 'facts', items: [{ k: 'Hôte', v: 'srv1', alert: false }, { k: 'Risque', v: 'élevé', alert: true }] },
  { id: 'vd', type: 'p', html: '' },
  { id: 'io', type: 'image', src: 'IMAGE_AILLEURS', caption: 'Image d\'une autre origine', alt: '' },
  { id: 't1', type: 'table', rows: [['Nom', 'État'], ['Serveur', P('OK')]] },
  { id: 'tl', type: 'timeline', orient: 'v', items: [{ date: '2024', title: 'Début', text: '', color: 'ok' }, { date: '2025', title: 'Fin', text: '', color: 'ok' }] },
  { id: 'mp', type: 'map', height: 300, bg: 'vector', view: { lat: 48, lon: 2, z: 4 }, markers: [{ lat: 48.85, lon: 2.35, label: 'Paris', color: 'bad' }], zones: [], routes: [], list: false },
  { id: 'g1', type: 'group', title: 'Événement', folded: false, blocks: [
    { id: 'dm', type: 'diamond', title: 'Campagne X', adversaire: 'APT', capacite: '', infrastructure: '', victime: '' },
    { id: 'gt', type: 'timeline', orient: 'v', items: [{ date: '2024', title: 'Début', text: '', color: 'ok' }] }] },
] }] };

export const nom = 'copier pour Office';
export default async function ({ ecran, cdp, evalue, attendre, mesure, echec }) {
  const dir = mkdtempSync(join(tmpdir(), 'ardoise-office-'));
  // image servie en http sur 127.0.0.1 : une autre origine que la page (file://), sans CORS, donc canvas sali
  const serveur = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(Buffer.from(PNG, 'base64')); });
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  try {
    const source = readFileSync(new URL('../../dist/ardoise.html', import.meta.url), 'utf8');
    const balise = '<script id="ardoise-doc" type="application/json">{}</script>';
    if (!source.includes(balise)) throw new Error('document embarqué introuvable dans dist/ardoise.html');
    const fichier = join(dir, 'office.html');
    const doc = JSON.stringify(DOC).replace('IMAGE_AILLEURS', 'http://127.0.0.1:' + serveur.address().port + '/ailleurs.png');
    writeFileSync(fichier, source.replace(balise, balise.replace('{}', doc.replace(/<\//g, '<\\/'))));
    await ecran(1000, false);
    await cdp('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
    await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp('Page.navigate', { url: 'file://' + fichier });
    for (let i = 0; i < 100 && !(await evalue('document.readyState === "complete" && !!document.querySelector("#app .tl")')); i++) await attendre(50);
    for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, modifiers: 2, key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69 });
    for (let i = 0; i < 40 && !(await evalue('!!document.querySelector(".blk[data-id=x1] [data-act=menu-bloc]")')); i++) await attendre(50);
    if (!(await evalue('document.documentElement.dataset.theme === "dark"'))) echec('le document n\'est pas en thème sombre : l\'essai du thème clair ne prouverait rien');

    // ⋯ puis « Copier pour Office » au vrai clic (geste de l'utilisateur), presse-papier vidé avant
    const copier = async (id) => {
      await evalue('navigator.clipboard.writeText("vide").then(() => true)');
      await evalue(`(() => { const t = document.querySelector('.toast'); if (t) t.style.display = 'none'; const b = document.querySelector('.blk[data-id="${id}"] [data-act="menu-bloc"]'); b.scrollIntoView({ block: 'center' }); b.click(); return true; })()`);
      const p = await evalue(`(() => { const x = [...document.querySelectorAll('.menu-bloc .mi')].find((m) => m.textContent.includes('Copier pour Office')); if (!x) return null; const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (!p) { echec('« Copier pour Office » absent du menu ⋯ de ' + id); return null; }
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
      for (let i = 0; i < 60 && !(await evalue('(() => { const t = document.querySelector(".toast"); return !!t && t.style.display === "block"; })()')); i++) await attendre(100);
      return evalue('document.querySelector(".toast") && document.querySelector(".toast").textContent');
    };
    const presse = () => evalue(`(async () => { const o = {}; for (const i of await navigator.clipboard.read()) for (const t of i.types) o[t] = t === 'image/png' ? 'png' : await (await i.getType(t)).text(); return o; })()`);
    // image du presse-papier : taille et nombre de pixels proches (écart ≤ e par canal) de chaque couleur cherchée
    const image = (couleurs, e = 40) => evalue(`(async () => {
      for (const i of await navigator.clipboard.read()) if (i.types.includes('image/png')) {
        const bm = await createImageBitmap(await i.getType('image/png')), cv = document.createElement('canvas'); cv.width = bm.width; cv.height = bm.height;
        const g = cv.getContext('2d'); g.drawImage(bm, 0, 0); const px = g.getImageData(0, 0, bm.width, bm.height).data, n = {};
        for (const c of ${JSON.stringify(couleurs)}) { const r = parseInt(c.slice(1, 3), 16), v = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); let k = 0;
          for (let j = 0; j < px.length; j += 4) if (Math.abs(px[j] - r) <= ${e} && Math.abs(px[j + 1] - v) <= ${e} && Math.abs(px[j + 2] - b) <= ${e}) k++; n[c] = k; }
        return { l: bm.width, h: bm.height, n };
      }
      return null; })()`);

    const TROIS = 'image/png,text/html,text/plain', SOMBRE = ['#0f161c', '#0a1117'];   // fonds du thème sombre (page, mer)
    const sansSombre = (n) => SOMBRE.every((c) => n[c] === 0);
    // paragraphe : HTML à styles en ligne en thème clair, marqué, lien interne sans adresse ; image du bloc ; texte brut à côté
    mesure();
    const t1 = await copier('x1'), p1 = await presse();
    if (t1 !== 'Copié pour Office') echec('message après la copie : ' + t1);
    if (Object.keys(p1).sort().join() !== TROIS) echec('types du presse-papier (paragraphe) : ' + Object.keys(p1));
    else {
      if (!/<div data-ardoise-office="1">/.test(p1['text/html'])) echec('marque absente du HTML copié : ' + p1['text/html'].slice(0, 200));
      if (!p1['text/html'].includes('background:#e3f3ea;color:#1f7a4d')) echec('pastille hors du thème clair : ' + p1['text/html']);
      if (/class=/.test(p1['text/html'].replace(/<meta[^>]*>/, ''))) echec('classe dans le HTML copié : ' + p1['text/html']);
      if (p1['text/html'].includes('#pg-p1') || !p1['text/html'].includes('<u>lien interne</u>')) echec('lien interne : ' + p1['text/html']);
      // style d'Ardoise (ticket 03 de copie-office-style) : Segoe UI, retrait de 2em de 15 px en points
      if (!p1['text/html'].includes("font-family:'Segoe UI',sans-serif") || !/<p style="[^"]*margin-left:22\.5pt/.test(p1['text/html'])) echec('paragraphe hors du style d\'Ardoise : ' + p1['text/html']);
      if (p1['text/plain'] !== '  Statut #OK et lien interne') echec('texte brut : ' + JSON.stringify(p1['text/plain']));
      // image : 680 px utiles + 2 × 8 de marge, à dpr 2 ; texte foncé et pastille verte du thème clair, aucun fond sombre
      const i1 = await image(['#17212b', '#e3f3ea', ...SOMBRE], 4);
      if (!i1 || i1.l !== 1392) echec('image du paragraphe : ' + JSON.stringify(i1));
      else if (i1.n['#17212b'] < 50 || i1.n['#e3f3ea'] < 50 || !sansSombre(i1.n)) echec('couleurs de l\'image du paragraphe (thème clair attendu) : ' + JSON.stringify(i1.n));
    }

    // recollé dans Ardoise (vrai Ctrl+V) : du texte, comme avant les trois formats, pas un bloc image
    mesure();
    const images = () => evalue('document.querySelectorAll("#app .blk figure.fig img").length');
    const avant = await images();
    await evalue(`(() => { const f = document.querySelector('.fld[data-b="vd"]'); f.focus(); const r = document.createRange(); r.selectNodeContents(f); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
    for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, modifiers: 2, key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, commands: type === 'keyDown' ? ['paste'] : [] });
    await attendre(300);
    const recolle = await evalue('document.querySelector(\'.fld[data-b="vd"]\').textContent');
    if (!/Statut OK et lien interne/.test(recolle)) echec('recollage dans Ardoise : « ' + recolle + ' » au lieu du texte du paragraphe');
    if ((await images()) !== avant) echec('recollage dans Ardoise : un bloc image a été inséré');

    // image copiée ailleurs, avec un HTML sans marque puis seule : un bloc image à chaque fois
    for (const html of ['<p>Image d\'une page web</p>', '']) {
      mesure();
      const blocs0 = await evalue('document.querySelectorAll("#app .blk[data-id]").length');
      await evalue(`(async () => { const png = await (await fetch('data:image/png;base64,${PNG}')).blob();
        const dt = new DataTransfer(); dt.items.add(new File([png], 'image.png', { type: 'image/png' })); if (${JSON.stringify(html)}) dt.setData('text/html', ${JSON.stringify(html)});
        const f = document.querySelector('.fld[data-b="x1"]'); f.focus(); f.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return true; })()`);
      let blocs1 = blocs0;
      for (let i = 0; i < 40 && (blocs1 = await evalue('document.querySelectorAll("#app .blk[data-id]").length')) === blocs0; i++) await attendre(50);
      if (blocs1 !== blocs0 + 1 || !(await evalue('(() => { const b = document.querySelector(".blk[data-id=x1]").nextElementSibling; return !!b && !!b.querySelector("img[src^=\'data:image/png\']"); })()')))
        echec('image collée ' + (html ? 'avec un HTML sans marque' : 'seule') + ' : pas de bloc image après le paragraphe');
    }

    // fiche de faits : trois formats, image en thème clair
    mesure();
    await copier('fa'); const p7 = await presse();
    if (Object.keys(p7).sort().join() !== TROIS) echec('types du presse-papier (fiche de faits) : ' + Object.keys(p7));
    const i7 = await image(['#ffffff', '#17212b', ...SOMBRE], 4);
    if (!i7 || i7.l !== 1392) echec('image de la fiche de faits : ' + JSON.stringify(i7));
    else if (i7.n['#ffffff'] < 1000 || i7.n['#17212b'] < 50 || !sansSombre(i7.n)) echec('couleurs de l\'image de la fiche de faits (thème clair attendu) : ' + JSON.stringify(i7.n));

    // image d'une autre origine dans le bloc : canvas sali, la copie se fait sans image, HTML et texte gardés
    mesure();
    const t8 = await copier('io'), p8 = await presse();
    if (t8 !== 'Copié pour Office') echec('message de la copie sans image : ' + t8);
    if (Object.keys(p8).sort().join() !== 'text/html,text/plain') echec('types du presse-papier (image d\'une autre origine) : ' + Object.keys(p8));
    else if (!/data-ardoise-office/.test(p8['text/html']) || !/autre origine/.test(p8['text/plain'])) echec('copie sans image : ' + JSON.stringify(p8).slice(0, 300));

    // tableau : vrai tableau, en-tête en étiquette (capitales écrites, <td> : Writer centre et graisse un <th>)
    mesure();
    await copier('t1'); const p2 = await presse();
    if (!/<table[\s\S]*>NOM<\/span><\/td>/.test(p2['text/html'] || '') || /<th/.test(p2['text/html'] || '')) echec('tableau copié : ' + p2['text/html']);
    if (p2['text/plain'] !== 'Nom\tÉtat\nServeur\t#OK') echec('texte brut du tableau : ' + JSON.stringify(p2['text/plain']));

    // carte au fond hors ligne : image/png de 680 px utiles (+ 2 × 8 de marge) à dpr 2, mer et épingle en couleurs claires
    mesure();
    await copier('mp'); const p3 = await presse();
    if (Object.keys(p3).sort().join() !== 'image/png,text/plain') echec('types du presse-papier (carte) : ' + Object.keys(p3));
    if (p3['text/plain'] !== 'Carte\n- Paris (48.8500, 2.3500)') echec('texte brut de la carte : ' + JSON.stringify(p3['text/plain']));
    const i3 = await image(['#d9e5ec', '#b42318', '#0a1117'], 4);
    if (!i3 || i3.l !== 1392) echec('image de la carte : ' + JSON.stringify(i3));
    else if (i3.n['#d9e5ec'] < 1000 || i3.n['#b42318'] < 50 || i3.n['#0a1117'] > 0) echec('couleurs de la carte (mer claire, épingle rouge, pas de mer sombre) : ' + JSON.stringify(i3.n));

    // chronologie : image/png, points verts du thème clair
    mesure();
    await copier('tl'); const i4 = await image(['#1f7a4d', '#5fd09a'], 4);
    if (!i4 || i4.l !== 1392) echec('image de la chronologie : ' + JSON.stringify(i4));
    else if (i4.n['#1f7a4d'] < 100 || i4.n['#5fd09a'] > 0) echec('points de la chronologie hors du thème clair : ' + JSON.stringify(i4.n));

    // groupe (ticket 05) : titre en gras, diamant en tableau, sa chronologie en image intégrée au HTML
    mesure();
    await copier('g1'); const p6 = await presse(), h6 = p6['text/html'] || '';
    if (!/<b>Événement<\/b>[\s\S]*<table[\s\S]*<b>Adversaire<\/b>[\s\S]*APT[\s\S]*<img src="data:image\/png;base64,/.test(h6)) echec('groupe copié : ' + h6.slice(0, 400));
    if (!(p6['text/plain'] || '').startsWith('Événement\nTitre\tCampagne X\nAdversaire\tAPT')) echec('texte brut du groupe : ' + JSON.stringify(p6['text/plain']));

    // presse-papier qui refuse : message d'erreur, pas « Copié »
    mesure();
    await evalue('(() => { navigator.clipboard.write = () => Promise.reject(new DOMException("refus", "NotAllowedError")); return true; })()');
    const t5 = await copier('x1');
    if (t5 !== 'Le presse-papier a refusé la copie') echec('message d\'un refus : ' + t5);
  } finally {
    serveur.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
