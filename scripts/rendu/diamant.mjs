// Modèle diamant : losange à quatre sommets (rendu en édition, lecture, export), invites, tiret d'un sommet vide,
// et source « Modèles diamant » du bloc requête (cellules, pastilles de tous les champs, filtre « toutes », lien vers le bloc).
// Origine : spec groupe-office-diamant, user stories 73 à 83.
import { monter, test, egal, vrai, textes } from './commun.mjs';

const P = (t) => '<span class="pill">' + t + '</span>';
const DIA = (props, autres) => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [{ id: 'd1', type: 'diamond', ...props }].concat(autres || []) }] });
const rendu = (brut, view) => { const { ctx, d } = monter(brut); return ctx.renderPage(d, { page: 0, view }); };
const noms = (h) => textes(h, /<span class="dia-n">([\s\S]*?)<\/span>/g);

test('diamant : un bloc normalisé a ses cinq champs, vides par défaut', () => {
  const { d } = monter(DIA({ adversaire: 'APT28' }));
  const b = d.pages[0].blocks[0];
  egal([b.title, b.adversaire, b.capacite, b.infrastructure, b.victime], ['', 'APT28', '', '', '']);
});

test('diamant : quatre sommets nommés dans l\'ordre de la pile, en lecture, édition et export', () => {
  ['read', 'edit', 'export'].forEach((v) => {
    egal(noms(rendu(DIA({ adversaire: 'a' }), v)), ['Adversaire', 'Capacité', 'Infrastructure', 'Victime'], v);
  });
});

test('diamant : quatre côtés pleins et deux axes en pointillés', () => {
  const h = rendu(DIA({}), 'read');
  egal((h.match(/<line class="dia-cote"/g) || []).length, 4);
  egal((h.match(/<line class="dia-axe"/g) || []).length, 2);
});

test('diamant : en édition, chaque sommet est un champ enrichi qui invite au nom du sommet', () => {
  const h = rendu(DIA({ capacite: 'Mimikatz' }), 'edit');
  [['adversaire', 'Adversaire'], ['capacite', 'Capacité'], ['infrastructure', 'Infrastructure'], ['victime', 'Victime']].forEach(([k, n]) => {
    vrai(new RegExp('data-k="' + k + '" data-rich[^>]*data-ph="' + n + '"').test(h), 'champ ' + k);
  });
  vrai(/data-k="title"[^>]*data-ph="Titre \(facultatif\)"/.test(h), 'titre facultatif');
  vrai(h.includes('>Mimikatz</div>'), 'valeur du sommet');
  vrai(!h.includes('dia-vide'), 'pas de tiret en édition');
});

test('diamant : en lecture et à l\'export, un sommet vide montre un tiret discret ; un titre vide n\'est pas rendu', () => {
  ['read', 'export'].forEach((v) => {
    const h = rendu(DIA({ adversaire: 'APT28 ' + P('russie') }), v);
    egal((h.match(/<span class="dia-vide">—<\/span>/g) || []).length, 3, v);
    vrai(h.includes('APT28 ' + P('russie')), v + ' : sommet avec pastille');
    vrai(!h.includes('class="dia-t"'), v + ' : pas de titre vide');
  });
  vrai(rendu(DIA({ title: 'Campagne X' }), 'read').includes('Campagne X'), 'titre rempli');
});

test('diamant : en lecture, le bloc porte l\'ancre b-<id> que vise le lien d\'une requête', () => {
  vrai(/<div id="b-d1"[^>]* class="dia"/.test(rendu(DIA({}), 'read')), 'lecture');
  vrai(/<div id="b-d1"[^>]* class="dia"/.test(rendu(DIA({}), 'export')), 'export');
});

// requête : deux diamants, une fiche de faits à ignorer
const REQ = (q) => DIA({ title: 'Campagne ' + P('x'), adversaire: 'APT28 ' + P('russie'), capacite: 'Mimikatz', infrastructure: '1.2.3.4', victime: 'Mairie ' + P('public') }, [
  { id: 'd2', type: 'diamond', title: 'Campagne Y', adversaire: 'Lazarus', victime: 'Banque ' + P('public') },
  { id: 'f1', type: 'facts', items: [{ k: 'Adversaire', v: 'autre ' + P('russie'), alert: false }] },
  Object.assign({ id: 'q1', type: 'query', src: 'diamond', scope: 'doc' }, q),
]);
const req = (q, view) => { const { ctx, d } = monter(REQ(q)); return ctx.queryResult(d.pages[0].blocks[3], d, { page: 0, view: view || 'read' }); };
const lignes = (h) => [...h.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => textes(m[1], /<td>([\s\S]*?)<\/td>/g)).filter((l) => l.length);

