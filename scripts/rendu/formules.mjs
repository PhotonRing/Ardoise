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
  egal(corps('f(x)=1'), '<mi>𝑓</mi><mo>(</mo>' + x + '<mo>)</mo><mo>=</mo>' + mn('1'));
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
