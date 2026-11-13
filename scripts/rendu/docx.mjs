// Export Word (src/js/08-docx.js) : écrivain de zip stocké et parties WordprocessingML. Le banc relit lui-même le zip
// (méthode 0, CRC vérifié), contrôle que chaque XML est bien formé et cherche dans document.xml ce que l'auteur attend.
import { monter, test, egal, vrai } from './commun.mjs';

const u32 = (o, i) => (o[i] | (o[i + 1] << 8) | (o[i + 2] << 16) | (o[i + 3] << 24)) >>> 0;
const u16 = (o, i) => o[i] | (o[i + 1] << 8);
// lecture d'un zip stocké par son répertoire central : { nom: Uint8Array }
export function lireZip(o, crc32) {
  let fin = o.length - 22; while (fin >= 0 && u32(o, fin) !== 0x06054b50) fin--;
  vrai(fin >= 0, 'fin de répertoire central introuvable');
  const n = u16(o, fin + 10); let p = u32(o, fin + 16); const out = {};
  for (let k = 0; k < n; k++) {
    vrai(u32(o, p) === 0x02014b50, 'entrée du répertoire central ' + k);
    const meth = u16(o, p + 10), crc = u32(o, p + 16), taille = u32(o, p + 20), ln = u16(o, p + 28), lx = u16(o, p + 30), lc = u16(o, p + 32), loc = u32(o, p + 42);
    const nom = new TextDecoder().decode(o.subarray(p + 46, p + 46 + ln));
    egal(meth, 0, 'méthode stockée : ' + nom);
    vrai(u32(o, loc) === 0x04034b50, 'en-tête local de ' + nom);
    const deb = loc + 30 + u16(o, loc + 26) + u16(o, loc + 28), data = o.subarray(deb, deb + taille);
    egal(crc32(data) >>> 0, crc, 'CRC de ' + nom);
    out[nom] = data; p += 46 + ln + lx + lc;
  }
  return out;
}
const texte = (o) => new TextDecoder().decode(o);
// XML bien formé : déclaration, balises équilibrées, attributs entre guillemets, entités connues
export function bienForme(x, nom) {
  vrai(/^<\?xml version="1.0" encoding="UTF-8" standalone="yes"\?>\r?\n?</.test(x), nom + ' : déclaration XML');
  const pile = [], corps = x.replace(/^<\?xml[^>]*\?>/, '');
  const re = /<(\/?)([\w:.-]+)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>|([^<]+)|(<)/g; let m;
  while ((m = re.exec(corps))) {
    if (m[6]) throw new Error(nom + ' : balise mal formée vers ' + corps.slice(m.index, m.index + 80));
    if (m[5] != null) { const e = m[5].replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, ''); vrai(!/[&<>]/.test(e), nom + ' : caractère non échappé dans ' + m[5].slice(0, 80)); continue; }
    if (m[1]) { const o = pile.pop(); egal(o, m[2], nom + ' : fermeture'); }
    else if (!m[4]) pile.push(m[2]);
  }
  egal(pile, [], nom + ' : balises non fermées');
}

test('docx : CRC32 (valeur de référence) et zip stocké relu', () => {
  const { ctx } = monter({ title: 'Doc', pages: [{ id: 'p1', blocks: [] }] });
  egal(ctx.crc32(ctx.utf8('123456789')).toString(16), 'cbf43926');
  const z = ctx.zipStocke([{ nom: 'a.txt', octets: ctx.utf8('été ✓') }, { nom: 'dossier/b.bin', octets: new Uint8Array([0, 255, 7]) }]);
  const lu = lireZip(z, ctx.crc32);
  egal(Object.keys(lu), ['a.txt', 'dossier/b.bin']);
  egal(texte(lu['a.txt']), 'été ✓'); egal([...lu['dossier/b.bin']], [0, 255, 7]);
});

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const P = (t) => '<span class="pill">' + t + '</span>';
const PAGE = { v: 6, title: 'Doc', tags: { ko: { c: 1 } }, pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'hd', type: 'header', eyebrow: 'Rapport', title: 'Incident 42', lede: 'Résumé' },
  { id: 's1', type: 'h2', html: 'Section' }, { id: 's2', type: 'h3', html: 'Sous-section' }, { id: 's3', type: 'subtitle', html: 'Petit titre' },
  { id: 'e1', type: 'step', title: 'Isoler' },
  { id: 'p1', type: 'p', html: 'Voir <a href="https://ex.fr/a?b=1&amp;c=2">le site</a>, <a href="#pg-p1">ici</a>, ' + P('KO') + ' et <b>gras</b>' },
  { id: 'l1', type: 'list', ordered: true, items: [{ html: 'un' }, { html: 'sous', lv: 1 }, { html: 'deux' }] },
  { id: 'l2', type: 'list', ordered: false, items: [{ html: 'puce' }] },
  { id: 'c1', type: 'check', items: [{ html: 'fait', done: true }, { html: 'à faire', lv: 1 }] },
  { id: 't1', type: 'table', rows: [['Nom', 'État'], ['Serveur', '']] },
  { id: 'n1', type: 'note', variant: 'bad', html: 'Attention' },
  { id: 'k1', type: 'code', name: 'a.sh', code: 'echo "<a>"\n\tls\n' },
  { id: 'ft', type: 'footer', html: 'Sources' },
  { id: 'im', type: 'image', src: 'data:image/png;base64,' + PNG, caption: 'Légende' },
  { id: 'g1', type: 'group', title: 'Groupe plié', folded: true, blocks: [{ id: 'gd', type: 'diamond', title: 'Campagne', adversaire: 'A', capacite: '', infrastructure: 'I', victime: 'V' }] },
  { id: 'dv', type: 'divider' },
  { id: 'ex', type: 'image', src: 'https://ex.fr/i.png', caption: 'Externe' },
] }] };
function produire(doc = PAGE, images = { im: { src: 'data:image/png;base64,' + PNG, mime: 'image/png', l: 1360, h: 680 } }) {
  const { ctx, d } = monter(doc);
  const elts = ctx.officeBlocs(d.pages[0].blocks, d, { page: 0, images });
  const z = ctx.docxDepuisElements(elts, d);
  const parts = lireZip(z, ctx.crc32), t = {};
  for (const k in parts) if (/\.(xml|rels)$/.test(k)) t[k] = texte(parts[k]);
  return { parts, t, doc: t['word/document.xml'], ctx };
}
const PARTIES = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/_rels/document.xml.rels'];