test('requête « Modèles diamant » : un résultat par bloc, colonnes Titre, Adversaire, Capacité, Infrastructure, Victime', () => {
  const h = req({});
  egal(textes(h, /<th>([\s\S]*?)<\/th>/g), ['Titre', 'Adversaire', 'Capacité', 'Infrastructure', 'Victime', 'Source']);
  egal(lignes(h).map((l) => l.slice(0, 5)), [['Campagne x', 'APT28 russie', 'Mimikatz', '1.2.3.4', 'Mairie public'], ['Campagne Y', 'Lazarus', '', '', 'Banque public']]);
});

test('requête « Modèles diamant » : pastilles de tous les sommets et du titre, filtre « au moins une » et « toutes »', () => {
  egal(lignes(req({ tags: ['public'] })).length, 2, 'victime des deux');
  egal(lignes(req({ tags: ['x'] })).map((l) => l[0]), ['Campagne x'], 'titre');
  egal(lignes(req({ tags: ['russie', 'public'], match: 'all' })).map((l) => l[0]), ['Campagne x'], 'toutes : adversaire et victime du même bloc');
  egal(lignes(req({ tags: ['russie', 'x'], match: 'all' })).length, 1, 'toutes : titre et adversaire');
  egal(lignes(req({ tags: ['russie', 'public', 'absente'], match: 'all' })).length, 0, 'toutes : une absente');
});

test('requête « Modèles diamant » : lien vers le bloc, vues liste et nombre', () => {
  vrai(req({}).includes('href="#pg-p1/d1"'), 'lien vers le premier diamant');
  vrai(req({}).includes('href="#pg-p1/d2"'), 'lien vers le second');
  egal((req({ view: 'list' }).match(/<li>/g) || []).length, 2, 'liste');
  vrai(req({ view: 'count' }).includes('<b>2</b><span class="q-lab">modèles diamant</span>'), 'nombre');
});

test('requête « Modèles diamant » : proposée dans la fenêtre de la source et portée de section', () => {
  const { ctx, d } = monter(REQ({}));
  const h = ctx.renderPage(d, { page: 0, view: 'edit' }), q = d.pages[0].blocks.find((x) => x.type === 'query');
  vrai(h.includes('<small>Chercher</small> Modèles diamant'), 'puce de la source');
  vrai(/data-qset="src" data-v="diamond" aria-pressed="true"><span>Modèles diamant</.test(ctx.qFenetre(q, d, 0, 'src')), 'choix de la fenêtre');
  const brut = { title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 's1', type: 'h2', html: 'Un' }, { id: 'd1', type: 'diamond', title: 'Dans un' },
    { id: 's2', type: 'h2', html: 'Deux' }, { id: 'd2', type: 'diamond', title: 'Dans deux' },
    { id: 'q1', type: 'query', src: 'diamond', scope: 'sec:p1/s2' },
  ] }] };
  const m = monter(brut);
  egal(lignes(m.ctx.queryResult(m.d.pages[0].blocks[4], m.d, { page: 0, view: 'read' })).map((l) => l[0]), ['Dans deux']);
});

test('visite guidée : un modèle diamant titré, rendu avec ses quatre sommets', () => {
  const { ctx } = monter({ title: 'x', pages: [{ id: 'p', blocks: [] }] });
  const d = ctx.normalize(ctx.template('tour'));
  const b = d.pages[0].blocks.filter((x) => x.type === 'diamond');
  egal(b.length, 1, 'un diamant dans la première page');
  egal(b[0].title, 'Campagne X');
  egal(noms(ctx.renderPage(d, { page: 0, view: 'read' })), ['Adversaire', 'Capacité', 'Infrastructure', 'Victime']);
});
