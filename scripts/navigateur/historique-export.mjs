// Sujet : Précédent et Suivant dans l'export statique (spec pages-et-fichiers, élément 49, user story 86). Le document est
// exporté depuis l'éditeur, enregistré puis ouvert en file:// comme chez le propriétaire, et parcouru comme dans
// historique-pages.mjs : pages, lien vers une section, section de la barre latérale, retour, ouverture sur une adresse.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const long = (p) => Array.from({ length: 40 }, (_, k) => ({ id: p + 'x' + k, type: 'p', html: 'Ligne ' + k + ' de la page ' + p + ', assez longue pour remplir la largeur de la colonne de lecture.' }));
const DOC = {
  title: 'Carnet', pages: [
    { id: 'p1', blocks: [{ id: 'h1', type: 'header', title: 'Accueil' }, { id: 'a1', type: 'p', html: 'Début' }].concat(long('p1')) },
    { id: 'p2', blocks: [{ id: 'h2', type: 'header', title: 'Suite' }, { id: 'l2', type: 'p', html: 'Aller à <a href="#pg-p3/s3">la section</a>' }].concat(long('p2')) },
    { id: 'p3', blocks: [{ id: 'h3', type: 'header', title: 'Fin' }, { id: 'l3', type: 'p', html: 'Plus bas : <a href="#pg-p3/s3">la section</a>' }].concat(long('p3'),
      [{ id: 's3', type: 'h2', html: 'Section visée' }, { id: 'y3', type: 'p', html: 'Sous la section' }], long('p3b')) }] };

// page visible (identifiant), adresse, défilement, nombre d'entrées
const ETAT = `({ pg: (document.querySelector('.pg:not([hidden])') || {}).dataset?.pgid, h: location.hash, y: Math.round(scrollY), n: history.length })`;
const GUET = `(() => { window.__min = Infinity; window.addEventListener('scroll', () => { window.__min = Math.min(window.__min, scrollY); }); return true; })()`;
const cliquer = (sel) => `(() => { const a = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => e.offsetParent !== null); a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; })()`;
const HAUT_SECTION = `Math.round(document.getElementById('b-s3').getBoundingClientRect().top)`;

