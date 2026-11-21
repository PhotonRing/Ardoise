// Formules (spec formules, ticket 01) : moteur LaTeX → MathML (05-formules.js, module pur) et passage des formules dans la
// chaîne du rendu (page en édition et en lecture, requêtes). Le MathML attendu est écrit à la main, d'après MathML Core.
import { contexte, monter, test, egal, vrai } from './commun.mjs';

const ctx = contexte();
const tex = (s, mode) => ctx.texEnMathML(s, mode || 'ligne');
// corps de la formule : le contenu de <semantics> sans l'annotation, et sans le <mrow> qui l'enveloppe
const corps = (s, mode) => {
  const m = tex(s, mode).match(/^<math[^>]*><semantics><mrow>([\s\S]*)<\/mrow><annotation encoding="application\/x-tex">[\s\S]*<\/annotation><\/semantics><\/math>$/);
  if (!m) throw new Error('structure inattendue : ' + tex(s, mode));
  return m[1];
};
const x = '<mi>𝑥</mi>', y = '<mi>𝑦</mi>', n = '<mi>𝑛</mi>', k = '<mi>𝑘</mi>';
const mn = (c) => '<mn>' + c + '</mn>';

test('formules : enveloppe <math>, annotation de la source, display="block" pour un bloc', () => {
  egal(tex('x'), '<math><semantics><mrow>' + x + '</mrow><annotation encoding="application/x-tex">x</annotation></semantics></math>');
  egal(tex('x', 'bloc'), '<math display="block"><semantics><mrow>' + x + '</mrow><annotation encoding="application/x-tex">x</annotation></semantics></math>');
  vrai(tex('a<b & c').includes('<annotation encoding="application/x-tex">a&lt;b &amp; c</annotation>'), 'source échappée dans l\'annotation');
});

test('formules : source vide ou de blancs → chaîne vide', () => {
  egal(tex(''), '');
  egal(tex('   '), '');
  egal(tex(null), '');
});

test('formules : lettres en italique mathématique Unicode, chiffres groupés, opérateurs', () => {
  egal(corps('ab'), '<mi>𝑎</mi><mi>𝑏</mi>');
  egal(corps('h'), '<mi>ℎ</mi>', 'h : U+210E');
  egal(corps('AZ'), '<mi>𝐴</mi><mi>𝑍</mi>');
  egal(corps('12.5+3'), mn('12.5') + '<mo>+</mo>' + mn('3'));
  egal(corps('a-b'), '<mi>𝑎</mi><mo>−</mo><mi>𝑏</mi>', 'moins : U+2212');
  egal(corps('x < y'), x + '<mo>&lt;</mo>' + y, 'blancs ignorés, < échappé');
  egal(corps('f(x)=1'), '<mi>𝑓</mi><mo stretchy="false">(</mo>' + x + '<mo stretchy="false">)</mo><mo>=</mo>' + mn('1'), 'parenthèse tapée : non étirée, comme en LaTeX');
  egal(corps('[a]|b|\\{\\}'), '<mo stretchy="false">[</mo><mi>𝑎</mi><mo stretchy="false">]</mo><mo stretchy="false" lspace="0" rspace="0">|</mo><mi>𝑏</mi><mo stretchy="false" lspace="0" rspace="0">|</mo><mo stretchy="false">{</mo><mo stretchy="false">}</mo>');
});

test('formules : indices et exposants, seuls, ensemble, avec ou sans accolades', () => {
  egal(corps('x^2'), '<msup>' + x + mn('2') + '</msup>');
  egal(corps('x_1'), '<msub>' + x + mn('1') + '</msub>');
  egal(corps('x_1^2'), '<msubsup>' + x + mn('1') + mn('2') + '</msubsup>');
  egal(corps('x^2_1'), '<msubsup>' + x + mn('1') + mn('2') + '</msubsup>', 'ordre inverse');
  egal(corps('x^{n+1}'), '<msup>' + x + '<mrow>' + n + '<mo>+</mo>' + mn('1') + '</mrow></msup>');
  egal(corps('x^23'), '<msup>' + x + mn('2') + '</msup>' + mn('3'), 'sans accolades : un seul caractère');
  egal(corps('x_{i}'), '<msub>' + x + '<mi>𝑖</mi></msub>', 'groupe d\'un élément : sans mrow');
  egal(corps('e^{\\alpha}'), '<msup><mi>𝑒</mi><mi>𝛼</mi></msup>');
});

