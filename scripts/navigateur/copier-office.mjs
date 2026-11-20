// Sujet : « Copier pour Office » (menu ⋯ d'un bloc). Un texte ou un tableau part en HTML à styles en ligne marqué d'Ardoise,
// en thème clair même sous le thème sombre, avec un texte brut, sans image (Writer ne collerait que l'image) ; une carte (fond
// hors ligne) ou une chronologie part en image PNG dessinée à la largeur de la page imprimée, à dpr 2, avec son texte brut.
// Recollé dans Ardoise, le bloc copié reste du texte ; une image venue d'ailleurs reste un bloc image. Un presse-papier qui
// refuse donne un message d'erreur.
// Origine : spec groupe-office-diamant, ticket 04 ; spec copie-office-style, tickets 02 et 09. Presse-papier, canvas et menu
// ne se voient que dans un vrai navigateur.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEklEQVR4nGP4z8AARwzEcQAAh5gP8Y7Dc3sAAAAASUVORK5CYII=';   // 4 × 4 px
const P = (t) => '<span class="pill">' + t + '</span>';
const DOC = { v: 6, id: 'doc-copier-office', title: 'Office', theme: 'dark', tags: { ok: { c: 0 } }, pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'x1', type: 'p', indent: 1, html: 'Statut ' + P('OK') + ' et <a href="#pg-p1">lien interne</a>' },
  { id: 'fa', type: 'facts', items: [{ k: 'Hôte', v: 'srv1', alert: false }, { k: 'Risque', v: 'élevé', alert: true }] },
  { id: 'vd', type: 'p', html: '' },
  { id: 't1', type: 'table', rows: [['Nom', 'État'], ['Serveur', P('OK')]] },
  { id: 'tl', type: 'timeline', orient: 'v', items: [{ date: '2024', title: 'Début', text: '', color: 'ok' }, { date: '2025', title: 'Fin', text: '', color: 'ok' }] },
  { id: 'mp', type: 'map', height: 300, bg: 'vector', view: { lat: 48, lon: 2, z: 4 }, markers: [{ lat: 48.85, lon: 2.35, label: 'Paris', color: 'bad' }], zones: [], routes: [], list: false },
  // bloc texte mêlé (ticket 08 du bloc texte) : numéros qui repartent à 1, puce imbriquée, cases, sous-titre, centrée, Petit, Grand
  { id: 'tm', type: 'texte', lignes: [{ html: 'Étapes', genre: 'soustitre' }, { html: 'Geler', genre: 'numero' }, { html: 'prévenir', genre: 'puce', lv: 1 },
    { html: 'Déployer', genre: 'numero' }, { html: 'Remarque', align: 'centre', taille: 'petit' }, { html: 'Relancer', genre: 'numero', taille: 'grand' },
    { html: 'Serveurs', genre: 'case', done: true }, { html: 'Sauvegardes', genre: 'case', lv: 1 }] },
  { id: 'g1', type: 'group', title: 'Événement', folded: false, blocks: [
    { id: 'dm', type: 'diamond', title: 'Campagne X', adversaire: 'APT', capacite: '', infrastructure: '', victime: '' },
    { id: 'gt', type: 'timeline', orient: 'v', items: [{ date: '2024', title: 'Début', text: '', color: 'ok' }] }] },
] }] };

