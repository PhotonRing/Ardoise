// Adresse de l'éditeur (09-adresse.js) : lecture de l'adresse à l'ouverture et au retour par Précédent / Suivant,
// et écriture de l'adresse d'une page ou d'une section, la même que celle des liens internes.
import { contexte, test, egal } from './commun.mjs';

const ctx = contexte();
const PAGES = [{ id: 'p1', blocks: [] }, { id: 'p2', blocks: [] }, { id: 'p3', blocks: [] }];
const lire = (h) => JSON.parse(JSON.stringify(ctx.lireAdresse(h, PAGES)));

test('adresse : #pg-<id> ouvre la page par son identifiant', () => {
  egal(lire('#pg-p2'), { page: 1, bloc: '', mode: '', introuvable: false });
});

test('adresse : #pg-<id>/<bloc> ouvre la page et nomme la section', () => {
  egal(lire('#pg-p3/b7'), { page: 2, bloc: 'b7', mode: '', introuvable: false });
});

test('adresse : ancienne forme #p<N>, bornée au document', () => {
  egal(lire('#p3').page, 2);
  egal(lire('#p99').page, 2);
  egal(lire('#p0').page, 0);
});

test('adresse : #edit ouvre la première page en édition', () => {
  egal(lire('#edit'), { page: 0, bloc: '', mode: 'edit', introuvable: false });
});

test('adresse : page supprimée → première page, signalée introuvable', () => {
  egal(lire('#pg-disparue/b1'), { page: 0, bloc: '', mode: '', introuvable: true });
});

test('adresse : vide ou inconnue → première page, sans message', () => {
  egal(lire(''), { page: 0, bloc: '', mode: '', introuvable: false });
  egal(lire('#b-x1'), { page: 0, bloc: '', mode: '', introuvable: false });
});

test('adresse : celle d\'une page ou d\'une section se relit à l\'identique', () => {
  egal(ctx.adressePage(PAGES, 1), '#pg-p2');
  egal(ctx.adressePage(PAGES, 2, 'b7'), '#pg-p3/b7');
  egal(lire(ctx.adressePage(PAGES, 2, 'b7')), { page: 2, bloc: 'b7', mode: '', introuvable: false });
});
