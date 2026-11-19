// Sujet : Effacer de la barre de mise en forme ne retire la forme que du texte sélectionné. Une forme qui englobe la sélection
// reste avant et après elle ; pastilles, taquets et sauts de ligne restent. Origine : spec bloc-texte, ticket 01.

// bloc à placer seul (avec un paragraphe voisin), champ à trouver, valeur enregistrée à relire
const BLOCS = {
  p: (html) => ({ id: 'ba', type: 'p', html }),
  note: (html) => ({ id: 'ba', type: 'note', variant: 'info', html }),
  table: (html) => ({ id: 'ba', type: 'table', rows: [['Titre', 'Autre'], [html, 'x']] }),
};
const CHAMP = { p: `.fld[data-b="ba"]`, note: `.fld[data-b="ba"]`, table: `.blk[data-id="ba"] [data-k="rows.1.0"]` };
const LIRE = { p: 'b.html', note: 'b.html', table: 'b.rows[1][0]' };
// bloc remis à html, puis sélection de son texte de l'index a à b (texte sans balises, sauts de ligne non comptés)
const PREPARER = (genre, html, a, b) => `(async () => {
  const d = JSON.parse(JSON.stringify(window.ardoise.doc)); d.pages[0].blocks = [${JSON.stringify(BLOCS[genre](html))}, { id: 'bb', type: 'p', html: 'Autre' }];
  window.ardoise.load(d); await new Promise((r) => setTimeout(r, 80));
  const el = document.querySelector(${JSON.stringify(CHAMP[genre])}); el.focus({ preventScroll: true });
  const pos = (n) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) { if (n <= t.nodeValue.length) return [t, n]; n -= t.nodeValue.length; } return [el, el.childNodes.length]; };
  const r = document.createRange(), [t1, o1] = pos(${a}), [t2, o2] = pos(${b}); r.setStart(t1, o1); r.setEnd(t2, o2);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
const VALEUR = (genre) => `(() => { const b = window.ardoise.doc.pages[0].blocks.find((x) => x.id === 'ba'); return ${LIRE[genre]}; })()`;

export const nom = 'barre de mise en forme : effacer partiel';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const clic = async (sel) => {
    const p = await evalue(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || !b.getClientRects().length) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!p) { echec(`${sel} absent de l'écran`); return; }
    for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await attendre(60);
  };
  const effacer = async () => { await clic('.bmf [data-mf="clear"]'); await attendre(250); };
  const valeur = async (genre) => (await evalue(VALEUR(genre))).replace(/​/g, '');
  const touche = async (key, code, vk, modifiers) => { for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, modifiers }); };

  await ecran(1000, false);
  await charger();

  // [genre de bloc, html de départ, début et fin de la sélection, html enregistré attendu, quoi]
  const vert = '<span class="c-vert">Une phrase verte</span>', attenduVert = '<span class="c-vert">Une </span>phrase<span class="c-vert"> verte</span>';
  const cas = [
    ['p', vert, 4, 10, attenduVert, 'mot dans une phrase verte'],
    ['p', '<span class="s-jaune">Une phrase surlignée</span>', 4, 10, '<span class="s-jaune">Une </span>phrase<span class="s-jaune"> surlignée</span>', 'mot dans une phrase surlignée'],
    ['p', '<b>Un passage en gras</b>', 3, 10, '<b>Un </b>passage<b> en gras</b>', 'mot dans un passage en gras'],
    ['p', '<a href="https://exemple.fr" target="_blank" rel="noopener">un lien long</a>', 3, 7,
      '<a href="https://exemple.fr" target="_blank" rel="noopener">un </a>lien<a href="https://exemple.fr" target="_blank" rel="noopener"> long</a>', 'mot dans un lien'],
    ['p', '<span class="c-vert">Un <b>mot gras</b> vert</span>', 3, 6, '<span class="c-vert">Un </span>mot<span class="c-vert"><b> gras</b> vert</span>', 'gras qui déborde de la sélection'],
    ['p', 'Un <b>mot</b> et <i>autre</i>', 0, 16, 'Un mot et autre', 'sélection qui couvre toutes les formes'],
    ['p', '<span class="c-vert">A <span class="pill">OK</span> B</span>', 0, 6, 'A <span class="pill">OK</span> B', 'pastille dans la sélection'],
    ['p', '<span class="pill">Un mot</span> fin', 3, 6, '<span class="pill">Un mot</span> fin', 'sélection dans une pastille'],
    ['p', '<b>Un <span class="pill">OK</span> mot</b>', 6, 9, '<b>Un <span class="pill">OK</span> </b>mot', 'pastille avant la sélection, dans le gras de la sélection'],
    ['p', '<b>une ligne<br>autre ligne</b>', 4, 14, '<b>une </b>ligne<br>autre<b> ligne</b>', 'sélection qui traverse un saut de ligne'],
    ['note', vert, 4, 10, attenduVert, 'mot vert dans un encadré'],
    ['table', vert, 4, 10, attenduVert, 'mot vert dans une cellule de tableau'],
    ['p', vert, 4, 4, vert, 'sans sélection : rien'],
  ];
  for (const [genre, depart, a, b, attendu, quoi] of cas) {
    await evalue(PREPARER(genre, depart, a, b)); await attendre(60);
    await effacer();
    const h = await valeur(genre); mesure();
    if (h !== attendu) echec(`${quoi} : ${h}, attendu ${attendu}`);
  }

  // la sélection reste sur le texte effacé
  await evalue(PREPARER('p', vert, 4, 10)); await attendre(60);
  await effacer();
  const sel = await evalue(`getSelection().toString()`); mesure();
  if (sel !== 'phrase') echec(`sélection après Effacer : « ${sel} »`);

  // Effacer est une étape d'historique à part : Ctrl+Z rend la forme, pas la frappe qui le précède
  await evalue(PREPARER('p', vert, 16, 16)); await attendre(60);
  await cdp('Input.insertText', { text: 'x' }); await attendre(30);
  await evalue(`(() => { const el = document.querySelector('.fld[data-b="ba"]'), t = el.querySelector('span').firstChild, r = document.createRange();
    r.setStart(t, 4); r.setEnd(t, 10); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  await effacer(); await attendre(400);
  await touche('z', 'KeyZ', 90, 2); await attendre(300);
  const hz = await valeur('p'); mesure();
  if (hz !== '<span class="c-vert">Une phrase vertex</span>') echec(`Ctrl+Z après Effacer : ${hz}`);
}
