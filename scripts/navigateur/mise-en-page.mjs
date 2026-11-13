// Sujet : mise en page sur écran étroit. Ni la page, ni la barre du haut, ni le menu ☰ ne débordent ; la pastille d'état reste entière.
// Origine : spec corrections-1-19, où 3 px de débordement de la page élargissaient la barre et le menu sur téléphone.

// pire cas réaliste : titre long, état d'enregistrement long, synchronisation active, libellés d'annulation longs
const LONG = 'Paragraphe « Réserver les billets de train pour Inverness et les nuits à Édimbourg » : texte modifié';
const TITRE = 'Préparation du grand voyage en Écosse avec toute la famille et les cousins';
const POLICES = {
  normale: '',
  large: '#ui *{font-family:"DejaVu Serif",serif!important;letter-spacing:.08em!important}',
  agrandie: '#ui .sh-big,#ui .sh-big *{font-size:22px!important}#ui .tb,#ui .tb *{font-size:18px!important}',
};
const prep = (police) => `(() => {
  const s = document.createElement('style'); s.textContent = ${JSON.stringify(police)}; document.head.appendChild(s);
  document.querySelector('.tb .doc-name').textContent = ${JSON.stringify(TITRE)};
  const st = document.querySelector('.tb #st'); if (st) { st.className = 'st ok'; st.querySelector('span').textContent = 'Enregistré · un-nom-de-fichier-assez-long.html'; }
  const sy = document.querySelector('.tb .syn'); if (sy) { sy.hidden = false; sy.innerHTML = '<button type="button" class="syn-b ok" data-ui="sync"><i></i><span class="syn-l">Synchronisé · 3 personnes</span><span class="syn-av" style="background:#c33">A</span><span class="syn-av" style="background:#36c">B</span></button>'; }
  return true; })()`;
// débordements : page plus large que l'écran, élément visible dont le bord droit sort de l'écran, texte qui sort de son gros bouton
const MESURE = `(() => {
  const iw = innerWidth, o = { page: document.documentElement.scrollWidth - iw, barre: [], menu: [], textes: [] };
  const deb = (el) => [...el.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && getComputedStyle(e).display !== 'none' && r.right > iw + 0.5; }).slice(0, 5).map((e) => (e.dataset.ui || e.dataset.sh || e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().right));
  const tb = document.querySelector('.tb');
  if (tb && getComputedStyle(tb).display !== 'none') { o.barre = deb(tb); const st = tb.querySelector('#st'); if (st && getComputedStyle(st).display !== 'none') o.etat = st.getBoundingClientRect().width; }
  const sh = document.querySelector('.sheet');
  if (sh) { o.menu = deb(sh); o.menuDeborde = sh.scrollWidth - sh.clientWidth;
    o.textes = [...sh.querySelectorAll('.sh-big')].filter((b) => [...b.querySelectorAll('*')].some((e) => e.getBoundingClientRect().right > b.getBoundingClientRect().right + 0.5)).map((b) => b.dataset.sh); }
  return o; })()`;
const OUVRIR = `(() => { document.querySelector('[data-ui=burger]').click(); for (const k of ['undo', 'redo']) { const u = document.querySelector('.sheet [data-sh=' + k + ']'); u.disabled = false; u.querySelector('.sub').textContent = ${JSON.stringify(LONG)}; } return true; })()`;

export const nom = 'mise en page';
export default async function ({ ecran, charger, evalue, attendre, mesure, echec }) {
  const verifier = (cas, o) => {
    mesure();
    if (o.page > 0) echec(`${cas} : la page déborde de ${o.page} px`);
    if (o.barre.length) echec(`${cas} : la barre du haut déborde (${o.barre.join(', ')})`);
    if (o.etat !== undefined && o.etat < 8) echec(`${cas} : pastille d'état rognée (${o.etat.toFixed(1)} px de large)`);
    if (o.menu.length || o.menuDeborde > 0) echec(`${cas} : le menu ☰ déborde (${o.menu.join(', ') || o.menuDeborde + ' px'})`);
    if (o.textes.length) echec(`${cas} : texte qui sort de son bouton dans le menu ☰ (${o.textes.join(', ')})`);
  };
  for (const [w, mobile] of [[320, true], [360, true], [412, true], [780, false], [820, false], [880, false], [1000, false]]) {
    for (const [police, css] of Object.entries(POLICES)) {
      const cas = `${w} px ${mobile ? 'mobile' : 'bureau'}, police ${police}`;
      await ecran(w, mobile);
      await charger(); await evalue(prep(css)); await attendre(50);
      verifier(cas + ', édition', await evalue(MESURE));
      if (mobile) { await evalue(OUVRIR); await attendre(100); verifier(cas + ', menu ☰', await evalue(MESURE)); }
    }
  }
}