test('docx : parties présentes, XML bien formé, types de contenu et relations résolues', () => {
  const { parts, t } = produire();
  for (const p of PARTIES) vrai(parts[p], 'partie absente : ' + p);
  egal(Object.keys(parts).filter((k) => k.startsWith('word/media/')), ['word/media/image1.png']);
  for (const k in t) bienForme(t[k], k);
  const ct = t['[Content_Types].xml'];
  vrai(/<Default Extension="png" ContentType="image\/png"\/>/.test(ct) && /PartName="\/word\/document.xml"/.test(ct) && /PartName="\/word\/numbering.xml"/.test(ct) && /PartName="\/word\/styles.xml"/.test(ct), ct);
  vrai(/Target="word\/document.xml"/.test(t['_rels/.rels']), 'relation du document');
  // chaque r:id / r:embed du document a sa relation
  const rels = t['word/_rels/document.xml.rels'];
  for (const m of t['word/document.xml'].matchAll(/r:(?:id|embed)="([^"]+)"/g)) vrai(rels.includes('Id="' + m[1] + '"'), 'relation absente : ' + m[1]);
});

test('docx : styles Word (Titre, Titre 1 à 3 au volet de navigation, Normal, Code, Légende), page A4 aux marges de l\'impression', () => {
  const { t, doc } = produire(), st = t['word/styles.xml'];
  for (const [id, nom] of [['Title', 'Title'], ['Heading1', 'heading 1'], ['Heading2', 'heading 2'], ['Heading3', 'heading 3'], ['Normal', 'Normal'], ['Code', 'Code'], ['Caption', 'caption']])
    vrai(new RegExp('<w:style w:type="paragraph"[^>]*w:styleId="' + id + '"[^>]*><w:name w:val="' + nom + '"/>').test(st), 'style ' + id);
  for (const n of [0, 1, 2]) vrai(new RegExp('w:styleId="Heading' + (n + 1) + '"[\\s\\S]*?<w:outlineLvl w:val="' + n + '"/>').test(st), 'niveau de plan ' + n);
  vrai(/<w:pgSz w:w="11906" w:h="16838"\/>/.test(doc), 'A4');
  vrai(/<w:pgMar w:top="907" w:right="850" w:bottom="1020" w:left="850"/.test(doc), 'marges de @page');
});

const para = (doc, mot) => (doc.match(new RegExp('<w:p>(?:(?!<w:p>)[\\s\\S])*?' + mot + '[\\s\\S]*?</w:p>')) || [''])[0];
test('docx : en-tête en titre du document, sections en Titre 1 à 3, étape numérotée', () => {
  const { doc } = produire();
  vrai(/<w:pStyle w:val="Title"\/>[\s\S]*?Incident 42/.test(para(doc, 'Incident 42')), 'titre');
  for (const [mot, s] of [['>Section<', 'Heading1'], ['Sous-section', 'Heading2'], ['Petit titre', 'Heading3'], ['1 Isoler', 'Heading1']]) vrai(para(doc, mot).includes('<w:pStyle w:val="' + s + '"/>'), mot + ' → ' + s);
  vrai(doc.indexOf('Rapport') < doc.indexOf('Incident 42') && doc.indexOf('Incident 42') < doc.indexOf('Résumé'), 'surtitre, titre, chapeau');
});