test('formules : fractions et coefficient binomial', () => {
  egal(corps('\\frac{1}{n}'), '<mfrac>' + mn('1') + n + '</mfrac>');
  egal(corps('\\frac12'), '<mfrac>' + mn('1') + mn('2') + '</mfrac>', 'arguments sans accolades');
  egal(corps('\\dfrac{a}{b}'), '<mstyle displaystyle="true" scriptlevel="0"><mfrac><mi>𝑎</mi><mi>𝑏</mi></mfrac></mstyle>');
  egal(corps('\\tfrac{a}{b}'), '<mstyle displaystyle="false"><mfrac><mi>𝑎</mi><mi>𝑏</mi></mfrac></mstyle>');
  egal(corps('\\binom{n}{k}'), '<mrow><mo>(</mo><mfrac linethickness="0">' + n + k + '</mfrac><mo>)</mo></mrow>');
});

test('formules : racines carrée et n-ième', () => {
  egal(corps('\\sqrt{2}'), '<msqrt>' + mn('2') + '</msqrt>');
  egal(corps('\\sqrt{x+1}'), '<msqrt>' + x + '<mo>+</mo>' + mn('1') + '</msqrt>');
  egal(corps('\\sqrt[3]{x}'), '<mroot>' + x + mn('3') + '</mroot>');
  egal(corps('\\sqrt[n]{x^2}'), '<mroot><msup>' + x + mn('2') + '</msup>' + n + '</mroot>');
});

test('formules : lettres grecques, minuscules en italique, majuscules droites', () => {
  egal(corps('\\alpha\\beta\\pi\\omega'), '<mi>𝛼</mi><mi>𝛽</mi><mi>𝜋</mi><mi>𝜔</mi>');
  egal(corps('\\varepsilon\\epsilon\\phi\\varphi'), '<mi>𝜀</mi><mi>𝜖</mi><mi>𝜙</mi><mi>𝜑</mi>');
  egal(corps('\\Gamma\\Omega'), '<mi mathvariant="normal">Γ</mi><mi mathvariant="normal">Ω</mi>');
});

test('formules : commande inconnue en rouge, le reste est rendu', () => {
  egal(corps('a+\\cancel{b}'), '<mi>𝑎</mi><mo>+</mo><mtext class="f-err">\\cancel</mtext><mi>𝑏</mi>');
  egal(corps('\\newcommand x'), '<mtext class="f-err">\\newcommand</mtext>' + x);
});

test('formules : accolade non fermée fermée en fin de source, accolade en trop ignorée', () => {
  egal(corps('\\frac{1}{x+1'), '<mfrac>' + mn('1') + '<mrow>' + x + '<mo>+</mo>' + mn('1') + '</mrow></mfrac>');
  egal(corps('x^{2'), '<msup>' + x + mn('2') + '</msup>');
  egal(corps('x}+1'), x + '<mo>+</mo>' + mn('1'));
  egal(corps('\\sqrt'), '<msqrt><mrow></mrow></msqrt>', 'argument absent');
});

// rendu d'une page : la forme stockée <span class="formule">source</span> devient l'élément rendu
const F = (s) => '<span class="formule">' + s + '</span>';
const DOC = { title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 't', type: 'texte', lignes: [{ html: 'Aire ' + F('\\pi r^2') + ' fin' }] },
  { id: 'f', type: 'facts', items: [{ k: 'Énergie', v: F('E=mc^2') }] },
  { id: 'q', type: 'query', src: 'facts', scope: 'doc' },
] }] };

