/* ---------- Import Markdown ----------
   Une note Markdown (Obsidian surtout) devient des blocs du document : fonctions pures, sans DOM ni stockage au chargement.
   Le HTML produit reste brut : l'appelant l'assainit (sanitize) dans le navigateur. */
var ETAPE_MARKDOWN = 'page importée du Markdown';
// langage d'un bloc de code clôturé → langage de la coloration (06-coloration-syntaxique.js) ; inconnu : détection automatique
var LANGUES_MD = { sh: 'bash', bash: 'bash', zsh: 'bash', shell: 'bash', console: 'bash', py: 'py', python: 'py', ps: 'ps', ps1: 'ps', powershell: 'ps', pwsh: 'ps',
  js: 'js', javascript: 'js', ts: 'js', typescript: 'js', jsx: 'js', tsx: 'js', json: 'json', yaml: 'yaml', yml: 'yaml', sql: 'sql', html: 'html', xml: 'html', svg: 'html',
  c: 'c', cpp: 'c', 'c++': 'c', h: 'c', java: 'c', go: 'c', rust: 'c', rs: 'c', cs: 'c', csharp: 'c', kotlin: 'c', swift: 'c', php: 'c', text: 'text', txt: 'text', plain: 'text' };
// type d'encadré d'Obsidian → variante d'Encadré ; tout autre type (note, info, tip, inconnu…) → info
var ENCADRES_MD = { warning: 'warn', caution: 'warn', attention: 'warn', danger: 'bad', error: 'bad', bug: 'bad', failure: 'bad', fail: 'bad', missing: 'bad', success: 'ok', check: 'ok', done: 'ok' };
var MD_CLOTURE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/, MD_TITRE = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/, MD_SEPARATEUR = /^ {0,3}([-*_])([ \t]*\1){2,}[ \t]*$/;
var MD_CITATION = /^ {0,3}>/, MD_ELEMENT = /^([ \t]*)([-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/, MD_DELIMITEURS = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

// #tag d'Obsidian : en début de mot, lettres (latines, grecques, cyrilliques), chiffres, _ - / ; au moins une lettre
var MD_LETTRE = 'A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\u0370-\u03FF\u0400-\u04FF';
var MD_PASTILLE = new RegExp('(^|[\\s(*_~])#([' + MD_LETTRE + '0-9_\\/-]*[' + MD_LETTRE + '][' + MD_LETTRE + '0-9_\\/-]*)', 'g');
var liensMd = null;   // pages du document pendant une conversion (liens [[…]]) ; cur : page remplacée, dont les sections ne comptent pas
// { entete: { title } | null, blocs: blocs sans identifiant, imagesManquantes } ; pages : pages du document, pour les liens [[…]]
function blocsDuMarkdown(texte, pages, cur) {
  var lignes = String(texte == null ? '' : texte).replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  liensMd = { pages: pages || [], cur: cur };
  try { return blocsDuMarkdownLu(lignes); } finally { liensMd = null; }
}
function blocsDuMarkdownLu(lignes) {
  var r = { entete: null, blocs: [], imagesManquantes: 0, images: [] }, fin = finYamlMd(lignes);
  if (fin > 0) { var fiche = ficheYamlMd(lignes.slice(1, fin)); if (fiche.items.length) r.blocs.push(fiche); lignes = lignes.slice(fin + 1); }
  // une image devient un bloc Image juste après le bloc qui la contenait ; distante : à télécharger (images), sinon à remettre
  function poserImages(images) {
    images.forEach(function (im) {
      if (im.distante) r.images.push({ bloc: r.blocs.length, url: im.url, nom: im.nom }); else r.imagesManquantes++;
      r.blocs.push({ type: 'image', src: '', caption: esc(im.distante ? im.alt : im.nom), alt: im.alt });
    });
  }
  decouperMarkdown(lignes).forEach(function (g) {
    if (g.sorte === 'titre') {
      var html = enLigneMd(g.texte);
      if (g.niveau === 1 && !r.entete) r.entete = { title: html };
      else r.blocs.push({ type: g.niveau <= 2 ? 'h2' : g.niveau === 3 ? 'h3' : 'subtitle', html: html });
    } else if (g.sorte === 'paragraphe') {
      var x = imagesDuParagrapheMd(g.lignes.join('\n'));
      if (x.texte) r.blocs.push({ type: 'p', html: enLigneMd(x.texte) });
      poserImages(x.images);
    } else {
      // images d'un élément de liste ou d'une ligne de tableau : sorties comme celles d'un paragraphe, après le bloc entier
      var imgs = [], sortir = function (t) { var y = imagesDuParagrapheMd(t); if (!y.images.length) return t; imgs = imgs.concat(y.images); return y.texte; };
      if (g.sorte === 'liste') g.elements.forEach(function (e) { e.texte = sortir(e.texte); });
      else if (g.sorte === 'tableau') g.lignes = g.lignes.map(sortir);
      r.blocs.push(blocDuGroupe(g)); poserImages(imgs);
    }
  });
  return r;
}
// images d'un paragraphe (hors code en ligne) : ![texte](adresse) et ![[fichier.png|…]] ; { texte sans les images, images }
var MD_IMAGE = /(`+)[\s\S]*?[^`]\1(?!`)|!\[([^\]\n]*)\]\(\s*<?([^\s()<>]+)>?(?:\s+"[^"]*")?\s*\)|!\[\[([^\[\]\n|]+?\.(?:png|jpe?g|gif|webp|svg|bmp|avif))(?:\|[^\]\n]*)?\]\]/gi;
function imagesDuParagrapheMd(texte) {
  var images = [];
  var t = texte.replace(MD_IMAGE, function (m, code, alt, url, fichier) {
    if (code) return m;
    var adresse = url || fichier, nom = adresse.replace(/[?#].*$/, '').split('/').pop();
    try { nom = decodeURIComponent(nom); } catch (_) {}
    if (/^data:/i.test(adresse)) nom = 'image';
    images.push({ alt: alt || '', url: adresse, nom: nom || 'image', distante: !!url && /^(https?:|data:image\/)/i.test(url) });
    return '\u0005';
  });
  t = t.replace(/[ \t]*\u0005[ \t]*/g, ' ').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).join('\n');
  return { texte: t, images: images };
}
// en-tête YAML d'Obsidian : « --- » en toute première ligne, fermé par « --- » ou « ... » ; indice de la ligne qui le ferme, sinon -1
function finYamlMd(lignes) {
  if (!/^---[ \t]*$/.test(lignes[0])) return -1;
  for (var i = 1; i < lignes.length; i++) if (/^(---|\.\.\.)[ \t]*$/.test(lignes[i])) return i;
  return -1;
}
// propriétés YAML → Fiche de faits : une ligne par clé (texte simple), valeurs d'une liste jointes par des virgules ;
// tags (ou tag) → pastilles. Lecture simple : scalaire, liste [a, b], liste à tirets, texte sur plusieurs lignes (| ou >)
function ficheYamlMd(lignes) {
  var props = [], p = null;
  lignes.forEach(function (l) {
    var m;
    if (!l.trim() || /^\s*#/.test(l)) return;
    if (!/^[ \t]/.test(l) && (m = l.match(/^([^:]+?)[ \t]*:(?:[ \t]+(.*?))?[ \t]*$/))) {
      var v = m[2] || '';
      p = { k: m[1].replace(/^(["'])(.*)\1$/, '$2'), valeurs: [], bloc: /^[|>][-+]?$/.test(v) };
      props.push(p);
      if (/^\[.*\]$/.test(v)) p.valeurs = v.slice(1, -1).split(',').map(scalaireYamlMd).filter(function (x) { return x !== ''; });
      else if (v && !p.bloc) p.valeurs = [scalaireYamlMd(v)];
      return;
    }
    if (!p) return;
    if (!p.bloc && (m = l.match(/^[ \t]*-[ \t]*(.*)$/))) { var x = scalaireYamlMd(m[1]); if (x !== '') p.valeurs.push(x); return; }
    if (p.bloc && p.valeurs.length) p.valeurs[0] += ' ' + l.trim(); else p.valeurs.push(l.trim());   // texte sur plusieurs lignes, sous-objet gardé en texte
  });
  return { type: 'facts', items: props.map(function (p) {
    if (/^tags?$/i.test(p.k)) {
      var noms = []; p.valeurs.forEach(function (v) { v.split(/[,\s]+/).forEach(function (n) { n = n.replace(/^#/, ''); if (n) noms.push(n); }); });
      return { k: p.k, v: noms.map(function (n) { return '<span class="pill">' + esc(n) + '</span>'; }).join(' ') };
    }
    return { k: p.k, v: esc(p.valeurs.join(', ')) };
  }) };
}
function scalaireYamlMd(v) { v = v.trim(); var m = v.match(/^(["'])(.*)\1$/); return m ? m[2] : v.replace(/[ \t]+#.*$/, ''); }
// lignes groupées en blocs bruts ; le code clôturé passe avant tout le reste et son contenu n'est jamais interprété
function decouperMarkdown(lignes) {
  var out = [], i = 0, n = lignes.length, l, m;
  function debutDeBloc(k) {
    var x = lignes[k];
    return MD_CLOTURE.test(x) || MD_TITRE.test(x) || MD_SEPARATEUR.test(x) || MD_CITATION.test(x) || MD_ELEMENT.test(x) || debutDeTableau(k);
  }
  function debutDeTableau(k) { return lignes[k].indexOf('|') >= 0 && k + 1 < n && lignes[k + 1].indexOf('-') >= 0 && MD_DELIMITEURS.test(lignes[k + 1]) && (lignes[k + 1].indexOf('|') >= 0 || /^\s*\|/.test(lignes[k])); }
  while (i < n) {
    l = lignes[i];
    if (!l.trim()) { i++; continue; }
    if ((m = l.match(MD_CLOTURE))) {
      var fin = new RegExp('^ {0,3}' + (m[1][0] === '`' ? '`' : '~') + '{' + m[1].length + ',}[ \\t]*$'), code = [];
      for (i++; i < n && !fin.test(lignes[i]); i++) code.push(lignes[i]);
      i++; out.push({ sorte: 'code', langue: m[2], code: code.join('\n') }); continue;
    }
    if ((m = l.match(MD_TITRE))) { out.push({ sorte: 'titre', niveau: m[1].length, texte: (m[2] || '').replace(/[ \t]+#+$/, '').replace(/^#+$/, '') }); i++; continue; }
    if (MD_SEPARATEUR.test(l)) { out.push({ sorte: 'separateur' }); i++; continue; }
    if (debutDeTableau(i)) {
      var t = [l]; for (i += 2; i < n && lignes[i].trim() && lignes[i].indexOf('|') >= 0; i++) t.push(lignes[i]);
      out.push({ sorte: 'tableau', lignes: t }); continue;
    }
    if (MD_CITATION.test(l)) {
      var c = []; for (; i < n && MD_CITATION.test(lignes[i]); i++) c.push(lignes[i].replace(/^ {0,3}> ?/, ''));
      out.push({ sorte: 'citation', lignes: c }); continue;
    }
    if (MD_ELEMENT.test(l)) {
      var el = [];
      while (i < n) {
        if ((m = lignes[i].match(MD_ELEMENT)) && !MD_SEPARATEUR.test(lignes[i])) { el.push({ retrait: m[1].replace(/\t/g, '    ').length, marque: m[2], texte: m[3] || '' }); i++; continue; }
        if (lignes[i].trim() && /^[ \t]/.test(lignes[i]) && !debutDeBloc(i)) { el[el.length - 1].texte += '\n' + lignes[i].trim(); i++; continue; }   // ligne de suite
        if (!lignes[i].trim()) { var k = i; while (k < n && !lignes[k].trim()) k++; if (k < n && MD_ELEMENT.test(lignes[k]) && !MD_SEPARATEUR.test(lignes[k])) { i = k; continue; } }
        break;
      }
      out.push({ sorte: 'liste', elements: el }); continue;
    }
    var p = [l]; for (i++; i < n && lignes[i].trim() && !debutDeBloc(i); i++) p.push(lignes[i]);
    out.push({ sorte: 'paragraphe', lignes: p });
  }
  return out;
}
function blocDuGroupe(g) {
  if (g.sorte === 'separateur') return { type: 'divider' };
  if (g.sorte === 'paragraphe') return { type: 'p', html: enLigneMd(g.lignes.join('\n')) };
  if (g.sorte === 'code') {
    var c = { type: 'code', variant: 'dark', name: g.langue, code: g.code, tall: false }, lg = LANGUES_MD[g.langue.toLowerCase()];
    if (lg) c.lang = lg;
    return c;
  }
  if (g.sorte === 'tableau') {
    var rows = g.lignes.map(cellulesMd), lc = 0;
    rows.forEach(function (r) { lc = Math.max(lc, r.length); });
    return { type: 'table', rows: rows.map(function (r) { while (r.length < lc) r.push(''); return r; }) };
  }
  if (g.sorte === 'liste') return listeMd(g.elements);
  return citationMd(g.lignes);
}
// éléments de liste → Liste (à puces ou numérotée, selon le premier) ou Liste à cocher dès qu'un élément est une case ;
// niveau : pile des retraits (2 espaces ou une tabulation par niveau, 4 espaces tolérés), plafonné à 6
function listeMd(elements) {
  var pile = [], cases = false, items = elements.map(function (e) {
    while (pile.length && e.retrait < pile[pile.length - 1]) pile.pop();
    if (!pile.length || e.retrait > pile[pile.length - 1]) pile.push(e.retrait);
    var lv = Math.min(6, pile.length - 1), m = e.texte.match(/^\[([ xX])\](?:[ \t]+([\s\S]*))?$/);
    if (m) cases = true;
    return { lv: lv, done: !!m && m[1] !== ' ', html: enLigneMd(m ? m[2] || '' : e.texte) };
  });
  return cases ? { type: 'check', items: items.map(function (it) { var o = { html: it.html, done: it.done }; if (it.lv) o.lv = it.lv; return o; }) }
    : { type: 'list', ordered: /\d/.test(elements[0].marque), items: items.map(function (it) { var o = { html: it.html }; if (it.lv) o.lv = it.lv; return o; }) };
}
// citation → Encadré ; « [!type] Titre » d'Obsidian : variante selon le type, titre en gras ; replié (-) ou dépliable (+) → Bloc dépliable
function citationMd(lignes) {
  var m = lignes[0].match(/^[ \t]*\[!([^\]]+)\]([+-]?)[ \t]*(.*)$/), corps = m ? lignes.slice(1) : lignes;
  var paras = [], cur = [];
  corps.forEach(function (l) { if (l.trim()) cur.push(l); else if (cur.length) { paras.push(cur); cur = []; } });
  if (cur.length) paras.push(cur);
  var html = paras.map(function (p) { return enLigneMd(p.join('\n')); }).join('<br><br>');
  if (!m) return { type: 'note', variant: 'info', html: html };
  var type = m[1].trim().toLowerCase(), titre = m[3].trim() ? enLigneMd(m[3].trim()) : '';
  if (m[2]) return { type: 'details', title: titre || type.charAt(0).toUpperCase() + type.slice(1), html: html, open: m[2] === '+' };
  return { type: 'note', variant: ENCADRES_MD[type] || 'info', html: titre ? '<b>' + titre + '</b>' + (html ? '<br>' + html : '') : html };
}
// cellules d'une ligne de tableau : | de bord retirés, \| et | dans du code gardés comme texte
function cellulesMd(ligne) {
  var s = ligne.trim().replace(/^\|/, ''), out = [], cur = '', code = false;
  if (/[^\\]\|$/.test(s) || s === '|') s = s.slice(0, -1);
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (ch === '`') code = !code;
    if (ch === '|' && !code) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(function (c) { return enLigneMd(c.trim()); });
}
// mise en forme en ligne : code, échappements, HTML brut (assaini à l'appel), liens, gras, italique, barré, retours à la ligne
function enLigneMd(texte) {
  var gardes = [];
  function garder(h) { gardes.push(h); return '\u0001' + (gardes.length - 1) + '\u0002'; }
  var s = String(texte).replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, function (m, f, c) { return garder('<code>' + esc(c.replace(/^ ([\s\S]*) $/, '$1')) + '</code>'); });
  s = s.replace(/\\([\\`*_{}\[\]()#+\-.!|~<>])/g, function (m, c) { return garder(esc(c)); });
  s = s.replace(/!?\[\[([^\[\]\n]+)\]\]/g, function (m, cible) { var l = lienWikiMd(cible); return garder(l.href ? '<a href="' + l.href + '">' + esc(l.texte) + '</a>' : esc(l.texte)); });
  s = s.replace(/<!--[\s\S]*?-->|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g, garder);   // balise HTML : laissée à l'assainisseur
  s = s.replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|[A-Za-z][A-Za-z0-9]*;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // [texte](adresse) : adresse web, courriel ou ancre ; une autre adresse (fichier local) ne garde que le texte
  s = s.replace(/(^|[^!])\[([^\]\n]+)\]\(\s*(?:&lt;)?([^\s()]*?)(?:&gt;)?(?:\s+"[^"]*")?\s*\)/g, function (m, av, t, u) {
    return av + (/^(https?:|mailto:|#)/i.test(u) ? garder('<a href="' + u.replace(/"/g, '&quot;') + '">') + t + garder('</a>') : t);
  });
  // #tag → pastille (règle de la pastille au clavier, saisieDiese) : en début de mot, au moins une lettre ; pas dans un lien
  s = s.replace(MD_PASTILLE, function (m, av, nom, i, tout) {
    nom = nom.replace(/[\/-]+$/, '');
    var ouverts = 0; tout.slice(0, i + av.length).replace(/\u0001(\d+)\u0002/g, function (x, k) { if (/^<a\s/.test(gardes[+k])) ouverts++; else if (gardes[+k] === '</a>') ouverts--; return x; });
    return ouverts > 0 ? m : av + garder('<span class="pill">' + nom + '</span>') + m.slice(av.length + 1 + nom.length);
  });
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>');
  s = s.replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<b><i>$1</i></b>');
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<b>$1</b>').replace(/(^|[^A-Za-z0-9À-ɏ_])__(?=\S)([\s\S]*?\S)__(?![A-Za-z0-9À-ɏ_])/g, '$1<b>$2</b>');
  s = s.replace(/\*(?=[^\s*])([^*]*?[^\s*])\*/g, '<i>$1</i>').replace(/(^|[^A-Za-z0-9À-ɏ_])_(?=[^\s_])([^_]*?[^\s_])_(?![A-Za-z0-9À-ɏ_])/g, '$1<i>$2</i>');
  s = s.split('\n').map(function (l) { return l.replace(/^[ \t]+/, '').replace(/(\\|[ \t]+)$/, ''); }).join('<br>');   // chaque retour à la ligne est gardé, comme dans Obsidian
  while (/\u0001\d+\u0002/.test(s)) s = s.replace(/\u0001(\d+)\u0002/g, function (m, k) { return gardes[+k]; });
  return s.trim();
}
// [[Page]], [[Page|texte]], [[Page#Section]] (^bloc : la page) → { href, texte } ; page cherchée sans casse ni accents par son
// nom (pageTitle), avec ou sans dossier et .md ; section absente : la page ; sans page : href vide. Texte : l'alias, sinon « Page › Section »
function lienWikiMd(cible) {
  var bar = cible.indexOf('|'), alias = bar >= 0 ? cible.slice(bar + 1).trim() : '', c = bar >= 0 ? cible.slice(0, bar) : cible;
  var di = c.indexOf('#'), nom = (di >= 0 ? c.slice(0, di) : c).trim(), sec = di >= 0 ? c.slice(di + 1).trim() : '';
  if (sec.charAt(0) === '^') sec = '';
  var texte = alias || (nom && sec ? nom + ' › ' + sec : nom || sec);
  if (!nom || !liensMd) return { href: '', texte: texte };
  var cles = [sansAccents(nom), sansAccents(nom.replace(/\.md$/i, '').split('/').pop())], pages = liensMd.pages;
  for (var i = 0; i < pages.length; i++) {
    if (cles.indexOf(sansAccents(pageTitle(pages[i], i))) < 0) continue;
    var x = sec && i !== liensMd.cur ? sectionsOf(pages[i]).filter(function (y) { return sansAccents(y.t) === sansAccents(sec); })[0] : null;
    return { href: '#pg-' + pages[i].id + (x ? '/' + x.id : ''), texte: texte };
  }
  return { href: '', texte: texte };
}
// vrai si la page a un bloc non vide autre que l'en-tête et le pied de page, que l'import garde
function pageAContenu(blocs) {
  return blocs.some(function (b) {
    if (b.type === 'header' || b.type === 'footer' || b.type === 'divider') return false;
    if (b.type === 'p' || b.type === 'h2' || b.type === 'h3' || b.type === 'subtitle') return !!htmlText(b.html).trim();
    return true;
  });
}
