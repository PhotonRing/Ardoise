// Sujet : modèle diamant à l'écran. Losange en large (Adversaire au-dessus, Infrastructure à gauche, Capacité à droite,
// Victime en dessous, traits affichés) ; sous 480 px, pile verticale Adversaire, Capacité, Infrastructure, Victime, sans débordement.
// En édition et en lecture. Origine : spec groupe-office-diamant, user stories 74 et 78.

const DOC = {
  title: 'Intrusion', pages: [{ id: 'p1', blocks: [
    { id: 'h1', type: 'header', title: 'Intrusion' },
    { id: 'd1', type: 'diamond', title: 'Campagne X', adversaire: 'APT28, groupe connu aussi sous le nom de Fancy Bear', capacite: 'Mimikatz', infrastructure: 'vpn.exemple.org et 203.0.113.7', victime: '' },
  ] }] };
const MODE = `document.documentElement.classList.contains('is-edit')`;
const BASCULER = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
// boîtes des sommets (nom → centre et bords), traits visibles, débordement de la page
const MESURE = `(() => {
  const g = document.querySelector('.dia-g'); if (!g) return null;
  const s = {}; g.querySelectorAll('.dia-s').forEach((e) => { const r = e.getBoundingClientRect(); s[e.querySelector('.dia-n').textContent] = { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
  return { s, traits: getComputedStyle(g.querySelector('.dia-traits')).display !== 'none', deborde: document.documentElement.scrollWidth - innerWidth };
})()`;

export const nom = 'modèle diamant';
export default async function ({ ecran, charger, evalue, attendre, mesure, echec }) {
  const verifier = (cas, o, large) => {
    mesure();
    if (!o) { echec(`${cas} : modèle diamant introuvable`); return; }
    const { Adversaire: a, Capacité: c, Infrastructure: i, Victime: v } = o.s;
    if (o.deborde > 0) echec(`${cas} : la page déborde de ${o.deborde} px`);
    if (large) {
      if (!(a.bottom <= i.top + 1 && a.bottom <= c.top + 1 && i.bottom <= v.top + 1 && c.bottom <= v.top + 1)) echec(`${cas} : Adversaire en haut, Victime en bas attendus ${JSON.stringify(o.s)}`);
      if (!(i.right <= a.left + 1 && a.right <= c.left + 1 && Math.abs(i.y - c.y) < 2 && Math.abs(a.x - v.x) < 2)) echec(`${cas} : Infrastructure à gauche, Capacité à droite attendues ${JSON.stringify(o.s)}`);
      if (!o.traits) echec(`${cas} : traits du losange masqués`);
    } else {
      const ordre = Object.entries(o.s).sort((x, y) => x[1].top - y[1].top).map((e) => e[0]);
      if (ordre.join() !== 'Adversaire,Capacité,Infrastructure,Victime') echec(`${cas} : ordre de la pile ${ordre}`);
      if (!(a.bottom <= c.top + 1 && c.bottom <= i.top + 1 && i.bottom <= v.top + 1 && Math.abs(a.left - v.left) < 1)) echec(`${cas} : sommets non empilés ${JSON.stringify(o.s)}`);
      if (o.traits) echec(`${cas} : traits du losange affichés dans la pile`);
    }
  };
  await ecran(1000, false); await charger();
  if (!(await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`))) { echec('document refusé'); return; }
  await attendre(150);
  for (const vue of ['édition', 'lecture']) {
    const edit = await evalue(MODE);
    if (edit !== (vue === 'édition')) { await evalue(BASCULER); await attendre(200); }
    for (const [w, mobile] of [[1000, false], [360, true]]) {
      await ecran(w, mobile); await attendre(150);
      verifier(`${vue}, ${w} px`, await evalue(MESURE), w > 480);
    }
    await ecran(1000, false);
  }
}
