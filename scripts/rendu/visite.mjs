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

// Origine : spec requetes-avancees, ticket 06 (user story 60) : la page « Suivi de projet » montre les requêtes avancées
test('visite guidée : choix des colonnes, cartes bloquées, vue regroupée et carte de chaleur sur la page de suivi', () => {
  const { ctx, brut } = visite();
  const d = ctx.normalize(brut);
  const i = d.pages.findIndex((pg) => pg.id === 'suivi'), qs = d.pages[i].blocks.filter((b) => b.type === 'query');
  const res = (b) => ctx.queryResult(b, d, { page: i, view: 'read' });
  const sauf = qs.find((b) => b.colonnes && b.colonnes.mode === 'sauf');
  vrai(sauf, 'une requête « Toutes sauf… »');
  const hs = res(sauf);
  vrai(!/>Priorité</.test(hs) && !/>Attend</.test(hs) && />Échéance/.test(hs), 'Priorité et Attend masquées, Échéance gardée');
  const bloq = qs.find((b) => b.src === 'kanban' && (b.filtres || []).find((f) => f.prop === 'bloquees'));
  vrai(bloq, 'une requête kanban « Bloquées »');
  const hb = res(bloq);
  vrai(/Migrer la base/.test(hb) && !/Rédiger le guide/.test(hb), 'seule la carte bloquée');
  vrai(/Attend/.test(hb) && /Tests de charge/.test(hb), 'colonne Attend affichée');
  const reg = qs.find((b) => b.view === 'regroupee' && b.src === 'table');
  vrai(reg && ctx.qRegReglage(reg, ctx.queryRecords(reg, d, i)).x === reg.regX, 'vue regroupée sur sa colonne');
  vrai(/q-reg/.test(res(reg)) && /Messagerie/.test(res(reg)), 'vue regroupée rendue');
  const ch = qs.find((b) => b.view === 'chaleur' && b.src === 'table');
  const rc = ch && ctx.qChReglage(ch, ctx.queryRecords(ch, d, i));
  vrai(rc && rc.x === ch.chX && rc.y === ch.chY && rc.n === ch.chN, 'carte de chaleur sur ses colonnes');
  vrai(/q-ch/.test(res(ch)), 'carte de chaleur rendue');
});

// Origine : spec filtres-logiques, ticket 05 (user story 46) : la visite montre un filtre à plusieurs valeurs, un « sauf »,
// un filtre « Valeur d'une colonne » et une carte de nombre avec sa ligne de puces
test('visite guidée : filtres à plusieurs valeurs, « sauf », « Valeur d\'une colonne » et carte de nombre à puces', () => {
  const { ctx, brut } = visite();
  const d = ctx.normalize(brut);
  const i = d.pages.findIndex((pg) => pg.id === 'suivi'), qs = d.pages[i].blocks.filter((b) => b.type === 'query');
  const nb = qs.find((b) => b.view === 'count' && (b.cards || []).some((c) => (c.filtres || []).some((f) => f.mode === 'aucun')));
  vrai(nb, 'une carte de nombre avec un filtre « sauf »');
  const lu = ctx.queryResult(nb, d, { page: i, view: 'read' });
  vrai(/<b>3<small> \/ 5<\/small><\/b><span class="q-lab">Cartes ouvertes hors Recette</.test(lu), 'à faire ou en cours, sauf Recette : 3 sur 5');
  const ed = ctx.queryResult(nb, d, { page: i, view: 'edit' });
  vrai(/Colonne : À faire ou En cours/.test(ed), 'puce à plusieurs valeurs sur la carte');
  vrai(/sauf Recette/.test(ed), 'puce « sauf » sur la carte');
  const val = qs.find((b) => b.src === 'table' && (b.filtres || []).some((f) => f.prop === 'valeur'));
  vrai(val, 'une requête « Valeur d\'une colonne »');
  const hv = ctx.queryResult(val, d, { page: i, view: 'read' });
  egal((hv.match(/Majeure|Critique/g) || []).length, 4, 'les 4 incidents majeurs ou critiques');
  vrai(!/Mineure/.test(hv), 'aucun incident mineur');
  vrai(/Gravité : Majeure ou Critique/.test(ctx.renderPage(d, { page: i, view: 'edit' })), 'puce de la colonne Gravité');
});
