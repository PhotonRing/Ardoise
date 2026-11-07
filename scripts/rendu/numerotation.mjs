// Numérotation des étapes (stepNums) dans la page, les sommaires et l'édition.
import { monter, test, egal, textes } from './commun.mjs';

// étapes : automatique, saisie, reprise après un numéro saisi, nonum (sans pastille, ne compte pas), saisie sans chiffre
const ETAPES = {
  title: 'Doc',
  pages: [{ id: 'p1', title: 'Étapes', blocks: [
    { id: 'm1', type: 'summary' },
    { id: 'e1', type: 'step', title: 'Un' },
    { id: 'e2', type: 'step', title: 'Deux' },
    { id: 'e3', type: 'step', title: 'Cinq', num: '5' },
    { id: 'e4', type: 'step', title: 'Six' },
    { id: 'e5', type: 'step', title: 'Sans numéro', nonum: true },
    { id: 'e6', type: 'step', title: 'Sept' },
    { id: 'e7', type: 'step', title: 'Annexe', num: '2b' },
    { id: 'e8', type: 'step', title: 'Trois' },
    { id: 'e9', type: 'step', title: 'Lettre', num: 'A' },
    { id: 'e10', type: 'step', title: 'Quatre' },
  ] }],
};
const NUMEROS = ['1', '2', '5', '6', '7', '2b', '3b', 'A', '4b'];
const tocN = (h) => textes(h, /<span class="toc-n">([\s\S]*?)<\/span>/g);

test('numérotation des étapes : la même dans la page, le bloc sommaire et le sommaire latéral', () => {
  const { ctx, d } = monter(ETAPES);
  const page = ctx.renderPage(d, { page: 0, view: 'read' });
  egal(textes(page, /<span class="num">([\s\S]*?)<\/span>/g), NUMEROS, 'pastilles de la page');
  egal(tocN(ctx.summaryList(d.pages[0].blocks[0], d, 0)), NUMEROS, 'bloc sommaire');
  egal(tocN(ctx.navHTML(d, { page: 0, view: 'read' })), NUMEROS, 'sommaire latéral');
});

test('numérotation en édition : la pastille vide montre le numéro calculé, la saisie reste telle quelle', () => {
  const { ctx, d } = monter(ETAPES);
  const h = ctx.renderPage(d, { page: 0, view: 'edit' });
  egal([...h.matchAll(/<span class="num fld"[^>]*data-ph="([^"]*)">([^<]*)<\/span>/g)].map((m) => m[1] + '|' + m[2]),
    ['1|', '2|', '5|5', '6|', '7|', '2b|2b', '3b|', 'A|A', '4b|']);
});

test('stepNums : numéro affiché de chaque étape d\'une page, étapes nonum exclues', () => {
  const { ctx, d } = monter(ETAPES);
  egal(JSON.parse(JSON.stringify(ctx.stepNums(d.pages[0].blocks))),
    { e1: '1', e2: '2', e3: '5', e4: '6', e6: '7', e7: '2b', e8: '3b', e9: 'A', e10: '4b' });
});

// numéro saisi à plusieurs niveaux : l'étape automatique suivante le recopie en augmentant son dernier nombre
const suite = (num) => {
  const blocks = [{ id: 's', type: 'step', num }, { id: 'u', type: 'step' }, { id: 'v', type: 'step' }];
  const { ctx, d } = monter({ title: 'Doc', pages: [{ id: 'p1', blocks }] }), r = ctx.stepNums(d.pages[0].blocks);
  return [r.u, r.v];
};
test('stepNums : la suite d\'un numéro saisi garde sa forme et augmente son dernier nombre', () => {
  egal(suite('5. 2'), ['5. 3', '5. 4'], '« 5. 2 »');
  egal(suite('5.2.'), ['5.3.', '5.4.'], '« 5.2. »');
  egal(suite('5'), ['6', '7'], '« 5 »');
  egal(suite('5.'), ['6.', '7.'], '« 5. »');
  egal(suite('Étape 4'), ['Étape 5', 'Étape 6'], '« Étape 4 »');
  egal(suite('1.9'), ['1.10', '1.11'], 'retenue');
});
