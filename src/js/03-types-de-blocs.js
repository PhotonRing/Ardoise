/* ---------- Types de blocs ---------- */
var T = {
  header:  { label: 'En-tête', ic: 'H1', desc: 'Surtitre, grand titre et chapeau', kw: 'titre entete header', make: function () { return { eyebrow: '', title: '', lede: '' }; } },
  h2:      { label: 'Titre de section', ic: 'H2', desc: 'Titre intermédiaire', kw: 'titre heading', make: function () { return { html: '' }; } },
  h3:      { label: 'Sous-titre', ic: 'H3', desc: 'Petit titre', kw: 'titre heading', make: function () { return { html: '' }; } },
  p:       { label: 'Paragraphe', ic: '¶', desc: 'Texte courant', kw: 'texte paragraphe', make: function () { return { html: '' }; } },
  step:    { label: 'Étape numérotée', ic: '1.', desc: 'Ouvre une section avec pastille de numéro', kw: 'etape section numero step', make: function () { return { num: '', title: '', nonum: false }; } },
  facts:   { label: 'Fiche de faits', ic: '▤', desc: 'Grille clé / valeur en carte', kw: 'faits cle valeur facts resume', make: function () { return { items: [{ k: 'Clé', v: '', alert: false }, { k: 'Clé', v: '', alert: false }, { k: 'Clé', v: '', alert: false }] }; } },
  cards:   { label: 'Cartes', ic: '▦', desc: 'Grille de cartes avec texte et cases', kw: 'cartes grille cards', make: function () { return { min: 340, cards: [{ title: '', text: '', checks: [{ html: '', done: false }] }, { title: '', text: '', checks: [{ html: '', done: false }] }] }; } },
  check:   { label: 'Liste à cocher', ic: '☑', desc: 'Cases enregistrées dans le fichier', kw: 'checklist cases cocher todo', make: function () { return { items: [{ html: '', done: false }] }; } },
  list:    { label: 'Liste', ic: '•', desc: 'Liste à puces ou numérotée', kw: 'liste puces numerotee', make: function () { return { ordered: false, items: [''] }; } },
  code:    { label: 'Bloc de code', ic: '{}', desc: 'Sombre, boîte avec fichier, ou commande', kw: 'code script commande terminal', make: function () { return { variant: 'dark', name: '', code: '', tall: false }; } },
  table:   { label: 'Tableau', ic: '▥', desc: 'Tableau avec ligne d’en-tête', kw: 'tableau table', make: function () { return { rows: [['Colonne', 'Colonne', 'Colonne'], ['', '', ''], ['', '', '']] }; } },
  note:    { label: 'Encadré', ic: '!', desc: 'Attention, info, alerte, succès', kw: 'note encadre callout alerte', make: function () { return { variant: 'warn', html: '' }; } },
  details: { label: 'Bloc dépliable', ic: '▸', desc: 'Titre cliquable qui révèle un texte', kw: 'details depliable accordeon', make: function () { return { title: '', html: '', open: false }; } },
  image:   { label: 'Image', ic: '▣', desc: 'Intégrée au fichier', kw: 'image photo capture', make: function () { return { src: '', caption: '', alt: '' }; } },
  divider: { label: 'Séparateur', ic: '—', desc: 'Ligne horizontale', kw: 'separateur ligne hr', make: function () { return {}; } },
  footer:  { label: 'Pied de page', ic: '§', desc: 'Sources, auteur, date', kw: 'pied footer sources', make: function () { return { html: '' }; } },
  map:     { label: 'Carte', ic: '◎', desc: 'Points, zones, cercles, itinéraires · hors ligne ou plan / satellite', kw: 'carte map geo port ville zone cercle itineraire route trajet distance localisation monde', make: function () { return { height: 420, bg: 'vector', view: { lat: 30, lon: 10, z: 1.6 }, markers: [], zones: [], routes: [], list: true, cities: true, lock: false, hideBg: false }; } },
  timeline: { label: 'Chronologie', ic: '⟿', desc: 'Événements datés, verticale ou horizontale', kw: 'timeline chronologie frise evenements dates historique deroule',
    make: function () { return { orient: 'v', items: [{ date: '', title: '', text: '', color: 'accent' }, { date: '', title: '', text: '', color: 'accent' }, { date: '', title: '', text: '', color: 'accent' }] }; } }
};
var ORDER = ['p', 'h2', 'h3', 'step', 'header', 'facts', 'cards', 'check', 'list', 'code', 'table', 'timeline', 'note', 'details', 'image', 'map', 'divider', 'footer'];
function mk(type, props) { var b = T[type].make(); b.id = uid(); b.type = type; for (var k in props) b[k] = props[k]; return b; }
function chk(arr) { return arr.map(function (h) { return { html: h, done: false }; }); }

