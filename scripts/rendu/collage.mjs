// Collage dans un champ d'une ligne : compacterLigne (02-assainissement.js) retire les blancs de bord et réduit les suites de
// blancs à une espace. Le contexte commun remplace l'assainisseur par des équivalents purs : ce sujet charge le vrai module.
import vm from 'node:vm';
import { js, test, egal } from './commun.mjs';

const ctx = vm.createContext({});
new vm.Script(js('02-assainissement.js'), { filename: '02-assainissement.js' }).runInContext(ctx);
const compacter = (s) => ctx.compacterLigne(s);

test('collage : les blancs de tête et de fin disparaissent', () => {
  egal(compacter('\nMon titre\n'), 'Mon titre');
  egal(compacter(' \t\r\n Valeur  '), 'Valeur');
});

test('collage : les blancs autour d\'une balise en tête ou en fin disparaissent', () => {
  egal(compacter('\n<b> gras </b>\n'), '<b>gras</b>');
  egal(compacter('<a href="https://ex.fr"> lien</a> et <i>fin </i> '), '<a href="https://ex.fr">lien</a> et <i>fin</i>');
  egal(compacter(' <b> </b> mot'), '<b></b>mot');
});

test('collage : retours à la ligne et indentation au milieu deviennent une espace', () => {
  egal(compacter('un\n    deux\t\ttrois'), 'un deux trois');
  egal(compacter('<b>un</b>\n  <i>deux</i>'), '<b>un</b> <i>deux</i>');
});

test('collage : les espaces insécables sont gardées', () => {
  egal(compacter('a&nbsp;b'), 'a&nbsp;b');
  egal(compacter('\u00a0a \u00a0 b\u00a0'), '\u00a0a \u00a0 b\u00a0');
  egal(compacter('&nbsp; a'), '&nbsp; a');
});

test('collage : balises et attributs gardés tels quels', () => {
  const h = '<span class="pill pc-3">projet</span> <a href="https://ex.fr/a  b" target="_blank" rel="noopener">x</a>';
  egal(compacter(h), h);
});

test('collage : chaîne vide ou absente', () => {
  egal(compacter(''), '');
  egal(compacter(' \n '), '');
  egal(compacter(null), '');
});

test('collage : texte brut d\'Excel sans espace de fin', () => {
  egal(compacter('valeur\r\n'), 'valeur');
});
