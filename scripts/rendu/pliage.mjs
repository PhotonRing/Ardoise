// Règle de pliage commune (foldHidden) et pliage de la page exportée.
import { monter, test, egal, SECTIONS } from './commun.mjs';

// pliage : niveaux de foldLevel (étape et h2 = 1, h3 = 2, en-tête et pied = 0, autres = -1) ; r[i] = titre plié qui masque i, ou -1
const cache = (levels, plies) => JSON.parse(JSON.stringify(monter(SECTIONS).ctx.Reader.foldHidden(levels, levels.map((_, i) => plies.includes(i)))));

test('foldHidden : une étape ou un h2 plié masque jusqu\'au prochain titre de niveau 1 ou 0, h3 compris', () => {
  egal(cache([1, -1, 2, -1, 1, -1], [0]), [-1, 0, 0, 0, -1, -1], 'étape : jusqu\'à l\'étape suivante');
  egal(cache([1, -1, 0, -1], [0]), [-1, 0, -1, -1], 'h2 : jusqu\'au pied');
});

test('foldHidden : un h3 plié s\'arrête au h3 suivant ou à tout niveau inférieur', () => {
  egal(cache([2, -1, 2, -1], [0]), [-1, 0, -1, -1], 'h3 suivant');
  egal(cache([2, -1, 1, -1], [0]), [-1, 0, -1, -1], 'h2 ou étape');
  egal(cache([2, -1, 0, -1], [0]), [-1, 0, -1, -1], 'en-tête ou pied');
});

test('foldHidden : en-tête, pied et blocs ordinaires ne plient rien ; un titre sans contenu ne masque rien', () => {
  egal(cache([0, -1, -1, 0, -1], [0, 1, 3]), [-1, -1, -1, -1, -1]);
  egal(cache([1, 1, -1], [0]), [-1, -1, -1]);
});

test('foldHidden : plis imbriqués, le titre le plus extérieur masque tout ; déplié, le pli intérieur masque encore le sien', () => {
  egal(cache([1, -1, 2, -1, 2, -1, 1], [0, 2]), [-1, 0, 0, 0, 0, 0, -1], 'h2 et h3 pliés');
  egal(cache([1, -1, 2, -1, 2, -1, 1], [2]), [-1, -1, -1, 2, -1, -1, -1], 'h3 seul');
});

// page en lecture montée dans un DOM minimal (une ligne par bloc, sections d'étape), pour le pliage de la page exportée :
// chaque élément garde ses attributs ; etats() rend texte du bloc → 'plié' | 'masqué' | '' comme plis()
function domLecture(html) {
  const el = (tag, attrs, parent) => {
    const e = { tagName: tag.toUpperCase(), attrs, children: [], parentNode: parent, texte: '',
      getAttribute: (k) => (k in e.attrs ? e.attrs[k] : null), hasAttribute: (k) => k in e.attrs,
      setAttribute: (k, v) => { e.attrs[k] = String(v); }, removeAttribute: (k) => { delete e.attrs[k]; },
      classList: { contains: (c) => (e.attrs.class || '').split(' ').includes(c) },
      get nextElementSibling() { const s = e.parentNode.children; return s[s.indexOf(e) + 1] || null; },
      get previousElementSibling() { const s = e.parentNode.children; return s[s.indexOf(e) - 1] || null; },
      querySelector: (s) => (s === '[data-vfold]' && e.bouton) || null,
      closest: (s) => { for (let x = e; x; x = x.parentNode) if (correspond(x, s)) return x; return null; } };
    if (parent) parent.children.push(e);
    return e;
  };
  const correspond = (x, s) => (s[0] === '.' ? x.classList.contains(s.slice(1)) : s[0] === '[' ? x.hasAttribute(s.slice(1, -1)) : false);
  const attrsDe = (t) => Object.fromEntries([...t.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].slice(1).map((m) => [m[1], m[2] == null ? '' : m[2]]));
  const wrap = el('div', { class: 'wrap' }, null), blocs = [];
  let parent = wrap;
  for (const ligne of html.replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '').split('\n')) {
    if (ligne === '</section>') { parent = wrap; continue; }
    const t = ligne.match(/^<[^>]*>/)[0], e = el(t.match(/^<(\w+)/)[1], attrsDe(t), parent);
    if (e.tagName === 'SECTION') { parent = e; continue; }
    if (/data-vfold/.test(ligne)) e.bouton = { setAttribute() {} };
    e.texte = ligne.replace(/<[^>]*>/g, ''); blocs.push(e);
  }
  const etats = () => Object.fromEntries(blocs.map((e) => [e.texte, e.hasAttribute('data-folded') ? 'plié' : e.hasAttribute('data-fh') ? 'masqué' : '']));
  return { bloc: (texte) => blocs.find((e) => e.texte === texte), etats };
}
// sections imbriquées et étapes : h3 plié dans un h2, étape pliée qui contient un h3
const IMBRIQUES = {
  title: 'Doc',
  pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 's1', type: 'h2', html: 'Section' }, { id: 'x1', type: 'p', html: 'texte de section' },
    { id: 's2', type: 'h3', html: 'Sous-section', folded: true }, { id: 'x2', type: 'p', html: 'texte de sous-section' },
    { id: 's3', type: 'h2', html: 'Autre section' }, { id: 'x3', type: 'p', html: 'autre texte' },
    { id: 'e1', type: 'step', title: 'Étape un', folded: true }, { id: 's4', type: 'h3', html: 'Détail' }, { id: 'x4', type: 'p', html: 'texte d\'étape' },
    { id: 'e2', type: 'step', title: 'Étape deux' }, { id: 'x5', type: 'p', html: 'suite' },
  ] }],
};
function lecture(folds) {
  const { ctx, d } = monter(IMBRIQUES);
  ctx.window = { dispatchEvent() {} }; ctx.Event = function () {};
  const rendu = (f) => domLecture(ctx.renderPage(d, { page: 0, view: 'read', folds: f })).etats();
  return { ctx, rendu, page: domLecture(ctx.renderPage(d, { page: 0, view: 'read', folds })) };
}

test('pliage au clic de la page exportée : masque la même chose que le rendu de l\'éditeur pour les mêmes plis', () => {
  const { ctx, rendu, page } = lecture({});
  const etapeUn = Object.keys(page.etats()).find((t) => t.includes('Étape un'));
  ctx.Reader.foldToggle(page.bloc('Section'));
  egal(page.etats(), rendu({ s1: true }), 'h2 plié par-dessus un h3 plié');
  ctx.Reader.foldToggle(page.bloc('Section'));
  egal(page.etats(), rendu({}), 'h2 déplié : le h3 reste plié');
  ctx.Reader.foldToggle(page.bloc(etapeUn));
  egal(page.etats(), rendu({ e1: false }), 'étape dépliée');
  ctx.Reader.foldToggle(page.bloc('Détail'));
  egal(page.etats(), rendu({ e1: false, s4: true }), 'h3 plié dans une étape : jusqu\'à l\'étape suivante');
});

test('foldReveal : déplie tous les titres qui cachent le bloc visé, comme revealBlock dans l\'éditeur', () => {
  const { ctx, rendu, page } = lecture({ s1: true });
  ctx.Reader.foldReveal(page.bloc('texte de sous-section'));
  egal(page.etats(), rendu({ s1: false, s2: false }), 'h2 et h3 dépliés');
});
