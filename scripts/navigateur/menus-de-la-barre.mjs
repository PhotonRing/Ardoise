// Sujet : toutes les fenêtres de la barre de mise en forme (palettes de teinte, sélecteurs d'un bloc texte), en large et
// en étroit. Chaque bouton de la barre et de chaque fenêtre garde son libellé entier et ses icônes centrées en hauteur.
// Origine : rétrospective du lot 4b (c51, c62, c65 et une interruption : fenêtres « ratatinées », icônes calées en haut,
// trouvées à la main parce que chaque sujet ne mesurait que sa propre fenêtre). Une nouvelle fenêtre de la barre est
// couverte d'office : le sujet ouvre tout bouton de la barre qui ouvre une fenêtre.
import { LIBELLE_ENTIER, encreCentree } from './outils/mesures.mjs';

const DOC = { title: 'Menus', pages: [{ id: 'p1', title: 'Accueil', blocks: [{ id: 't1', type: 'texte', lignes: [{ html: 'une ligne de texte' }, { html: 'une autre ligne' }] }] }] };
const SELECTIONNER = `(() => { const el = document.querySelector('.fld[data-b="t1"]'); el.focus({ preventScroll: true });
  const lg = el.querySelectorAll('.lg'), r = document.createRange(); r.setStart(lg[0].firstChild, 0); r.setEnd(lg[1].firstChild, 3);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); return s.toString(); })()`;
const CENTRE = (sel) => `(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || !b.getClientRects().length) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`;
// boutons de la barre qui ouvrent une fenêtre (« ouvrir » est le bouton Aa de la fenêtre étroite)
const A_FENETRE = ['couleur', 'surlignage', 'genre', 'align', 'taille'];

export const nom = 'fenêtres de la barre de mise en forme';
export default async function ({ ecran, charger, evalue, cdp, attendre, visibles, mesure, echec }) {
  const clic = async (p) => { for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 }); await attendre(150); };
  const mesurer = async (ou, sel) => {
    mesure();
    // un bouton de la barre qui ne montre que son icône garde son libellé dans .bmf-cache, hors de la mesure du libellé
    const coupes = (await visibles(sel.replace(' button', ' button:not(:has(.bmf-cache))'), LIBELLE_ENTIER)).filter((x) => x);
    if (coupes.length) echec(`${ou} : libellés coupés ` + JSON.stringify(coupes));
    const decales = (await encreCentree({ cdp, evalue }, sel)).filter((x) => x);
    if (decales.length) echec(`${ou} : icônes décentrées ` + JSON.stringify(decales));
  };
  for (const [largeur, mobile] of [[1000, false], [400, true]]) {
    await ecran(largeur, mobile);
    await charger();
    if (!(await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`))) throw new Error('document refusé');
    await attendre(120);
    await evalue(SELECTIONNER); await attendre(200);
    const ouvrir = await evalue(CENTRE('.bmf [data-mf="ouvrir"]'));
    if (ouvrir) await clic(ouvrir);
    await mesurer(`barre à ${largeur} px`, '.bmf button');
    const cles = (await visibles('.bmf [data-mf]', 'return x.dataset.mf')).filter((k) => A_FENETRE.includes(k));
    if (cles.length !== A_FENETRE.length) echec(`barre à ${largeur} px : fenêtres trouvées ${JSON.stringify(cles)} au lieu de ${JSON.stringify(A_FENETRE)}`);
    for (const k of cles) {
      const b = await evalue(CENTRE(`.bmf [data-mf="${k}"]`));
      await clic(b);
      if (!(await visibles('.pop button')).length) { echec(`fenêtre ${k} à ${largeur} px : ne s'ouvre pas`); continue; }
      await mesurer(`fenêtre ${k} à ${largeur} px`, '.pop button');
      await clic(b);   // le même bouton la referme
    }
  }
}
