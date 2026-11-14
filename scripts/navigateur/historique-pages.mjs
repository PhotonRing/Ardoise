// Sujet : Précédent et Suivant dans l'éditeur (spec pages-et-fichiers, élément 49). Chaque changement de page voulu et chaque
// saut vers une section créent une entrée d'historique ; Précédent ramène à la page d'avant, à la même position de défilement,
// sans passer par le haut ; l'adresse est #pg-<page> ou #pg-<page>/<bloc>. Annulation, bascule de mode : aucune entrée.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const long = (p) => Array.from({ length: 40 }, (_, k) => ({ id: p + 'x' + k, type: 'p', html: 'Ligne ' + k + ' de la page ' + p + ', assez longue pour remplir la largeur de la colonne de lecture.' }));
const DOC = {
  title: 'Carnet', pages: [
    { id: 'p1', blocks: [{ id: 'h1', type: 'header', title: 'Accueil' }, { id: 'a1', type: 'p', html: 'Début' }].concat(long('p1')) },
    { id: 'p2', blocks: [{ id: 'h2', type: 'header', title: 'Suite' }, { id: 'l2', type: 'p', html: 'Aller à <a href="#pg-p3/s3">la section</a>' }].concat(long('p2')) },
    { id: 'p3', blocks: [{ id: 'h3', type: 'header', title: 'Fin' }, { id: 'l3', type: 'p', html: 'Plus bas : <a href="#pg-p3/s3">la section</a>' }].concat(long('p3'),
      [{ id: 's3', type: 'h2', html: 'Section visée' }, { id: 'y3', type: 'p', html: 'Sous la section' }], long('p3b')) }] };

// état observé : page affichée (identifiant), adresse, défilement, nombre d'entrées
const ETAT = `({ pg: window.ardoise.doc.pages[window.ardoise.doc.cur].id, h: location.hash, y: Math.round(scrollY), n: history.length })`;
// plus petit défilement vu entre le geste et la fin du retour : un retour net ne repasse pas par le haut de la page
const GUET = `(() => { window.__min = Infinity; window.addEventListener('scroll', () => { window.__min = Math.min(window.__min, scrollY); }); return true; })()`;
const lien = (sel, ctrl) => `(() => { const a = document.querySelector(${JSON.stringify(sel)}); a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: ${!!ctrl} })); return true; })()`;
const cliquerPage = (i) => `(() => { const b = [...document.querySelectorAll('[data-pg="${i}"]')].find((e) => e.offsetParent !== null); b.click(); return true; })()`;
const touche = (key, mods) => `document.dispatchEvent(new KeyboardEvent('keydown', { key: '${key}', bubbles: true, cancelable: true, ${mods} }))`;

