// Sujet : vue « Carte de chaleur » d'une requête (spec requetes-avancees, ticket 05).
// Matrice en lecture ; sous-niveau choisi dans la fenêtre de la puce « vue » (une étape, un Ctrl+Z) ; bulle des lignes au survol, qui ne filtre rien ;
// à 360 px la matrice défile dans le bloc, jamais la page ; texte des cases lisible (contraste ≥ 4,5) en clair et en sombre, pour chaque palette.

const LIGNES = [['Tactique', 'Technique', 'Sous-technique', 'Score'],
  ['Accès initial', 'T1566', '.001', '2'], ['Exécution', 'T1059', '.001', '3,5'], ['Exécution', 'T1059', '.003', '1'],
  ['Persistance', 'T1053', '.005', '4'], ['Élévation', 'T1068', '', '1'], ['Défense', 'T1027', '', '6'],
  ['Accès aux identifiants', 'T1003', '.001', '5'], ['Découverte', 'T1082', '', '1'], ['Mouvement latéral', 'T1021', '.002', '2']];
const DOC = { title: 'Chaleur', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 't1', type: 'table', rows: LIGNES },
  { id: 'q1', type: 'query', title: 'Matrice', src: 'table', scope: 'doc', view: 'chaleur', chX: 'tactique', chY: 'technique', chN: 'score' },
] }] };
const MODE = `document.documentElement.classList.contains('is-edit')`;
const basculer = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
const ETAT = `(() => {
  const q = document.querySelector('[data-qid="q1"]'), b = window.ardoise.doc.pages[0].blocks[1];
  return { colonnes: q.querySelectorAll('.q-ch-col').length, cases: q.querySelectorAll('.q-ch-c').length, sous: q.querySelectorAll('.q-ch-s').length,
    vues: [...document.querySelectorAll('.q-fen [data-qset=view]')].map((o) => o.dataset.v), chZ: b.chZ || '', view: b.view,
    puce: ((document.querySelector('.blk[data-id="q1"] [data-qpuce="view"]') || {}).textContent || '').trim() };
})()`;
const ouvrir = (cle) => `document.querySelector('.blk[data-id="q1"] [data-qpuce="${cle}"]').click()`;
const choisir = (prop, v) => `(() => { const s = document.querySelector('.q-fen[data-id="q1"] select[data-prop=${prop}]'); s.value = ${JSON.stringify(v)}; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`;
// contraste WCAG du texte de chaque palier sur son fond, couleurs calculées par le navigateur (color-mix compris)
const CONTRASTES = `(() => {
  const rgb = (s) => { const m = s.match(/color\\(srgb ([\\d.]+) ([\\d.]+) ([\\d.]+)/); if (m) return [m[1], m[2], m[3]].map((x) => +x * 255); return s.match(/[\\d.]+/g).slice(0, 3).map(Number); };
  const L = (c) => { const f = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
  const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const out = [], q = document.querySelector('.q-ch');
  for (const th of ['light', 'dark']) for (const pal of ['', 'petrole', 'indigo', 'rubis', 'foret', 'graphite']) {
    document.documentElement.dataset.theme = th; if (pal) document.documentElement.dataset.palette = pal; else delete document.documentElement.dataset.palette;
    for (let i = 0; i < 5; i++) {
      const c = document.createElement('div'); c.className = 'q-ch-c q-ch-p' + i; c.textContent = 'T1059'; q.appendChild(c);
      const s = getComputedStyle(c); out.push({ th, pal: pal || 'ambre', i, r: Math.round(cr(rgb(s.backgroundColor), rgb(s.color)) * 100) / 100 }); c.remove();
    }
  }
  delete document.documentElement.dataset.theme; delete document.documentElement.dataset.palette;
  return out;
})()`;

