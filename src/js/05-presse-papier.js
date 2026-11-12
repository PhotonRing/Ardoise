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