test('rendu : une formule s\'affiche en MathML en lecture, non éditable en édition', () => {
  const { ctx: c, d } = monter(DOC);
  const lecture = c.renderPage(d, { page: 0, view: 'read' }), edition = c.renderPage(d, { page: 0, view: 'edit' });
  vrai(lecture.includes('Aire <span class="formule"><math><semantics><mrow><mi>𝜋</mi>'), 'lecture : ' + lecture);
  vrai(!lecture.includes('contenteditable="false"'), 'lecture : pas de contenteditable');
  vrai(edition.includes('Aire <span class="formule" contenteditable="false"><math>'), 'édition : élément non éditable');
  vrai(!/<span class="formule">[^<]/.test(lecture + edition), 'aucune source laissée en texte');
});

test('rendu : une case citée par une requête montre sa formule', () => {
  const { ctx: c, d } = monter(DOC);
  const page = c.renderPage(d, { page: 0, view: 'read' });
  const res = page.slice(page.indexOf('q-res'));
  vrai(res.includes('<annotation encoding="application/x-tex">E=mc^2</annotation>'), 'résultat de requête : ' + res);
});

test('rendu : rendreFormules ne retouche pas une formule déjà rendue', () => {
  const une = ctx.rendreFormules(F('x'), true);
  egal(ctx.rendreFormules(une, true), une);
  egal(ctx.rendreFormules('a &lt;span class="formule"&gt;x&lt;/span&gt;', false), 'a &lt;span class="formule"&gt;x&lt;/span&gt;', 'texte échappé intact');
  vrai(ctx.rendreFormules(F('a &amp;lt; b'), false).includes('<annotation encoding="application/x-tex">a &amp;lt; b</annotation>'), 'entités décodées puis réécrites');
});

// Saisie `$…$` (ticket 02) : règle des dollars de Pandoc, appliquée au texte qui précède le curseur
test('saisie : le `$` qui ferme `$x^2$` rend la source et la place du `$` ouvrant', () => {
  egal(JSON.stringify(ctx.dollarsFermes('Aire $x^2$', '')), JSON.stringify({ debut: 5, source: 'x^2' }));
  egal(JSON.stringify(ctx.dollarsFermes('$a + b$', ' fin')), JSON.stringify({ debut: 0, source: 'a + b' }));
  egal(JSON.stringify(ctx.dollarsFermes('un $a$ puis $b$', '')), JSON.stringify({ debut: 12, source: 'b' }), 'le dernier couple');
});
test('saisie : prix, espaces aux bords, chiffre après, source vide : pas de formule', () => {
  egal(ctx.dollarsFermes('5 $ et 10 $', ''), null, 'prix');
  egal(ctx.dollarsFermes('5$ et 10$', ''), null, 'prix collés');
  egal(ctx.dollarsFermes('$ x$', ''), null, 'espace après l\'ouvrant');
  egal(ctx.dollarsFermes('$x $', ''), null, 'espace avant le fermant');
  egal(ctx.dollarsFermes('$x$', '1'), null, 'chiffre après le fermant');
  egal(ctx.dollarsFermes('$$', ''), null, 'source vide');
  egal(ctx.dollarsFermes('$x', ''), null, 'pas de fermant');
});
test('texte brut : une formule, stockée ou rendue, s\'écrit `$source$`', () => {
  egal(ctx.formulesEnTexte('a ' + ctx.formuleHTML('x^2', true) + ' b'), 'a $x^2$ b');
  egal(ctx.formulesEnTexte('a <span class="formule">x &lt; y</span>'), 'a $x &lt; y$');
  egal(ctx.formulesEnTexte(ctx.rendreFormules('<b><span class="formule">\\frac{1}{2}</span></b>', false)), '<b>$\\frac{1}{2}$</b>');
});

// ---------- ticket 04 : sous-ensemble complet ----------
const somme = '<mo>∑</mo>', kEg1 = '<mrow>' + k + '<mo>=</mo>' + mn('1') + '</mrow>';

