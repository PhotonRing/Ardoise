/* ---------- Copier pour Office : bloc de code (socle et point d'entrée : 08-office.js) ----------
   Bloc de code par variante (.code, .codebox, pre.cmd), d'après page.css (le tableau : 06-bloc-listes.js, officeTabTableau : 08-office.js). */

/* Bloc de code : le code reste du texte modifiable, en Consolas, espaces et retours gardés (<pre> à white-space:pre-wrap),
   dans une cellule teintée pleine largeur (Google Docs ne teinte un <pre> que sous le texte). */
// couleurs des jetons de page.css (vérifiées par le banc du rendu) : bloc sombre (règle .code) et thème clair (:root)
var OFFICE_TAB_TK_SOMBRE = { k: '#c792ea', s: '#c3e88d', c: '#7f93a3', n: '#f78c6c', f: '#82aaff', v: '#ffcb6b', t: '#89ddff', p: '#9fb3c3' };
var OFFICE_TAB_TK_CLAIR = { k: '#8a2bb5', s: '#2b7a1b', c: '#6b7c8a', n: '#b4450a', f: '#1d5fbf', v: '#9a5b00', t: '#0b7285', p: '#5d6b78' };
// code coloré en couleurs en ligne : un <span> par jeton et par ligne (comme HL.lines), commentaires en italique
function officeTabLignesCode(code, lang, tk) {
  return HL.tokens(String(code || ''), lang).map(function (t) {
    if (!t[0] || !tk[t[0]]) return esc(t[1]);
    var st = 'color:' + tk[t[0]] + (t[0] === 'c' ? ';font-style:italic' : '');
    return t[1].split('\n').map(function (p) { return p ? '<span style="' + st + '">' + esc(p) + '</span>' : ''; }).join('\n');
  }).join('');
}
function officeTabPre(b, px, couleur, tk) {
  var code = String(b.code || '').replace(/\n$/, ''), lignes = officeTabLignesCode(code, HL.resolve(b.lang, code, b.name), tk);
  return '<pre style="margin:0pt;font-family:' + OFFICE_POLICES.mono + ';font-size:' + officePt(px) + ';line-height:1.55;color:' + couleur + ';white-space:pre-wrap">' + (lignes || '&nbsp;') + '</pre>';
}
OFFICE_RENDUS.code = function (b, x) {
  var trait = '1px solid ' + x.C.line, nom = String(b.name || '').trim();
  if (b.variant === 'box') {
    // .codebox : barre du nom sur fond blanc, filet, puis le code sur code-soft (sans les numéros de ligne, qu'Ardoise ne copie pas)
    var barre = nom ? '<tr>' + officeCellule(esc(nom), 'font-family:' + OFFICE_POLICES.mono + ';font-size:' + officePt(12.5) + ';color:' + x.C.muted + ';background:' + x.C.surface +
      ';padding:7.5pt 10.5pt;border-top:' + trait + ';border-left:' + trait + ';border-right:' + trait, '100%') + '</tr>' : '';
    // le code porte le filet sous la barre : Writer ne garde le retrait intérieur que du côté d'une bordure
    return officeTable(barre + '<tr>' + officeCellule(officeTabPre(b, 12.5, x.C.fg, OFFICE_TAB_TK_CLAIR), 'background:' + x.C['code-soft'] + ';padding:10.5pt 12pt;border:' + trait, '100%') + '</tr>', 'margin:0 0 6pt');
  }
  if (b.variant === 'cmd')   // pre.cmd : ligne de commande sur code-soft, bordée, sans nom
    return officeTable('<tr>' + officeCellule(officeTabPre(b, 13.5, x.C.fg, OFFICE_TAB_TK_CLAIR), 'background:' + x.C['code-soft'] + ';padding:9pt 10.5pt;border:' + trait, '100%') + '</tr>', 'margin:0 0 6pt');
  // « Sombre » (.code) : nom en capitales mono grises (code-fg à 55 % d'opacité à l'écran : Writer ignore l'opacité), code clair coloré sur code-bg ;
  // bordure de la couleur du fond : sans bordure, Writer ignore le retrait intérieur de la cellule
  var titre = nom ? officeEtiquette(officeTexteSegs(nom), x, { couleur: OFFICE_TAB_TK_SOMBRE.c, marges: 'margin:0pt 0pt 6pt' }) : '';
  return officeTable('<tr>' + officeCellule(titre + officeTabPre(b, 12.5, x.C['code-fg'], OFFICE_TAB_TK_SOMBRE), 'background:' + x.C['code-bg'] + ';padding:10.5pt 12pt;border:1px solid ' + x.C['code-bg'], '100%') + '</tr>', 'margin:0 0 6pt');
};
