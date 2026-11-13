// Sujet : déplacer un bloc vers une autre page. Bouton de la barre du bloc, liste des pages (hiérarchie, filtre sans casse
// ni accents, flèches, Entrée, Échap, page affichée inactive), section emportée avec son contenu, message « Ouvrir »,
// Ctrl+Z, lien vers l'ancienne adresse de la section suivi dans l'éditeur et dans l'export, liste tenue sur un téléphone.
// Origine : spec pages-et-fichiers, élément 37.

const PAGES = (n) => {
  const pages = [
    { id: 'p1', title: 'Accueil', blocks: [
      { id: 'hd1', type: 'header', title: 'Accueil' },
      { id: 'lien', type: 'p', html: 'Voir <a href="#pg-p1/s1">les courses</a>.' },
      { id: 's1', type: 'h2', html: 'Courses' }, { id: 'x1', type: 'p', html: 'du pain' },
      { id: 's2', type: 'h3', html: 'Marché' }, { id: 'x2', type: 'p', html: 'des pommes' },
      { id: 's3', type: 'h2', html: 'Voyage' }, { id: 'x3', type: 'p', html: 'le train' },
    ] },
    { id: 'p2', title: 'Suite', blocks: [{ id: 'hd2', type: 'header', title: 'Suite' }, { id: 'y1', type: 'p', html: 'déjà là' }, { id: 'f2', type: 'footer', html: 'Pied de la suite' }] },
    { id: 'p3', title: 'Été', lv: 1, blocks: [{ id: 'hd3', type: 'header', title: 'Été' }] },
  ];
  for (let i = 4; i <= n; i++) pages.push({ id: 'p' + i, title: 'Page ' + i, blocks: [{ id: 'hd' + i, type: 'header', title: 'Page numéro ' + i }] });
  // de quoi faire défiler la page cible : la section déplacée arrive bien plus bas que le haut de l'écran
  for (let i = 0; i < 30; i++) pages[1].blocks.splice(2, 0, { id: 'long' + i, type: 'p', html: 'Ligne de remplissage ' + i });
  return pages;
};
const CHARGER = (n) => `(() => { const d = JSON.parse(JSON.stringify(window.ardoise.doc)); d.pages = ${JSON.stringify(PAGES(n))}; return window.ardoise.load(d); })()`;
const IDS = `window.ardoise.doc.pages.map((p) => p.blocks.map((b) => b.id).filter((id) => !/^long/.test(id)).join(','))`;
const OUVRIR = (id) => `(() => { const b = document.querySelector('.blk[data-id="${id}"] [data-act="move-page"]'); if (!b) return false; b.click(); return !!document.querySelector('.move-pop'); })()`;
const LISTE = `[...document.querySelectorAll('.move-pop .menu-list .mi')].map((b) => ({ t: b.querySelector('span:last-child').firstChild.textContent, off: b.getAttribute('aria-disabled') === 'true', act: b.classList.contains('act'), ml: parseFloat(getComputedStyle(b).marginLeft) || 0 }))`;
const TAPER = (v) => `(() => { const q = document.querySelector('.move-pop [data-q]'); q.value = ${JSON.stringify(v)}; q.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`;
const TOUCHE = (key, opts = {}) => `(() => { const t = document.querySelector('.move-pop [data-q]') || document.activeElement || document.body; t.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }, ${JSON.stringify(opts)}))); return true; })()`;
const VISIBLE = (id) => `(() => { const e = document.getElementById('b-${id}') || document.querySelector('.blk[data-id="${id}"]'); if (!e || e.offsetParent === null) return false; const r = e.getBoundingClientRect(); return r.top >= -1 && r.top < innerHeight; })()`;