test('formules : \\sum, \\prod, \\lim : bornes dessous et dessus en bloc, à côté en ligne', () => {
  egal(corps('\\sum_{k=1}^n', 'bloc'), '<munderover>' + somme + kEg1 + n + '</munderover>');
  egal(corps('\\sum_{k=1}^n'), '<msubsup>' + somme + kEg1 + n + '</msubsup>');
  egal(corps('\\prod_k', 'bloc'), '<munder><mo>∏</mo>' + k + '</munder>');
  egal(corps('\\prod^k', 'bloc'), '<mover><mo>∏</mo>' + k + '</mover>');
  egal(corps('\\prod_k'), '<msub><mo>∏</mo>' + k + '</msub>');
  egal(corps('\\lim_{x\\to 0} f', 'bloc'), '<munder><mi>lim</mi><mrow>' + x + '<mo>→</mo>' + mn('0') + '</mrow></munder><mi>𝑓</mi>');
  egal(corps('\\sum', 'bloc'), somme, 'sans bornes');
});

test('formules : \\int garde ses bornes à côté, même dans un bloc', () => {
  egal(corps('\\int_0^1 x', 'bloc'), '<msubsup><mo>∫</mo>' + mn('0') + mn('1') + '</msubsup>' + x);
  egal(corps('\\int_0^\\infty', 'ligne'), '<msubsup><mo>∫</mo>' + mn('0') + '<mi>∞</mi></msubsup>');
  egal(corps('\\frac\\sum x y_1', 'bloc'), '<mfrac>' + somme + x + '</mfrac><msub>' + y + mn('1') + '</msub>', 'opérateur en argument : bornes non reportées');
});

test('formules : fonctions usuelles en romain, suivies de l\'application de fonction', () => {
  egal(corps('\\sin x'), '<mi>sin</mi><mo>&#x2061;</mo>' + x);
  egal(corps('\\log_2 n'), '<msub><mi>log</mi>' + mn('2') + '</msub><mo>&#x2061;</mo>' + n);
  for (const f of ['cos', 'tan', 'ln', 'exp', 'max', 'min', 'arctan', 'det']) egal(corps('\\' + f), '<mi>' + f + '</mi><mo>&#x2061;</mo>', f);
});

test('formules : relations, flèches et symboles courants', () => {
  egal(corps('a\\leq b\\neq c\\approx d'), '<mi>𝑎</mi><mo>≤</mo><mi>𝑏</mi><mo>≠</mo><mi>𝑐</mi><mo>≈</mo><mi>𝑑</mi>');
  egal(corps('\\in\\subset\\to\\Rightarrow\\iff'), '<mo>∈</mo><mo>⊂</mo><mo>→</mo><mo>⇒</mo><mo>⟺</mo>');
  egal(corps('\\geq\\notin\\subseteq\\leftarrow\\Leftrightarrow\\mapsto'), '<mo>≥</mo><mo>∉</mo><mo>⊆</mo><mo>←</mo><mo>⇔</mo><mo>↦</mo>');
  egal(corps('\\times\\cdot\\pm\\cdots'), '<mo>×</mo><mo>⋅</mo><mo>±</mo><mo>⋯</mo>');
  egal(corps('\\partial\\nabla\\emptyset'), '<mi>∂</mi><mi>∇</mi><mi>∅</mi>');
  egal(corps('x\\rightarrow y'), x + '<mo>→</mo>' + y);
});

test('formules : accents', () => {
  const acc = (c) => '<mover accent="true">' + x + '<mo stretchy="false">' + c + '</mo></mover>';
  egal(corps('\\hat x'), acc('ˆ'));
  egal(corps('\\vec{x}'), acc('→'));
  egal(corps('\\bar x'), acc('¯'));
  egal(corps('\\tilde x'), acc('˜'));
  egal(corps('\\dot x'), acc('˙'));
  egal(corps('\\overline{x+y}'), '<mover accent="true"><mrow>' + x + '<mo>+</mo>' + y + '</mrow><mo stretchy="true">―</mo></mover>');
  egal(corps('\\underline{x}'), '<munder accentunder="true">' + x + '<mo stretchy="true">―</mo></munder>');
  egal(corps('\\vec{v}^2'), '<msup><mover accent="true"><mi>𝑣</mi><mo stretchy="false">→</mo></mover>' + mn('2') + '</msup>');
});