export const nom = 'historique des pages';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const attendu = (cas, cond, detail) => { mesure(); if (!cond) echec(`${cas} : ${JSON.stringify(detail)}`); };
  const etat = () => evalue(ETAT);
  const retour = async (sens) => { await evalue(`window.__min = Infinity; history.${sens}(); true`); await attendre(250); return etat(); };

  await ecran(1000, false);
  // l'historique de l'onglet plafonne à 50 entrées : les sujets d'avant ne doivent pas l'avoir rempli
  await cdp('Page.resetNavigationHistory');
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(50);
  await evalue(GUET);
  const e0 = await etat();
  attendu('chargé sur la première page', e0.pg === 'p1', e0);

  // barre latérale ou onglets : une entrée, adresse #pg-
  await evalue('scrollTo(0, 300); true'); await attendre(50);
  await evalue(cliquerPage(1)); await attendre(100);
  const e1 = await etat();
  attendu('page 2 par la navigation : une entrée, adresse #pg-p2, haut de page', e1.pg === 'p2' && e1.h === '#pg-p2' && e1.n === e0.n + 1 && e1.y === 0, e1);

  // lien vers une section d'une autre page (Ctrl+clic en édition) : une seule entrée, adresse de la section
  await evalue('scrollTo(0, 600); true'); await attendre(50);
  await evalue(lien('.blk[data-id="l2"] a', true)); await attendre(150);
  const e2 = await etat();
  attendu('lien vers la section : une entrée, adresse #pg-p3/s3', e2.pg === 'p3' && e2.h === '#pg-p3/s3' && e2.n === e1.n + 1, e2);
  const sec = await evalue(`Math.round(document.querySelector('.blk[data-id="s3"]').getBoundingClientRect().top)`);
  attendu('lien vers la section : la section est en haut de l\'écran', Math.abs(sec) < 120, sec);

  // Précédent : page 2 à 600 px, sans passer par le haut
  const r1 = await retour('back');
  attendu('Précédent : page 2, adresse #pg-p2, défilement rétabli', r1.pg === 'p2' && r1.h === '#pg-p2' && Math.abs(r1.y - 600) < 2 && r1.n === e2.n, r1);
  const min1 = await evalue('window.__min');
  attendu('Précédent : pas de passage par le haut de la page', min1 === Infinity || min1 > 500, min1);
  const r2 = await retour('back');
  attendu('Précédent : page 1, défilement de départ', r2.pg === 'p1' && Math.abs(r2.y - 300) < 2, r2);
  const r3 = await retour('forward');
  attendu('Suivant : page 2 à 600 px', r3.pg === 'p2' && Math.abs(r3.y - 600) < 2, r3);
  const r4 = await retour('forward');
  const sec4 = await evalue(`Math.round(document.querySelector('.blk[data-id="s3"]').getBoundingClientRect().top)`);
  attendu('Suivant : page 3, adresse de la section, section en haut', r4.pg === 'p3' && r4.h === '#pg-p3/s3' && Math.abs(sec4) < 120, { r4, sec4 });

  // saut vers une section de la même page, depuis l'adresse de la page : une entrée ; Précédent remonte au point de départ
  await evalue(cliquerPage(1)); await attendre(100); await evalue(cliquerPage(2)); await attendre(100);
  const avant = await etat();
  await evalue(lien('.blk[data-id="l3"] a', true)); await attendre(600);
  const e5 = await etat();
  attendu('section de la même page : une entrée', avant.h === '#pg-p3' && e5.n === avant.n + 1 && e5.h === '#pg-p3/s3' && e5.y > 500, { avant, e5 });
  const r5 = await retour('back');
  attendu('Précédent après un saut sur la même page : haut de la page 3', r5.pg === 'p3' && r5.y < 2, r5);

  // section de la barre latérale, puis la même section ou le lien vers elle : une seule entrée
  const secLat = `(() => { document.querySelector('.pnav-side a[data-sec="s3"]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; })()`;
  await evalue(secLat); await attendre(150);
  const d1 = await etat();
  attendu('section de la barre latérale : adresse de la section', d1.h === '#pg-p3/s3', { r5, d1 });
  await evalue(secLat); await attendre(150);
  await evalue(lien('.blk[data-id="l3"] a', true)); await attendre(150);
  const d2 = await etat();
  attendu('même section une deuxième fois (barre latérale, lien) : pas d\'entrée en double', d2.h === '#pg-p3/s3' && d2.n === d1.n, { d1, d2 });
  const d3 = await retour('back');
  attendu('Précédent après la même section cliquée trois fois : adresse de la page', d3.h === '#pg-p3', d3);

  // Alt+Page↓ : un changement de page voulu, une entrée
  const a0 = await etat();
  await evalue(touche('PageUp', 'altKey: true')); await attendre(100);
  const a1 = await etat();
  attendu('Alt+Page↑ : page 2, adresse #pg-p2', a1.pg === 'p2' && a1.h === '#pg-p2', { a0, a1 });
  const a2 = await retour('back');
  attendu('Alt+Page↑ a créé une entrée : Précédent revient en page 3', a2.pg === 'p3', a2);
  await retour('forward');

  // Ctrl+E (lecture puis édition) et Ctrl+Z : aucune entrée
  const b0 = await etat();
  await evalue(touche('e', 'ctrlKey: true')); await attendre(100);
  await evalue(touche('e', 'ctrlKey: true')); await attendre(100);
  const b1 = await etat();
  attendu('Ctrl+E : ni entrée ni changement d\'adresse', b1.n === b0.n && b1.h === b0.h && b1.pg === b0.pg, { b0, b1 });
  await evalue(`window.ardoise.load(${JSON.stringify({ ...DOC, title: 'Carnet modifié' })})`); await attendre(50);
  await evalue(touche('z', 'ctrlKey: true')); await attendre(100);
  const b2 = await etat();
  attendu('Ctrl+Z : aucune entrée', b2.n === b0.n && b2.h === b0.h, { b0, b2 });

  // Précédent pendant la saisie : la frappe est validée (une étape à annuler) ; un menu ouvert se ferme
  await evalue(cliquerPage(0)); await attendre(100);
  await evalue(`(() => { const f = document.querySelector('.blk[data-id="a1"] [contenteditable]'); f.focus(); const r = document.createRange(); r.selectNodeContents(f); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); return true; })()`);
  await cdp('Input.insertText', { text: ' ajouté' }); await attendre(30);
  await evalue(`(() => { const m = document.querySelector('[data-pgm]'); if (m) m.click(); return true; })()`); await attendre(50);
  const s1 = await retour('back');
  const s2 = await evalue(`({ texte: window.ardoise.doc.pages[0].blocks[1].html, pop: !!document.querySelector('.pop') })`);
  attendu('Précédent pendant la saisie : page 2, saisie gardée, menu fermé', s1.pg === 'p2' && /ajouté/.test(s2.texte) && !s2.pop, { s1, s2 });
  await evalue(touche('z', 'ctrlKey: true')); await attendre(100);
  const s3 = await evalue(`window.ardoise.doc.pages[0].blocks[1].html`);
  attendu('la saisie validée par Précédent s\'annule d\'un Ctrl+Z', !/ajouté/.test(s3), s3);

  // ouverture d'un fichier sur une adresse : #p2, #pg-<page>/<bloc>, page supprimée ; dans une iframe, aucune entrée
  const page = (await evalue('location.href')).split('#')[0];
  const html = readFileSync(new URL(page)).toString('utf8').replace(/(<script id="ardoise-doc" type="application\/json">)[\s\S]*?(<\/script>)/, (_, a, b) => a + JSON.stringify(DOC) + b);
  const dir = mkdtempSync(join(tmpdir(), 'ardoise-historique-'));
  try {
    const f = join(dir, 'carnet.html'); writeFileSync(f, html);
    const ouvrir = async (hash) => {
      await cdp('Page.navigate', { url: 'about:blank' }); await attendre(50);
      await cdp('Page.navigate', { url: 'file://' + f + hash });
      for (let i = 0; i < 100; i++) { await attendre(50); if (await evalue('!!document.querySelector(".tb .doc-name") && document.readyState === "complete"')) break; }
      await attendre(100);
      return evalue(`({ pg: window.ardoise.doc.pages[window.ardoise.doc.cur].id, h: location.hash, y: Math.round(scrollY), toast: (document.querySelector('.toast') || {}).textContent || '', edit: document.documentElement.classList.contains('is-edit') })`);
    };
    const o1 = await ouvrir('#p2');
    attendu('ouverture sur #p2 : deuxième page, adresse réécrite #pg-p2', o1.pg === 'p2' && o1.h === '#pg-p2', o1);
    const o0 = await ouvrir('');
    attendu('ouverture sans adresse : adresse réécrite #pg-p1', o0.pg === 'p1' && o0.h === '#pg-p1', o0);
    const o2 = await ouvrir('#pg-p3/s3');
    const sec2 = await evalue(`Math.round(document.querySelector('[data-id="s3"], #b-s3').getBoundingClientRect().top)`);
    attendu('ouverture sur #pg-p3/s3 : page 3, section en haut', o2.pg === 'p3' && Math.abs(sec2) < 120, { o2, sec2 });
    // section déplacée vers une autre page : sa page réelle s'ouvre, l'adresse est corrigée
    const o5 = await ouvrir('#pg-p1/s3');
    const sec5 = await evalue(`Math.round(document.querySelector('[data-id="s3"], #b-s3').getBoundingClientRect().top)`);
    attendu('ouverture sur une section déplacée : sa page, section en haut, adresse corrigée', o5.pg === 'p3' && o5.h === '#pg-p3/s3' && Math.abs(sec5) < 120, { o5, sec5 });
    await ouvrir('');
    await evalue(`location.hash = '#pg-p1/s3'; true`); await attendre(250);
    const o6 = await evalue(`({ pg: window.ardoise.doc.pages[window.ardoise.doc.cur].id, h: location.hash })`);
    attendu('retour vers l\'adresse d\'une section déplacée : sa page, adresse corrigée', o6.pg === 'p3' && o6.h === '#pg-p3/s3', o6);
    const o3 = await ouvrir('#pg-supprimee');
    attendu('ouverture sur une page supprimée : première page et « Page introuvable »', o3.pg === 'p1' && /Page introuvable/.test(o3.toast), o3);
    const o4 = await ouvrir('#edit');
    attendu('ouverture sur #edit : édition, adresse gardée', o4.edit && o4.pg === 'p1' && o4.h === '#edit', o4);
    // Ardoise intégrée dans une iframe (par un autre site) : changer de page n'ajoute rien à l'historique du haut
    await ouvrir('');
    const n0 = await evalue('history.length');
    await evalue(`new Promise((r) => { const i = document.createElement('iframe'); i.style.cssText = 'width:900px;height:600px'; i.onload = () => r(true); i.src = ${JSON.stringify('file://' + f)}; document.body.appendChild(i); })`);
    await attendre(300);
    await evalue(`(() => { const w = document.querySelector('iframe').contentWindow; const b = [...w.document.querySelectorAll('[data-pg="1"]')].find((e) => e.offsetParent !== null); b.click(); return true; })()`); await attendre(150);
    const c = await evalue(`({ n: history.length, pg: (() => { const d = document.querySelector('iframe').contentWindow.ardoise.doc; return d.pages[d.cur].id; })() })`);
    attendu('dans une iframe : la page change sans entrée d\'historique', c.pg === 'p2' && c.n === n0, { n0, c });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