test('docx : liens web cliquables, liens internes en texte, pastille surlignée de sa couleur', () => {
  const { doc, t } = produire(), rels = t['word/_rels/document.xml.rels'];
  const h = doc.match(/<w:hyperlink r:id="(rId\d+)"[^>]*>[\s\S]*?le site[\s\S]*?<\/w:hyperlink>/);
  vrai(h, 'hyperlien'); vrai(new RegExp('Id="' + h[1] + '" Type="[^"]*/hyperlink" Target="https://ex.fr/a\\?b=1&amp;c=2" TargetMode="External"').test(rels), rels);
  vrai(!doc.includes('pg-p1') && /<w:u w:val="single"\/>[\s\S]{0,80}>ici</.test(doc), 'lien interne en texte souligné');
  vrai(/<w:shd w:val="clear" w:color="auto" w:fill="FDECEA"\/>[\s\S]{0,120}<w:t[^>]*>KO</.test(doc) && /<w:color w:val="B42318"\/>[\s\S]{0,120}>KO</.test(doc), 'pastille KO en rouge');
});

test('docx : listes Word à niveaux (numérotée à deux niveaux, puces), cases ☐/☑', () => {
  const { doc, t } = produire(), num = t['word/numbering.xml'];
  const n1 = para(doc, '>un<').match(/<w:ilvl w:val="0"\/><w:numId w:val="(\d+)"\/>/), n2 = para(doc, '>sous<').match(/<w:ilvl w:val="1"\/><w:numId w:val="(\d+)"\/>/);
  vrai(n1 && n2 && n1[1] === n2[1], 'deux niveaux dans la même liste');
  const abs = num.match(new RegExp('<w:num w:numId="' + n1[1] + '"><w:abstractNumId w:val="(\\d+)"/>'));
  vrai(abs && new RegExp('<w:abstractNum w:abstractNumId="' + abs[1] + '"[^>]*>[\\s\\S]*?<w:numFmt w:val="decimal"/>').test(num), 'numérotation décimale');
  const p = para(doc, '>puce<').match(/<w:numId w:val="(\d+)"\/>/);
  vrai(p && p[1] !== n1[1], 'liste à puces : autre numérotation');
  vrai(/☑ [\s\S]*?fait/.test(para(doc, 'fait')) && !para(doc, 'fait').includes('numPr'), 'case cochée sans puce');
  vrai(/<w:ind w:left="(\d+)"/.test(para(doc, 'à faire')), 'case de niveau 1 en retrait');
});

test('docx : tableau à ligne d\'en-tête, cellules jamais vides, encadré, code, ligne, pied de page à sa place', () => {
  const { doc } = produire();
  const tb = doc.match(/<w:tbl>(?:(?!<w:tbl>)[\s\S])*?Serveur[\s\S]*?<\/w:tbl>/)[0];
  vrai(/<w:tblHeader\/>[\s\S]*?Nom/.test(tb) && /<w:tblBorders>/.test(tb), 'en-tête répété, bordures');
  vrai(!/<w:tc>(?:<w:tcPr>(?:(?!<\/w:tcPr>)[\s\S])*<\/w:tcPr>)?<\/w:tc>/.test(doc), 'aucune cellule sans paragraphe');
  vrai(/<w:shd w:val="clear" w:color="auto" w:fill="FDECEA"\/>[\s\S]*?Attention/.test(doc) && /<w:left w:val="single" w:sz="24" w:space="0" w:color="B42318"\/>/.test(doc), 'encadré teinté, barre');
  vrai(/<w:pStyle w:val="Code"\/>[\s\S]*?echo "&lt;a&gt;"<\/w:t><\/w:r><w:r>[\s\S]*?<w:br\/><w:tab\/>/.test(doc), 'code : lignes et tabulation');
  vrai(/<w:pBdr><w:bottom /.test(doc), 'séparateur en ligne horizontale');
  const pied = para(doc, 'Sources');
  vrai(/<w:sz w:val="18"\/>/.test(pied) && /<w:color w:val="566573"\/>/.test(pied), 'pied de page petit et gris');
  vrai(doc.indexOf('Sources') < doc.indexOf('Légende'), 'pied de page gardé à sa place');
});

