// Sujet : menu de bloc collant. Sur un bloc plus haut que l'écran, le menu du bloc reste visible sous le haut d'écran
// (barre du haut, puis onglets de pages collés en édition), sans le chevaucher ni descendre sous le bas du bloc,
// et la ligne du curseur ne reste pas cachée dessous. Origine : spec saisie-et-tableaux, élément 41.

// document : un paragraphe, un tableau de 80 lignes, un paragraphe ; le tableau est bien plus haut que l'écran
const CHARGER = `(() => {
  const d = JSON.parse(JSON.stringify(window.ardoise.doc)), rows = [['Ville', 'Pays', 'Note']];
  for (let i = 1; i <= 80; i++) rows.push(['Ville ' + i, 'Pays ' + i, 'Note ' + i]);
  d.pages[0].blocks = [{ id: 'avant', type: 'p', html: 'Un paragraphe court au-dessus du tableau.' },
    { id: 'tab', type: 'table', rows }, { id: 'apres', type: 'p', html: 'Un paragraphe court sous le tableau.' }];
  return window.ardoise.load(d); })()`;
// haut d'écran attendu, mesuré indépendamment du code : bas de la barre du haut et des onglets de pages s'ils sont affichés
const MESURE = `(() => {
  const vis = (e) => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0;
  const tb = document.querySelector('.tb'), on = document.querySelector('.pnav-tabs');
  const haut = Math.max(vis(tb) ? tb.getBoundingClientRect().bottom : 0, vis(on) ? on.getBoundingClientRect().bottom : 0);
  const blk = (id) => document.querySelector('.blk[data-id="' + id + '"]');
  const r = (id) => { const b = blk(id), m = b.querySelector('.blk-bar'), rb = b.getBoundingClientRect(), rm = m.getBoundingClientRect();
    // haut de la bande collée : le menu, ou la barre de mise en forme (bouton « Aa » sous 600 px) posée au-dessus quand elle ne tient pas à côté
    const bande = Math.min(rm.top, ...[...b.querySelectorAll(':scope > .collant > .bmf')].filter((x) => x.getClientRects().length).map((x) => x.getBoundingClientRect().top));
    return { haut: rb.top, bas: rb.bottom, mHaut: rm.top, mBas: rm.bottom, bHaut: bande, visible: getComputedStyle(m).visibility === 'visible' && +getComputedStyle(m).opacity === 1 }; };
  return { haut, tb: tb.getBoundingClientRect().bottom, tab: r('tab'), avant: r('avant') }; })()`;
const FOCUS = (ligne) => `(() => { const c = document.querySelector('.blk[data-id="tab"] tbody tr:nth-child(${ligne}) td'); c.focus({ preventScroll: true });
  const s = getSelection(), rg = document.createRange(); rg.selectNodeContents(c); rg.collapse(false); s.removeAllRanges(); s.addRange(rg); return true; })()`;
// défile pour que le haut du tableau soit à y px du haut de la fenêtre
const DEFILER = (y) => `(() => { const b = document.querySelector('.blk[data-id="tab"]'); scrollBy(0, b.getBoundingClientRect().top - (${y})); return true; })()`;

// numéro de la ligne du tableau cachée sous le menu collé, 0 s'il n'y en a pas
const SOUS_MENU = `(() => { const m = document.querySelector('.blk[data-id="tab"] .blk-bar').getBoundingClientRect();
  const tr = [...document.querySelectorAll('.blk[data-id="tab"] tbody tr')].find((t) => { const r = t.getBoundingClientRect(); return r.top < m.bottom - 2 && r.bottom > m.top + 2; });
  return tr ? [...tr.parentNode.children].indexOf(tr) + 1 : 0; })()`;
// document de blocs de texte entre des paragraphes de remplissage, pour les placer au milieu de l'écran
const TEXTES = `(() => {
  const d = JSON.parse(JSON.stringify(window.ardoise.doc)), rem = (i) => ({ id: 'r' + i, type: 'p', html: 'Remplissage ' + i + '. Texte courant pour donner de la hauteur à la page. '.repeat(6) });
  d.pages[0].blocks = [rem(1), rem(2), rem(3), { id: 'st', type: 'subtitle', html: 'Un sous-titre' }, rem(4), rem(5),
    { id: 'ss', type: 'h3', html: 'Une sous-section' }, rem(6), rem(7), { id: 'ts', type: 'h2', html: 'Un titre de section' }, rem(8), rem(9),
    { id: 'pa', type: 'p', html: 'Un paragraphe' }, rem(10), rem(11), rem(12), rem(13)];
  return window.ardoise.load(d); })()`;
// bloc au milieu de l'écran, curseur en fin de texte dans son champ
const MILIEU = (id) => `(() => { const b = document.querySelector('.blk[data-id="${id}"]'), f = b.querySelector('.fld:not(.num)');
  scrollBy(0, b.getBoundingClientRect().top - innerHeight / 2); f.focus({ preventScroll: true });
  const s = getSelection(), rg = document.createRange(); rg.selectNodeContents(f); rg.collapse(false); s.removeAllRanges(); s.addRange(rg); return true; })()`;

