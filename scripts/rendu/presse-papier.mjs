// Presse-papier (05-presse-papier.js) : texte brut d'une copie qui contient des pastilles (#nom), et marque de provenance
// des pastilles copiées, pour qu'une couleur d'exception ne passe pas d'un document à l'autre.
import { contexte, test, egal } from './commun.mjs';

const ctx = contexte();

test('texte brut : chaque pastille devient # suivi de son nom', () => {
  egal(ctx.texteBrutDePresse('Statut <span class="pill">OK</span> et <span class="pill pc-5">Très urgent</span> fin'), 'Statut #OK et #Très urgent fin');
  egal(ctx.texteBrutDePresse('<span class="pill" data-ad="d1"><b>Gras</b></span>'), '#Gras');
});

test('texte brut : entités décodées, balises de mise en forme retirées', () => {
  egal(ctx.texteBrutDePresse('<b>A &amp; B</b> &lt;c&gt;&nbsp;<i>d</i>'), 'A & B <c> d');
});

test('texte brut : blocs en lignes, cellules en tabulations', () => {
  egal(ctx.texteBrutDePresse('<p>Un <span class="pill">OK</span></p><p>Deux<br>trois</p>'), 'Un #OK\nDeux\ntrois');
  egal(ctx.texteBrutDePresse('<ul><li>a</li><li>b</li></ul>'), 'a\nb');
  egal(ctx.texteBrutDePresse('<table><tbody><tr><td>a</td><td><span class="pill">KO</span></td></tr><tr><td>c</td><td>d</td></tr></tbody></table>'), 'a\t#KO\nc\td');
});

test('copie : les pastilles perdent leur couleur calculée et portent l\'identifiant du document', () => {
  egal(ctx.pastillesSansCouleur('x <span class="pill pa-3" style="color:red">OK</span> <span class="pill pc-5">Urgent</span>', 'd1'),
    'x <span class="pill" data-ad="d1">OK</span> <span class="pill pc-5" data-ad="d1">Urgent</span>');
  egal(ctx.pastillesSansCouleur('sans pastille <b>gras</b>', 'd1'), 'sans pastille <b>gras</b>');
});

test('collage : l\'exception reste dans le même document, part sinon', () => {
  const html = '<span class="pill pc-5" data-ad="d1">Urgent</span> <span class="pill" data-ad="d1">OK</span>';
  egal(ctx.pastillesDuCollage(html, 'd1'), html);
  egal(ctx.pastillesDuCollage(html, 'd2'), '<span class="pill" data-ad="d1">Urgent</span> <span class="pill" data-ad="d1">OK</span>');
  egal(ctx.pastillesDuCollage('<span class="pill pc-5">Urgent</span>', 'd1'), '<span class="pill">Urgent</span>');
});