export const nom = 'carte de chaleur';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const etat = () => evalue(ETAT);
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };

  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(50);
  if (await evalue(MODE)) { await evalue(basculer); await attendre(50); }
  let e = await etat();
  attendu('lecture : une colonne par tactique, une case par technique', e.colonnes === 8 && e.cases === 8 && e.sous === 0, e);

  // bulle au survol d'une case : ses lignes avec leur source ; un clic ne filtre rien
  await evalue(`document.querySelector('[data-qid="q1"] .q-ch-c').parentNode.nextElementSibling.querySelector('.q-ch-c').dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))`); await attendre(60);
  const bulle = await evalue(`(() => { const t = document.querySelector('.tl-bubble.q-ch-bulle'); return t ? { lignes: t.querySelectorAll('li').length, src: t.querySelectorAll('.q-src').length, pe: getComputedStyle(t).pointerEvents } : null; })()`);
  attendu('survol : bulle avec les deux lignes de T1059 et leurs sources', bulle && bulle.lignes === 2 && bulle.src === 2 && bulle.pe === 'auto', bulle);
  await evalue(`document.querySelector('[data-qid="q1"] .q-ch-c').click()`); await attendre(60);
  e = await etat();
  attendu('clic sur une case : rien de filtré', e.cases === 8 && e.view === 'chaleur', e);

  // à la souris : la bulle touche la case ; en descendant de la case vers la bulle, le pointeur ne traverse aucune autre case
  // et la bulle reste celle de la case quittée (colonne de trois cases : Exécution)
  const D3 = JSON.parse(JSON.stringify(DOC)); D3.pages[0].blocks[1].chY = 'sous-technique';
  await evalue(`window.ardoise.load(${JSON.stringify(D3)})`); await attendre(80);
  const c = await evalue(`(() => { const col = [...document.querySelectorAll('[data-qid="q1"] .q-ch-col')].find((x) => x.querySelector('h4').textContent.startsWith('Exécution'));
    const cs = col.querySelectorAll('.q-ch-c'); cs[0].scrollIntoView({ block: 'center' }); const r = cs[0].getBoundingClientRect(), r2 = cs[1].getBoundingClientRect();
    return { n: cs.length, x: Math.round(r.left + 12), y: Math.round(r.top + r.height / 2), bas: r.bottom, haut2: r2.top }; })()`);
  await attendre(60);
  const vue = `(() => { const t = document.querySelector('.tl-bubble.q-ch-bulle'); if (!t || !t.getClientRects().length) return null; const r = t.getBoundingClientRect();
    return { haut: r.top, gauche: r.left, droite: r.right, texte: t.textContent }; })()`;
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y, button: 'none' }); await attendre(80);
  const b0 = await evalue(vue);
  attendu('survol à la souris : bulle collée sous la case', c.n === 2 && b0 && b0.haut <= c.bas + 1 && b0.haut >= c.bas - 4 && b0.gauche <= c.x && b0.droite >= c.x, { c, b0 });
  let trajet = true;
  for (let y = c.y; y <= (b0 ? b0.haut : c.bas) + 12; y += 3) {
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y, button: 'none' }); await attendre(15);
    const b = await evalue(vue); if (!b || b.texte !== (b0 && b0.texte)) { trajet = { y, b }; break; }
  }
  attendu('de la case à la bulle : la même bulle reste ouverte', trajet === true, trajet);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 990, y: 5, button: 'none' }); await attendre(60);
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(80);

  // contraste du texte des cases, clair et sombre, toutes les palettes
  const faibles = (await evalue(CONTRASTES)).filter((x) => x.r < 4.5);
  attendu('contraste ≥ 4,5 pour chaque palier, thème et palette', !faibles.length, faibles);

  // édition : puce « Carte de chaleur », vue proposée dans sa fenêtre, sous-niveau choisi (une étape, un Ctrl+Z)
  await evalue(basculer); await attendre(80);
  await evalue(ouvrir('view')); await attendre(80);
  e = await etat();
  attendu('édition : puce « Carte de chaleur », vue proposée pour les lignes de tableaux', e.puce === 'Carte de chaleur' && e.vues.includes('chaleur'), e);
  await evalue(choisir('chZ', 'sous-technique')); await attendre(80);
  e = await etat();
  attendu('sous-niveau choisi : sous-cases', e.chZ === 'sous-technique' && e.sous === 6, e);
  await evalue(`document.querySelector('#ui [data-ui=undo]').click()`); await attendre(80);
  e = await etat();
  attendu('Ctrl+Z : sous-niveau retiré', e.chZ === '' && e.sous === 0, e);

  // téléphone : la matrice défile dans le bloc, jamais la page
  await ecran(360, true); await evalue(basculer); await attendre(120);
  const d = await evalue(`document.documentElement.scrollWidth - innerWidth`);
  const w = await evalue(`(() => { const x = document.querySelector('[data-qid="q1"] .q-ch-wrap'); return x ? x.scrollWidth - x.clientWidth : -1; })()`);
  attendu('360 px : la matrice défile dans le bloc, pas la page', d <= 0 && w > 0, { d, w });
  await ecran(1000, false); await evalue(basculer); await attendre(80);

  // autre source : la vue retombe sur « Tableau »
  await evalue(ouvrir('src')); await attendre(80);
  await evalue(`document.querySelector('.q-fen [data-qset="src"][data-v="facts"]').click()`); await attendre(80);
  await evalue(ouvrir('view')); await attendre(80);
  e = await etat();
  attendu('fiches de faits : vue Tableau', e.view === 'table' && !e.vues.includes('chaleur'), e);
}
