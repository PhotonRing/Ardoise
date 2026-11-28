// Complétude des types de blocs (inscriptions T des familles 06-bloc-*.js) : chaque type de ORDER est inscrit et chaque inscription
// porte label, ic, desc, kw, make, rendu, elements ; office, reglages, normaliser, libelle sont présentes ou déclarées absentes dans
// sans: [...] ; saisie (facultative, jamais dans sans) est un objet de gestionnaires par évènement. Le retour d'un ancien aiguillage (switch par type, OFFICE_RENDUS, 09-office-*.js) est refusé par scripts/check.mjs.
import { contexte, test, vrai } from './commun.mjs';

const NOMS = ['label', 'ic', 'desc', 'kw', 'make'];
const OBLIGATOIRES = ['rendu', 'elements'];
const FACULTATIVES = ['office', 'reglages', 'normaliser', 'libelle'];
const SAISIE = ['input', 'change', 'keydown', 'scroll', 'focusout', 'champ'];

// manques d'une inscription : noms, facettes obligatoires, absences non déclarées, déclarations fautives ; [] si elle est complète
export function manquesDe(type, t) {
  const manques = [], sans = t.sans || [];
  for (const k of NOMS) if (k === 'make' ? typeof t[k] !== 'function' : typeof t[k] !== 'string' || (k !== 'kw' && !t[k])) manques.push(type + ' : ' + k + ' manquant');
  if (!Array.isArray(sans)) manques.push(type + ' : sans doit être une liste');
  else for (const k of sans) {
    if (!FACULTATIVES.includes(k)) manques.push(type + ' : sans « ' + k + ' » n\'est pas une facette facultative');
    else if (typeof t[k] === 'function') manques.push(type + ' : ' + k + ' présente et déclarée absente');
  }
  for (const k of OBLIGATOIRES) if (typeof t[k] !== 'function') manques.push(type + ' : ' + k);
  for (const k of FACULTATIVES) if (typeof t[k] !== 'function' && !(Array.isArray(sans) && sans.includes(k))) manques.push(type + ' : ' + k + ' (ni présente ni déclarée absente)');
  if (t.saisie !== undefined) {
    if (!t.saisie || typeof t.saisie !== 'object') manques.push(type + ' : saisie doit être un objet');
    else for (const k of Object.keys(t.saisie)) {
      if (!SAISIE.includes(k)) manques.push(type + ' : saisie « ' + k + ' » n\'est pas un évènement de saisie');
      else if (typeof t.saisie[k] !== 'function') manques.push(type + ' : saisie.' + k + ' n\'est pas une fonction');
    }
  }
  return manques;
}

test('complétude : chaque type de ORDER est inscrit dans T', () => {
  const ctx = contexte();
  for (const t of ctx.ORDER) vrai(ctx.T[t], 'type du menu sans inscription : ' + t);
});

test('complétude : chaque inscription de T porte ses noms, ses facettes obligatoires et ses absences déclarées', () => {
  const ctx = contexte(), manques = Object.keys(ctx.T).flatMap((type) => manquesDe(type, ctx.T[type]));
  vrai(!manques.length, 'inscriptions incomplètes :\n  ' + manques.join('\n  '));
});

// le banc lui-même : une inscription fautive est bien signalée
test('complétude : une inscription fautive est signalée', () => {
  const f = () => {};
  const ok = manquesDe('x', { label: 'X', ic: 'X', desc: 'X', kw: '', make: f, rendu: f, elements: f, office: f, sans: ['reglages', 'normaliser', 'libelle'], saisie: { input: f, champ: f } });
  vrai(!ok.length, 'inscription complète refusée : ' + JSON.stringify(ok));
  const ko = manquesDe('x', { label: 'X', ic: 'X', desc: 'X', kw: '', make: f, rendu: f, office: f, sans: ['office', 'rendu'] });
  for (const re of [/office présente et déclarée absente/, /« rendu »/, /^x : elements$/, /x : reglages \(ni présente/])
    vrai(ko.some((m) => re.test(m)), 'manque non signalé (' + re + ') : ' + JSON.stringify(ko));
  // facette saisie : clé inconnue, valeur qui n'est pas une fonction, facette qui n'est pas un objet, déclarée dans sans
  const base = { label: 'X', ic: 'X', desc: 'X', kw: '', make: f, rendu: f, elements: f, office: f, sans: ['reglages', 'normaliser', 'libelle'] };
  const ks = manquesDe('x', { ...base, saisie: { clic: f, keydown: 'f' } });
  for (const re of [/saisie « clic » n'est pas un évènement/, /saisie\.keydown n'est pas une fonction/])
    vrai(ks.some((m) => re.test(m)), 'manque non signalé (' + re + ') : ' + JSON.stringify(ks));
  vrai(manquesDe('x', { ...base, saisie: f }).some((m) => /saisie doit être un objet/.test(m)), 'saisie fonction non signalée');
  vrai(manquesDe('x', { ...base, sans: [...base.sans, 'saisie'] }).some((m) => /« saisie » n'est pas une facette facultative/.test(m)), 'saisie dans sans non signalée');
});
