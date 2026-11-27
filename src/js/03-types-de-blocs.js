/* ---------- Types de blocs ---------- */
// sommets du modèle diamant : clé du champ et nom, dans l'ordre de la pile (Adversaire, Capacité, Infrastructure, Victime)
var DIA_SOMMETS = [{ cle: 'adversaire', nom: 'Adversaire' }, { cle: 'capacite', nom: 'Capacité' }, { cle: 'infrastructure', nom: 'Infrastructure' }, { cle: 'victime', nom: 'Victime' }];
var T = {
  // famille texte et titres (ticket 02)
  // famille cadres (ticket 03)
  note:    { label: 'Encadré', ic: '!', desc: 'Attention, info, alerte, succès', kw: 'note encadre callout alerte', make: function () { return { variant: 'warn', html: '' }; }, sans: ['normaliser', 'libelle'] },
  facts:   { label: 'Fiche de faits', ic: '▤', desc: 'Grille clé / valeur en carte', kw: 'faits cle valeur facts resume', make: function () { return { items: [{ k: 'Clé', v: '', alert: false }, { k: 'Clé', v: '', alert: false }, { k: 'Clé', v: '', alert: false }] }; }, sans: ['normaliser', 'libelle'] },
  cards:   { label: 'Cartes', ic: '▦', desc: 'Grille de cartes avec texte et cases', kw: 'cartes grille cards', make: function () { return { min: 340, cards: [{ title: '', text: '', checks: [{ html: '', done: false }] }, { title: '', text: '', checks: [{ html: '', done: false }] }] }; }, sans: ['normaliser', 'libelle'] },
  details: { label: 'Bloc dépliable', ic: '▸', desc: 'Titre cliquable qui révèle un texte', kw: 'details depliable accordeon', make: function () { return { title: '', html: '', open: false }; }, sans: ['normaliser', 'libelle'] },
  group:   { label: 'Groupe repliable', ic: '⊟', desc: 'Titre cliquable qui plie quelques blocs, hors du sommaire', kw: 'groupe repliable plier replier accordeon conteneur blocs', make: function () { return { title: '', folded: false, blocks: [] }; }, sans: ['reglages', 'normaliser'] },
  diamond: { label: 'Modèle diamant', ic: '◇', desc: 'Adversaire, capacité, infrastructure et victime en losange', kw: 'diamant diamond modele intrusion adversaire capacite infrastructure victime cti menace evenement',
    make: function () { var o = { title: '' }; DIA_SOMMETS.forEach(function (s) { o[s.cle] = ''; }); return o; }, sans: ['reglages', 'normaliser', 'libelle'] },
  // famille carte et chronologie (ticket 04)
  map:     { label: 'Carte', ic: '◎', desc: 'Points, zones, cercles, itinéraires · hors ligne ou plan / satellite', kw: 'carte map geo port ville zone cercle itineraire route trajet distance localisation monde', make: function () { return { height: 420, bg: 'vector', view: { lat: 30, lon: 10, z: 1.6 }, markers: [], zones: [], routes: [], list: true, cities: true, lock: false, hideBg: false }; }, sans: ['office', 'normaliser', 'libelle'] },
  timeline: { label: 'Chronologie', ic: '⟿', desc: 'Événements datés, verticale ou horizontale', kw: 'timeline chronologie frise evenements dates historique deroule',
    make: function () { return { orient: 'v', items: [{ date: '', title: '', text: '', color: 'accent' }, { date: '', title: '', text: '', color: 'accent' }, { date: '', title: '', text: '', color: 'accent' }] }; }, sans: ['office', 'normaliser', 'libelle'] },
  // famille listes et tableaux (ticket 05)
  list:    { label: 'Liste', ic: '•', desc: 'Liste à puces ou numérotée', kw: 'liste puces numerotee', make: function () { return { ordered: false, items: [{ html: '' }] }; }, sans: ['libelle'] },
  check:   { label: 'Liste à cocher', ic: '☑', desc: 'Cases enregistrées dans le fichier', kw: 'checklist cases cocher todo', make: function () { return { items: [{ html: '', done: false }] }; }, sans: ['normaliser', 'libelle'] },
  summary: { label: 'Sommaire', ic: '☰', desc: 'Sections ou sous-pages de la page, tenu à jour', kw: 'sommaire table des matieres toc index sections sous-pages plan', make: function () { return { title: 'Sommaire', src: 'sec', sort: 'doc' }; }, sans: ['normaliser', 'libelle'] },
  table:   { label: 'Tableau', ic: '▥', desc: 'Tableau avec ligne d’en-tête', kw: 'tableau table', make: function () { return { rows: [['Colonne', 'Colonne', 'Colonne'], ['', '', ''], ['', '', '']] }; }, sans: ['normaliser'] },
  // famille requête et kanban (ticket 06)
  query:   { label: 'Requête', ic: '⌕', desc: 'Fiches de faits, lignes de tableaux ou cases à cocher filtrées par pastilles : tableau, liste ou nombre', kw: 'requete query dataview filtre recherche pastille tag compteur widget tableau liste nombre',
    make: function () { return { title: '', src: 'facts', scope: 'doc', view: 'table', cards: [{ id: uid(), label: '', total: 'none' }] }; }, sans: ['reglages'] },
  kanban:  { label: 'Kanban', ic: '▥', desc: 'Colonnes de cartes à déplacer (échéance et responsable facultatifs)', kw: 'kanban tableau taches suivi colonnes cartes trello projet',
    make: function () { return { cols: [{ id: uid(), title: 'À faire', cards: [] }, { id: uid(), title: 'En cours', cards: [] }, { id: uid(), title: 'Fait', cards: [] }] }; }, sans: ['reglages'] },
  // famille médias (ticket 07)
  image:   { label: 'Image', ic: '▣', desc: 'Intégrée au fichier', kw: 'image photo capture', make: function () { return { src: '', caption: '', alt: '' }; }, sans: ['normaliser', 'libelle'] },
  code:    { label: 'Bloc de code', ic: '{}', desc: 'Sombre, boîte avec fichier, ou commande', kw: 'code script commande terminal', make: function () { return { variant: 'dark', name: '', code: '', tall: false }; }, sans: ['normaliser', 'libelle'] },
  formule: { label: 'Formule', ic: '∑', desc: 'Une formule LaTeX seule, centrée et en grand', kw: 'formule equation maths mathematiques latex tex', make: function () { return { tex: '' }; }, sans: ['reglages', 'normaliser', 'libelle'] },
  divider: { label: 'Séparateur', ic: '—', desc: 'Ligne horizontale', kw: 'separateur ligne hr', make: function () { return {}; }, sans: ['reglages', 'normaliser', 'libelle'] }
};
// Liste, Liste à cocher et Sous-titre restent dans T (rendus, modifiables, exportés, requêtés) mais ne s'insèrent plus : le bloc
// texte les remplace (« Convertir en texte », 16-menu-bloc.js)
var ORDER = ['texte', 'h2', 'h3', 'step', 'summary', 'query', 'kanban', 'header', 'facts', 'cards', 'code', 'formule', 'table', 'timeline', 'note', 'details', 'image', 'map', 'divider', 'footer', 'diamond', 'group'];
// types refusés dans un groupe repliable (un seul niveau ; le sommaire, les sections et les étapes restent au premier niveau)
var HORS_GROUPE = { header: 1, footer: 1, h2: 1, h3: 1, step: 1, group: 1 };
// facette d'un type (rendu, reglages, elements, office, normaliser, libelle) : la fonction inscrite, sinon null (type inconnu, facette
// absente) ; seul accès des points d'entrée communs à l'inscription. Une facette facultative absente est déclarée dans sans: [...]
function facette(type, nom) { var t = T[type]; return t && typeof t[nom] === 'function' ? t[nom] : null; }
function mk(type, props) {
  var b = T[type].make(); b.id = uid(); b.type = type;
  if (type === 'group') b.blocks = [mk('texte', {})];   // un groupe neuf contient un bloc texte vide
  for (var k in props) b[k] = props[k];
  return b;
}
function chk(arr) { return arr.map(function (h) { return { html: h, done: false }; }); }

