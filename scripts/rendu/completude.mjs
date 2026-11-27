// Complétude des types de blocs (src/js/03-types-de-blocs.js et familles 06-bloc-*.js) : chaque type inscrit dans T porte
// ce que les points d'entrée communs lisent. Obligatoires : label, ic, desc, kw, make, rendu, elements. Facultatives :
// office, reglages, normaliser, libelle, chacune présente ou déclarée absente dans sans: [...].
// STRICT = false tant que des familles restent à migrer (repli sur les anciens case) : rendu, elements et une facette
// facultative ni présente ni déclarée sont listés sans échec. Le ticket 08 passe STRICT à true.
import { contexte, test, vrai } from './commun.mjs';

const STRICT = false;
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
  if (STRICT) vrai(!manques.length, 'facettes manquantes :\n  ' + manques.join('\n  '));
  else if (manques.length) {
    const migres = Object.keys(ctx.T).filter((type) => !manques.some((m) => m.startsWith(type + ' :')));
    console.log(`complétude (tolérant) : ${manques.length} manques dans ${Object.keys(ctx.T).length - migres.length} types non migrés` + (migres.length ? ` ; migrés : ${migres.join(', ')}` : ''));
  }
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