test('docx : image intégrée à la largeur de la page avec sa relation et sa légende ; image externe en texte', () => {
  const { doc, t, parts } = produire();
  vrai(/<wp:extent cx="6477000" cy="3238500"\/>/.test(doc), 'bornée à 680 px (EMU)');
  const e = doc.match(/<a:blip r:embed="(rId\d+)"\/>/); vrai(e, 'image');
  vrai(new RegExp('Id="' + e[1] + '" Type="[^"]*/image" Target="media/image1.png"').test(t['word/_rels/document.xml.rels']), 'relation de l\'image');
  egal([...parts['word/media/image1.png'].subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'octets PNG décodés');
  vrai(para(doc, '>Légende<').includes('<w:pStyle w:val="Caption"/>'), 'légende');
  vrai(doc.includes('[Image : Externe]'), 'image externe : texte');
  egal([...doc.matchAll(/<wp:docPr id="(\d+)"/g)].length, 1);
});

test('docx : groupe ouvert (titre en gras puis ses blocs) et modèle diamant en tableau', () => {
  const { doc } = produire();
  vrai(/<w:b\/>[\s\S]{0,60}Groupe plié/.test(para(doc, 'Groupe plié')), 'titre du groupe en gras');
  const tb = doc.match(/<w:tbl>(?:(?!<w:tbl>)[\s\S])*?Campagne[\s\S]*?<\/w:tbl>/)[0];
  egal([...tb.matchAll(/<w:tr>/g)].length, 5, 'titre et quatre sommets');
  egal([...tb.matchAll(/<w:t[^>]*>(Titre|Adversaire|Capacité|Infrastructure|Victime)</g)].map((m) => m[1]), ['Titre', 'Adversaire', 'Capacité', 'Infrastructure', 'Victime']);
  vrai(doc.indexOf('Groupe plié') < doc.indexOf('Campagne'), 'ordre');
});

test('docx : caractères interdits en XML retirés, texte gardé', () => {
  const { doc } = produire({ title: 'D', pages: [{ id: 'p1', blocks: [{ id: 'x', type: 'p', html: 'a\u0001b\u000bc &amp; &lt;d&gt;' }] }] }, {});
  vrai(doc.includes('>abc &amp; &lt;d&gt;</w:t>'), doc);
});

test('docx : deux tableaux qui se suivent restent séparés (Word fusionne des tableaux contigus) ; code en Courier New', () => {
  const { doc, t } = produire({ title: 'D', pages: [{ id: 'p1', blocks: [{ id: 'a', type: 'diamond', title: 'X' }, { id: 'b', type: 'note', html: 'n' }, { id: 'c', type: 'code', code: 'x' }] }] }, {});
  vrai(!doc.includes('</w:tbl><w:tbl>'), 'tableaux contigus');
  vrai(!/Consolas/.test(doc + t['word/styles.xml']) && /w:ascii="Courier New"/.test(t['word/styles.xml']), 'police à chasse fixe présente partout');
});

test('docx : nom de fichier tiré du titre du bloc, sinon de la page, nettoyé', () => {
  const { ctx, d } = monter({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 'hd', type: 'header', title: 'Rapport : <i>incident</i> n° 42 / été' }, { id: 's', type: 'h2', html: 'Section ?' }, { id: 'e', type: 'step', title: 'Isoler' },
    { id: 'g', type: 'group', title: 'Détails', blocks: [] }, { id: 'dm', type: 'diamond', title: '' }, { id: 'q', type: 'query', title: 'Hôtes' }, { id: 'x', type: 'p', html: 'texte' },
  ] }, { id: 'p2', title: '', blocks: [{ id: 'y', type: 'p', html: 'b' }] }] });
  const nom = (id, pi = 0) => ctx.nomExportWord(id ? d.pages[pi].blocks.find((b) => b.id === id) : null, d, pi);
  egal(nom(null), 'Rapport-incident-n-42-ete.docx', 'page : titre de l\'en-tête');
  egal(['s', 'e', 'g', 'q'].map((id) => nom(id)), ['Section.docx', 'Isoler.docx', 'Details.docx', 'Hotes.docx']);
  egal(nom('dm'), 'Rapport-incident-n-42-ete.docx', 'diamant sans titre : celui de la page');
  egal(nom('x'), 'Rapport-incident-n-42-ete.docx', 'paragraphe : titre de la page');
  egal(nom(null, 1), 'Page-2.docx', 'page sans titre : son nom par défaut');
  egal(ctx.nomDeFichier('///'), 'page', 'rien de lisible');
});

test('docx : une fiche de faits ou un tableau sans ligne n\'écrit aucun tableau (Word refuse un tableau sans ligne)', () => {
  const { doc } = produire({ title: 'D', pages: [{ id: 'p1', blocks: [{ id: 'f', type: 'facts', items: [] }, { id: 't', type: 'table', rows: [] }, { id: 'x', type: 'p', html: 'fin' }] }] }, {});
  for (const m of doc.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)) vrai(m[0].includes('<w:tr>'), 'tableau sans ligne : ' + m[0].slice(0, 200));
  vrai(!doc.includes('<w:tbl>'), 'aucun tableau attendu : ' + doc.slice(0, 400));
  vrai(doc.includes('>fin</w:t>'), 'le reste de la page');
});
