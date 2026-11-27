/* ---------- Formules : moteur LaTeX → MathML (maison, sans dépendance : ADR 0001) ---------- */
// Module pur, sans DOM : texEnMathML(source, mode) rend un <math> annoté de sa source (application/x-tex), lettres en caractères
// mathématiques Unicode (𝑥, 𝛼 : le peintre de Copier pour Office ignore l'italique des <mi>). Commande inconnue : <mtext class="f-err">
// rouge, le reste est rendu ; accolade, \left ou environnement non fermé : fermé en fin de source. Extension par COMMANDES_TEX.

// lettres en caractères mathématiques : [majuscule A, minuscule a, chiffre 0] de chaque variante, et les lettres qu'Unicode
// a placées ailleurs (ℎ, ℝ, ℱ…) ; italique par défaut, \mathbb, \mathcal, \mathbf ; null : pas de chiffre propre
var VARIANTES_TEX = {
  it: [0x1D434, 0x1D44E, null, { h: 'ℎ' }],
  bb: [0x1D538, 0x1D552, 0x1D7D8, { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' }],
  cal: [0x1D49C, 0x1D4B6, null, { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' }],
  bf: [0x1D400, 0x1D41A, 0x1D7CE, {}],
};
function lettreTex(c, v) {
  var t = VARIANTES_TEX[v || 'it'], o = c.charCodeAt(0);
  return t[3][c] || String.fromCodePoint(o >= 97 ? t[1] + o - 97 : t[0] + o - 65);
}
function chiffresTex(m, v) {
  var d = VARIANTES_TEX[v || 'it'][2];
  return d == null ? m : m.replace(/[0-9]/g, function (c) { return String.fromCodePoint(d + +c); });
}
// délimiteurs de \left, \right et des environnements, écrits en commande
var DELIMITEURS_TEX = { '{': '{', '}': '}', '|': '‖', langle: '⟨', rangle: '⟩', vert: '|', Vert: '‖', lvert: '|', rvert: '|', lVert: '‖', rVert: '‖',
  lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉' };
function delimiteurEtire(c) { return c ? '<mo fence="true" stretchy="true">' + esc(c) + '</mo>' : ''; }
// environnements : délimiteurs gauche et droit, attributs du tableau (alignement par page.css : Chromium ignore columnalign)
var ENVIRONNEMENTS_TEX = { matrix: ['', '', ''], pmatrix: ['(', ')', ''], bmatrix: ['[', ']', ''],
  cases: ['{', '', ' class="f-cases" columnalign="left left"'], aligned: ['', '', ' class="f-aligned" displaystyle="true" columnalign="right left"'] };
function erreurTex(t) { return '<mtext class="f-err">' + esc(t) + '</mtext>'; }
// accents : caractère posé sur (ou sous) la base
var ACCENTS_TEX = { hat: 'ˆ', vec: '→', bar: '¯', tilde: '˜', dot: '˙' };
// grec : minuscules en italique mathématique (U+1D6FC α … U+1D714 ω, puis variantes), majuscules droites
var GREC_MIN = ['alpha', 'beta', 'gamma', 'delta', 'varepsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'varsigma', 'sigma', 'tau', 'upsilon', 'varphi', 'chi', 'psi', 'omega'];
var GREC_VAR = { epsilon: 0x1D716, vartheta: 0x1D717, varkappa: 0x1D718, phi: 0x1D719, varrho: 0x1D71A, varpi: 0x1D71B };
var GREC_MAJ = { Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω' };
// opérateurs écrits autrement que tapés
var OP_TEX = { '-': '−', '*': '∗' };
// opérateur tapé ; une parenthèse, un crochet ou une barre tapés ne s'étirent pas (LaTeX : seuls \left et \right s'étirent),
// et la barre de |x| ne prend pas l'espace d'un opérateur infixe
function operateurTex(c) {
  return '<mo' + ('()[]|{}'.indexOf(c) >= 0 ? ' stretchy="false"' : '') + (c === '|' ? ' lspace="0" rspace="0"' : '') + '>' + esc(OP_TEX[c] || c) + '</mo>';
}
// une commande reçoit l'analyseur et rend un élément MathML
var COMMANDES_TEX = {
  // grands opérateurs : bornes dessous et dessus dans un bloc (a.limites), à côté en ligne ; \int toujours à côté, comme LaTeX
  sum: function (a) { a.limites(); return '<mo>∑</mo>'; },
  prod: function (a) { a.limites(); return '<mo>∏</mo>'; },
  lim: function (a) { a.limites(); return '<mi>lim</mi>'; },
  int: function () { return '<mo>∫</mo>'; },
  // barre horizontale U+2015 : celle que les polices mathématiques étirent sur toute la base (‾ et _ restent courts)
  overline: function (a) { return '<mover accent="true">' + a.argument() + '<mo stretchy="true">―</mo></mover>'; },
  underline: function (a) { return '<munder accentunder="true">' + a.argument() + '<mo stretchy="true">―</mo></munder>'; },
  // texte tel que tapé ; MathML rogne les blancs des bords d'un jeton : espaces insécables
  text: function (a) { return '<mtext>' + esc(a.brut()).replace(/ /g, '\u00a0') + '</mtext>'; },
  mathbb: function (a) { return a.variante('bb'); },
  mathcal: function (a) { return a.variante('cal'); },
  mathbf: function (a) { return a.variante('bf'); },
  left: function (a) {
    var g = a.delimiteur(), c = a.liste(function () { return a.vu('\\right'); }).join(''), d = '';
    if (a.vu('\\right')) { a.avance(6); d = a.delimiteur(); }
    return '<mrow>' + delimiteurEtire(g) + c + delimiteurEtire(d) + '</mrow>';
  },
  right: function (a) { var d = a.delimiteur(); return d ? operateurTex(d) : ''; },
  begin: function (a) {
    var nom = a.brut(), e = Object.prototype.hasOwnProperty.call(ENVIRONNEMENTS_TEX, nom) && ENVIRONNEMENTS_TEX[nom];
    if (!e) return erreurTex('\\begin{' + nom + '}');
    var t = '<mtable' + e[2] + '>' + a.lignes(true) + '</mtable>';
    if (a.vu('\\end')) { a.avance(4); a.brut(); }   // fermé sous n'importe quel nom, ou par la fin de la source
    return e[0] || e[1] ? '<mrow>' + delimiteurEtire(e[0]) + t + delimiteurEtire(e[1]) + '</mrow>' : t;
  },
  end: function (a) { return erreurTex('\\end{' + a.brut() + '}'); },
  // saut de ligne dans un groupe : ignoré (au premier niveau et dans un environnement, il coupe les lignes : tableau())
  '\\': function (a) { a.optionnel(); return ''; },
  quad: function () { return '<mspace width="1em"></mspace>'; },
  qquad: function () { return '<mspace width="2em"></mspace>'; },
  frac: function (a) { return '<mfrac>' + a.argument() + a.argument() + '</mfrac>'; },
  dfrac: function (a) { return '<mstyle displaystyle="true" scriptlevel="0"><mfrac>' + a.argument() + a.argument() + '</mfrac></mstyle>'; },
  tfrac: function (a) { return '<mstyle displaystyle="false"><mfrac>' + a.argument() + a.argument() + '</mfrac></mstyle>'; },
  binom: function (a) { return '<mrow><mo>(</mo><mfrac linethickness="0">' + a.argument() + a.argument() + '</mfrac><mo>)</mo></mrow>'; },
  sqrt: function (a) {
    var n = a.optionnel();
    return n == null ? '<msqrt>' + a.enfants() + '</msqrt>' : '<mroot>' + a.argument() + n + '</mroot>';
  },
};
GREC_MIN.forEach(function (g, i) { COMMANDES_TEX[g] = function () { return '<mi>' + String.fromCodePoint(0x1D6FC + i) + '</mi>'; }; });
Object.keys(GREC_VAR).forEach(function (g) { COMMANDES_TEX[g] = function () { return '<mi>' + String.fromCodePoint(GREC_VAR[g]) + '</mi>'; }; });
Object.keys(GREC_MAJ).forEach(function (g) { COMMANDES_TEX[g] = function () { return '<mi mathvariant="normal">' + GREC_MAJ[g] + '</mi>'; }; });
Object.keys(ACCENTS_TEX).forEach(function (n) {
  COMMANDES_TEX[n] = function (a) { return '<mover accent="true">' + a.argument() + '<mo stretchy="false">' + ACCENTS_TEX[n] + '</mo></mover>'; };
});
// espaces de \, \; \! et de la barre oblique suivie d'une espace
[[',', '0.1667em'], [';', '0.2778em'], ['!', '-0.1667em'], [' ', '0.25em']].forEach(function (e) {
  COMMANDES_TEX[e[0]] = function () { return '<mspace width="' + e[1] + '"></mspace>'; };
});
// fonctions usuelles : nom en romain (mi de plusieurs lettres), puis l'application de fonction invisible (U+2061)
'sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh coth log ln lg exp max min sup inf det gcd deg dim ker arg'.split(' ').forEach(function (f) {
  COMMANDES_TEX[f] = function (a) { a.fonction(); return '<mi>' + f + '</mi>'; };
});
// relations, flèches et opérateurs : <mo> ; symboles ordinaires : <mi>
var SYMBOLES_MO = { leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', sim: '∼', simeq: '≃', cong: '≅', propto: '∝',
  ll: '≪', gg: '≫', in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇', cup: '∪', cap: '∩', setminus: '∖',
  to: '→', rightarrow: '→', leftarrow: '←', gets: '←', leftrightarrow: '↔', Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', iff: '⟺',
  implies: '⟹', mapsto: '↦', uparrow: '↑', downarrow: '↓', longrightarrow: '⟶', times: '×', cdot: '⋅', div: '÷', pm: '±', mp: '∓', circ: '∘',
  forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨', perp: '⊥', parallel: '∥', mid: '∣', ldots: '…', dots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱' };
var SYMBOLES_MI = { infty: '∞', partial: '∂', nabla: '∇', emptyset: '∅', varnothing: '∅', ell: 'ℓ', hbar: 'ℏ' };
Object.keys(SYMBOLES_MO).forEach(function (s) { COMMANDES_TEX[s] = function () { return '<mo>' + SYMBOLES_MO[s] + '</mo>'; }; });
Object.keys(SYMBOLES_MI).forEach(function (s) { COMMANDES_TEX[s] = function () { return '<mi>' + SYMBOLES_MI[s] + '</mi>'; }; });
// caractères réservés précédés d'une barre oblique : le caractère lui-même
'{}%$#&_'.split('').forEach(function (c) { COMMANDES_TEX[c] = function () { return operateurTex(c); }; });

function analyseurTex(src, mode) {
  var p = 0, a, limites = false, fonction = false, variante = null, arrets = [];
  function blancs() { while (p < src.length && /\s/.test(src[p])) p++; }
  // la source reprend-elle par `t` ? une commande en lettres ne doit pas être suivie d'une lettre (\right n'est pas \rightarrow)
  function vu(t) { return src.substr(p, t.length) === t && !(/[a-zA-Z]$/.test(t) && /[a-zA-Z]/.test(src[p + t.length] || '')); }
  // liste d'éléments jusqu'à la fermeture `fin` (un caractère, consommé) ou la fin de la source (fermeture implicite) ;
  // `fin` peut être un test d'arrêt (\right, cellule) non consommé, qui arrête aussi les listes ouvertes à l'intérieur
  function liste(fin) {
    var t = typeof fin === 'function';
    if (t) arrets.push(fin);
    var out = elements(t ? null : fin, t);
    if (t) arrets.pop();
    return out;
  }
  function elements(fin, pile) {
    var out = [];
    for (;;) {
      blancs();
      if (p >= src.length) return out;
      if (pile && arrets.some(function (f) { return f(); })) return out;
      var c = src[p];
      if (c === fin) { p++; return out; }
      if (c === '}') { p++; continue; }   // accolade en trop : ignorée
      if (c === '^' || c === '_') { out.push(scripts('<mrow></mrow>')); continue; }   // exposant sans base
      out.push(scripts(atome()));
    }
  }
  // un élément ; un groupe de plusieurs éléments est enveloppé d'un <mrow>
  function groupe(els) { return els.length === 1 ? els[0] : '<mrow>' + els.join('') + '</mrow>'; }
  function atome() {
    var c = src[p];
    if (c === '{') { p++; return groupe(liste('}')); }
    if (c === '\\') return commande();
    p++;
    if (/[a-zA-Z]/.test(c)) return '<mi>' + lettreTex(c, variante) + '</mi>';
    if (/[0-9]/.test(c)) {
      var m = src.slice(p - 1).match(/^\d+(?:\.\d+)?/)[0];
      p += m.length - 1;
      return '<mn>' + chiffresTex(m, variante) + '</mn>';
    }
    var cp = src.codePointAt(p - 1);
    if (cp > 0xFFFF) { c = String.fromCodePoint(cp); p++; }
    return operateurTex(c);
  }
  // nom de la commande après sa barre oblique : des lettres, ou un seul autre caractère
  function nomCommande() {
    p++;
    var nom = /[a-zA-Z]/.test(src[p] || '') ? src.slice(p).match(/^[a-zA-Z]+/)[0] : (src[p] || '');
    p += nom.length;
    return nom;
  }
  function commande() {
    var nom = nomCommande(), f = Object.prototype.hasOwnProperty.call(COMMANDES_TEX, nom) && COMMANDES_TEX[nom];
    return f ? f(a) : '<mtext class="f-err">' + esc('\\' + nom) + '</mtext>';
  }
  // indices et exposants qui suivent une base, dans les deux ordres
  function scripts(base) {
    var dessous = limites && mode === 'bloc', f = fonction ? '<mo>&#x2061;</mo>' : '';
    limites = fonction = false;
    return indices(base, dessous) + f;
  }
  function indices(base, dessous) {
    var sub = null, sup = null;
    for (;;) {
      var q = p; blancs();
      var c = src[p];
      if (c === '_' && sub == null) { p++; sub = argument(); }
      else if (c === '^' && sup == null) { p++; sup = argument(); }
      else { p = q; break; }
    }
    if (dessous) {
      if (sub != null && sup != null) return '<munderover>' + base + sub + sup + '</munderover>';
      if (sub != null) return '<munder>' + base + sub + '</munder>';
      if (sup != null) return '<mover>' + base + sup + '</mover>';
    }
    if (sub != null && sup != null) return '<msubsup>' + base + sub + sup + '</msubsup>';
    if (sub != null) return '<msub>' + base + sub + '</msub>';
    if (sup != null) return '<msup>' + base + sup + '</msup>';
    return base;
  }
  // marques posées par une commande sur la base qu'elle rend (bornes, fonction), lues par scripts() ; un argument les efface
  function argument() { var r = lireArgument(); limites = fonction = false; return r; }
  // argument d'une commande ou d'un indice : un groupe, une commande, ou un seul caractère (un seul chiffre)
  function lireArgument() {
    blancs();
    if (p >= src.length || src[p] === '}') return '<mrow></mrow>';
    var c = src[p];
    if (c === '{' || c === '\\') return atome();
    if (/[0-9]/.test(c)) { p++; return '<mn>' + chiffresTex(c, variante) + '</mn>'; }
    return atome();
  }
  // délimiteur après \left ou \right : un caractère ou une commande ; « . » ou inconnu : aucun
  function delimiteur() {
    blancs();
    if (p >= src.length) return '';
    if (src[p] !== '\\') { var c = src[p++]; return c === '.' ? '' : c; }
    var nom = nomCommande();
    return Object.prototype.hasOwnProperty.call(DELIMITEURS_TEX, nom) ? DELIMITEURS_TEX[nom] : '';
  }
  // lignes coupées par \\ (et cellules par & dans un environnement, arrêtées à \end) : les <mtr> d'un tableau ;
  // une dernière ligne vide est retirée
  function tableau(env) {
    var cellule = function () { return vu('\\\\') || (env && (vu('&') || vu('\\end'))); }, lignes = [], l = [];
    for (;;) {
      l.push(liste(cellule).join(''));
      if (env && vu('&')) { p++; continue; }
      lignes.push(l); l = [];
      if (!vu('\\\\')) break;
      p += 2; optionnel();
    }
    var der = lignes[lignes.length - 1];
    if (lignes.length > 1 && der.length === 1 && !der[0]) lignes.pop();
    return lignes;
  }
  function lignesMtr(lignes) {
    return lignes.map(function (l) { return '<mtr>' + l.map(function (c) { return '<mtd>' + c + '</mtd>'; }).join('') + '</mtr>'; }).join('');
  }
  // corps de la formule : une ligne, ou plusieurs lignes centrées si la source contient \\ au premier niveau
  function formule() {
    var l = tableau(false);
    return l.length === 1 ? l[0][0] : '<mtable>' + lignesMtr(l) + '</mtable>';
  }
  // contenu brut d'un argument entre accolades (accolades imbriquées comptées, fermé en fin de source), ou un caractère
  function brut() {
    blancs();
    if (src[p] !== '{') return src[p] ? src[p++] : '';
    var d = ++p, n = 1;
    for (; p < src.length; p++) {
      if (src[p] === '\\') { p++; continue; }
      if (src[p] === '{') n++;
      else if (src[p] === '}' && !--n) return src.slice(d, p++);
    }
    return src.slice(d);
  }
  // argument rendu dans une variante de lettres (\mathbb…) ; la variante extérieure revient ensuite
  function avecVariante(v) { var avant = variante; variante = v; var r = argument(); variante = avant; return r; }
  // argument facultatif entre crochets, ou null
  function optionnel() {
    var q = p; blancs();
    if (src[p] !== '[') { p = q; return null; }
    p++; return groupe(liste(']'));
  }
  // argument d'un élément qui accepte plusieurs enfants (msqrt) : les éléments d'un groupe, sans <mrow>
  function enfants() {
    blancs();
    if (src[p] === '{') { p++; return liste('}').join('') || '<mrow></mrow>'; }
    return argument();
  }
  a = { argument: argument, optionnel: optionnel, enfants: enfants, liste: liste,
    limites: function () { limites = true; }, fonction: function () { fonction = true; }, brut: brut, variante: avecVariante,
    vu: vu, avance: function (n) { p += n; }, delimiteur: delimiteur, lignes: function (env) { return lignesMtr(tableau(env)); }, formule: formule };
  return a;
}
var texCache = new Map();
function texEnMathML(source, mode) {
  source = String(source == null ? '' : source);
  if (!source.trim()) return '';
  var cle = mode + '\n' + source;
  if (texCache.has(cle)) return texCache.get(cle);
  var corps = analyseurTex(source, mode).formule();
  var m = '<math' + (mode === 'bloc' ? ' display="block"' : '') + '><semantics><mrow>' + corps + '</mrow><annotation encoding="application/x-tex">' + esc(source) + '</annotation></semantics></math>';
  if (texCache.size > 2000) texCache.clear();
  texCache.set(cle, m);
  return m;
}
// élément rendu d'une formule en ligne : insécable, non éditable en édition ; la source n'est portée que par l'annotation
function formuleHTML(source, edition) {
  var m = texEnMathML(source, 'ligne');
  return m ? '<span class="formule"' + (edition ? ' contenteditable="false"' : '') + '>' + m + '</span>' : '';
}
// passage des formules dans un rendu (texte HTML) : la forme stockée <span class="formule">source</span> devient l'élément
// rendu ; une formule déjà rendue (elle contient <math>) n'est pas retouchée. Appelé partout où paintPills l'est.
var FORMULE_RE = /<span class="formule">([^<]*)<\/span>/g;
function rendreFormules(html, edition) {
  if (html.indexOf('class="formule"') < 0) return html;
  return html.replace(FORMULE_RE, function (m, src) { return formuleHTML(htmlText(src), edition); });
}
// Saisie `$…$` (règle des dollars de Pandoc) : avant = texte jusqu'au curseur, qui finit par le `$` tapé ; suivant = texte
// après le curseur. Le `$` ouvrant n'est pas suivi d'une espace, le fermant n'est ni précédé d'une espace ni suivi d'un
// chiffre, la source n'est pas vide (« 5 $ et 10 $ » reste du texte). Rend { debut (place du `$` ouvrant), source } ou null.
function dollarsFermes(avant, suivant) {
  avant = String(avant || '');
  if (avant.slice(-1) !== '$' || /^\d/.test(suivant || '')) return null;
  var m = avant.match(/\$([^\s$](?:[^$]*[^\s$])?)\$$/);
  return m ? { debut: m.index, source: m[1] } : null;
}
// texte brut : une formule, stockée ou rendue (source dans l'annotation), s'écrit `$source$` ; la source reste échappée
var FORMULE_RENDUE_RE = /<span class="formule"[^>]*>(?:(?!<\/span>)[\s\S])*?<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>[\s\S]*?<\/span>/g;
function formulesEnTexte(html) {
  html = String(html == null ? '' : html);
  if (html.indexOf('class="formule"') < 0) return html;
  return html.replace(FORMULE_RENDUE_RE, '$$$1$$').replace(FORMULE_RE, '$$$1$$');
}
