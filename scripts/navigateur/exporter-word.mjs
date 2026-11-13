// Sujet : « Exporter en Word (.docx) » : menu Fichier, menu Lecture et menu ⋯ d'un bloc téléchargent un .docx dont le zip
// est valide (relu par son répertoire central), nommé d'après le titre, sans modifier le document ni l'historique ;
// une carte au fond hors ligne y entre en image PNG. Origine : spec groupe-office-diamant, ticket 05.
const DOC = { v: 6, id: 'doc-exporter-word', title: 'Word', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'hd', type: 'header', title: 'Rapport d’incident' },
  { id: 'x1', type: 'p', html: 'Texte <b>gras</b>' },
  { id: 'g1', type: 'group', title: 'Événement', folded: true, blocks: [{ id: 'dm', type: 'diamond', title: 'Campagne X', adversaire: 'APT', capacite: '', infrastructure: '', victime: '' }] },
  { id: 'mp', type: 'map', height: 300, bg: 'vector', view: { lat: 48, lon: 2, z: 4 }, markers: [{ lat: 48.85, lon: 2.35, label: 'Paris', color: 'bad' }], zones: [], routes: [], list: false },
] }] };

// téléchargement intercepté : type, nom, octets (en base64) et liste des parties du zip relue dans la page
const GUET = `(() => { window.__dl = null; const o = URL.createObjectURL, c = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (b) => { window.__blob = b; return o.call(URL, b); };
  HTMLAnchorElement.prototype.click = function () { if (this.download) { const b = window.__blob; b.arrayBuffer().then((a) => { const u = new Uint8Array(a), dv = new DataView(a);
    let f = u.length - 22; while (f >= 0 && dv.getUint32(f, true) !== 0x06054b50) f--;
    const noms = []; if (f >= 0) { let p = dv.getUint32(f + 16, true); for (let k = 0; k < dv.getUint16(f + 10, true); k++) { const ln = dv.getUint16(p + 28, true); noms.push(new TextDecoder().decode(u.subarray(p + 46, p + 46 + ln))); p += 46 + ln + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true); } }
    const doc = noms.includes('word/document.xml') ? (() => { let p = dv.getUint32(f + 16, true); for (;;) { const ln = dv.getUint16(p + 28, true), nm = new TextDecoder().decode(u.subarray(p + 46, p + 46 + ln)), loc = dv.getUint32(p + 42, true);
      if (nm === 'word/document.xml') { const deb = loc + 30 + dv.getUint16(loc + 26, true) + dv.getUint16(loc + 28, true); return new TextDecoder().decode(u.subarray(deb, deb + dv.getUint32(p + 20, true))); } p += 46 + ln + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true); } })() : '';
    window.__dl = { nom: this.download, type: b.type, pk: u[0] === 0x50 && u[1] === 0x4b && u[2] === 3 && u[3] === 4, noms, doc }; }); return; } return c.call(this); }; return true; })()`;

export const nom = 'exporter en Word';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(100);
  await evalue(GUET);
  const telecharge = async (clic) => {
    await evalue('window.__dl = null; true');
    await evalue(clic);
    for (let i = 0; i < 150 && !(await evalue('!!window.__dl')); i++) await attendre(100);
    return evalue('window.__dl');
  };
  const avant = await evalue('JSON.stringify(window.ardoise.doc)');
  const basculer = async () => { for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, modifiers: 2, key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69 }); await attendre(150); };
  const enLecture = () => evalue(`(() => { const v = document.querySelector('[data-ui=vmenu]'); return !!v && v.offsetParent !== null; })()`);
  if (!(await enLecture())) await basculer();
  if (!(await enLecture())) echec('mode lecture introuvable');

  // lecture : menu ⋯ de la barre, « Exporter la page en Word (.docx) »
  mesure();
  const lu = await telecharge(`(() => { document.querySelector('[data-ui=vmenu]').click(); const x = document.querySelector('.pop [data-vm=word]'); if (x) x.click(); return !!x; })()`);
  if (!lu) echec('menu Lecture : aucun téléchargement');
  else {
    if (lu.nom !== 'Rapport-d-incident.docx') echec('nom du fichier : ' + lu.nom);
    if (lu.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') echec('type : ' + lu.type);
    if (!lu.pk) echec('le fichier ne commence pas par un en-tête de zip');
    for (const p of ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/media/image1.png']) if (!lu.noms.includes(p)) echec('partie absente : ' + p + ' (' + lu.noms.join(', ') + ')');
    if (!/Événement[\s\S]*Campagne X[\s\S]*<a:blip/.test(lu.doc)) echec('groupe, diamant puis carte en image attendus dans document.xml');
  }

  // édition : menu Fichier, puis menu ⋯ du groupe
  await basculer();
  for (let i = 0; i < 40 && !(await evalue('!!document.querySelector(".blk[data-id=g1] [data-act=menu-bloc]")')); i++) await attendre(50);
  const annuler = await evalue(`document.querySelector('[data-ui=undo]').title`);
  mesure();
  const fi = await telecharge(`(() => { document.querySelector('[data-ui=file]').click(); const x = document.querySelector('.pop [data-f=word]'); if (x) x.click(); return !!x; })()`);
  if (!fi || !fi.pk || fi.nom !== 'Rapport-d-incident.docx') echec('menu Fichier : ' + JSON.stringify(fi && { nom: fi.nom, pk: fi.pk }));
  mesure();
  const bl = await telecharge(`(() => { document.querySelector('.blk[data-id="g1"] [data-act="menu-bloc"]').click(); const x = [...document.querySelectorAll('.menu-bloc .mi')].find((m) => m.textContent.includes('Exporter en Word (.docx)')); if (x) x.click(); return !!x; })()`);
  if (!bl) echec('menu ⋯ du bloc : aucun téléchargement');
  else {
    if (bl.nom !== 'Evenement.docx') echec('nom tiré du titre du groupe : ' + bl.nom);
    if (!/Campagne X/.test(bl.doc) || /Texte/.test(bl.doc)) echec('le bloc seul attendu');
  }
  mesure();
  if ((await evalue('JSON.stringify(window.ardoise.doc)')) !== avant) echec('le document a changé');
  if ((await evalue(`document.querySelector('[data-ui=undo]').title`)) !== annuler) echec('une étape d\'annulation est apparue');
}