export const nom = 'historique de l\'export';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const attendu = (cas, cond, detail) => { mesure(); if (!cond) echec(`${cas} : ${JSON.stringify(detail)}`); };
  const etat = () => evalue(ETAT);
  const retour = async (sens) => { await evalue(`window.__min = Infinity; history.${sens}(); true`); await attendre(250); return etat(); };

  // export depuis l'éditeur : le fichier téléchargé est lu au passage
  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(50);
  const html = await evalue(`new Promise((r) => {
    const o = URL.createObjectURL; URL.createObjectURL = (b) => { URL.createObjectURL = o; b.text().then(r); return o.call(URL, b); };
    const v = document.querySelector('[data-ui=vmenu]');   // menu Lecture, ou menu Fichier en édition
    if (v && v.offsetParent !== null) { v.click(); document.querySelector('.pop [data-vm=export]').click(); }
    else { document.querySelector('[data-ui=file]').click(); document.querySelector('.pop [data-f=export]').click(); } })`);
  attendu('export : page statique produite', /class="pg"/.test(html), html.slice(0, 200));

  const dir = mkdtempSync(join(tmpdir(), 'ardoise-export-'));
  try {
    const f = join(dir, 'carnet-lecture.html'); writeFileSync(f, html);
    const ouvrir = async (hash) => {
      await cdp('Page.navigate', { url: 'about:blank' }); await attendre(50);
      await cdp('Page.navigate', { url: 'file://' + f + hash });
      for (let i = 0; i < 100; i++) { await attendre(50); if (await evalue('!!document.querySelector(".pg") && document.readyState === "complete"')) break; }
      await attendre(100);
      return etat();
    };
    const e0 = await ouvrir('');
    await evalue(GUET);
    attendu('ouverture : première page', e0.pg === 'p1', e0);

    // page 2 par la navigation : une entrée, adresse #pg-p2, haut de page
    await evalue('scrollTo(0, 300); true'); await attendre(250);
    await evalue(cliquer('[data-pg="1"]')); await attendre(100);
    const e1 = await etat();
    attendu('page 2 par la navigation : une entrée, adresse #pg-p2, haut de page', e1.pg === 'p2' && e1.h === '#pg-p2' && e1.n === e0.n + 1 && e1.y === 0, { e0, e1 });

    // lien vers une section d'une autre page : une seule entrée, adresse de la section, section en haut
    await evalue('scrollTo(0, 600); true'); await attendre(250);
    await evalue(cliquer('#b-l2 a, [data-id="l2"] a, .pg:not([hidden]) a[href="#pg-p3/s3"]')); await attendre(150);
    const e2 = await etat(), s2 = await evalue(HAUT_SECTION);
    attendu('lien vers la section : une entrée, adresse #pg-p3/s3, section en haut', e2.pg === 'p3' && e2.h === '#pg-p3/s3' && e2.n === e1.n + 1 && Math.abs(s2) < 120, { e2, s2 });

    // Précédent et Suivant : page et défilement rétablis, sans passer par le haut
    const r1 = await retour('back');
    attendu('Précédent : page 2 à 600 px', r1.pg === 'p2' && r1.h === '#pg-p2' && Math.abs(r1.y - 600) < 2, r1);
    const min1 = await evalue('window.__min');
    attendu('Précédent : pas de passage par le haut de la page', min1 === Infinity || min1 > 500, min1);
    const r2 = await retour('back');
    attendu('Précédent : page 1 à 300 px', r2.pg === 'p1' && Math.abs(r2.y - 300) < 2, r2);
    const r3 = await retour('forward');
    attendu('Suivant : page 2 à 600 px', r3.pg === 'p2' && Math.abs(r3.y - 600) < 2, r3);
    const r4 = await retour('forward'), s4 = await evalue(HAUT_SECTION);
    attendu('Suivant : page 3, section en haut', r4.pg === 'p3' && r4.h === '#pg-p3/s3' && Math.abs(s4) < 120, { r4, s4 });

    // section de la barre latérale, depuis une autre page : la page s'ouvre, la section défile, une entrée
    await evalue(cliquer('[data-pg="0"]')); await attendre(100);
    const b0 = await etat();
    await evalue(`(() => { const a = document.querySelector('.pnav-side a[data-sec="s3"]'); a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; })()`); await attendre(150);
    const b1 = await etat(), sb = await evalue(HAUT_SECTION);
    attendu('section de la barre latérale sur une autre page : page 3, section en haut, une entrée', b1.pg === 'p3' && b1.h === '#pg-p3/s3' && b1.n === b0.n + 1 && Math.abs(sb) < 120, { b0, b1, sb });
    const b2 = await retour('back');
    attendu('Précédent : retour en page 1', b2.pg === 'p1' && b2.h === '#pg-p1', b2);

    // ouverture sur une adresse : ancienne forme #p2, section, page supprimée
    const o1 = await ouvrir('#p2');
    attendu('ouverture sur #p2 : deuxième page', o1.pg === 'p2', o1);
    const o2 = await ouvrir('#pg-p3/s3'), so2 = await evalue(HAUT_SECTION);
    attendu('ouverture sur #pg-p3/s3 : page 3, section en haut', o2.pg === 'p3' && Math.abs(so2) < 120, { o2, so2 });
    const o3 = await ouvrir('#pg-supprimee');
    attendu('ouverture sur une page supprimée : première page', o3.pg === 'p1', o3);

    // dans une iframe : la page change sans entrée d'historique
    await ouvrir('');
    const n0 = await evalue('history.length');
    await evalue(`new Promise((r) => { const i = document.createElement('iframe'); i.style.cssText = 'width:900px;height:600px'; i.onload = () => r(true); i.src = ${JSON.stringify('file://' + f)}; document.body.appendChild(i); })`);
    await attendre(300);
    await evalue(`(() => { const w = document.querySelector('iframe').contentWindow; const b = [...w.document.querySelectorAll('[data-pg="1"]')].find((e) => e.offsetParent !== null); b.click(); return true; })()`); await attendre(150);
    const c = await evalue(`({ n: history.length, pg: document.querySelector('iframe').contentWindow.document.querySelector('.pg:not([hidden])').dataset.pgid })`);
    attendu('dans une iframe : la page change sans entrée d\'historique', c.pg === 'p2' && c.n === n0, { n0, c });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