test('formules : \\text en mtext, blancs des bords gardés en espaces insécables', () => {
  egal(corps('x \\text{si } x>0'), x + '<mtext>si </mtext>' + x + '<mo>&gt;</mo>' + mn('0'));
  egal(corps('\\text{a {b} <c>}'), '<mtext>a {b} &lt;c&gt;</mtext>', 'accolades imbriquées, échappement');
  egal(corps('\\text{non fermé'), '<mtext>non fermé</mtext>');
});

test('formules : ensembles, cursive et gras en caractères Unicode', () => {
  egal(corps('\\mathbb{R}'), '<mi>ℝ</mi>');
  egal(corps('\\mathcal{F}'), '<mi>ℱ</mi>');
  egal(corps('\\mathbf{v}'), '<mi>𝐯</mi>');
  egal(corps('\\mathbb{NZQCA}'), '<mrow><mi>ℕ</mi><mi>ℤ</mi><mi>ℚ</mi><mi>ℂ</mi><mi>𝔸</mi></mrow>');
  egal(corps('\\mathcal{AB}'), '<mrow><mi>𝒜</mi><mi>ℬ</mi></mrow>');
  egal(corps('\\mathbf{M}x'), '<mi>𝐌</mi>' + x, 'la variante ne déborde pas');
  egal(corps('\\mathbf{x}_1'), '<msub><mi>𝐱</mi>' + mn('1') + '</msub>');
  egal(corps('\\mathbb 1'), '<mn>𝟙</mn>');
});

test('formules : espaces', () => {
  const sp = (w) => '<mspace width="' + w + '"></mspace>';
  egal(corps('a\\,b'), '<mi>𝑎</mi>' + sp('0.1667em') + '<mi>𝑏</mi>');
  egal(corps('\\;\\quad\\qquad\\!'), sp('0.2778em') + sp('1em') + sp('2em') + sp('-0.1667em'));
  egal(corps('a\\ b'), '<mi>𝑎</mi>' + sp('0.25em') + '<mi>𝑏</mi>', 'barre oblique et espace');
});

const fe = (c) => '<mo fence="true" stretchy="true">' + c + '</mo>';
const a1 = '<mi>𝑎</mi>', b1 = '<mi>𝑏</mi>', c1 = '<mi>𝑐</mi>', d1 = '<mi>𝑑</mi>';
const tr = (...cs) => '<mtr>' + cs.map((c) => '<mtd>' + c + '</mtd>').join('') + '</mtr>';
// balises ouvrantes et fermantes équilibrées dans le corps
const equilibre = (h) => { const pile = []; for (const [, f, t] of h.matchAll(/<(\/?)([a-z]+)[^>]*>/g)) { if (!f) pile.push(t); else if (pile.pop() !== t) return false; } return !pile.length; };

test('formules : délimiteurs adaptables \\left … \\right', () => {
  egal(corps('\\left( \\frac{a}{b} \\right)'), '<mrow>' + fe('(') + '<mfrac>' + a1 + b1 + '</mfrac>' + fe(')') + '</mrow>');
  egal(corps('\\left. x \\right|_0'), '<msub><mrow>' + x + fe('|') + '</mrow>' + mn('0') + '</msub>', '\\left. : aucun délimiteur');
  egal(corps('\\left\\{ x \\right\\rangle'), '<mrow>' + fe('{') + x + fe('⟩') + '</mrow>');
  egal(corps('\\left[ \\left( x \\right) \\right]'), '<mrow>' + fe('[') + '<mrow>' + fe('(') + x + fe(')') + '</mrow>' + fe(']') + '</mrow>', 'imbriqués');
  egal(corps('\\left( x\\rightarrow y'), '<mrow>' + fe('(') + x + '<mo>→</mo>' + y + '</mrow>', 'sans \\right, \\rightarrow n\'est pas \\right');
  egal(corps('x \\right) y'), x + '<mo stretchy="false">)</mo>' + y, '\\right orphelin');
});

