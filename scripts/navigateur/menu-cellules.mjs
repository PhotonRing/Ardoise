// Sujet : menu contextuel des cellules d'un tableau (clic droit, Maj+F10), et boutons +L, −L, +C, −C qui partagent ses opérations.
// Origine : spec saisie-et-tableaux, élément 40.

const DOC = { title: 'Menu des cellules', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 't1', type: 'table', rows: [['Ville', 'Pays', 'Note'], ['Lyon', 'France', '1'], ['Rome', 'Italie', '2']] },
  ...Array.from({ length: 30 }, (_, i) => ({ id: 'x' + i, type: 'p', html: 'Paragraphe ' + i })),
] }] };
// état observé : grille du document, menu ouvert et ses entrées, cellule qui a le focus, libellé d'Annuler
const ETAT = `(() => {
  const p = document.querySelector('#ui .pop'), a = document.activeElement;
  return { rows: window.ardoise.doc.pages[0].blocks[0].rows, menu: p ? [...p.querySelectorAll('.mi')].map((m) => m.textContent) : null,
    focusMenu: !!(p && p.contains(a)), focus: a && a.dataset && a.dataset.k || null, annuler: (document.querySelector('#ui [data-ui=undo]') || {}).title || '' };
})()`;
const cellule = (k) => `document.querySelector('[data-b="t1"][data-k="${k}"]')`;

export const nom = 'menu des cellules';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const etat = () => evalue(ETAT);
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  const prete = async () => {
    await charger();
    await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(100);
    // l'appel de load est une étape ; on garde le menu natif annulé ou non pour chaque clic droit
    await evalue(`window.__natif = null; window.addEventListener('contextmenu', (e) => { window.__natif = !e.defaultPrevented; }); true`);
  };
  const centre = async (k) => evalue(`(() => { const r = ${cellule(k)}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const clicDroit = async (k, modifiers = 0) => {
    const { x, y } = await centre(k);
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', clickCount: 1, modifiers });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', clickCount: 1, modifiers });
    await attendre(80);
  };
  const touche = async (key, code, vk, modifiers = 0) => {
    await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, modifiers });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers });
    await attendre(80);
  };
  const choisir = (libelle) => evalue(`(() => { const m = [...document.querySelectorAll('#ui .pop .mi')].find((x) => x.textContent === ${JSON.stringify(libelle)}); if (m) m.click(); return !!m; })()`);

  await ecran(1000, false);
  await prete();

  // clic droit dans une cellule de données : les six entrées, le menu natif est remplacé
  await clicDroit('rows.1.1');
  let e = await etat();
  attendu('clic droit dans une cellule : six entrées', JSON.stringify(e.menu) === JSON.stringify(['Insérer une ligne au-dessus', 'Insérer une ligne en dessous',
    'Insérer une colonne à gauche', 'Insérer une colonne à droite', 'Supprimer la ligne', 'Supprimer la colonne']) && e.focusMenu, e);
  attendu('clic droit dans une cellule : menu natif remplacé', (await evalue('window.__natif')) === false, await evalue('window.__natif'));
  await touche('Escape', 'Escape', 27);
  e = await etat(); attendu('Échap ferme le menu', e.menu === null, e);

  // « Insérer une ligne au-dessus » : ligne vide à sa place, curseur dedans, libellé d'annulation
  await clicDroit('rows.1.1');
  attendu('entrée « Insérer une ligne au-dessus » trouvée', await choisir('Insérer une ligne au-dessus'), null);
  await attendre(100);
  e = await etat();
  attendu('ligne insérée au-dessus', JSON.stringify(e.rows) === JSON.stringify([['Ville', 'Pays', 'Note'], ['', '', ''], ['Lyon', 'France', '1'], ['Rome', 'Italie', '2']]), e.rows);
  attendu('curseur dans la nouvelle ligne', e.focus === 'rows.1.1' && e.menu === null, e);
  attendu('libellé d\'annulation « ligne ajoutée »', /ligne ajoutée/.test(e.annuler), e.annuler);

  // en-tête : ni « au-dessus » ni « Supprimer la ligne »
  await clicDroit('rows.0.0');
  e = await etat();
  attendu('en-tête : ni au-dessus ni Supprimer la ligne', e.menu && e.menu.length === 4 && !e.menu.includes('Insérer une ligne au-dessus') && !e.menu.includes('Supprimer la ligne'), e.menu);
  await touche('Escape', 'Escape', 27);

  // Ctrl + clic droit : menu natif
  await clicDroit('rows.2.0', 2);
  e = await etat();
  attendu('Ctrl + clic droit : pas de menu d\'Ardoise, menu natif', e.menu === null && (await evalue('window.__natif')) === true, e);

  // Maj+F10 : même menu, flèches, puis le défilement le ferme
  await evalue(`(${cellule('rows.2.0')}).focus(), true`);
  await touche('F10', 'F10', 121, 8);
  e = await etat();
  attendu('Maj+F10 ouvre le menu, focus sur la première entrée', e.menu && e.menu.length === 6 && e.focusMenu, e);
  await touche('ArrowDown', 'ArrowDown', 40);
  const deuxieme = await evalue(`document.activeElement.textContent`);
  attendu('flèche bas : deuxième entrée', deuxieme === 'Insérer une ligne en dessous', deuxieme);
  await touche('ArrowUp', 'ArrowUp', 38); await touche('ArrowUp', 'ArrowUp', 38);
  const boucle = await evalue(`document.activeElement.textContent`);
  attendu('flèche haut en boucle : dernière entrée', boucle === 'Supprimer la colonne', boucle);
  await evalue('window.scrollBy(0, 200), true'); await attendre(150);
  e = await etat(); attendu('le défilement ferme le menu', e.menu === null, e);

  // bouton +C de la barre du bloc : même opération, curseur et libellé
  await evalue(`(${cellule('rows.2.1')}).focus(), true`);
  await evalue(`document.querySelector('.blk[data-id="t1"] [data-act=col-add]').click(), true`); await attendre(100);
  e = await etat();
  attendu('+C : colonne « Colonne » à droite de la cellule active', JSON.stringify(e.rows[0]) === JSON.stringify(['Ville', 'Pays', 'Colonne', 'Note']), e.rows);
  attendu('+C : curseur dans la nouvelle colonne, libellé « colonne ajoutée »', e.focus === 'rows.2.2' && /colonne ajoutée/.test(e.annuler), e);

  // lecture : clic droit natif
  await evalue(`document.activeElement.blur(), document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true })), true`); await attendre(150);
  const enLecture = await evalue(`!document.querySelector('[data-b="t1"][contenteditable]')`);
  attendu('passage en lecture', enLecture, enLecture);
  const { x, y } = await evalue(`(() => { const td = document.querySelector('#app .tablewrap td'); td.scrollIntoView({ block: 'center' }); const r = td.getBoundingClientRect(); return { x: r.left + 5, y: r.top + 5 }; })()`);
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', clickCount: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', clickCount: 1 }); await attendre(80);
  e = await etat();
  attendu('lecture : pas de menu d\'Ardoise, menu natif', e.menu === null && (await evalue('window.__natif')) === true, e);
}
