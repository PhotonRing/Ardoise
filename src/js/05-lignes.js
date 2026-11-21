/* ---------- Lignes d'un bloc texte : module pur ---------- */
// Sans DOM (scripts/rendu/bloc-texte.mjs). Ligne : { html, lv (1 à 6), genre, align, taille, done }, défauts omis (texte,
// gauche, Normal ; jamais de taille sur un sous-titre ; done sur une case cochée) ; un bloc texte a au moins une ligne
var LIGNE_LV_MAX = 6;
var LIGNE_GENRES = ['puce', 'numero', 'case', 'soustitre'];
var GENRES_LISTE = ['puce', 'numero', 'case'];   // genres dont la ligne vide sort par Entrée et Retour arrière ; un élément liste à l'export
// alignements : valeur CSS (écran, Copier pour Office) et de Word (w:jc)
var LIGNE_ALIGNEMENTS = { centre: { css: 'center', word: 'center' }, droite: { css: 'right', word: 'right' }, justifie: { css: 'justify', word: 'both' } };
var LIGNE_ALIGNS = Object.keys(LIGNE_ALIGNEMENTS);
var LIGNE_TAILLES_PX = { petit: 13, grand: 18 };   // Normal : 15 px (--t-petit et --t-grand de page.css)
var LIGNE_TAILLES = Object.keys(LIGNE_TAILLES_PX);
function enChaine(x) { return String(x == null ? '' : x); }
function niveauDe(l) { return +l.lv || 0; }
function sansZ(t) { return enChaine(t).replace(/​/g, ''); }   // espaces sans chasse posés pour sortir d'une pastille
function ligne(html, lv) {
  var o = { html: enChaine(html) }, n = Math.max(0, Math.min(LIGNE_LV_MAX, Math.floor(+lv) || 0));
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
  enChaine(html).split(/(<[^>]*>)/).forEach(function (m, i) {
    if (!m) return;
    if (i % 2 === 0) {
      if (pile.some(function (x) { return x.x === 'tab'; })) return;   // le caractère du taquet
      var t = sansZ(m); if (!t) return;
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
    var n = niveauDe(l); cpt.length = Math.min(cpt.length, n + 1);
    if (l.genre !== 'numero') { cpt[n] = 0; return null; }
    cpt[n] = (cpt[n] || 0) + 1; return cpt[n];
  });
}
// raccourci tapé au début d'une ligne (« - », « * », « 1. », « [] », « [ ] », « ## » suivis d'une espace) : { genre, html restant }, ou null
var LIGNE_RACCOURCI = /^(?:([-*])|(\d+\.)|(\[ ?\])|(##))(?: |&nbsp;|\u00a0)/;
function raccourciDeLigne(html) {
  var m = enChaine(html).match(LIGNE_RACCOURCI); if (!m) return null;
  return { genre: m[1] ? 'puce' : m[2] ? 'numero' : m[3] ? 'case' : 'soustitre', html: html.slice(m[0].length) };
}
/* ---------- Collage et copie ---------- */
var LIGNE_BLOC = /^(p|div|li|h[1-6]|tr|blockquote|pre|dt|dd|ul|ol|dl|table|section|article|header|footer|hr)$/;
var LIGNE_VIDE_EL = /^(img|wbr|input|meta|link|col|source|area|base|embed|param|track)$/;
var LIGNE_IGNOREE = /^(head|style|script|title|template|noscript)$/;
// HTML collé → lignes (html non assaini) : <br> coupe la ligne, un bloc (p, li…) aussi s'il a du contenu ou s'il est vide.
// Genres : <li> d'un <ul>/<ol> au niveau de sa profondeur (aria-level de Docs l'emporte), <input type=checkbox> ou ☐/☑ en tête,
// liste de Word (mso-list) selon son symbole, data-lv/g/done d'une copie d'Ardoise ; un titre venu d'ailleurs reste du texte
var LIGNE_MARQUE_CASE = /^((?:<[^>]*>)*)\s*([☐☑])(?: |&nbsp;| )?/;
function lignesDuCollage(html) {
  var s = enChaine(html)
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
  var t = enChaine(texte).split(/\r\n|\r|\n/);
  if (t.length > 1 && t[t.length - 1] === '') t.pop();
  return t.map(function (x) { return ligne(esc(x)); });
}
// marque d'une ligne en texte brut : « - » puce, « N. » numéro affiché n, « ☐ »/« ☑ » case ; rien pour le texte et le sous-titre.
// Seule source des marques de genre (copie, Copier pour Office, Word)
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
  return lignes.map(function (l, i) { return new Array(niveauDe(l) + 1).join('  ') + marqueDeLigne(l, nums[i]) + texteBrutDePresse(l.html); }).join('\n');
}
// puces et numéros en <ul>/<ol> imbriqués (un autre genre au même niveau ferme la liste, toute autre ligne les ferme toutes) ;
// f.liste(tag, niveau, haut (liste au-dessus ou null), numéro, i) → balise ouvrante ; f.li(l, i) → <li…> et contenu ;
// f.ligne(l, i) → ligne hors liste. Copie (lignesEnHtml) et Copier pour Office
function lignesEnListes(lignes, nums, f) {
  var out = '', ouvertes = [];
  var fermer = function (jusqua) { while (ouvertes.length > jusqua) out += '</li></' + ouvertes.pop().tag + '>'; };
  lignes.forEach(function (l, i) {
    var n = niveauDe(l);
    if (l.genre === 'puce' || l.genre === 'numero') {
      var tag = l.genre === 'puce' ? 'ul' : 'ol';
      while (ouvertes.length && ouvertes[ouvertes.length - 1].lv > n) fermer(ouvertes.length - 1);
      var haut = ouvertes[ouvertes.length - 1];
      if (haut && haut.lv === n && haut.tag !== tag) { fermer(ouvertes.length - 1); haut = ouvertes[ouvertes.length - 1]; }
      if (haut && haut.lv === n) out += '</li>';
      else { out += f.liste(tag, n, haut || null, nums[i], i); ouvertes.push({ tag: tag, lv: n }); }
      out += f.li(l, i); return;
    }
    fermer(0);
    out += f.ligne(l, i);
  });
  fermer(0);
  return out;
}
// copie : listes par lignesEnListes (une liste sans parent à son niveau porte data-lv, et une marge hors de toute liste ;
// <ol start> = numéro affiché) ; cases en <p> avec ☐/☑ (Writer change une liste de cases en puces) ; sous-titre en <h3> ;
// texte en <p>. data-lv, data-g et data-done : pour un collage dans Ardoise, la marge pour les autres applications
function lignesEnHtml(lignes, idDoc, nums) {
  var retrait = function (n) { return n ? ' data-lv="' + n + '" style="margin-left:' + 2 * n + 'em"' : ''; };
  var h = function (l) { return rendreFormules(pastillesSansCouleur(l.html, idDoc), false); };   // formules en MathML annoté (05-formules.js)
  return lignesEnListes(lignes, nums || numerosDesLignes(lignes), {
    liste: function (tag, n, haut, num) {
      var att = !haut ? retrait(n) : n !== haut.lv + 1 ? ' data-lv="' + n + '"' : '';
      if (tag === 'ol' && num && num !== 1) att += ' start="' + num + '"';
      return '<' + tag + att + '>';
    },
    li: function (l) { return '<li>' + (h(l) || '<br>'); },
    ligne: function (l) {
      var n = niveauDe(l);
      if (l.genre === 'case') return '<p data-g="case"' + (l.done ? ' data-done' : '') + retrait(n) + '>' + marqueDeLigne(l) + h(l) + '</p>';
      if (l.genre === 'soustitre') return '<h3 data-g="soustitre"' + retrait(n) + '>' + (h(l) || '<br>') + '</h3>';
      return '<p' + retrait(n) + '>' + (h(l) || '<br>') + '</p>';
    }
  });
}
// case parente (requêtes « cases à cocher ») : html de la ligne la plus proche au-dessus de niveau strictement inférieur,
// quel que soit son genre, cochée ou non ; '' au niveau 0. Ne lit que html et lv : vaut aussi pour une Liste à cocher
function caseParente(lignes, i) {
  var lv = niveauDe(lignes[i]);
  for (var j = i - 1; lv > 0 && j >= 0; j--) if (niveauDe(lignes[j]) < lv) return lignes[j].html;
  return '';
}
// Cochées à la fin (menu contextuel d'une case) : la suite de cases de même niveau autour de la ligne i, chacune suivie de
// ses lignes plus profondes, est rangée cochées après non cochées (tri stable) ; seul ce niveau est rangé. Nouveau tableau
// des mêmes objets ligne ; les lignes hors de la suite restent à leur place. Ligne i qui n'est pas une case : même ordre.
function casesALaFin(lignes, i) {
  var out = lignes.slice(), l = lignes[i]; if (!l || l.genre !== 'case') return out;
  var lv = niveauDe(l), nv = function (j) { return niveauDe(lignes[j]); }, estCase = function (j) { return lignes[j].genre === 'case' && nv(j) === lv; };
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