test('formules : matrices', () => {
  egal(corps('\\begin{matrix} a & b \\\\ c & d \\end{matrix}'), '<mtable>' + tr(a1, b1) + tr(c1, d1) + '</mtable>');
  egal(corps('\\begin{pmatrix} a & b \\\\ c & d \\\\ \\end{pmatrix}'), '<mrow>' + fe('(') + '<mtable>' + tr(a1, b1) + tr(c1, d1) + '</mtable>' + fe(')') + '</mrow>', 'dernière ligne vide retirée');
  egal(corps('\\begin{bmatrix} 1 & x+1 \\\\ & 0 \\end{bmatrix}'), '<mrow>' + fe('[') + '<mtable>' + tr(mn('1'), x + '<mo>+</mo>' + mn('1')) + tr('', mn('0')) + '</mtable>' + fe(']') + '</mrow>', 'cellule vide, plusieurs éléments');
});

test('formules : cas et égalités alignées', () => {
  egal(corps('f(x)=\\begin{cases} 1 & \\text{si } x>0 \\\\ 0 & \\text{sinon} \\end{cases}').replace(/^.*?<mo>=<\/mo>/, ''),
    '<mrow>' + fe('{') + '<mtable class="f-cases" columnalign="left left">' + tr(mn('1'), '<mtext>si\u00a0</mtext>' + x + '<mo>&gt;</mo>' + mn('0')) + tr(mn('0'), '<mtext>sinon</mtext>') + '</mtable></mrow>');
  egal(corps('\\begin{aligned} a &= b \\\\ &= c \\end{aligned}', 'bloc'),
    '<mtable class="f-aligned" displaystyle="true" columnalign="right left">' + tr(a1, '<mo>=</mo>' + b1) + tr('', '<mo>=</mo>' + c1) + '</mtable>');
});

test('formules : \\\\ hors environnement : lignes au premier niveau, ignoré dans un groupe', () => {
  egal(corps('a \\\\ b', 'bloc'), '<mtable>' + tr(a1) + tr(b1) + '</mtable>');
  egal(corps('{a \\\\ b}'), '<mrow>' + a1 + b1 + '</mrow>');
  egal(corps('a \\\\[2pt] b \\\\'), '<mtable>' + tr(a1) + tr(b1) + '</mtable>', 'argument d\'espacement absorbé, dernière ligne vide retirée');
});

test('formules : environnement mal fermé ou inconnu, \\left sans \\right : sans exception, le reste rendu', () => {
  egal(corps('\\begin{pmatrix} 1 & 2'), '<mrow>' + fe('(') + '<mtable>' + tr(mn('1'), mn('2')) + '</mtable>' + fe(')') + '</mrow>', 'non fermé');
  egal(corps('\\begin{cases} a \\end{matrix} + b'), '<mrow>' + fe('{') + '<mtable class="f-cases" columnalign="left left">' + tr(a1) + '</mtable></mrow><mo>+</mo>' + b1, 'fermé sous un autre nom');
  egal(corps('\\begin{foo} a \\end{foo}'), '<mtext class="f-err">\\begin{foo}</mtext>' + a1 + '<mtext class="f-err">\\end{foo}</mtext>');
  for (const s of ['\\begin{matrix', '\\begin{aligned} a &', '\\left( \\begin{bmatrix} a', '\\left', '\\left\\', '\\text', '\\begin', '\\end', '\\\\', '\\left( a \\\\ b \\right)', '\\begin{matrix} \\left( a & b \\end{matrix}'])
    vrai(equilibre(tex(s, 'bloc')), s + ' : ' + tex(s, 'bloc'));
});

test('formules : commandes hors sous-ensemble en rouge, le reste rendu', () => {
  egal(corps('\\ce{H2O} + x'), '<mtext class="f-err">\\ce</mtext><mrow><mi>𝐻</mi>' + mn('2') + '<mi>𝑂</mi></mrow><mo>+</mo>' + x);
});
