// Précédent et Suivant dans l'export statique (01-lecture.js) : la lecture d'adresse du runtime de lecture, copie autonome
// de celle de l'éditeur (09-adresse.js), donne les mêmes résultats ; la page exportée crée des entrées d'historique, sauf
// dans une iframe, et revient à la page et au défilement de l'entrée par Précédent.
import { contexte, monter, test, egal, vrai, DEUX_PAGES } from './commun.mjs';
import vm from 'node:vm';

const ctx = contexte();
const PAGES = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
const lire = (f, h) => JSON.parse(JSON.stringify(f(h, PAGES)));
const CAS = ['#pg-p2', '#pg-p3/b7', '#pg-p1/', '#p3', '#p99', '#p0', '#p', '#edit', '', '#pg-disparue', '#pg-disparue/b1', '#b-x1', '#pg-', 'pg-p2', '#P2'];

test('adresse de l\'export : mêmes résultats que celle de l\'éditeur', () => {
  for (const h of CAS) egal(lire(ctx.Reader.lireAdresse, h), lire(ctx.lireAdresse, h), 'adresse ' + JSON.stringify(h));
});

test('adresse de l\'export : page, section, ancienne forme, page supprimée', () => {
  const r = ctx.Reader.lireAdresse;
  egal(lire(r, '#pg-p3/b7'), { page: 2, bloc: 'b7', mode: '', introuvable: false });
  egal(lire(r, '#p2').page, 1);
  egal(lire(r, '#pg-disparue'), { page: 0, bloc: '', mode: '', introuvable: true });
});

// Page exportée dans vm : deux pages (.pg) et un bouton de page par page, un historique qui note les appels.
// top : la fenêtre du haut (elle-même hors iframe, une autre dans une iframe)
function exportee(dansCadre, hash) {
  const ecoute = {}, appels = [], defile = [];
  const pose = (type, fn) => { (ecoute[type] = ecoute[type] || []).push(fn); };
  const attr = (o) => (k) => (k in o ? o[k] : null);
  const pages = ['p1', 'p2'].map((id) => ({ hidden: false, getAttribute: attr({ 'data-pgid': id }), querySelectorAll: () => [] }));
  const boutons = [0, 1].map((i) => ({ getAttribute: attr({ 'data-pg': String(i) }), closest: () => null, setAttribute() {}, removeAttribute() {}, textContent: 'Page ' + (i + 1) }));
  const el = { getAttribute: () => null, classList: { contains: () => false, toggle() {} }, style: { setProperty() {} } };
  const document = {
    documentElement: el, title: 'Essai', readyState: 'complete', addEventListener: pose, getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: (s) => (s === '.pg' ? pages : s === '[data-pg]' ? boutons : []),
  };
  const location = { hash: hash || '', get href() { return 'file:///essai-lecture.html' + this.hash; } };
  const history = {
    state: null, scrollRestoration: 'auto',
    pushState(st, _, u) { appels.push(['push', u]); this.state = st; location.hash = u; },
    replaceState(st, _, u) { appels.push(['replace', u]); this.state = st; location.hash = String(u).replace(/^[^#]*/, ''); },
  };
  const c = vm.createContext({ document, location, history, innerWidth: 1200, scrollY: 0, setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: (f) => { f(); return 1; },
    scrollTo(x, y) { defile.push(y); c.scrollY = y; }, Event: function (type) { this.type = type; }, addEventListener: pose, dispatchEvent() {} });
  c.window = c; c.self = c; c.top = dansCadre ? {} : c;
  new vm.Script(monter(DEUX_PAGES).ctx.readerScript(), { filename: 'lecture.js' }).runInContext(c);
  const visible = () => pages.findIndex((p) => !p.hidden);
  const clic = (i) => ecoute.click.forEach((f) => f({ target: { closest: (s) => (s === '[data-pg]' ? boutons[i] : null) }, preventDefault() {} }));
  return { c, ecoute, appels, defile, history, location, visible, clic };
}

test('export : un clic sur une page crée une entrée #pg-, Précédent revient à la page et au défilement', () => {
  const p = exportee(false);
  egal(p.visible(), 0, 'ouverture : première page');
  vrai(p.ecoute.popstate, 'Précédent écouté hors iframe');
  egal(p.history.scrollRestoration, 'manual');
  p.c.scrollY = 300;
  p.clic(1);
  egal(p.visible(), 1, 'page 2 affichée');
  egal(p.appels.filter((a) => a[0] === 'push'), [['push', '#pg-p2']], 'une entrée, adresse de la page');
  p.clic(1);
  egal(p.appels.filter((a) => a[0] === 'push').length, 1, 'page déjà affichée : pas d\'entrée');
  p.location.hash = '#pg-p1'; p.defile.length = 0;
  p.ecoute.popstate.forEach((f) => f({ state: { y: 300 } }));
  egal(p.visible(), 0, 'Précédent : page 1');
  egal(p.defile, [300], 'Précédent : défilement rétabli, sans passer par le haut');
});

test('export : ouverture sur #pg-<page> et sur l\'ancienne adresse #p<N>', () => {
  egal(exportee(false, '#pg-p2').visible(), 1);
  egal(exportee(false, '#p2').visible(), 1);
  egal(exportee(false, '#pg-disparue').visible(), 0);
});

test('export dans une iframe : aucune entrée, Précédent non écouté', () => {
  const p = exportee(true);
  vrai(!p.ecoute.popstate, 'pas d\'écouteur popstate');
  p.clic(1);
  egal(p.visible(), 1, 'la page change');
  egal(p.appels, [['replace', '#pg-p2']], 'adresse remplacée, sans entrée');
});
