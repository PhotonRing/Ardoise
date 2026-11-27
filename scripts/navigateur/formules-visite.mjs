// Sujet : formules de la visite guidée. Ouverte par le menu Fichier, l'étape « Écrire » rend ses formules en ligne, une
// commande inconnue en rouge, le bloc formule et sa définition par cas ; le titre « Des formules » rend sa formule dans le
// sommaire latéral, en édition et en lecture ; un clic sur une formule ouvre sa fenêtre, sans erreur. Origine : spec
// formules, ticket 10 (user story 55).

const ECOUTER = `(() => { window.__erreurs = []; const note = (m) => window.__erreurs.push(String(m));
  addEventListener('error', (e) => note(e.message)); addEventListener('unhandledrejection', (e) => note(e.reason && e.reason.message || e.reason)); return true; })()`;
const OUVRIR = `(() => { document.querySelector('[data-ui=file]').click(); const b = document.querySelector('[data-f="new-tour"]'); if (!b) return false; b.click(); return true; })()`;
const BASCULER = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
// sources des formules rendues (MathML annoté, de largeur non nulle) d'un sélecteur
const RENDUES = 'const m = x.querySelector("math"), a = x.querySelector("math semantics annotation"); return m && a && m.getBoundingClientRect().width > 0 ? a.textContent : "!"';
const SOMMAIRE = `[...document.querySelectorAll('.pnav-side a[data-sec]')].filter((a) => a.getClientRects().length).flatMap((a) => [...a.querySelectorAll('.formule')]
  .map((x) => { ${RENDUES} }))`;

export const nom = 'formules de la visite';
export default async function ({ ecran, charger, evalue, cdp, attendre, visibles, mesure, echec }) {
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  await ecran(1400, false);
  await charger();
  await evalue(ECOUTER);
  attendu('menu Fichier : entrée de la visite', await evalue(OUVRIR), false);
  await attendre(400);

  // édition : formules en ligne rendues, commande inconnue en rouge, bloc formule avec ses cas
  const enLigne = await visibles('.lg .formule', RENDUES);
  attendu('édition : formules en ligne rendues', ['\\sqrt{a^2 + b^2}', '\\frac{1}{2}', '\\vecteur{u} + \\sqrt{2}'].every((s) => enLigne.includes(s)) && !enLigne.includes('!'), enLigne);
  const rouge = await visibles('.formule mtext.f-err', 'return [x.textContent, getComputedStyle(x).color]');
  attendu('édition : commande inconnue en rouge', rouge.length === 1 && rouge[0][0] === '\\vecteur' && /^rgb\((\d+)/.exec(rouge[0][1])[1] > 150, rouge);
  const cas = await visibles('.blk mtable.f-cases', 'return x.getBoundingClientRect().height');
  attendu('édition : bloc formule avec sa définition par cas', cas.length === 1 && cas[0] > 20, cas);

  // sommaire latéral : la formule du titre « Des formules » est rendue, en édition puis en lecture
  attendu('édition : formule du titre dans le sommaire', JSON.stringify(await evalue(SOMMAIRE)) === '["E = mc^2"]', await evalue(SOMMAIRE));
  await evalue(BASCULER); await attendre(300);
  attendu('lecture : formule du titre dans le sommaire', JSON.stringify(await evalue(SOMMAIRE)) === '["E = mc^2"]', await evalue(SOMMAIRE));
  const lec = await visibles('.lg .formule', RENDUES);
  attendu('lecture : formules en ligne rendues', lec.includes('\\frac{1}{2}') && !lec.includes('!'), lec);
  await evalue(BASCULER); await attendre(300);

  // clic sur la formule de la phrase « Cliquez » : sa fenêtre s'ouvre avec sa source, Échap la referme
  const p = await evalue(`(() => { const f = [...document.querySelectorAll('.blk .fld .formule')].find((x) => (x.querySelector('annotation') || {}).textContent === '\\\\frac{1}{2}');
    f.scrollIntoView({ block: 'center' }); const r = f.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await attendre(150);
  for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p[0], y: p[1], button: 'left', clickCount: 1 });
  await attendre(150);
  const fen = await evalue(`(() => { const c = document.querySelector('.formule-pop [data-fsrc]'); return c && c.getClientRects().length ? c.value : null; })()`);
  attendu('clic : fenêtre de la formule avec sa source', fen === '\\frac{1}{2}', fen);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }); await attendre(150);
  attendu('Échap : fenêtre refermée', !(await evalue(`!!document.querySelector('.formule-pop')`)), true);

  const err = await evalue('JSON.stringify(window.__erreurs.splice(0))');
  attendu('aucune erreur', err === '[]', err);
}
