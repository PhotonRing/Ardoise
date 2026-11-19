/* ---------- Lignes d'un bloc texte : module pur ---------- */
// Règles du bloc texte, sans DOM (testées par scripts/rendu/bloc-texte.mjs). Une ligne : { html, lv },
// valeurs par défaut omises (lv absent au niveau 0, de 1 à 6 sinon). Un bloc texte a toujours au moins une ligne.
var LIGNE_LV_MAX = 6;
function ligne(html, lv) {
  var o = { html: String(html == null ? '' : html) }, n = Math.max(0, Math.min(LIGNE_LV_MAX, Math.floor(+lv) || 0));
  if (n) o.lv = n;
  return o;
}
// tableau enregistré : lignes illisibles écartées, html en chaîne, niveau borné ; jamais vide
function normLignes(arr) {
  var out = (Array.isArray(arr) ? arr : []).filter(function (x) { return typeof x === 'string' || (x && typeof x === 'object' && !Array.isArray(x)); }).map(function (x) {
    if (typeof x === 'string') return ligne(x);
    var o = {}, k; for (k in x) o[k] = x[k];
    var l = ligne(o.html, o.lv); o.html = l.html; if (l.lv) o.lv = l.lv; else delete o.lv;
    return o;
  });
  return out.length ? out : [ligne('')];
}
// formes vides laissées par une coupe (<b></b>)
function sansFormesVides(h) {
  var avant;
  do { avant = h; h = h.replace(/<(b|i|u|s|code|a|span)\b[^>]*><\/\1>/g, ''); } while (h !== avant);
  return h;
}
// Paragraphe → lignes : chaque <br> coupe la ligne, même dans une mise en forme (refermée avant, rouverte après) ;
// les taquets (span.tab) en tête de ligne en font le niveau, ajouté au retrait du paragraphe ; ailleurs, une espace
function lignesDuParagraphe(html, indent) {
  var base = Math.max(0, Math.floor(+indent) || 0), out = [], pile = [], cur = null;
  var formes = function () { return pile.filter(function (x) { return !x.x; }); };
  var debut = function () { cur = { h: formes().map(function (x) { return x.o; }).join(''), lv: 0, tete: true }; };
  var fin = function () {
    var h = cur.h, f = formes();
    for (var i = f.length - 1; i >= 0; i--) h += '</' + f[i].n + '>';
    out.push(ligne(sansFormesVides(h), base + cur.lv));
  };
  debut();
  String(html == null ? '' : html).split(/(<[^>]*>)/).forEach(function (m, i) {
    if (!m) return;
    if (i % 2 === 0) {
      if (pile.some(function (x) { return x.x === 'tab'; })) return;   // le caractère du taquet
      var t = m.replace(/​/g, ''); if (!t) return;
      cur.tete = false; cur.h += t; return;
    }
    if (/^<br\b/i.test(m)) { fin(); debut(); return; }
    var ferme = /^<\//.test(m), nom = ((m.match(/^<\/?([a-z0-9]+)/i) || [])[1] || '').toLowerCase();
    if (!ferme) {
      if (nom === 'span' && /class="[^"]*\btab\b/.test(m)) { pile.push({ n: nom, x: 'tab', t: cur.tete }); return; }
      if (nom === 'span' && /class="[^"]*\bln\b/.test(m)) { pile.push({ n: nom, x: 'ln' }); return; }   // enveloppe d'affichage
      pile.push({ n: nom, o: m }); cur.h += m; return;
    }
    var j = pile.length - 1; while (j >= 0 && pile[j].n !== nom) j--;
    if (j < 0) return;
    var e = pile.splice(j, 1)[0];
    if (e.x === 'tab') { if (e.t) cur.lv++; else cur.h += ' '; return; }
    if (!e.x) cur.h += m;
  });
  fin();
  return out;
}
/* ---------- Collage et copie ---------- */
var LIGNE_BLOC = /^(p|div|li|h[1-6]|tr|blockquote|pre|dt|dd|ul|ol|dl|table|section|article|header|footer|hr)$/;
var LIGNE_VIDE_EL = /^(img|wbr|input|meta|link|col|source|area|base|embed|param|track)$/;
var LIGNE_IGNOREE = /^(head|style|script|title|template|noscript)$/;
// HTML collé → lignes de texte : <br> coupe la ligne ; un bloc (p, div, li…) la coupe s'il a du contenu, ou s'il est vide
// (<p></p> : ligne vide) ; les formes ouvertes sont refermées et rouvertes à chaque coupe ; data-lv d'un bloc (copie d'Ardoise)
// donne le niveau. Le html des lignes n'est pas assaini (l'appelant le fait, ligne par ligne).
function lignesDuCollage(html) {
  var s = String(html == null ? '' : html).replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/gi, '');
  var out = [], pile = [], cur = null, ignore = 0, vu = false;
  var debut = function () { cur = { h: pile.map(function (x) { return x.o; }).join(''), lv: 0, plein: false }; };
  var fin = function () {
    var h = cur.h;
    for (var i = pile.length - 1; i >= 0; i--) h += '</' + pile[i].n + '>';
    h = sansFormesVides(h).replace(/\s+((?:<\/[a-z0-9]+>)*)$/i, '$1');
    if (!/<(img|wbr)\b/i.test(h) && htmlText(h).replace(/[\s ​]/g, '') === '') h = '';
    out.push(ligne(h, cur.lv)); vu = false; debut();
  };
  debut();
  s.split(/(<(?:[^>"']|"[^"]*"|'[^']*')*>)/).forEach(function (m, i) {
    if (!m) return;
    if (i % 2 === 0) {
      if (ignore) return;
      var t = m.replace(/\s*[\r\n]+\s*/g, ' ');
      if (!cur.plein) t = t.replace(/^\s+/, '');
      if (!t) return;
      cur.plein = true; cur.h += t; return;
    }
    var ferme = /^<\//.test(m), nom = ((m.match(/^<\/?([a-z0-9:]+)/i) || [])[1] || '').toLowerCase();
    if (LIGNE_IGNOREE.test(nom)) { ignore = Math.max(0, ignore + (ferme ? -1 : 1)); return; }
    if (ignore || !nom || /^<!/.test(m)) return;
    if (nom === 'br') { fin(); return; }
    if (LIGNE_BLOC.test(nom)) {
      if (cur.plein) fin();
      else if (ferme && vu) fin();
      if (!ferme) {
        vu = nom !== 'hr';
        var lv = m.match(/\sdata-lv="(\d+)"/);
        if (lv) cur.lv = +lv[1];
      }
      return;
    }
    if (LIGNE_VIDE_EL.test(nom)) { if (nom !== 'meta' && nom !== 'link' && nom !== 'base') { cur.h += m; cur.plein = true; } return; }
    if (!ferme) { pile.push({ n: nom, o: m }); cur.h += m; return; }
    var j = pile.length - 1; while (j >= 0 && pile[j].n !== nom) j--;
    if (j < 0) return;
    pile.splice(j, 1); cur.h += m;
  });
  if (cur.plein) fin();
  return out;
}
// texte brut collé : une ligne de texte par saut de ligne (un saut final ne fait pas de ligne), rien n'est converti
function lignesDuTexteBrut(texte) {
  var t = String(texte == null ? '' : texte).split(/\r\n|\r|\n/);
  if (t.length > 1 && t[t.length - 1] === '') t.pop();
  return t.map(function (x) { return ligne(esc(x)); });
}
// copie hors d'Ardoise : texte brut à deux espaces par niveau, pastilles en #nom (texteBrutDePresse : 05-presse-papier.js)
function lignesEnTexte(lignes) {
  return lignes.map(function (l) { return new Array((+l.lv || 0) + 1).join('  ') + texteBrutDePresse(l.html); }).join('\n');
}
// copie : un <p> par ligne ; data-lv pour un collage dans Ardoise, marge pour les autres applications
function lignesEnHtml(lignes, idDoc) {
  return lignes.map(function (l) {
    var n = +l.lv || 0;
    return '<p' + (n ? ' data-lv="' + n + '" style="margin-left:' + 2 * n + 'em"' : '') + '>' + (pastillesSansCouleur(l.html, idDoc) || '<br>') + '</p>';
  }).join('');
}
