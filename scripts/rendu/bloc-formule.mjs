// Bloc formule (spec formules, ticket 05, stories 20 à 24) : en édition, le champ de la source au-dessus de l'aperçu, ou
// une invite si la source est vide ; en lecture et dans la page exportée, la formule seule, et rien pour un bloc vide.
import { contexte, monter, test, egal, vrai } from './commun.mjs';

const SOURCE = 'x^2\n< \\frac{1}{2}';
const DOC = { title: 'Bloc formule', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'f', type: 'formule', tex: SOURCE },
  { id: 'v', type: 'formule', tex: '' },
  { id: 't', type: 'texte', lignes: [{ html: 'après' }] },
] }] };
// rendu d'un bloc dans la page : de son enveloppe d'édition (ou de son data-bid en lecture) au bloc suivant
const bloc = (page, id) => { const m = page.match(new RegExp('data-(?:id|bid)="' + id + '"[\\s\\S]*?(?=data-(?:id|bid)="(?!' + id + ')|$)')); return m ? m[0] : ''; };

test('bloc formule : type « Formule », source vide à la création, juste après le bloc de code dans le menu', () => {
  const ctx = contexte();
  egal(ctx.T.formule.label, 'Formule');
  egal(JSON.parse(JSON.stringify(ctx.T.formule.make())), { tex: '' });
  egal(ctx.ORDER[ctx.ORDER.indexOf('code') + 1], 'formule');
});

test('bloc formule : en édition, le champ garde la source sur plusieurs lignes, l\'aperçu est la formule en bloc', () => {
  const { ctx, d } = monter(DOC);
  const h = bloc(ctx.renderPage(d, { page: 0, view: 'edit' }), 'f');
  vrai(h.includes('<textarea class="formule-ta" data-b="f" data-k="tex"'), 'champ de la source : ' + h);
  vrai(h.includes('>x^2\n&lt; \\frac{1}{2}</textarea>'), 'source échappée, saut de ligne gardé : ' + h);
  const ta = h.indexOf('<textarea'), ap = h.indexOf('class="formule-apercu"');
  vrai(ta >= 0 && ap > ta, 'champ au-dessus de l\'aperçu');
  vrai(/class="formule-apercu"><math display="block">[\s\S]*<mfrac>/.test(h), 'aperçu en MathML de bloc : ' + h);
  vrai(!h.includes('formule-invite'), 'pas d\'invite pour une source écrite');
});

test('bloc formule : vide en édition, une invite et pas de formule', () => {
  const { ctx, d } = monter(DOC);
  const h = bloc(ctx.renderPage(d, { page: 0, view: 'edit' }), 'v');
  vrai(h.includes('<textarea class="formule-ta" data-b="v" data-k="tex"'), 'champ présent : ' + h);
  vrai(/class="formule-apercu"><span class="formule-invite">Tapez une formule LaTeX/.test(h), 'invite : ' + h);
  vrai(!h.includes('<math'), 'pas de formule');
});

test('bloc formule : en lecture et à l\'export, la formule seule, et rien pour un bloc vide', () => {
  const { ctx, d } = monter(DOC);
  for (const view of ['read', 'export']) {
    const page = ctx.renderPage(d, { page: 0, view });
    vrai(!page.includes('<textarea'), view + ' : pas de champ');
    egal((page.match(/class="formule-bloc"/g) || []).length, 1, view + ' : un seul bloc formule affiché');
    vrai(/<div [^>]*class="formule-bloc"[^>]*><math display="block"><semantics>[\s\S]*<annotation encoding="application\/x-tex">x\^2\n&lt; \\frac\{1\}\{2\}<\/annotation>/.test(page), view + ' : formule et source : ' + page);
    vrai(!page.includes('formule-invite'), view + ' : pas d\'invite');
  }
});
