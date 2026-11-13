// Visite guidée (modèle « tour » de 04-modeles.js) : elle passe la normalisation sans rien perdre, montre chaque type
// du menu d'insertion, et ses exemples récents (dépendances et colonne réduite du kanban) se rendent.
// Origine : spec groupe-office-diamant, ticket 06 (user stories 34 et 85).
import { contexte, test, egal, vrai } from './commun.mjs';

const visite = () => { const ctx = contexte(); return { ctx, brut: JSON.parse(JSON.stringify(ctx.template('tour'))) }; };
// blocs d'une liste, enfants des groupes compris
const tous = (blocs) => blocs.flatMap((b) => [b].concat(b.type === 'group' ? tous(b.blocks || []) : []));
// chaque champ écrit dans le modèle se retrouve tel quel après normalisation
const garde = (ecrit, normal, ou) => {
  if (ecrit && typeof ecrit === 'object') {
    vrai(normal && typeof normal === 'object', ou + ' : objet perdu');
    if (Array.isArray(ecrit)) egal(normal.length, ecrit.length, ou + ' : longueur');
    Object.keys(ecrit).forEach((k) => garde(ecrit[k], normal[k], ou + '.' + k));
  } else egal(normal, ecrit, ou);
};

test('visite guidée : écrite au format courant, elle passe la normalisation sans perte', () => {
  const { ctx, brut } = visite();
  egal(brut.v, ctx.VERSION, 'TEMPLATES_V suit le format');
  const d = ctx.normalize(JSON.parse(JSON.stringify(brut)));
  egal(d.pages.length, brut.pages.length, 'pages');
  brut.pages.forEach((pg, i) => garde(pg.blocks, d.pages[i].blocks, 'page ' + pg.id));
});

test('visite guidée : au moins un bloc de chaque type du menu d\'insertion', () => {
  const { ctx, brut } = visite();
  const vus = new Set(brut.pages.flatMap((pg) => tous(pg.blocks)).map((b) => b.type));
  egal(ctx.ORDER.filter((t) => !vus.has(t)), [], 'types absents');
});

test('visite guidée : le kanban montre une dépendance et une colonne réduite', () => {
  const { ctx, brut } = visite();
  const d = ctx.normalize(brut);
  const i = d.pages.findIndex((pg) => pg.blocks.some((b) => b.type === 'kanban'));
  const h = ctx.renderPage(d, { page: i, view: 'read' });
  vrai(/Attend : /.test(h) && /Bloque : /.test(h), 'Attend et Bloque affichés');
  vrai(/data-red/.test(h), 'une colonne réduite');
});
