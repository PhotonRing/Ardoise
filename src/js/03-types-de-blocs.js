/* ---------- Types de blocs ---------- */
// sommets du modèle diamant : clé du champ et nom, dans l'ordre de la pile (Adversaire, Capacité, Infrastructure, Victime)
var DIA_SOMMETS = [{ cle: 'adversaire', nom: 'Adversaire' }, { cle: 'capacite', nom: 'Capacité' }, { cle: 'infrastructure', nom: 'Infrastructure' }, { cle: 'victime', nom: 'Victime' }];
/* Ajouter un type : son inscription T.<type> = { … } dans une famille 06-bloc-<famille>.js (exemple à copier : 06-bloc-listes.js),
   puis le type dans ORDER ; aucun point d'entrée commun à toucher. Facettes obligatoires et facultatives (absences déclarées dans
   sans: [...]) : scripts/rendu/completude.mjs, qui refuse une inscription incomplète. */
var T = {};
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