export const nom = 'copier pour Office';
export default async function ({ ecran, cdp, evalue, attendre, mesure, echec }) {
  const dir = mkdtempSync(join(tmpdir(), 'ardoise-office-'));
  try {
    const source = readFileSync(new URL('../../dist/ardoise.html', import.meta.url), 'utf8');
    const balise = '<script id="ardoise-doc" type="application/json">{}</script>';
    if (!source.includes(balise)) throw new Error('document embarqué introuvable dans dist/ardoise.html');
    const fichier = join(dir, 'office.html');
    writeFileSync(fichier, source.replace(balise, balise.replace('{}', JSON.stringify(DOC).replace(/<\//g, '<\\/'))));
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

    const DEUX = 'text/html,text/plain';   // sans image/png
    // paragraphe : HTML à styles en ligne en thème clair, marqué, lien interne sans adresse ; texte brut à côté
    mesure();
    const t1 = await copier('x1'), p1 = await presse();
    if (t1 !== 'Copié pour Office') echec('message après la copie : ' + t1);
    if (Object.keys(p1).sort().join() !== DEUX) echec('types du presse-papier (paragraphe) : ' + Object.keys(p1));
    else {
      if (!/<div data-ardoise-office="1">/.test(p1['text/html'])) echec('marque absente du HTML copié : ' + p1['text/html'].slice(0, 200));
      if (!p1['text/html'].includes('background:#e3f3ea;color:#1f7a4d')) echec('pastille hors du thème clair : ' + p1['text/html']);
      if (/class=/.test(p1['text/html'].replace(/<meta[^>]*>/, ''))) echec('classe dans le HTML copié : ' + p1['text/html']);
      if (p1['text/html'].includes('#pg-p1') || !p1['text/html'].includes('<u>lien interne</u>')) echec('lien interne : ' + p1['text/html']);
      // style d'Ardoise (ticket 03 de copie-office-style) : Segoe UI, retrait de 2em de 15 px en points
      if (!p1['text/html'].includes("font-family:'Segoe UI',sans-serif") || !/<p style="[^"]*margin-left:22\.5pt/.test(p1['text/html'])) echec('paragraphe hors du style d\'Ardoise : ' + p1['text/html']);
      if (p1['text/plain'] !== '  Statut #OK et lien interne') echec('texte brut : ' + JSON.stringify(p1['text/plain']));
    }

    // recollé dans Ardoise (vrai Ctrl+V) : du texte, pas un bloc image
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

    // fiche de faits : HTML et texte, sans image
    mesure();
    await copier('fa'); const p7 = await presse();
    if (Object.keys(p7).sort().join() !== DEUX) echec('types du presse-papier (fiche de faits) : ' + Object.keys(p7));
    else if (!/data-ardoise-office/.test(p7['text/html']) || !/Hôte/.test(p7['text/plain'])) echec('fiche de faits copiée : ' + JSON.stringify(p7).slice(0, 300));

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

    // groupe (ticket 05) : titre semi-gras marqué, diamant en losange (noms en étiquette), sa chronologie en image intégrée au HTML
    mesure();
    await copier('g1'); const p6 = await presse(), h6 = p6['text/html'] || '';
    if (!/font-weight:600">[\s\S]{0,80}Événement<\/p>[\s\S]*<table[\s\S]*>ADVERSAIRE<\/span><\/p>[\s\S]*APT[\s\S]*<img src="data:image\/png;base64,/.test(h6)) echec('groupe copié : ' + h6.slice(0, 400));
    if (!(p6['text/plain'] || '').startsWith('Événement\nTitre\tCampagne X\nAdversaire\tAPT')) echec('texte brut du groupe : ' + JSON.stringify(p6['text/plain']));

    // bloc texte mêlé : listes imbriquées aux numéros d'Ardoise, cases en paragraphes, alignement et taille ; texte brut à marques
    mesure();
    await copier('tm'); const p8 = await presse(), h8 = (p8['text/html'] || '').replace(/ style="[^"]*"/g, '').replace(/<\/?span>/g, '');
    if (!h8.includes('<h3>Étapes</h3><ol type="1"><li>Geler<ul type="circle"><li>prévenir</li></ul></li><li>Déployer</li></ol><p>Remarque</p><ol type="1"><li>Relancer</li></ol><p>☑ Serveurs</p><p>☐ Sauvegardes</p>')) echec('bloc texte copié : ' + h8);
    if (!/text-align:center;font-size:9\.75pt;">Remarque/.test(p8['text/html'] || '') || !/font-size:13\.5pt;">Relancer/.test(p8['text/html'] || '')) echec('alignement et taille du bloc texte : ' + p8['text/html']);
    if (p8['text/plain'] !== 'Étapes\n1. Geler\n  - prévenir\n2. Déployer\nRemarque\n1. Relancer\n☑ Serveurs\n  ☐ Sauvegardes') echec('texte brut du bloc texte : ' + JSON.stringify(p8['text/plain']));

    // presse-papier qui refuse : message d'erreur, pas « Copié »
    mesure();
    await evalue('(() => { navigator.clipboard.write = () => Promise.reject(new DOMException("refus", "NotAllowedError")); return true; })()');
    const t5 = await copier('x1');
    if (t5 !== 'Le presse-papier a refusé la copie') echec('message d\'un refus : ' + t5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
