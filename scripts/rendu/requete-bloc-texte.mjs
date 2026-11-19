// Requêtes « cases à cocher » sur les blocs texte (spec bloc-texte, ticket 10) : case parente (module pur 05-lignes.js),
// résultats d'un bloc texte (chemin lignes.i.done, pastilles), cochage depuis un résultat et lien vers le bloc.
import { contexte, monter, test, egal, vrai } from './commun.mjs';

const parent = (lignes, i) => contexte().caseParente(lignes, i);
const SERVEURS = [{ html: 'Serveurs' }, { html: 'Sauvegardes', genre: 'case', lv: 1 }, { html: 'Restauration', genre: 'case', lv: 2 }];

test('case parente : la ligne la plus proche au-dessus de niveau strictement inférieur', () => {
  egal(parent(SERVEURS, 2), 'Sauvegardes', 'Serveurs / Sauvegardes / Restauration');
  egal(parent(SERVEURS, 1), 'Serveurs', 'parent ligne de texte');
  egal(parent([{ html: 'Titre', genre: 'soustitre' }, { html: 'x', genre: 'case', lv: 1 }], 1), 'Titre', 'sous-titre');
  egal(parent([{ html: 'p', genre: 'puce' }, { html: 'x', genre: 'case', lv: 1 }], 1), 'p', 'puce');
  egal(parent([{ html: 'fait', genre: 'case', done: true }, { html: 'x', genre: 'case', lv: 1 }], 1), 'fait', 'case cochée');
  egal(parent([{ html: 'a' }, { html: 'b', genre: 'case', lv: 1 }, { html: 'c', lv: 2 }, { html: 'd', genre: 'case', lv: 1 }], 3), 'a', 'lignes plus profondes et de même niveau sautées');
});

test('case parente : aucune au niveau 0 ni sans ligne moins profonde au-dessus', () => {
  egal(parent([{ html: 'a' }, { html: 'b', genre: 'case' }], 1), '');
  egal(parent([{ html: 'b', genre: 'case', lv: 2 }], 0), '');
});

const P = (n) => '<span class="pill">' + n + '</span>';
const DOC = (q) => ({ title: 'Doc', pages: [
  { id: 'p1', title: 'Accueil', blocks: [{ id: 'q', type: 'query', src: 'check', scope: 'doc', view: 'list', ...q }] },
  { id: 'p2', title: 'Exploitation', blocks: [
    { id: 'h', type: 'h2', html: 'Serveurs' },
    { id: 'c', type: 'check', items: [{ html: 'Liste' }, { html: 'Sous-liste', lv: 1, done: true }] },
    { id: 't', type: 'texte', lignes: [{ html: 'Serveurs' }, { html: 'Sauvegardes ' + P('Prod'), genre: 'case', lv: 1, done: true }, { html: 'Restauration', genre: 'case', lv: 2 }, { html: 'Note', genre: 'puce', lv: 2 }, { html: 'Supervision', genre: 'case' }] },
    { id: 'k', type: 'cards', cards: [{ title: 'Carte', checks: [{ html: 'Dans la carte' }] }] },
  ] },
] });
const resultats = (q) => {
  const { ctx, d } = monter(DOC(q)), b = d.pages[0].blocks[0];
  return { ctx, d, recs: ctx.queryRecords(b, d, 0) };
};
const vue = (r) => [r.x.blk.id, r.path, r.par, r.done, r.tags.join(',')].join('|');

test('requête cases : une ligne de case d\'un bloc texte par résultat, chemin, parent et pastilles', () => {
  egal(resultats().recs.map(vue), [
    'c|items.0.done||false|', 'c|items.1.done|Liste|true|',
    't|lignes.1.done|Serveurs|true|prod', 't|lignes.2.done|Sauvegardes Prod|false|', 't|lignes.4.done||false|',
    'k|cards.0.checks.0.done|Carte|false|',
  ]);
});

test('requête cases : filtres de pastilles et d\'état appliqués aux lignes d\'un bloc texte', () => {
  egal(resultats({ filtres: [{ id: 'f', prop: 'tags', vals: ['prod'] }] }).recs.map((r) => r.path), ['lignes.1.done']);
  egal(resultats({ filtres: [{ id: 'f', prop: 'state', vals: ['todo'] }] }).recs.map((r) => r.x.blk.id + ':' + r.path), ['c:items.0.done', 't:lignes.2.done', 't:lignes.4.done', 'k:cards.0.checks.0.done']);
});

test('cocher depuis un résultat : une case de bloc texte cochée, puis décochée sans laisser done', () => {
  const { ctx, d } = resultats(), t = d.pages[1].blocks[2];
  vrai(ctx.basculerCaseRequete(t, 'lignes.2.done'), 'cochée');
  egal(t.lignes[2], { html: 'Restauration', genre: 'case', lv: 2, done: true });
  vrai(ctx.basculerCaseRequete(t, 'lignes.2.done'), 'décochée');
  egal(t.lignes[2], { html: 'Restauration', genre: 'case', lv: 2 });
});

test('cocher depuis un résultat : refus hors d\'une case ; Liste à cocher et carte basculées comme avant', () => {
  const { ctx, d } = resultats(), [, c, t, k] = d.pages[1].blocks;
  vrai(!ctx.basculerCaseRequete(t, 'lignes.3.done') && !('done' in t.lignes[3]), 'puce');
  vrai(!ctx.basculerCaseRequete(t, 'lignes.9.done'), 'ligne absente');
  vrai(!ctx.basculerCaseRequete(c, 'items.7.done'), 'case absente');
  vrai(ctx.basculerCaseRequete(c, 'items.1.done') && c.items[1].done === false, 'Liste à cocher');
  vrai(ctx.basculerCaseRequete(k, 'cards.0.checks.0.done') && k.cards[0].checks[0].done === true, 'carte');
});

test('lien vers la source : un résultat de bloc texte vise le bloc, celui d\'une Liste à cocher sa section', () => {
  const { ctx, d, recs } = resultats(), src = (id) => ctx.qSource(d, recs.find((r) => r.x.blk.id === id).x);
  vrai(src('t').includes('href="#pg-p2/t"'), src('t'));
  vrai(src('c').includes('href="#pg-p2/h"'), src('c'));
});

test('bloc texte en lecture : ancré (id b-<id>) dans la page et dans un groupe, export compris', () => {
  const { ctx, d } = monter({ title: 'Doc', pages: [{ id: 'p1', blocks: [{ id: 't1', type: 'texte', lignes: [{ html: 'a' }] },
    { id: 'g', type: 'group', title: 'G', blocks: [{ id: 't2', type: 'texte', lignes: [{ html: 'b' }] }] }] }] });
  for (const view of ['read', 'export']) {
    const h = ctx.renderPage(d, { page: 0, view });
    vrai(/id="b-t1"/.test(h) && /id="b-t2"/.test(h), view);
  }
});
