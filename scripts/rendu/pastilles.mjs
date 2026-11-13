// Registre des pastilles du document : comptage des apparitions par nom, et puces des requêtes qui lisent sans inscrire.
import vm from 'node:vm';
import { js, monter, test, egal, vrai } from './commun.mjs';

const P = (t, cls) => '<span class="pill' + (cls ? ' ' + cls : '') + '">' + t + '</span>';
// deux pages ; « OK » sur les deux (dont une exception de couleur), « KO » une fois, « Ancienne » au registre seulement ;
// « Alice » est responsable et « Fait » une colonne : ce ne sont pas des pastilles
const DOC = {
  title: 'Doc',
  tags: { ok: { c: 0 }, ko: { c: 1 }, ancienne: { c: 2 } },
  pages: [
    { id: 'p1', title: 'Accueil', blocks: [
      { id: 'a1', type: 'p', html: 'Statut ' + P('OK') + ' puis ' + P('ok ', 'pc-5') },
      { id: 'a2', type: 'table', rows: [['Statut', 'Suite'], [P('KO'), 'Rien']] },
    ] },
    { id: 'p2', title: 'Suite', blocks: [
      { id: 'b1', type: 'facts', items: [{ k: 'État', v: P('OK') }] },
      { id: 'b2', type: 'kanban', cols: [{ id: 'c1', title: 'Fait', cards: [{ id: 'k1', title: 'Tâche', who: 'Alice' }] }] },
      { id: 'b3', type: 'query', src: 'facts', scope: 'doc', tags: ['ok', 'ancienne'] },
    ] },
  ],
};

test('comptage : apparitions de chaque nom du registre comme pastille, et pages concernées', () => {
  const { ctx, d } = monter(DOC);
  egal(JSON.parse(JSON.stringify(ctx.tagUsage(d))), [
    { key: 'ancienne', name: 'ancienne', n: 0, pages: [] },
    { key: 'ko', name: 'KO', n: 1, pages: [{ pi: 0, title: 'Accueil' }] },
    { key: 'ok', name: 'OK', n: 3, pages: [{ pi: 0, title: 'Accueil' }, { pi: 1, title: 'Suite' }] },
  ]);
});

// puces d'un rendu : nom → classes et titre
const puces = (h) => Object.fromEntries([...h.matchAll(/<button type="button" class="([^"]*q-chip[^"]*)"[^>]*title="([^"]*)"[^>]*>([^<]*)</g)].map((m) => [m[3], { cls: m[1], title: m[2] }]));

test('une requête qui filtre par responsable, colonne ou pastille absente n\'inscrit rien au registre', () => {
  const { ctx, d } = monter({ ...DOC, pages: [...DOC.pages, { id: 'p3', title: 'Requêtes', blocks: [
    { id: 'q1', type: 'query', src: 'kanban', scope: 'doc', kbWho: 'alice', col: 'fait', tags: ['inconnue'] },
    { id: 'q2', type: 'query', src: 'facts', scope: 'doc', view: 'count', cards: [{ label: '', tags: ['autre'], match: 'any', state: 'all', total: 'filter', ttags: ['encore'] }] },
  ] }] });
  const avant = JSON.stringify(d.tags);
  const q1 = d.pages[2].blocks[0];
  const h = ctx.renderPage(d, { page: 2, view: 'edit' }) + ctx.qFenetre(q1, d, 2, 'f:tags') + ctx.qFenetre(q1, d, 2, 'f:kbWho') + ctx.qFenetre(q1, d, 2, 'f:col');
  egal(JSON.stringify(d.tags), avant, 'registre inchangé');
  for (const nom of ['inconnue', 'autre', 'encore']) {
    const p = puces(h)[nom];
    vrai(p, 'puce « ' + nom + ' » gardée :\n' + h);
    vrai(!/\bpa-\d/.test(p.cls) && /\bq-gone\b/.test(p.cls), 'puce « ' + nom + ' » grise et marquée absente : ' + p.cls);
    vrai(p.title.startsWith('Absente du document'), 'titre de « ' + nom + ' » : ' + p.title);
  }
});

// avec la vraie coloration des pastilles (15-pastilles.js) à la place de l'équivalent pur du banc
const peint = (brut) => {
  const m = monter(brut);
  m.ctx.session = { abonner: () => {} };
  vm.runInContext(js('15-pastilles.js'), m.ctx, { filename: '15-pastilles.js' });
  return m;
};
const nomDe = (ctx, d, key) => ctx.tagUsage(d).find((t) => t.key === key).name;

test('nom d\'une pastille retirée de tous les textes : celui vu au rendu pendant la session, la clé après rechargement', () => {
  const { ctx, d } = peint(DOC);
  egal(nomDe(ctx, d, 'ancienne'), 'ancienne', 'jamais rendue : la clé');
  ctx.renderPage(d, { page: 0, view: 'edit' });
  d.pages[0].blocks[1].rows[1][0] = 'KO';
  egal(nomDe(ctx, d, 'ko'), 'KO', 'vue au rendu de la page');
  const recharge = peint({ ...DOC, pages: [{ ...DOC.pages[0], blocks: [DOC.pages[0].blocks[0]] }, DOC.pages[1]] });
  egal(nomDe(recharge.ctx, recharge.d, 'ko'), 'ko', 'nouvelle session');
});

test('une pastille de la fenêtre du filtre prend la couleur du registre ; absente de la portée mais au registre, elle garde sa couleur', () => {
  const { ctx, d } = monter(DOC);
  const p = puces(ctx.qFenetre(d.pages[1].blocks.find((x) => x.id === 'b3'), d, 1, 'f:tags'));
  vrai(/\bpa-0\b/.test(p.OK.cls) && !/q-gone/.test(p.OK.cls), 'OK : couleur 0 : ' + p.OK.cls);
  vrai(/\bpa-2\b/.test(p.ancienne.cls) && /q-gone/.test(p.ancienne.cls) && p.ancienne.title.startsWith('Absente de la portée'), 'ancienne : ' + JSON.stringify(p.ancienne));
});
