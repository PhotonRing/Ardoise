// Sujet : mise en page des constructions du moteur de formules que seul le navigateur montre. Les cas (cases) s'alignent à
// gauche, les égalités alignées (aligned) à droite puis à gauche du signe (Chromium ignore columnalign : page.css) ; un
// délimiteur \left( \right) s'étire à la hauteur d'un tableau de trois lignes (police mathématique nommée : page.css). Origine : spec formules, ticket 04.

const F = (s) => '<span class="formule">' + s + '</span>';
const DOC = { title: 'Formules', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 't', type: 'texte', lignes: [
    { html: 'Cas ' + F('f(x)=\\begin{cases} 1 & \\text{si } x>0 \\\\ -100 & \\text{sinon} \\end{cases}') },
    { html: 'Égalités ' + F('\\begin{aligned} a+b+c &= d \\\\ x &= y+z+w \\end{aligned}') },
    { html: 'Délimiteurs ' + F('\\left( \\begin{matrix} a \\\\ b \\\\ c \\end{matrix} \\right)') + ' et ' + F('(x)') },
  ] },
] }] };
// position à l'écran du contenu de chaque cellule d'un tableau de la ligne n : [[gauche, droite] par cellule] par ligne
const CELLULES = (n) => `[...document.querySelectorAll('.blk[data-id="t"] .lg')[${n}].querySelectorAll('mtr')].map((tr) => [...tr.children].map((td) => {
  const r = [...td.children].map((e) => e.getBoundingClientRect()); return [Math.min(...r.map((x) => x.left)), Math.max(...r.map((x) => x.right))]; }))`;
const proche = (a, b) => Math.abs(a - b) < 0.6;
// une des polices mathématiques nommées par page.css est-elle installée ? (sinon, comme en CI, rien ne s'étire)
const POLICE_MATH = `(() => { const g = document.createElement('canvas').getContext('2d'); const l = (f) => { g.font = '40px ' + f; return g.measureText('(∑x⟩').width; };
  return ['Cambria Math', 'STIX Two Math', 'Latin Modern Math', 'Noto Sans Math'].some((p) => ['monospace', 'serif'].some((b) => l('"' + p + '", ' + b) !== l(b))); })()`;

export const nom = 'formules : mise en page';
export default async function ({ ecran, charger, evalue, attendre, mesure, echec }) {
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(150);

  const cas = await evalue(CELLULES(0));
  attendu('cases : colonnes alignées à gauche', cas.length === 2 && proche(cas[0][0][0], cas[1][0][0]) && proche(cas[0][1][0], cas[1][1][0])
    && !proche(cas[0][0][1], cas[1][0][1]), cas);
  const al = await evalue(CELLULES(1));
  attendu('aligned : à droite avant le signe, à gauche après', al.length === 2 && proche(al[0][0][1], al[1][0][1]) && proche(al[0][1][0], al[1][1][0])
    && !proche(al[0][0][0], al[1][0][0]), al);
  const h = await evalue(`[...document.querySelectorAll('.blk[data-id="t"] .lg')[2].querySelectorAll('mo')].filter((m) => /[()]/.test(m.textContent)).map((m) => m.getBoundingClientRect().height)`);
  if (await evalue(POLICE_MATH)) attendu('\\left( \\right) : délimiteurs étirés à la hauteur du tableau', h.length === 4 && h[0] > h[2] * 1.3 && h[1] > h[3] * 1.3, h);
  else console.log('formules : mise en page : aucune police mathématique installée, étirement non vérifié');
}
