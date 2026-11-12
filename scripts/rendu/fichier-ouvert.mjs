// Fichier ouvert : la poignée reprise au démarrage doit porter le nom du fichier d'où la page est ouverte (memeNomQueFichierOuvert).
import { contexte, test, egal } from './commun.mjs';

const meme = (nom, adresse) => contexte().memeNomQueFichierOuvert(nom, adresse);

test('fichier ouvert : même nom, décodé de l\'adresse locale', () => {
  egal(meme('Mon fichier.html', 'file:///C:/Users/theo/Documents/Mon%20fichier.html'), true);
  egal(meme('notes.html', 'file:///home/theo/notes.html'), true);
  egal(meme('Réunion été.html', 'file:///home/theo/R%C3%A9union%20%C3%A9t%C3%A9.html'), true);
});

test('fichier ouvert : requête et ancre ignorées', () => {
  egal(meme('notes.html', 'file:///home/theo/notes.html#edit'), true);
  egal(meme('notes.html', 'file:///home/theo/notes.html?x=1#p2'), true);
});

test('fichier ouvert : casse et accents décomposés ne comptent pas', () => {
  egal(meme('Notes.HTML', 'file:///C:/Users/theo/notes.html'), true);
  egal(meme('Re\u0301union.html', 'file:///Users/theo/R%C3%A9union.html'), true, 'nom NFD de macOS');
});

test('fichier ouvert : autre nom refusé', () => {
  egal(meme('notes.html', 'file:///home/theo/autre.html'), false);
  egal(meme('notes.html', 'file:///home/theo/notes-2.html'), false);
  egal(meme('notes.html', 'file:///home/theo/notes.html/'), false);
});

test('fichier ouvert : encodage invalide comparé tel quel', () => {
  egal(meme('a%zz.html', 'file:///home/theo/a%zz.html'), true);
  egal(meme('notes.html', 'file:///home/theo/a%zz.html'), false);
});

test('fichier ouvert : contrôle sans objet hors d\'un fichier local', () => {
  for (const a of ['https://exemple.org/ardoise.html', 'about:srcdoc', 'content://media/notes.html', '', undefined])
    egal(meme('notes.html', a), true, String(a));
});

// Nom proposé par le sélecteur d'enregistrement (nomPropose) : poignée gardée, poignée écartée ou aucune.
const propose = (poignee, ecarte, adresse) => contexte().nomPropose(poignee, ecarte, adresse, 'Titre du document.html');

test('nom proposé : celui de la poignée gardée', () => {
  egal(propose('notes.html', null, 'file:///home/theo/autre.html'), 'notes.html');
});

test('nom proposé : poignée écartée (déplacement, renommage), le fichier ouvert plutôt que le titre', () => {
  egal(propose(null, 'page.html', 'file:///home/theo/page.html'), 'page.html');
  egal(propose(null, 'ancien.html', 'file:///C:/Docs/Mon%20fichier.html'), 'Mon fichier.html', 'nom de l\'adresse');
  egal(propose(null, 'ancien.html', 'about:srcdoc'), 'ancien.html', 'hors fichier local : le nom de la poignée écartée');
});

test('nom proposé : sans poignée ni poignée écartée, le titre du document', () => {
  egal(propose(null, null, 'file:///home/theo/page.html'), 'Titre du document.html');
});
