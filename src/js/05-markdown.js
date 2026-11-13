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

// { entete: { title } | null, blocs: blocs sans identifiant, imagesManquantes } ; pages : pages du document, pour les liens [[…]]
function blocsDuMarkdown(texte, pages) {
  var lignes = String(texte == null ? '' : texte).replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  var r = { entete: null, blocs: [], imagesManquantes: 0 };
  decouperMarkdown(lignes).forEach(function (g) {
    if (g.sorte === 'titre') {
      var html = enLigneMd(g.texte);
      if (g.niveau === 1 && !r.entete) r.entete = { title: html };
      else r.blocs.push({ type: g.niveau <= 2 ? 'h2' : g.niveau === 3 ? 'h3' : 'subtitle', html: html });
    } else r.blocs.push(blocDuGroupe(g));
  });
  return r;
}
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
  s = s.replace(/<!--[\s\S]*?-->|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g, garder);   // balise HTML : laissée à l'assainisseur
  s = s.replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|[A-Za-z][A-Za-z0-9]*;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // [texte](adresse) : adresse web, courriel ou ancre ; une autre adresse (fichier local) ne garde que le texte
  s = s.replace(/(^|[^!])\[([^\]\n]+)\]\(\s*(?:&lt;)?([^\s()]*?)(?:&gt;)?(?:\s+"[^"]*")?\s*\)/g, function (m, av, t, u) {
    return av + (/^(https?:|mailto:|#)/i.test(u) ? garder('<a href="' + u.replace(/"/g, '&quot;') + '">') + t + garder('</a>') : t);
  });
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>');
  s = s.replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<b><i>$1</i></b>');
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<b>$1</b>').replace(/(^|[^A-Za-z0-9À-ɏ_])__(?=\S)([\s\S]*?\S)__(?![A-Za-z0-9À-ɏ_])/g, '$1<b>$2</b>');
  s = s.replace(/\*(?=[^\s*])([^*]*?[^\s*])\*/g, '<i>$1</i>').replace(/(^|[^A-Za-z0-9À-ɏ_])_(?=[^\s_])([^_]*?[^\s_])_(?![A-Za-z0-9À-ɏ_])/g, '$1<i>$2</i>');
  s = s.split('\n').map(function (l) { return l.replace(/^[ \t]+/, '').replace(/(\\|[ \t]+)$/, ''); }).join('<br>');   // chaque retour à la ligne est gardé, comme dans Obsidian
  while (/\u0001\d+\u0002/.test(s)) s = s.replace(/\u0001(\d+)\u0002/g, function (m, k) { return gardes[+k]; });
  return s.trim();
}
// vrai si la page a un bloc non vide autre que l'en-tête et le pied de page, que l'import garde
function pageAContenu(blocs) {
  return blocs.some(function (b) {
    if (b.type === 'header' || b.type === 'footer' || b.type === 'divider') return false;
    if (b.type === 'p' || b.type === 'h2' || b.type === 'h3' || b.type === 'subtitle') return !!htmlText(b.html).trim();
    return true;
  });
}
