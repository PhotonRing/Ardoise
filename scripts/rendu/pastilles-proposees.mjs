// Liste de la pastille au clavier : filtre sans casse ni accents, tri (préfixe, apparitions, alphabet), 8 lignes, ligne « Créer ».
import { monter, test, egal } from './commun.mjs';

const P = (t) => '<span class="pill">' + t + '</span>';
const fois = (t, n) => Array.from({ length: n }, () => P(t)).join(' ');
const DOC = {
  title: 'Doc',
  tags: { 'priorité': { c: 3 }, prioritaire: { c: 4 }, 'approbation prio': { c: 5 }, 'été': { c: 6 } },
  pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 'a1', type: 'p', html: fois('Priorité', 3) + ' ' + fois('Prioritaire', 1) + ' ' + fois('Approbation prio', 5) + ' ' + P('Été') },
  ] }],
};
// lignes rendues, ramenées à des objets simples (le contexte vm a ses propres prototypes)
const liste = (brut, saisie) => { const { ctx, d } = monter(brut); return JSON.parse(JSON.stringify(ctx.pastillesProposees(d, saisie))); };
const noms = (l) => l.map((x) => (x.creer ? '+' : '') + x.nom);

test('pastilles proposées : préfixe avant sous-chaîne, puis apparitions ; « Créer » en dernier quand des noms ressemblent', () => {
  egal(noms(liste(DOC, 'pri')), ['Priorité', 'Prioritaire', 'Approbation prio', '+pri']);
});

test('pastilles proposées : sans casse ni accents', () => {
  egal(noms(liste(DOC, 'PRIO')), ['Priorité', 'Prioritaire', 'Approbation prio', '+PRIO']);
  egal(noms(liste(DOC, 'ete')), ['Été', '+ete']);
});

test('pastilles proposées : nom identique par sa clé, pas de ligne « Créer » ; chaque ligne porte clé et couleur du registre', () => {
  egal(liste(DOC, 'priorité'), [{ nom: 'Priorité', cle: 'priorité', couleur: 3 }]);
  egal(noms(liste(DOC, 'Prioritaire')), ['Prioritaire']);
});

test('pastilles proposées : aucun nom ne correspond, seule la ligne « Créer », avec la couleur qu\'aurait le nom nouveau', () => {
  // couleurs 3 à 6 prises : la moins utilisée est la 0
  egal(liste(DOC, 'Neuf'), [{ nom: 'Neuf', cle: 'neuf', couleur: 0, creer: true }]);
  egal(liste({ title: 'Vide', pages: [{ id: 'p1', title: 'A', blocks: [] }] }, 'x'), [{ nom: 'x', cle: 'x', couleur: 0, creer: true }]);
});

test('pastilles proposées : 8 lignes au plus ; à égalité d\'apparitions, ordre alphabétique', () => {
  const n = ['Tâche h', 'Tâche b', 'Tâche g', 'Tâche a', 'Tâche f', 'Tâche c', 'Tâche e', 'Tâche d', 'Tâche i'];
  const tags = Object.fromEntries(n.map((x, i) => [x.toLowerCase(), { c: i }]));
  const brut = { title: 'Doc', tags, pages: [{ id: 'p1', title: 'A', blocks: [{ id: 'a', type: 'p', html: n.map(P).join(' ') }] }] };
  egal(noms(liste(brut, 'tache')), ['Tâche a', 'Tâche b', 'Tâche c', 'Tâche d', 'Tâche e', 'Tâche f', 'Tâche g', '+tache']);
});
