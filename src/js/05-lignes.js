/* ---------- Lignes d'un bloc texte : module pur ---------- */
// Règles du bloc texte, sans DOM (testées par scripts/rendu/bloc-texte.mjs). Une ligne : { html, lv, genre, align, taille, done },
// valeurs par défaut omises (lv absent au niveau 0, de 1 à 6 sinon ; genre absent pour une ligne de texte ; align absent pour
// gauche ; taille absente pour Normal, jamais sur un sous-titre ; done seulement sur une case cochée). Un bloc texte a
// toujours au moins une ligne.
var LIGNE_LV_MAX = 6;
var LIGNE_GENRES = ['puce', 'numero', 'case', 'soustitre'];
var LIGNE_ALIGNS = ['centre', 'droite', 'justifie'];
var LIGNE_TAILLES = ['petit', 'grand'];
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
    if (LIGNE_GENRES.indexOf(o.genre) < 0) delete o.genre;
    if (!(o.genre === 'case' && o.done === true)) delete o.done;
    if (LIGNE_ALIGNS.indexOf(o.align) < 0) delete o.align;
    if (LIGNE_TAILLES.indexOf(o.taille) < 0 || o.genre === 'soustitre') delete o.taille;   // le sous-titre a sa propre taille
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
// ancien Paragraphe (format 7) → bloc texte, sur place : même identifiant, sans uid tiré (migration, normalisation et
// synchronisation : deux copies qui convertissent le même JSON obtiennent le même bloc)
function paragrapheEnTexte(b) {
  b.type = 'texte'; b.lignes = lignesDuParagraphe(b.html, b.indent);
  delete b.html; delete b.indent;
  return b;
}
// bloc texte d'un HTML à sauts de ligne (import Markdown, modèles) : un <br> par ligne
function texteDuHtml(html) { return { type: 'texte', lignes: lignesDuParagraphe(html) }; }
// numéro affiché de chaque ligne (null hors numéro) : une suite par niveau, qui continue malgré des lignes plus profondes
// et repart à 1 après une ligne d'un autre genre au même niveau, ou après une ligne moins profonde. Pas de compteurs CSS :
// l'écran, Office et Word lisent ces numéros
function numerosDesLignes(lignes) {
  var cpt = [];
  return lignes.map(function (l) {
    var n = +l.lv || 0; cpt.length = Math.min(cpt.length, n + 1);
    if (l.genre !== 'numero') { cpt[n] = 0; return null; }
    cpt[n] = (cpt[n] || 0) + 1; return cpt[n];
  });
}
// raccourci tapé au début d'une ligne (« - », « * », « 1. », « [] », « [ ] », « ## » suivis d'une espace) : { genre, html restant }, ou null
var LIGNE_RACCOURCI = /^(?:([-*])|(\d+\.)|(\[ ?\])|(##))(?: |&nbsp;|\u00a0)/;
function raccourciDeLigne(html) {
  var m = String(html == null ? '' : html).match(LIGNE_RACCOURCI); if (!m) return null;
  return { genre: m[1] ? 'puce' : m[2] ? 'numero' : m[3] ? 'case' : 'soustitre', html: html.slice(m[0].length) };
}
/* ---------- Collage et copie ---------- */
var LIGNE_BLOC = /^(p|div|li|h[1-6]|tr|blockquote|pre|dt|dd|ul|ol|dl|table|section|article|header|footer|hr)$/;
var LIGNE_VIDE_EL = /^(img|wbr|input|meta|link|col|source|area|base|embed|param|track)$/;
var LIGNE_IGNOREE = /^(head|style|script|title|template|noscript)$/;
// HTML collé → lignes : <br> coupe la ligne ; un bloc (p, div, li…) la coupe s'il a du contenu, ou s'il est vide
// (<p></p> : ligne vide) ; les formes ouvertes sont refermées et rouvertes à chaque coupe. Genres : un <li> d'un <ul> donne une
// puce, d'un <ol> un numéro, au niveau de sa profondeur de liste (Writer imbrique <ol><ol> sans <li> parent ; aria-level de
// Google Docs l'emporte) ; un <input type=checkbox>, ou ☐/☑ en tête de ligne, donne une case (☑ ou checked : cochée) ; un
// paragraphe de liste de Word (mso-list) donne une puce ou un numéro selon son symbole, écarté du texte. Copie d'Ardoise :
// data-lv (niveau), data-g et data-done d'un bloc ou d'une liste. Un titre venu d'ailleurs reste du texte.
// Le html des lignes n'est pas assaini (l'appelant le fait, ligne par ligne).
var LIGNE_MARQUE_CASE = /^((?:<[^>]*>)*)\s*([☐☑])(?: |&nbsp;| )?/;
function lignesDuCollage(html) {
  var s = String(html == null ? '' : html)
    // symbole d'une liste de Word, avant le retrait des commentaires (deux formes : <![if !supportLists]> et <!--[if !supportLists]-->)
    .replace(/<!(?:--)?\[if !supportLists\](?:--)?>([\s\S]*?)<!(?:--)?\[endif\](?:--)?>/gi, function (x, m) { return '<msoliste m="' + esc(htmlText(m).replace(/[\s ]+/g, '')) + '">'; })
    .replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/gi, '');
  var out = [], pile = [], listes = [], cur = null, ignore = 0, vu = false;
  var debut = function () { cur = { h: pile.map(function (x) { return x.o; }).join(''), lv: 0, plein: false, genre: '', done: false }; };
  var fin = function () {
    var h = cur.h;
    for (var i = pile.length - 1; i >= 0; i--) h += '</' + pile[i].n + '>';
    h = sansFormesVides(h).replace(/\s+((?:<\/[a-z0-9]+>)*)$/i, '$1');
    var mc = h.match(LIGNE_MARQUE_CASE);
    if (mc) { h = mc[1] + h.slice(mc[0].length); cur.done = cur.genre === 'case' ? cur.done || mc[2] === '☑' : mc[2] === '☑'; cur.genre = 'case'; }
    if (!/<(img|wbr)\b/i.test(h) && htmlText(h).replace(/[\s ​]/g, '') === '') h = '';
    var l = ligne(h, cur.lv);
    if (cur.genre) l.genre = cur.genre;
    if (cur.genre === 'case' && cur.done) l.done = true;
    out.push(l); vu = false; debut();
  };
  var attr = function (m, nom) { var a = m.match(new RegExp('\\s' + nom + '=(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return a ? (a[1] != null ? a[1] : a[2] != null ? a[2] : a[3]) : null; };
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
    if (ignore || !nom || /^<!/.test(m) || nom.indexOf(':') >= 0) return;   // <o:p> de Word
    if (nom === 'msoliste') { if (cur.genre) cur.genre = /^[0-9a-z]+[.)]$/i.test(attr(m, 'm') || '') ? 'numero' : 'puce'; return; }
    if (nom === 'br') { fin(); return; }
    if (LIGNE_BLOC.test(nom)) {
      if (cur.plein) fin();
      else if (ferme && vu) fin();
      if (nom === 'ul' || nom === 'ol') {
        if (ferme) { listes.pop(); return; }
        var dl = attr(m, 'data-lv'), haut = listes[listes.length - 1];
        listes.push({ g: nom === 'ul' ? 'puce' : 'numero', lv: dl != null ? +dl || 0 : haut ? haut.lv + 1 : 0 });
        return;
      }
      if (!ferme) {
        vu = nom !== 'hr';
        var lv = attr(m, 'data-lv'), g = attr(m, 'data-g'), al = attr(m, 'aria-level'), mso = m.match(/mso-list:\s*l\d+\s+level(\d+)/i);
        if (nom === 'li' && listes.length) { cur.genre = listes[listes.length - 1].g; cur.lv = listes[listes.length - 1].lv; }
        if (nom === 'li' && al != null && +al >= 1) cur.lv = +al - 1;
        if (mso) { cur.genre = 'puce'; cur.lv = +mso[1] - 1; }
        if (lv != null) cur.lv = +lv || 0;
        if (g != null && LIGNE_GENRES.indexOf(g) >= 0) { cur.genre = g; cur.done = /\sdata-done\b/i.test(m); }
      }
      return;
    }
    if (nom === 'input' && /^checkbox$/i.test(attr(m, 'type') || '')) { cur.genre = 'case'; cur.done = /\schecked\b/i.test(m); return; }
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
// marque d'une ligne en texte brut : « - » puce, « N. » numéro affiché n, « ☐ »/« ☑ » case ; rien pour le texte et le sous-titre
function marqueDeLigne(l, n) {
  if (l.genre === 'puce') return '- ';
  if (l.genre === 'numero') return (n || 1) + '. ';
  if (l.genre === 'case') return l.done ? '☑ ' : '☐ ';
  return '';
}
// copie hors d'Ardoise : texte brut à deux espaces par niveau, marque du genre, pastilles en #nom (texteBrutDePresse :
// 05-presse-papier.js) ; nums : numéros affichés dans le bloc d'origine (par défaut, ceux des lignes copiées)
function lignesEnTexte(lignes, nums) {
  nums = nums || numerosDesLignes(lignes);
  return lignes.map(function (l, i) { return new Array((+l.lv || 0) + 1).join('  ') + marqueDeLigne(l, nums[i]) + texteBrutDePresse(l.html); }).join('\n');
}
// copie : puces et numéros en <ul>/<ol> imbriqués (une ligne plus profonde s'imbrique dans le <li> du dessus ; une liste sans
// parent à son niveau porte data-lv, et une marge hors de toute liste ; <ol start> = numéro affiché) ; cases en <p> avec ☐/☑
// (Writer change une liste de cases en puces) ; sous-titre en <h3> ; texte en <p>. data-lv, data-g et data-done : pour un
// collage dans Ardoise, la marge pour les autres applications
function lignesEnHtml(lignes, idDoc, nums) {
  nums = nums || numerosDesLignes(lignes);
  var out = '', ouvertes = [];
  var fermer = function (jusqua) { while (ouvertes.length > jusqua) out += '</li></' + ouvertes.pop().tag + '>'; };
  var retrait = function (n) { return n ? ' data-lv="' + n + '" style="margin-left:' + 2 * n + 'em"' : ''; };
  lignes.forEach(function (l, i) {
    var n = +l.lv || 0, h = pastillesSansCouleur(l.html, idDoc);
    if (l.genre === 'puce' || l.genre === 'numero') {
      var tag = l.genre === 'puce' ? 'ul' : 'ol';
      while (ouvertes.length && ouvertes[ouvertes.length - 1].lv > n) fermer(ouvertes.length - 1);
      var haut = ouvertes[ouvertes.length - 1];
      if (haut && haut.lv === n && haut.tag !== tag) { fermer(ouvertes.length - 1); haut = ouvertes[ouvertes.length - 1]; }
      if (haut && haut.lv === n) out += '</li>';
      else {
        var att = !haut ? retrait(n) : n !== haut.lv + 1 ? ' data-lv="' + n + '"' : '';
        if (tag === 'ol' && nums[i] && nums[i] !== 1) att += ' start="' + nums[i] + '"';
        out += '<' + tag + att + '>'; ouvertes.push({ tag: tag, lv: n });
      }
      out += '<li>' + (h || '<br>'); return;
    }
    fermer(0);
    if (l.genre === 'case') out += '<p data-g="case"' + (l.done ? ' data-done' : '') + retrait(n) + '>' + marqueDeLigne(l) + h + '</p>';
    else if (l.genre === 'soustitre') out += '<h3 data-g="soustitre"' + retrait(n) + '>' + (h || '<br>') + '</h3>';
    else out += '<p' + retrait(n) + '>' + (h || '<br>') + '</p>';
  });
  fermer(0);
  return out;
}
// case parente (requêtes « cases à cocher ») : html de la ligne la plus proche au-dessus de niveau strictement inférieur,
// quel que soit son genre, cochée ou non ; '' au niveau 0. Ne lit que html et lv : vaut aussi pour une Liste à cocher
function caseParente(lignes, i) {
  var lv = +lignes[i].lv || 0;
  for (var j = i - 1; lv > 0 && j >= 0; j--) if ((+lignes[j].lv || 0) < lv) return lignes[j].html;
  return '';
}
// Cochées à la fin (menu contextuel d'une case) : la suite de cases de même niveau autour de la ligne i, chacune suivie de
// ses lignes plus profondes, est rangée cochées après non cochées (tri stable) ; seul ce niveau est rangé. Nouveau tableau
// des mêmes objets ligne ; les lignes hors de la suite restent à leur place. Ligne i qui n'est pas une case : même ordre.
function casesALaFin(lignes, i) {
  var out = lignes.slice(), l = lignes[i]; if (!l || l.genre !== 'case') return out;
  var lv = +l.lv || 0, nv = function (j) { return +lignes[j].lv || 0; }, estCase = function (j) { return lignes[j].genre === 'case' && nv(j) === lv; };
  var debut = i;
  for (var j = i - 1; j >= 0 && nv(j) >= lv; j--) { if (nv(j) > lv) continue; if (!estCase(j)) break; debut = j; }
  var unites = [], k = debut;
  while (k < lignes.length && estCase(k)) {
    var u = [lignes[k]]; k++;
    while (k < lignes.length && nv(k) > lv) u.push(lignes[k++]);
    unites.push(u);
  }
  var range = unites.filter(function (u) { return !u[0].done; }).concat(unites.filter(function (u) { return u[0].done; }));
  Array.prototype.splice.apply(out, [debut, k - debut].concat([].concat.apply([], range)));
  return out;
}
// Convertir en texte : Liste → puces ou numéros, Liste à cocher → cases avec leurs coches, niveaux gardés, dans l'ordre saisi
// (jamais l'ordre affiché « cochées à la fin ») ; Sous-titre → une ligne de sous-titre. Même identifiant, pour que liens,
// requêtes et synchronisation suivent le bloc.
function blocEnTexte(b) {
  var ls;
  if (b.type === 'subtitle') ls = [{ html: b.html, genre: 'soustitre' }];
  else ls = (Array.isArray(b.items) ? b.items : []).map(function (it) {
    var o = ligne(it && it.html, it && it.lv);
    o.genre = b.type === 'check' ? 'case' : b.ordered ? 'numero' : 'puce';
    if (b.type === 'check' && it.done) o.done = true;
    return o;
  });
  return { id: b.id, type: 'texte', lignes: normLignes(ls) };
}
