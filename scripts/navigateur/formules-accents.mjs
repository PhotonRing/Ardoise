// Sujet : accents des formules (\hat, \vec, \bar, \tilde, \dot, \overline). Le navigateur pose un accent au ras de la
// lettre, au point qu'on le voit mal : page.css le remonte d'au moins 0,1 em par rapport à cette position, mesurée sur une
// copie de la formule où la retouche est annulée. Origine : spec formules, ticket 11 (décision d9, remarque de c42).

const F = (s) => '<span class="formule">' + s + '</span>';
const SOURCES = ['\\hat{a}', '\\hat{A}', '\\vec{v}', '\\vec{AB}', '\\bar{x}', '\\bar{X}', '\\tilde{n}', '\\dot{x}', '\\overline{AB}'];
const DOC = { title: 'Accents', pages: [{ id: 'p1', blocks: [{ id: 't', type: 'texte', lignes: [{ html: SOURCES.map(F).join(' ') }] }] }] };

export const nom = 'accents des formules';
export default async function ({ ecran, charger, evalue, attendre, mesure, echec }) {
  await ecran(1200, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(150);
  // écart vertical entre le haut de la lettre et le haut de l'accent, dans la formule et dans sa copie sans retouche
  const r = await evalue(`(() => { const b = document.querySelector('.blk[data-id="t"]'); b.style.fontSize = '48px';
    const ecart = (m) => m.firstElementChild.getBoundingClientRect().top - m.lastElementChild.getBoundingClientRect().top;
    return [...b.querySelectorAll('.formule')].map((f) => { const m = f.querySelector('mover'), c = f.cloneNode(true); f.after(c);
      const mc = c.querySelector('mover'); mc.lastElementChild.style.padding = '0'; const o = [ecart(m), ecart(mc), parseFloat(getComputedStyle(m.lastElementChild).fontSize)]; c.remove(); return o; }); })()`);
  r.forEach((x, i) => { mesure(); if (!(x[0] - x[1] >= 0.1 * x[2] - 0.5)) echec(SOURCES[i] + ' : accent remonté de ' + (x[0] - x[1]).toFixed(1) + ' px, attendu au moins 0,1 em (' + (0.1 * x[2]).toFixed(1) + ' px)'); });
}
