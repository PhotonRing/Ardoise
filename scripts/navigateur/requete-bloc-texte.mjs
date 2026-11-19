// Sujet : cases d'un bloc texte dans une requête « cases à cocher ». Cocher depuis le résultat met à jour le bloc (une étape,
// Ctrl+Z la défait, décochée sans laisser done) ; le lien vers la source mène au bloc texte, sur une autre page, en édition
// comme en lecture. Vérifié par le document enregistré (window.ardoise.doc) et par ce qui est visible. Origine : spec bloc-texte, ticket 10.

const P = (n) => '<span class="pill">' + n + '</span>';
const LIGNES = [{ html: 'Serveurs' }, { html: 'Sauvegardes ' + P('Prod'), genre: 'case', lv: 1 }, { html: 'Restauration', genre: 'case', lv: 2 }];
const DOC = { title: 'Cases', pages: [
  { id: 'p1', title: 'Accueil', blocks: [{ id: 'q', type: 'query', title: 'À faire', src: 'check', scope: 'doc', view: 'list' }] },
  { id: 'p2', title: 'Exploitation', blocks: [
    { id: 'h', type: 'h2', html: 'Serveurs' },
    { id: 'f', type: 'texte', lignes: Array.from({ length: 60 }, (_, i) => ({ html: 'Ligne de remplissage ' + (i + 1) })) },
    { id: 't', type: 'texte', lignes: LIGNES },
    { id: 'f2', type: 'texte', lignes: Array.from({ length: 60 }, (_, i) => ({ html: 'Suite ' + (i + 1) })) },
  ] },
] };
const MODE = `document.documentElement.classList.contains('is-edit')`;
const BOITE = `.q-res button.q-box[data-qchk$="|t|lignes.2.done"]`;
const LIEN = `.q-res a.q-src[href="#pg-p2/t"]`;
const LIGNES_T = `JSON.stringify(window.ardoise.doc.pages[1].blocks.find((b) => b.id === 't').lignes)`;
// bloc texte affiché : page courante, haut du bloc dans l'écran, coche de la ligne 2 à l'écran
const BLOC = `(() => { const el = document.querySelector('.blk[data-id="t"]') || document.getElementById('b-t'); if (!el) return null;
  const lg = el.querySelectorAll('.lg')[2], r = el.getBoundingClientRect();
  return { cur: window.ardoise.doc.cur, haut: Math.round(r.top), coche: !!lg && lg.hasAttribute('data-done') }; })()`;

export const nom = 'cases d\'un bloc texte dans une requête';
export default async function ({ ecran, charger, evalue, cdp, attendre, visibles, mesure, echec }) {
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  const touche = async (key, code, vk, modifiers = 0) => {
    for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers });
    await attendre(100);
  };
  // vrai clic de souris au centre d'un élément, ramené au milieu de l'écran au besoin
  const cliquer = async (sel) => {
    const p = await evalue(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!p) { echec('introuvable : ' + sel); return; }
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
    await attendre(200);
  };
  const lignes = async () => JSON.parse(await evalue(LIGNES_T));
  const charge = async (edition) => {
    if (!(await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`))) throw new Error('document refusé');
    await attendre(150);
    if ((await evalue(MODE)) !== edition) { await evalue(`document.querySelector('#ui [data-ui="mode"]').click()`); await attendre(150); }
    // la page affichée peut être retenue d'un chargement précédent : retour à l'accueil, où est la requête
    if (await evalue('window.ardoise.doc.cur')) { await evalue(`document.querySelector('[data-pg="0"]').click()`); await attendre(150); }
  };

  await ecran(1000, false);
  await charger();

  // édition : le résultat montre sa case parente ; cocher depuis la requête coche la ligne du bloc texte
  await charge(true);
  const it = await visibles('.blk[data-id="q"] .q-res li .q-it');
  attendu('édition : résultats du bloc texte avec leur parent', it.includes('Serveurs › Sauvegardes Prod') && it.includes('Sauvegardes Prod › Restauration'), it);
  await cliquer(BOITE);
  let l = await lignes();
  attendu('édition : cochée depuis la requête', l[2].done === true, l);
  attendu('édition : la case de la requête est cochée', (await evalue(`document.querySelector(${JSON.stringify(BOITE)}).getAttribute('aria-pressed')`)) === 'true', 'aria-pressed');
  await evalue(`document.activeElement && document.activeElement.blur()`);
  await touche('z', 'KeyZ', 90, 2);
  l = await lignes();
  attendu('édition : Ctrl+Z décoche', !('done' in l[2]), l);
  await cliquer(BOITE); await cliquer(BOITE);
  l = await lignes();
  attendu('édition : cochée puis décochée, sans done', !('done' in l[2]) && JSON.stringify(l) === JSON.stringify(LIGNES), l);
  await cliquer(BOITE);

  // le lien vers la source mène au bloc texte, sur sa page, coche à jour
  await cliquer(LIEN);
  let b = await evalue(BLOC);
  attendu('édition : le lien mène au bloc texte', b && b.cur === 1 && b.haut >= -2 && b.haut < 150 && b.coche, b);

  // lecture : cocher depuis la requête et suivre le lien
  await charge(false);
  await cliquer(BOITE);
  l = await lignes();
  attendu('lecture : cochée depuis la requête', l[2].done === true, l);
  await cliquer(LIEN);
  b = await evalue(BLOC);
  attendu('lecture : le lien mène au bloc texte', b && b.cur === 1 && b.haut >= -2 && b.haut < 150 && b.coche, b);
  attendu('lecture : la ligne cochée est visible', (await visibles('#b-t .lg[data-done]')).join('|') === 'Restauration', await visibles('#b-t .lg[data-done]'));
}
