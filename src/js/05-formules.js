/* ---------- Formules : moteur LaTeX → MathML (maison, sans dépendance : ADR 0001) ---------- */
// Module pur, sans DOM. texEnMathML(source, mode) rend une chaîne <math> dont la source voyage dans une annotation
// application/x-tex (relue par sanitize, 02-assainissement.js). Le navigateur fait la mise en page avec ses polices
// mathématiques. Les lettres sont écrites directement en caractères mathématiques Unicode (𝑥, 𝛼) : le peintre de Copier
// pour Office ne connaît pas l'italique automatique des <mi>.
// Une commande inconnue devient un <mtext class="f-err"> rouge (page.css) et le reste est rendu ; une accolade non
// fermée est fermée en fin de source. Le sous-ensemble s'étend par COMMANDES_TEX, sans toucher l'analyseur.

// lettres en italique mathématique : a → U+1D44E, A → U+1D434 ; h n'a pas sa place dans le bloc (U+210E)
function lettreTex(c) {
  if (c === 'h') return 'ℎ';
  var o = c.charCodeAt(0);
  return String.fromCodePoint(o >= 97 ? 0x1D44E + o - 97 : 0x1D434 + o - 65);
}
// grec : minuscules en italique mathématique (U+1D6FC α … U+1D714 ω, puis variantes), majuscules droites
var GREC_MIN = ['alpha', 'beta', 'gamma', 'delta', 'varepsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'varsigma', 'sigma', 'tau', 'upsilon', 'varphi', 'chi', 'psi', 'omega'];
var GREC_VAR = { epsilon: 0x1D716, vartheta: 0x1D717, varkappa: 0x1D718, phi: 0x1D719, varrho: 0x1D71A, varpi: 0x1D71B };
var GREC_MAJ = { Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω' };
// opérateurs écrits autrement que tapés
var OP_TEX = { '-': '−', '*': '∗' };
// une commande reçoit l'analyseur et rend un élément MathML ; le ticket 04 y ajoute le reste du sous-ensemble
var COMMANDES_TEX = {
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
// caractères réservés précédés d'une barre oblique : le caractère lui-même
'{}%$#&_'.split('').forEach(function (c) { COMMANDES_TEX[c] = function () { return '<mo>' + esc(c) + '</mo>'; }; });

function analyseurTex(src) {
  var p = 0, a;
  function blancs() { while (p < src.length && /\s/.test(src[p])) p++; }
  // liste d'éléments jusqu'à la fermeture `fin` (consommée) ou la fin de la source (fermeture implicite)
  function liste(fin) {
    var out = [];
    for (;;) {
      blancs();
      if (p >= src.length) return out;
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
    if (/[a-zA-Z]/.test(c)) return '<mi>' + lettreTex(c) + '</mi>';
    if (/[0-9]/.test(c)) {
      var m = src.slice(p - 1).match(/^\d+(?:\.\d+)?/)[0];
      p += m.length - 1;
      return '<mn>' + m + '</mn>';
    }
    var cp = src.codePointAt(p - 1);
    if (cp > 0xFFFF) { c = String.fromCodePoint(cp); p++; }
    return '<mo>' + esc(OP_TEX[c] || c) + '</mo>';
  }
  function commande() {
    p++;
    var nom = /[a-zA-Z]/.test(src[p] || '') ? src.slice(p).match(/^[a-zA-Z]+/)[0] : (src[p] || '');
    p += nom.length;
    var f = Object.prototype.hasOwnProperty.call(COMMANDES_TEX, nom) && COMMANDES_TEX[nom];
    return f ? f(a) : '<mtext class="f-err">' + esc('\\' + nom) + '</mtext>';
  }
  // indices et exposants qui suivent une base, dans les deux ordres
  function scripts(base) {
    var sub = null, sup = null;
    for (;;) {
      var q = p; blancs();
      var c = src[p];
      if (c === '_' && sub == null) { p++; sub = argument(); }
      else if (c === '^' && sup == null) { p++; sup = argument(); }
      else { p = q; break; }
    }
    if (sub != null && sup != null) return '<msubsup>' + base + sub + sup + '</msubsup>';
    if (sub != null) return '<msub>' + base + sub + '</msub>';
    if (sup != null) return '<msup>' + base + sup + '</msup>';
    return base;
  }
  // argument d'une commande ou d'un indice : un groupe, une commande, ou un seul caractère (un seul chiffre)
  function argument() {
    blancs();
    if (p >= src.length || src[p] === '}') return '<mrow></mrow>';
    var c = src[p];
    if (c === '{' || c === '\\') return atome();
    if (/[0-9]/.test(c)) { p++; return '<mn>' + c + '</mn>'; }
    return atome();
  }
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
  a = { argument: argument, optionnel: optionnel, enfants: enfants, liste: liste, groupe: groupe };
  return a;
}
var texCache = new Map();
function texEnMathML(source, mode) {
  source = String(source == null ? '' : source);
  if (!source.trim()) return '';
  var cle = mode + '\n' + source;
  if (texCache.has(cle)) return texCache.get(cle);
  var corps = analyseurTex(source).liste(null).join('');
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
