/* ---------- Export Word (module pur : sans DOM, testé dans le banc du rendu) ----------
   Éléments neutres de 08-office.js → fichier .docx : un petit écrivain de zip « stocké » (sans compression, CRC32 calculé)
   assemble les parties WordprocessingML. Aucune bibliothèque ; rend des octets, le téléchargement est l'affaire de l'appelant. */

// texte → octets UTF-8 (sans TextEncoder : absent du banc vm)
function utf8(s) {
  s = String(s); var out = [], i, c;
  for (i = 0; i < s.length; i++) {
    c = s.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { var c2 = s.charCodeAt(i + 1); if (c2 >= 0xdc00 && c2 < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00); i++; } }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | c >> 6, 0x80 | c & 63);
    else if (c < 0x10000) out.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    else out.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
  }
  return new Uint8Array(out);
}
var CRC_TABLE = null;
function crc32(o) {
  if (!CRC_TABLE) { CRC_TABLE = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; } }
  var crc = 0xffffffff;
  for (var i = 0; i < o.length; i++) crc = CRC_TABLE[(crc ^ o[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
// parties [{ nom, octets }] → zip stocké (méthode 0), noms en UTF-8 (drapeau 11), date DOS fixe (1er janvier 2026)
function zipStocke(parties) {
  var morceaux = [], central = [], pos = 0, DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
  var mot = function (arr, v, n) { for (var i = 0; i < n; i++) arr.push((v >>> (8 * i)) & 255); };
  parties.forEach(function (p) {
    var nom = utf8(p.nom), o = p.octets, crc = crc32(o), h = [];
    mot(h, 0x04034b50, 4); mot(h, 20, 2); mot(h, 0x800, 2); mot(h, 0, 2); mot(h, 0, 2); mot(h, DATE, 2);
    mot(h, crc, 4); mot(h, o.length, 4); mot(h, o.length, 4); mot(h, nom.length, 2); mot(h, 0, 2);
    var c = [];
    mot(c, 0x02014b50, 4); mot(c, 20, 2); mot(c, 20, 2); mot(c, 0x800, 2); mot(c, 0, 2); mot(c, 0, 2); mot(c, DATE, 2);
    mot(c, crc, 4); mot(c, o.length, 4); mot(c, o.length, 4); mot(c, nom.length, 2); mot(c, 0, 2); mot(c, 0, 2); mot(c, 0, 2); mot(c, 0, 2); mot(c, 0, 4); mot(c, pos, 4);
    morceaux.push(new Uint8Array(h), nom, o); central.push(new Uint8Array(c), nom);
    pos += h.length + nom.length + o.length;
  });
  var tc = central.reduce(function (s, x) { return s + x.length; }, 0), fin = [];
  mot(fin, 0x06054b50, 4); mot(fin, 0, 2); mot(fin, 0, 2); mot(fin, parties.length, 2); mot(fin, parties.length, 2); mot(fin, tc, 4); mot(fin, pos, 4); mot(fin, 0, 2);
  var tout = morceaux.concat(central, [new Uint8Array(fin)]), out = new Uint8Array(pos + tc + fin.length), k = 0;
  tout.forEach(function (x) { out.set(x, k); k += x.length; });
  return out;
}

/* Éléments neutres → fichier .docx (octets). Page A4 aux marges de l'impression (@page de page.css : 16 mm, 15 mm, 18 mm) */
var DOCX_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
var DOCX_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
var DOCX_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
var DOCX_EMU = 9525, DOCX_TEXTE = 11906 - 2 * 850;   // EMU par px ; largeur utile en twips (en px : OFFICE_LARGEUR, 08-office.js)
// texte XML : caractères interdits retirés, &, < et > échappés (et " dans un attribut)
function xmlTexte(s) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(^|[^\ud800-\udbff])[\udc00-\udfff]/g, '$1').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function xmlAttr(s) { return xmlTexte(s).replace(/"/g, '&quot;'); }
function docxCouleur(c) { return String(c || '').replace('#', '').toUpperCase(); }
// octets d'une image data:image/png|jpeg;base64 (null sinon) ; décodeur base64 du module (atob absent du banc vm)
function docxImage(src) {
  var m = /^data:image\/(png|jpe?g);base64,([\s\S]*)$/i.exec(String(src || '')); if (!m) return null;
  var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', s = m[2].replace(/[^A-Za-z0-9+/]/g, ''), out = new Uint8Array(Math.floor(s.length * 3 / 4)), k = 0, i, v;
  for (i = 0; i + 1 < s.length; i += 4) {
    v = (A.indexOf(s[i]) << 18) | (A.indexOf(s[i + 1]) << 12) | ((i + 2 < s.length ? A.indexOf(s[i + 2]) : 0) << 6) | (i + 3 < s.length ? A.indexOf(s[i + 3]) : 0);
    out[k++] = v >> 16 & 255; if (i + 2 < s.length) out[k++] = v >> 8 & 255; if (i + 3 < s.length) out[k++] = v & 255;
  }
  return { ext: /png/i.test(m[1]) ? 'png' : 'jpeg', octets: out.subarray(0, k) };
}
// dimensions lues dans l'image (en-tête PNG, segment SOF d'un JPEG) quand l'appelant ne les a pas fournies
function docxDimensions(img) {
  var o = img.octets, i;
  if (img.ext === 'png' && o.length > 24) return { l: (o[16] << 24 | o[17] << 16 | o[18] << 8 | o[19]) >>> 0, h: (o[20] << 24 | o[21] << 16 | o[22] << 8 | o[23]) >>> 0 };
  for (i = 2; i + 9 < o.length;) {
    if (o[i] !== 0xff) { i++; continue; }
    var t = o[i + 1]; if (t >= 0xc0 && t <= 0xcf && t !== 0xc4 && t !== 0xc8 && t !== 0xcc) return { l: o[i + 7] << 8 | o[i + 8], h: o[i + 5] << 8 | o[i + 6] };
    i += 2 + (o[i + 2] << 8 | o[i + 3]);
  }
  return { l: 0, h: 0 };
}

function docxDepuisElements(elts, d) {
  var C = OFFICE_CLAIR, acc = docxCouleur(officeAccent(d)[0]), rels = [], medias = [], nums = [], docPr = 0;
  var rel = function (type, cible, ext) { var id = 'rId' + (rels.length + 3); rels.push('<Relationship Id="' + id + '" Type="' + DOCX_REL + type + '" Target="' + xmlAttr(cible) + '"' + (ext ? ' TargetMode="External"' : '') + '/>'); return id; };
  // segments → runs ; o : propriétés du paragraphe appliquées à chaque run (taille, couleur, capitales, gras)
  var rPr = function (g, o) {
    var p = '', coul = g.pastille ? g.pastille.texte : g.lien ? '#' + acc : g.couleur || o.couleur;
    if (g.code) p += '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>';
    if (g.gras || g.pastille || o.gras) p += '<w:b/>';
    if (g.italique || o.italique) p += '<w:i/>';
    if (o.caps) p += '<w:caps/>';
    if (g.barre) p += '<w:strike/>';
    if (coul) p += '<w:color w:val="' + docxCouleur(coul) + '"/>';
    if (o.sz) p += '<w:sz w:val="' + o.sz + '"/><w:szCs w:val="' + o.sz + '"/>';
    if (g.souligne || g.lien) p += '<w:u w:val="single"/>';
    if (g.pastille || g.code) p += '<w:shd w:val="clear" w:color="auto" w:fill="' + docxCouleur(g.pastille ? g.pastille.fond : C['code-soft']) + '"/>';
    return p ? '<w:rPr>' + p + '</w:rPr>' : '';
  };
  var t = function (s) { return String(s).split('\t').map(function (x, i) { return (i ? '<w:tab/>' : '') + (x ? '<w:t xml:space="preserve">' + xmlTexte(x) + '</w:t>' : ''); }).join(''); };
  var runs = function (segs, o) {
    o = o || {}; var h = '', fus = officeFusion(segs);   // 08-office.js, appelé à l'exécution
    for (var i = 0; i < fus.length; i++) {
      var g = fus[i];
      if (g.saut) { h += '<w:r><w:br/></w:r>'; continue; }
      var r = '<w:r>' + rPr(g, o) + t(String(g.texte).replace(/[\r\n]+/g, ' ')) + '</w:r>';
      h += g.lien ? '<w:hyperlink r:id="' + rel('hyperlink', g.lien, true) + '" w:history="1">' + r + '</w:hyperlink>' : r;
    }
    return h;
  };
  var P = function (pPr, contenu) { return '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + (contenu || '') + '</w:p>'; };
  var STYLE = { surtitre: { caps: true, sz: 18, couleur: '#' + acc }, chapeau: { sz: 24, couleur: C.muted }, pied: { sz: 18, couleur: C.muted } };
  var bordures = function (tag, c, sz) { return '<' + tag + '>' + ['top', 'left', 'bottom', 'right'].concat(tag === 'w:tblBorders' ? ['insideH', 'insideV'] : []).map(function (k) { return '<w:' + k + ' w:val="single" w:sz="' + (sz || 4) + '" w:space="0" w:color="' + docxCouleur(c) + '"/>'; }).join('') + '</' + tag + '>'; };
  var tableau = function (lignes, entete, cellule) {
    var n = lignes.reduce(function (m, l) { return Math.max(m, l.length); }, 1), w = Math.floor(DOCX_TEXTE / n), grille = '';
    for (var j = 0; j < n; j++) grille += '<w:gridCol w:w="' + w + '"/>';
    return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>' + bordures('w:tblBorders', C.line) + '<w:tblCellMar><w:top w:w="57" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="57" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' + grille + '</w:tblGrid>' +
      lignes.map(function (l, i) {
        var th = entete && i === 0, cs = l.slice(); while (cs.length < n) cs.push([]);
        return '<w:tr>' + (th ? '<w:trPr><w:tblHeader/></w:trPr>' : '') + cs.map(function (c, j) { return cellule(c, th, w, i, j); }).join('') + '</w:tr>';
      }).join('') + '</w:tbl>';
  };
  // contenu d'une cellule : jamais vide, et un paragraphe après un tableau imbriqué
  var dansCellule = function (arr, o) { var x = tous(arr, o); return x && !/<\/w:tbl>$/.test(x) ? x : x + '<w:p/>'; };
  var liste = function (e) {
    var cases = e.items.some(function (it) { return it.coche != null; }), id = 0;
    if (!cases) { nums.push(e.ordonnee ? 2 : 1); id = nums.length; }
    return e.items.map(function (it) {
      var lv = Math.max(0, Math.min(8, +it.niveau || 0));
      if (cases) return P(lv ? '<w:ind w:left="' + 360 * lv + '"/>' : '', runs([{ texte: it.coche ? '☑ ' : '☐ ' }].concat(it.segs)));
      return P('<w:numPr><w:ilvl w:val="' + lv + '"/><w:numId w:val="' + id + '"/></w:numPr>', runs(it.segs));
    }).join('');
  };
  var image = function (e) {
    var img = docxImage(e.src);
    if (!img) return P('', runs([{ texte: officeTexte([e]) }]));
    var dim = e.l && e.h ? { l: e.l, h: e.h } : docxDimensions(img), l = dim.l || OFFICE_LARGEUR, h = dim.h || Math.round(l * 0.6);
    if (l > OFFICE_LARGEUR) { h = Math.round(h * OFFICE_LARGEUR / l); l = OFFICE_LARGEUR; }
    medias.push(img); docPr++;
    var nom = 'image' + medias.length + '.' + img.ext, rid = rel('image', 'media/' + nom), cx = l * DOCX_EMU, cy = h * DOCX_EMU;
    var dessin = '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/>' +
      '<wp:docPr id="' + docPr + '" name="Image ' + docPr + '" descr="' + xmlAttr(e.alt) + '"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:nvPicPr><pic:cNvPr id="' + docPr + '" name="' + nom + '"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    return P('<w:keepNext/>', dessin) + (officeVide(e.legende) ? '' : P('<w:pStyle w:val="Caption"/>', runs(e.legende)));
  };
  var un = function (e) {
    switch (e.t) {
      case 'titre': return P('<w:pStyle w:val="' + (e.niveau ? 'Heading' + Math.min(3, e.niveau) : 'Title') + '"/>', runs(e.segs));
      case 'para':
        var st = STYLE[e.style] || {}, pp = e.style === 'pied' ? '<w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="' + docxCouleur(C.line) + '"/></w:pBdr>' : '';
        if (e.retrait) pp += '<w:ind w:left="' + 480 * e.retrait + '"/>';
        return P(pp, runs(e.segs, st));
      case 'liste': return liste(e);
      case 'tableau':
        if (!e.lignes.length) return '';   // Word refuse un tableau sans ligne
        return tableau(e.lignes, e.entete, function (c, th, w, i, j) {
          var fd = th ? C.bg : e.fonds && e.fonds[i] && e.fonds[i][j];   // fonds : teinte facultative de chaque cellule (carte de chaleur)
          return '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (fd ? '<w:shd w:val="clear" w:color="auto" w:fill="' + docxCouleur(fd) + '"/>' : '') + '</w:tcPr>' + dansCellule(c, th ? { gras: true } : null) + '</w:tc>';
        });
      case 'cadre':
        var bd = e.barre ? '<w:tcBorders><w:top w:val="nil"/><w:left w:val="single" w:sz="24" w:space="0" w:color="' + docxCouleur(e.barre) + '"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>' : bordures('w:tcBorders', C.line);
        return tableau([[e.contenu]], false, function (c, th, w) { return '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + bd + '<w:shd w:val="clear" w:color="auto" w:fill="' + docxCouleur(e.fond) + '"/></w:tcPr>' + dansCellule(c) + '</w:tc>'; }).replace(bordures('w:tblBorders', C.line), '<w:tblBorders/>');
      case 'code':
        var lignes = String(e.texte).split('\n');
        return (e.nom ? P('<w:keepNext/>', '<w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:color w:val="' + docxCouleur(C.muted) + '"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>' + t(e.nom) + '</w:r>') : '') +
          P('<w:pStyle w:val="Code"/>', lignes.map(function (l, i) { return '<w:r>' + (i ? '<w:br/>' : '') + t(l) + '</w:r>'; }).join(''));
      case 'image': return image(e);
      case 'ligne': return P('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="' + docxCouleur(C.line) + '"/></w:pBdr>');
    }
    return '';
  };
  // o : propriétés de run imposées (en-tête de tableau en gras)
  // deux tableaux contigus seraient fusionnés par Word : un petit paragraphe vide les sépare
  var tous = function (arr, o) {
    return arr.map(function (e) { return o && e.t === 'para' ? P('', runs(e.segs, o)) : un(e); }).reduce(function (a, x) {
      return a + (/<\/w:tbl>$/.test(a) && /^<w:tbl>/.test(x) ? '<w:p><w:pPr><w:spacing w:after="0" w:line="120" w:lineRule="exact"/></w:pPr></w:p>' : '') + x;
    }, '');
  };
  var corps = tous(elts);
  var documentXml = DOCX_XML + '<w:document ' + DOCX_NS + '><w:body>' + corps +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="907" w:right="850" w:bottom="1020" w:left="850" w:header="454" w:footer="454" w:gutter="0"/></w:sectPr></w:body></w:document>';
  var parties = [
    { nom: '[Content_Types].xml', texte: DOCX_XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>' },
    { nom: '_rels/.rels', texte: DOCX_XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + DOCX_REL + 'officeDocument" Target="word/document.xml"/></Relationships>' },
    { nom: 'word/document.xml', texte: documentXml },
    { nom: 'word/styles.xml', texte: docxStyles() },
    { nom: 'word/numbering.xml', texte: docxNumerotation(nums) },
    { nom: 'word/_rels/document.xml.rels', texte: DOCX_XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + DOCX_REL + 'styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="' + DOCX_REL + 'numbering" Target="numbering.xml"/>' + rels.join('') + '</Relationships>' }
  ].map(function (p) { return { nom: p.nom, octets: utf8(p.texte) }; });
  medias.forEach(function (m, i) { parties.push({ nom: 'word/media/image' + (i + 1) + '.' + m.ext, octets: m.octets }); });
  return zipStocke(parties);
}
// styles : Normal (Arial 11 pt), Title, Heading1 à 3 (niveaux de plan du volet de navigation), Code, Caption ; noms intégrés : Word les traduit
function docxStyles() {
  var C = OFFICE_CLAIR, s = function (id, nom, ppr, rpr, defaut) {
    return '<w:style w:type="paragraph"' + (defaut ? ' w:default="1"' : '') + ' w:styleId="' + id + '"><w:name w:val="' + nom + '"/>' + (defaut ? '' : '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/>') + '<w:qFormat/>' +
      (ppr ? '<w:pPr>' + ppr + '</w:pPr>' : '') + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + '</w:style>';
  };
  var titre = function (n, sz, avant) { return s('Heading' + n, 'heading ' + n, '<w:keepNext/><w:keepLines/><w:spacing w:before="' + avant + '" w:after="120"/><w:outlineLvl w:val="' + (n - 1) + '"/>', '<w:b/><w:bCs/><w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/>'); };
  return DOCX_XML + '<w:styles ' + DOCX_NS + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:color w:val="' + docxCouleur(C.fg) + '"/>' +
    '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    s('Normal', 'Normal', '', '', true) +
    s('Title', 'Title', '<w:keepNext/><w:spacing w:before="120" w:after="120"/><w:outlineLvl w:val="0"/>', '<w:b/><w:bCs/><w:sz w:val="48"/><w:szCs w:val="48"/>') +
    titre(1, 32, 360) + titre(2, 26, 240) + titre(3, 22, 200) +
    s('Code', 'Code', '<w:shd w:val="clear" w:color="auto" w:fill="' + docxCouleur(C['code-soft']) + '"/><w:spacing w:after="120" w:line="240" w:lineRule="auto"/>', '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="19"/><w:szCs w:val="19"/>') +
    s('Caption', 'caption', '<w:spacing w:after="160"/>', '<w:i/><w:iCs/><w:color w:val="' + docxCouleur(C.muted) + '"/><w:sz w:val="18"/><w:szCs w:val="18"/>') +
    '</w:styles>';
}
// numérotation : 1 = puces, 2 = numéros (neuf niveaux) ; une instance par liste (les numéros repartent de 1)
function docxNumerotation(nums) {
  var PUCES = ['•', '◦', '▪'], abs = function (id, ordonnee) {
    var h = '<w:abstractNum w:abstractNumId="' + id + '"><w:multiLevelType w:val="hybridMultilevel"/>';
    for (var l = 0; l < 9; l++) h += '<w:lvl w:ilvl="' + l + '"><w:start w:val="1"/><w:numFmt w:val="' + (ordonnee ? 'decimal' : 'bullet') + '"/><w:lvlText w:val="' + (ordonnee ? '%' + (l + 1) + '.' : PUCES[l % 3]) + '"/><w:lvlJc w:val="left"/>' +
      '<w:pPr><w:ind w:left="' + 360 * (l + 1) + '" w:hanging="360"/></w:pPr>' + (ordonnee ? '' : '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr>') + '</w:lvl>';
    return h + '</w:abstractNum>';
  };
  return DOCX_XML + '<w:numbering ' + DOCX_NS + '>' + abs(1, false) + abs(2, true) + nums.map(function (a, i) {
    return '<w:num w:numId="' + (i + 1) + '"><w:abstractNumId w:val="' + a + '"/>' + (a === 2 ? '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>' : '') + '</w:num>';
  }).join('') + '</w:numbering>';
}
