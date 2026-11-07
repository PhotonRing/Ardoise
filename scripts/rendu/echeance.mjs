// Échéance d'une carte de kanban : lecture d'une date saisie en jj/mm/aaaa (kbParseDate) et champ d'édition.
import { monter, test, egal, vrai } from './commun.mjs';

const lire = (texte, jour) => { const { ctx } = monter({ title: 'Doc', pages: [] }); return ctx.kbParseDate(texte, jour || '2026-11-07'); };

test('échéance : formats acceptés, jour avant mois, année complétée', () => {
  egal(lire('7/11'), '2026-11-07');
  egal(lire('7/11', '2031-01-02'), '2031-11-07');
  egal(lire('7/11/26'), '2026-11-07');
  egal(lire('07/11/2026'), '2026-11-07');
  egal(lire('7.11.2026'), '2026-11-07');
  egal(lire('7-11-2026'), '2026-11-07');
  egal(lire('  3/2/27 '), '2027-02-03');
  egal(lire('29/02/2028'), '2028-02-29');
});

test('échéance : vide retire, date impossible refusée', () => {
  egal(lire(''), '');
  egal(lire('   '), '');
  for (const t of ['31/02', '29/02/2025', '0/1', '1/13', '32/1', 'abc', '7/11/202', '7', '7/11/2026/1', '2026-11-07'])
    egal(lire(t), null, t);
});

test('échéance : champ texte jj/mm/aaaa, bouton calendrier et sélecteur natif en édition', () => {
  const kb = (due) => ({ title: 'Doc', pages: [{ id: 'p1', blocks: [{ id: 'k1', type: 'kanban', cols: [{ id: 'c1', title: 'À faire', cards: [{ id: 'x', title: 'Tâche', due }] }] }] }] });
  const { ctx, d } = monter(kb('2026-11-07'));
  const h = ctx.renderPage(d, { page: 0, view: 'edit' });
  const champ = h.match(/<input[^>]*class="kb-due-in"[^>]*>/);
  vrai(champ, 'champ d\'échéance');
  vrai(/type="text"/.test(champ[0]) && /placeholder="jj\/mm\/aaaa"/.test(champ[0]) && /value="07\/11\/2026"/.test(champ[0]), champ[0]);
  vrai(/<button[^>]*class="kb-due-cal"/.test(h), 'bouton calendrier');
  vrai(/<input type="date" class="kb-due-pick"[^>]*value="2026-11-07"/.test(h), 'sélecteur natif');
  const v = monter(kb(undefined));
  vrai(/class="kb-due-in"[^>]*value=""/.test(v.ctx.renderPage(v.d, { page: 0, view: 'edit' })), 'sans échéance : champ vide');
});