export const nom = 'déplacer un bloc';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  await ecran(1000, false);
  await charger(); await evalue(CHARGER(3)); await attendre(100);

  // le bouton : sur chaque bloc sauf l'en-tête
  mesure();
  if (await evalue(`!!document.querySelector('.blk[data-id="hd1"] [data-act="move-page"]')`)) echec('l\'en-tête propose « Déplacer vers la page… »');
  if (!(await evalue(OUVRIR('s1')))) { echec('pas de fenêtre « Déplacer vers la page… » sur la section'); return; }

  // la liste : pages seules, hiérarchie, page affichée inactive et non choisie au départ
  let l = await evalue(LISTE); mesure();
  if (l.map((x) => x.t).join('|') !== 'Accueil|Suite|Été') echec('pages de la liste : ' + l.map((x) => x.t).join('|'));
  else {
    if (!l[0].off || l[1].off) echec('page affichée pas inactive, ou cible inactive');
    if (!(l[2].ml > l[1].ml)) echec('sous-page sans retrait dans la liste');
    if (!l[1].act) echec('la première page choisissable n\'est pas sélectionnée au départ');
  }
  // filtre sans casse ni accents
  await evalue(TAPER('ETE')); l = await evalue(LISTE); mesure();
  if (l.map((x) => x.t).join('|') !== 'Été') echec('filtre « ETE » : ' + l.map((x) => x.t).join('|'));
  await evalue(TAPER('')); await evalue(TOUCHE('ArrowDown')); l = await evalue(LISTE); mesure();
  if (!l[2] || !l[2].act) echec('flèche ↓ : « Été » pas sélectionnée');
  await evalue(TOUCHE('ArrowUp')); await evalue(TOUCHE('ArrowUp')); l = await evalue(LISTE); mesure();
  if (!l[1].act) echec('flèche ↑ : la page affichée (inactive) ne doit pas être sélectionnée');
  await evalue(TOUCHE('Escape')); mesure();
  if (await evalue(`!!document.querySelector('.move-pop')`)) echec('Échap ne ferme pas la liste');

  // déplacement de la section au clavier : filtre, Entrée
  await evalue(OUVRIR('s1')); await evalue(TAPER('suite')); await evalue(TOUCHE('Enter')); await attendre(100);
  mesure();
  const apres = await evalue(IDS);
  if (apres.join(' / ') !== 'hd1,lien,s3,x3 / hd2,y1,s1,x1,s2,x2,f2 / hd3') echec('après le déplacement : ' + apres.join(' / '));
  const toast = await evalue(`(() => { const t = document.querySelector('.toast'); return t && getComputedStyle(t).display !== 'none' ? { txt: t.textContent, btn: !!t.querySelector('button') } : null; })()`);
  if (!toast || !/Déplacé vers « Suite »/.test(toast.txt) || !toast.btn) echec('message après le déplacement : ' + JSON.stringify(toast));
  if (await evalue(`document.querySelector('.blk[data-id="s1"]') !== null`)) echec('on n\'est pas resté sur la page source');
  const annuler = await evalue(`document.querySelector('#ui [data-ui=undo]').title`);
  if (annuler !== 'Annuler : Accueil · Titre de section « Courses » : bloc déplacé vers « Suite » (Ctrl+Z)') echec('libellé d\'annulation : ' + annuler);

  // Ctrl+Z en une fois, puis rétablir
  await evalue(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })), true`); await attendre(50);
  mesure();
  if ((await evalue(IDS)).join(' / ') !== 'hd1,lien,s1,x1,s2,x2,s3,x3 / hd2,y1,f2 / hd3') echec('Ctrl+Z ne remet pas la section en une fois : ' + (await evalue(IDS)).join(' / '));
  await evalue(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })), true`); await attendre(50);

  // « Ouvrir » : page cible, section dans la fenêtre
  await evalue(OUVRIR('s3')); await evalue(TAPER('suite')); await evalue(TOUCHE('Enter')); await attendre(100);
  await evalue(`document.querySelector('.toast button').click(), true`); await attendre(200);
  mesure();
  if (!(await evalue(VISIBLE('s3')))) echec('« Ouvrir » ne montre pas la section déplacée sur la page cible');
  if (await evalue(`getComputedStyle(document.querySelector('.toast')).display !== 'none'`)) echec('le message reste affiché après « Ouvrir »');

  // le lien vers l'ancienne adresse de la section (#pg-p1/s1) la retrouve : Ctrl+clic en édition depuis Accueil
  await evalue(`document.querySelector('[data-pg="0"]').click(), true`); await attendre(100);
  await evalue(`document.querySelector('.blk[data-id="lien"] a').dispatchEvent(new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true })), true`); await attendre(200);
  mesure();
  if (await evalue('window.ardoise.doc.pages.findIndex((p) => p.blocks.some((b) => b.id === "hd2"))') !== await evalue(`+document.querySelector('[aria-current="page"][data-pg]').getAttribute('data-pg')`)) echec('le lien n\'ouvre pas la page réelle de la section');
  if (!(await evalue(VISIBLE('s1')))) echec('le lien n\'amène pas la section déplacée dans la fenêtre (édition)');

  // même lien dans l'export statique : la page qui contient la section s'affiche
  await evalue(`(() => { const B = window.Blob; window.Blob = function (parts, o) { window.__export = parts.join(''); return new B(parts, o); }; return true; })()`);
  await evalue(`document.querySelector('[data-ui="file"]').click(), true`); await attendre(50);
  await evalue(`document.querySelector('[data-f="export"]').click(), true`); await attendre(100);
  const html = await evalue('window.__export || ""');
  if (!html) echec('export statique non capturé');
  else {
    await cdp('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') }); await attendre(400);
    await evalue(`document.querySelector('a[href="#pg-p1/s1"]').click(), true`); await attendre(200);
    mesure();
    if (!(await evalue(VISIBLE('s1')))) echec('export : le lien n\'affiche pas la section sur sa nouvelle page');
  }

  // téléphone : la liste tient dans l'écran et défile
  for (const w of [320, 360]) {
    await ecran(w, true, 640);
    await charger(); await evalue(CHARGER(14)); await attendre(100);
    if (!(await evalue(OUVRIR('x1')))) { echec(w + ' px : pas de liste'); continue; }
    const o = await evalue(`(() => { const p = document.querySelector('.move-pop').getBoundingClientRect(), li = document.querySelector('.move-pop .menu-list');
      return { g: p.left, d: p.right, h: p.top, b: p.bottom, iw: innerWidth, ih: innerHeight, defile: li.scrollHeight > li.clientHeight && getComputedStyle(li).overflowY !== 'visible' }; })()`);
    mesure();
    if (o.g < 0 || o.d > o.iw || o.h < 0 || o.b > o.ih) echec(`${w} px : la liste sort de l'écran (${Math.round(o.g)}–${Math.round(o.d)} × ${Math.round(o.h)}–${Math.round(o.b)}, écran ${o.iw} × ${o.ih})`);
    if (!o.defile) echec(`${w} px : la liste de 14 pages ne défile pas`);
    await evalue(TOUCHE('Escape'));
  }
}
