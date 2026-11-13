/* ---------- Presse-papier (sans DOM : vérifié par le banc de rendu) ---------- */
// Une pastille copiée garde sa forme dans Ardoise (text/html) et devient « #nom » ailleurs (text/plain).
var BLOC_FIN_RE = /<\/(p|div|li|h[1-6]|tr|blockquote|pre)>|<br\s*\/?>/gi;
function texteBrutDePresse(html) {
  // texte brut d'un fragment HTML copié : pastilles en #nom, blocs en lignes, cellules en tabulations
  var s = String(html || '').replace(PILL_RE, function (m, cls, attrs, inner) { return '#' + htmlText(inner); })   // PILL_RE, htmlText : 05-migrations.js
    .replace(/<\/t[dh]>\s*(?=<t[dh][\s>])/gi, '\t')
    .replace(BLOC_FIN_RE, '\n');
  return htmlText(s).replace(/[ \t]*\n[ \t]*\n+/g, '\n').replace(/^\n+|\n+$/g, '');
}
function pastillesSansCouleur(html, idDoc) {
  // HTML copié : la couleur du registre (pa-N, posée au rendu) part ; l'identifiant du document (data-ad) dit d'où vient la pastille
  return String(html || '').replace(PILL_RE, function (m, cls, attrs, inner) {
    var pc = cls.match(/\bpc-\d+\b/);
    return '<span class="pill' + (pc ? ' ' + pc[0] : '') + '" data-ad="' + esc(idDoc) + '">' + inner + '</span>';
  });
}
function pastillesDuCollage(html, idDoc) {
  // HTML collé : une couleur d'exception (pc-N) ne reste que si la pastille vient du même document ; sinon le registre d'arrivée décide
  return String(html || '').replace(PILL_RE, function (m, cls, attrs, inner) {
    var ad = (attrs || '').match(/\bdata-ad="([^"]*)"/);
    if (ad && htmlText(ad[1]) === String(idDoc)) return m;
    return '<span class="pill' + cls.replace(/\s*\bpc-\d+\b/g, '') + '"' + attrs + '>' + inner + '</span>';
  });
}
/* ---------- Plage de cellules collée ----------
   Un tableur (Excel, Google Sheets, LibreOffice Calc), Word ou une page web mettent un <table> dans text/html et des
   tabulations dans text/plain. Le découpage est pur ; l'assainissement (sanitize, qui demande le DOM) se fait au collage. */
// cellules d'un texte à tabulations : un champ entre guillemets (à la manière d'Excel) peut contenir tabulations,
// retours à la ligne et guillemets doublés
function cellulesTsv(s) {
  var lignes = [[]], v = '', i = 0, debut = true, j, fin;
  function cellule() { lignes[lignes.length - 1].push(v); v = ''; debut = true; }
  while (i < s.length) {
    var ch = s.charAt(i);
    if (debut && ch === '"' && (fin = s.indexOf('"', i + 1)) > 0) {
      for (j = i + 1; j < s.length; j++) {
        if (s.charAt(j) !== '"') { v += s.charAt(j); continue; }
        if (s.charAt(j + 1) === '"') { v += '"'; j++; continue; }
        break;
      }
      i = j + 1; debut = false; continue;
    }
    if (ch === '\t') { cellule(); i++; continue; }
    if (ch === '\r' || ch === '\n') { cellule(); lignes.push([]); i += ch === '\r' && s.charAt(i + 1) === '\n' ? 2 : 1; continue; }
    v += ch; debut = false; i++;
  }
  cellule();
  return lignes;
}
// presse-papier (text/html, text/plain) → grille rectangulaire de cellules HTML d'une ligne, ou null si ce n'est pas une
// plage : une cellule seule, ou un texte sans tabulation, se collent comme avant
function grilleDuPressePapier(html, texte) {
  var t = String(html || '').replace(/<!--[\s\S]*?-->/g, '').match(/<table\b[\s\S]*?<\/table\s*>/i), g = null;
  if (t) g = t[0].split(/<tr\b(?:[^>"']|"[^"]*"|'[^']*')*>/i).slice(1).map(function (l) {
    return l.split(/<t[dh]\b(?:[^>"']|"[^"]*"|'[^']*')*>/i).slice(1).map(function (c) {
      return compacterLigne(c.replace(/<\/(t[dh]|tr|thead|tbody|tfoot|table)\s*>[\s\S]*$/i, '').replace(/<br\s*\/?>/gi, ' '));   // compacterLigne : 02-assainissement.js
    });
  });
  else if (/\t/.test(texte || '')) g = cellulesTsv(String(texte)).map(function (l) { return l.map(function (v) { return esc(compacterTexte(v)); }); });
  if (!g) return null;
  var vide = function (l) { return l.every(function (v) { return !v; }); };
  while (g.length && vide(g[g.length - 1])) g.pop();
  var n = 0; g.forEach(function (l) { n = Math.max(n, l.length); });
  if (!g.length || (g.length < 2 && n < 2)) return null;
  return g.map(function (l) { while (l.length < n) l.push(''); return l; });
}
/* ---------- Copie d'une plage de cellules ----------
   plage { r1, c1, r2, c2 } : coins inclus, dans n'importe quel ordre ; sauf : lignes masquées par un filtre, exclues. */
function cellulesDePlage(rows, plage) {
  var r0 = Math.min(plage.r1, plage.r2), r1 = Math.max(plage.r1, plage.r2), c0 = Math.min(plage.c1, plage.c2), c1 = Math.max(plage.c1, plage.c2), out = [];
  for (var r = r0; r <= r1; r++) if (!plage.sauf || plage.sauf.indexOf(r) < 0) out.push(rows[r].slice(c0, c1 + 1));
  return out;
}
// texte à tabulations pour un tableur : une valeur par cellule, pastilles en #nom, sans tabulation ni retour à la ligne
function grilleEnTexte(rows, plage) {
  return cellulesDePlage(rows, plage).map(function (l) {
    return l.map(function (h) { return texteBrutDePresse(h).replace(/[\t\r\n]+/g, ' '); }).join('\t');
  }).join('\n');
}
// tableau HTML pour Ardoise : se recolle par grilleDuPressePapier, pastilles marquées du document (pastillesSansCouleur)
function grilleEnHtml(rows, plage, idDoc) {
  return '<table><tbody>' + cellulesDePlage(rows, plage).map(function (l) {
    return '<tr>' + l.map(function (h) { return '<td>' + pastillesSansCouleur(h, idDoc) + '</td>'; }).join('') + '</tr>';
  }).join('') + '</tbody></table>';
}
