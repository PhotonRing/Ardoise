// Complétude des types de blocs (src/js/03-types-de-blocs.js et familles 06-bloc-*.js) : chaque type inscrit dans T porte
// ce que les points d'entrée communs lisent. Obligatoires : label, ic, desc, kw, make, rendu, elements. Facultatives :
// office, reglages, normaliser, libelle, chacune présente ou déclarée absente dans sans: [...]. Le banc échoue sur un type de
// ORDER non inscrit, une facette obligatoire manquante, une absence non déclarée, et sur le retour d'un ancien aiguillage
// (switch par type dans un point d'entrée, OFFICE_RENDUS, fichier 09-office-*.js).
import { readdirSync } from 'node:fs';
import vm from 'node:vm';
import { contexte, js, test, vrai, egal } from './commun.mjs';

const NOMS = ['label', 'ic', 'desc', 'kw', 'make'];
const OBLIGATOIRES = ['rendu', 'elements'];
const FACULTATIVES = ['office', 'reglages', 'normaliser', 'libelle'];

// manques d'une inscription : { erreurs (toujours fatales), manques (fatals en mode strict) }
export function manquesDe(type, t) {
  const erreurs = [], manques = [], sans = t.sans || [];
  for (const k of NOMS) if (k === 'make' ? typeof t[k] !== 'function' : typeof t[k] !== 'string' || (k !== 'kw' && !t[k])) erreurs.push(type + ' : ' + k + ' manquant');
  if (!Array.isArray(sans)) erreurs.push(type + ' : sans doit être une liste');
  else for (const k of sans) {
    if (!FACULTATIVES.includes(k)) erreurs.push(type + ' : sans « ' + k + ' » n\'est pas une facette facultative');
    else if (typeof t[k] === 'function') erreurs.push(type + ' : ' + k + ' présente et déclarée absente');
  }
  for (const k of OBLIGATOIRES) if (typeof t[k] !== 'function') manques.push(type + ' : ' + k);
  for (const k of FACULTATIVES) if (typeof t[k] !== 'function' && !(Array.isArray(sans) && sans.includes(k))) manques.push(type + ' : ' + k + ' (ni présente ni déclarée absente)');
  return { erreurs, manques };
}

test('complétude : chaque type de ORDER est inscrit dans T', () => {
  const ctx = contexte();
  for (const t of ctx.ORDER) vrai(ctx.T[t], 'type du menu sans inscription : ' + t);
});

test('complétude : chaque inscription de T porte ses noms, ses facettes obligatoires et ses absences déclarées', () => {
  const ctx = contexte(), erreurs = [], manques = [];
  for (const type of Object.keys(ctx.T)) { const m = manquesDe(type, ctx.T[type]); erreurs.push(...m.erreurs); manques.push(...m.manques); }
  vrai(!erreurs.length, 'inscriptions incomplètes :\n  ' + erreurs.join('\n  '));
  vrai(!manques.length, 'facettes manquantes :\n  ' + manques.join('\n  '));
});

// l'inscription est le seul aiguillage : ni switch par type dans les six points d'entrée, ni OFFICE_RENDUS, ni 09-office-*.js
test('complétude : plus aucun ancien aiguillage dans les points d\'entrée communs', () => {
  const ctx = contexte();
  vm.runInContext(js('05-synchro-moteur.js') + '\n' + js('05-libelle-etape.js'), ctx);
  const anciens = ['renderBlock', 'settings', 'officeBloc', 'officeHtmlContenu', 'normBlocks', 'libelleNature']
    .filter((f) => /switch\s*\(b\.type\)|case '|\/\/ famille /.test(ctx[f].toString()));
  egal(anciens, [], 'points d\'entrée avec un switch, un case ou une ligne de famille');
  egal(typeof ctx.OFFICE_RENDUS, 'undefined', 'OFFICE_RENDUS existe encore');
  egal(readdirSync(new URL('../../src/js/', import.meta.url)).filter((f) => /^09-office-.*\.js$/.test(f)), [], 'fichiers 09-office-*.js');
  vrai(!/\/\/ famille /.test(js('03-types-de-blocs.js')), '03-types-de-blocs.js : lignes de séparation des familles');
});

// le banc lui-même : une inscription fautive est bien signalée
test('complétude : une inscription fautive est signalée', () => {
  const f = () => {};
  const ok = manquesDe('x', { label: 'X', ic: 'X', desc: 'X', kw: '', make: f, rendu: f, elements: f, office: f, sans: ['reglages', 'normaliser', 'libelle'] });
  vrai(!ok.erreurs.length && !ok.manques.length, 'inscription complète refusée : ' + JSON.stringify(ok));
  const ko = manquesDe('x', { label: 'X', ic: 'X', desc: 'X', kw: '', make: f, rendu: f, office: f, sans: ['office', 'rendu'] });
  vrai(ko.erreurs.some((e) => /office présente et déclarée absente/.test(e)) && ko.erreurs.some((e) => /« rendu »/.test(e)), 'erreurs non signalées : ' + JSON.stringify(ko));
  vrai(ko.manques.includes('x : elements') && ko.manques.some((m) => /x : reglages \(ni présente/.test(m)), 'manques non signalés : ' + JSON.stringify(ko));
});