export const nom = 'menu collant';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const pres = (a, b) => Math.abs(a - b) <= 1;
  for (const [w, mobile] of [[360, true], [1000, false]]) {
    const cas = `${w} px ${mobile ? 'mobile' : 'bureau'}`;
    await ecran(w, mobile);
    await charger(); await evalue(CHARGER); await attendre(100);
    await evalue(FOCUS(3)); await attendre(250);

    // tableau défilé : son haut est 600 px au-dessus de la fenêtre
    await evalue(DEFILER(-600)); await attendre(100);
    let o = await evalue(MESURE); mesure();
    if (!o.tab.visible) echec(`${cas} : menu du tableau invisible après défilement`);
    if (!pres(o.tab.bHaut, o.haut)) echec(`${cas} : bande collée (menu, barre de mise en forme) à ${o.tab.bHaut.toFixed(1)} px, attendu contre le haut d'écran (${o.haut.toFixed(1)} px)`);
    if (o.tab.mHaut < o.tb - 0.5) echec(`${cas} : menu qui chevauche la barre du haut (${o.tab.mHaut.toFixed(1)} < ${o.tb.toFixed(1)})`);

    // bas du tableau presque atteint : le menu ne descend pas sous le bas du bloc
    await evalue(DEFILER(`-(b.getBoundingClientRect().height - ${o.haut} - 10)`)); await attendre(100);
    o = await evalue(MESURE); mesure();
    if (o.tab.mBas > o.tab.bas + 0.5) echec(`${cas} : menu sous le bas du bloc (${o.tab.mBas.toFixed(1)} > ${o.tab.bas.toFixed(1)})`);

    // retour en haut : le menu reprend sa place au-dessus du bloc ; le bloc court garde le sien
    await evalue('scrollTo(0, 0), true'); await attendre(100);
    o = await evalue(MESURE); mesure();
    if (!pres(o.tab.mHaut, o.tab.haut - 33)) echec(`${cas} : menu du tableau pas revenu au-dessus du bloc (${o.tab.mHaut.toFixed(1)}, bloc à ${o.tab.haut.toFixed(1)})`);
    if (o.avant.mBas > o.avant.haut + 0.5) echec(`${cas} : menu du bloc court plus bas que le haut du bloc`);

    // curseur sous le menu collant : après un déplacement du curseur, sa ligne est dégagée
    await evalue(DEFILER(-600)); await attendre(100);
    const sous = await evalue(`(() => { const m = document.querySelector('.blk[data-id="tab"] .blk-bar').getBoundingClientRect();
      const tr = [...document.querySelectorAll('.blk[data-id="tab"] tbody tr')].find((t) => { const r = t.getBoundingClientRect(); return r.top < m.bottom - 2 && r.bottom > m.top + 2; });
      return tr ? [...tr.parentNode.children].indexOf(tr) + 1 : 0; })()`);
    if (!sous) echec(`${cas} : aucune ligne sous le menu collant pour l'essai du curseur`);
    else {
      await evalue(FOCUS(sous)); await attendre(150);
      const c = await evalue(`(() => { const m = document.querySelector('.blk[data-id="tab"] .blk-bar').getBoundingClientRect();
        const r = getSelection().getRangeAt(0).getBoundingClientRect(), td = document.activeElement.getBoundingClientRect();
        return { menu: m.bottom, ligne: r.height ? r.top : td.top }; })()`); mesure();
      if (c.ligne < c.menu - 0.5) echec(`${cas} : ligne du curseur cachée sous le menu (${c.ligne.toFixed(1)} < ${c.menu.toFixed(1)})`);
    }

    // hauteur lue à l'exécution : une barre du haut plus haute déplace le menu collant
    await evalue(`(() => { const s = document.createElement('style'); s.textContent = '.tb{height:80px!important}html.is-edit.nav-tabs .pnav-tabs{top:80px!important}'; document.head.appendChild(s); dispatchEvent(new Event('resize')); return true; })()`);
    await attendre(150); await evalue(DEFILER(-600)); await attendre(100);
    o = await evalue(MESURE); mesure();
    if (!pres(o.tab.bHaut, o.haut)) echec(`${cas}, barre du haut de 80 px : bande collée à ${o.tab.bHaut.toFixed(1)} px, attendu ${o.haut.toFixed(1)} px`);
  }

  // frappe dans un bloc au milieu de l'écran : sa barre est à sa place normale, la page ne défile pas
  // (origine : spec copie-office-style, ticket 1 ; la page remontait d'1 px par frappe dans un Sous-titre ou une Sous-section)
  for (const [w, mobile] of [[360, true], [1000, false]]) {
    const cas = `${w} px ${mobile ? 'mobile' : 'bureau'}`;
    await ecran(w, mobile);
    await charger(); await evalue(TEXTES); await attendre(100);
    for (const [id, nomBloc] of [['st', 'un Sous-titre'], ['ss', 'une Sous-section'], ['ts', 'un Titre de section'], ['pa', 'un paragraphe']]) {
      await evalue(MILIEU(id)); await attendre(100);
      const avant = await evalue('scrollY');
      for (const c of 'abcdef') { await cdp('Input.insertText', { text: c }); await attendre(40); }
      await attendre(100);
      const apres = await evalue('scrollY'); mesure();
      if (apres !== avant) echec(`${cas} : taper dans ${nomBloc} fait défiler la page (scrollY ${avant} → ${apres})`);
    }

    // simple défilement : la ligne du curseur passe sous le menu collé du tableau, aucun dégagement sans mouvement du curseur
    await evalue(CHARGER); await attendre(100);
    await evalue(DEFILER(-600)); await attendre(100);
    const sous = await evalue(SOUS_MENU);
    if (!sous) { echec(`${cas} : aucune ligne sous le menu collant pour l'essai du simple défilement`); continue; }
    await evalue(DEFILER(0)); await attendre(100);
    await evalue(FOCUS(sous)); await attendre(150);
    await evalue(DEFILER(-600)); await attendre(100);
    const voulu = await evalue('scrollY'); await attendre(150);
    const obtenu = await evalue('scrollY'); mesure();
    if (obtenu !== voulu) echec(`${cas} : le simple défilement déplace la page pour dégager le curseur (scrollY ${voulu} → ${obtenu})`);
  }
}
