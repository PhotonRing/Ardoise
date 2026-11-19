// Sujet : alignement et taille des lignes d'un bloc texte. Sélecteurs de la barre de mise en forme sur plusieurs lignes
// (sélection gardée, une étape d'historique), libellés de la ligne du curseur, taille désactivée sur des sous-titres, Entrée
// qui garde les réglages, marque qui suit le texte centré, rendu en lecture. Origine : spec bloc-texte, ticket 06.
import { LIBELLE_ENTIER } from './bloc-texte-genres.mjs';

const doc = (blocks) => ({ title: 'Alignement', pages: [{ id: 'p1', title: 'Accueil', blocks }] });
const LIGNES = (bid) => `JSON.stringify(((window.ardoise.doc.pages[0].blocks.find((b) => b.id === ${JSON.stringify(bid)})) || {}).lignes)`;
const POS = `const pos = (bid, i, n) => { const el = document.querySelector('.fld[data-b="' + bid + '"]'), lg = el.querySelectorAll('.lg')[i];
  const w = document.createTreeWalker(lg, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) { if (n <= t.length) return [t, n]; n -= t.length; } return [lg, 0]; };`;
const curseur = (bid, i, n) => `(() => { ${POS} document.querySelector('.fld[data-b="${bid}"]').focus(); const p = pos('${bid}', ${i}, ${n}), r = document.createRange();
  r.setStart(p[0], p[1]); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
const choisir = (bid, i0, n0, i1, n1) => `(() => { ${POS} document.querySelector('.fld[data-b="${bid}"]').focus(); const a = pos('${bid}', ${i0}, ${n0}), b = pos('${bid}', ${i1}, ${n1}), r = document.createRange();
  r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return s.toString(); })()`;
const centre = (sel) => `(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || !b.getClientRects().length) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`;
// point juste à gauche du texte de la ligne i (là où la marque est dessinée quand elle suit le texte)
const avantTexte = (sel, i) => `(() => { const lg = document.querySelectorAll(${JSON.stringify(sel)} + ' > .lg')[${i}], r = document.createRange(); r.selectNodeContents(lg);
  const t = r.getClientRects()[0]; return { x: t.left - 7, y: t.top + t.height / 2, gauche: lg.getBoundingClientRect().left, texte: t.left }; })()`;

export const nom = 'alignement et taille';
export default async function ({ ecran, charger, evalue, cdp, attendre, visibles, mesure, echec }) {
  const touche = async (key, code, vk, modifiers = 0) => {
    for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers });
    await attendre(80);
  };
  const ENTREE = ['Enter', 'Enter', 13], CTRL_Z = ['z', 'KeyZ', 90, 2];
  const charge = async (blocks) => { if (!(await evalue(`window.ardoise.load(${JSON.stringify(doc(blocks))})`))) throw new Error('document refusé'); await attendre(120); };
  const lignes = async (bid) => JSON.parse((await evalue(LIGNES(bid))) || 'null');
  const verifie = async (cas, bid, attendu) => { mesure(); const l = await lignes(bid); if (JSON.stringify(l) !== JSON.stringify(attendu)) echec(cas + ' : ' + JSON.stringify(l) + ' au lieu de ' + JSON.stringify(attendu)); };
  const clic = async (p) => { for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 }); await attendre(150); };
  const libelles = async () => (await visibles('.bmf [data-mf="genre"], .bmf [data-mf="align"], .bmf [data-mf="taille"]')).join();
  // ouvre le sélecteur k et choisit la valeur v ; vérifie au passage les libellés entiers de sa fenêtre
  const choix = async (k, v) => {
    const b = await evalue(centre(`.bmf [data-mf="${k}"]`)); if (!b) { echec(`sélecteur ${k} absent de l'écran`); return; }
    await clic(b);
    mesure();
    const coupes = (await visibles('.pop [data-choix]', LIBELLE_ENTIER)).filter((x) => x);
    if (coupes.length) echec(`fenêtre ${k} : libellés coupés ` + JSON.stringify(coupes));
    const c = await evalue(centre(`.pop [data-choix="${v}"]`)); if (!c) { echec(`fenêtre ${k} : choix ${v} absent`); return; }
    await clic(c); await attendre(150);
  };
  await ecran(1000, false);
  await charger();

  // Centré puis Grand sur trois lignes sélectionnées : sélection gardée, une étape par choix
  const trois = [{ html: 'un' }, { html: 'deux', genre: 'puce' }, { html: 'trois', genre: 'case' }];
  await charge([{ id: 't1', type: 'texte', lignes: [{ html: 'avant' }].concat(trois, [{ html: 'après' }]) }]);
  await evalue(curseur('t1', 0, 2)); await attendre(250);
  mesure();
  if ((await libelles()) !== 'Texte,Gauche,Normal') echec('libellés sur une ligne par défaut : ' + await libelles());
  const sel = await evalue(choisir('t1', 1, 1, 3, 2)); await attendre(250);
  mesure();
  {
    const v = await visibles('.bmf [data-mf="align"], .bmf [data-mf="taille"]');
    if (v.length !== 2) echec('sélecteurs d\'alignement et de taille absents : ' + JSON.stringify(v));
  }
  await choix('align', 'centre');
  await verifie('Centré sur trois lignes', 't1', [{ html: 'avant' }, { html: 'un', align: 'centre' }, { html: 'deux', genre: 'puce', align: 'centre' }, { html: 'trois', genre: 'case', align: 'centre' }, { html: 'après' }]);
  mesure();
  if ((await evalue('getSelection().toString()')) !== sel) echec('Centré : sélection perdue');
  await choix('taille', 'grand');
  await verifie('Grand sur trois lignes', 't1', [{ html: 'avant' }, { html: 'un', align: 'centre', taille: 'grand' }, { html: 'deux', genre: 'puce', align: 'centre', taille: 'grand' }, { html: 'trois', genre: 'case', align: 'centre', taille: 'grand' }, { html: 'après' }]);
  mesure();
  if ((await evalue('getSelection().toString()')) !== sel) echec('Grand : sélection perdue');
  if ((await libelles()) !== 'Texte,Centré,Grand') echec('libellés après les choix : ' + await libelles());
  await touche(...CTRL_Z); await attendre(150);
  await verifie('un Ctrl+Z défait Grand seul', 't1', [{ html: 'avant' }, { html: 'un', align: 'centre' }, { html: 'deux', genre: 'puce', align: 'centre' }, { html: 'trois', genre: 'case', align: 'centre' }, { html: 'après' }]);
  // taille et alignement à l'écran
  mesure();
  {
    const st = await evalue(`[...document.querySelectorAll('.fld[data-b="t1"] > .lg')].map((x) => { const c = getComputedStyle(x); return c.textAlign + ' ' + c.fontSize; })`);
    if (JSON.stringify(st.slice(0, 2)) !== JSON.stringify(['start 15px', 'center 15px'])) echec('à l\'écran : ' + JSON.stringify(st));
  }
  // une case centrée : sa marque suit le texte, et s'y coche d'un clic
  {
    const p = await evalue(avantTexte('.fld[data-b="t1"]', 3));
    mesure();
    if (!(p.texte - p.gauche > 100)) echec('case centrée : texte non centré ' + JSON.stringify(p));
    await clic(p);
    await verifie('clic sur une case centrée', 't1', [{ html: 'avant' }, { html: 'un', align: 'centre' }, { html: 'deux', genre: 'puce', align: 'centre' }, { html: 'trois', genre: 'case', align: 'centre', done: true }, { html: 'après' }]);
  }

  // taille désactivée sur des sous-titres ; active sur un sous-titre et un texte, sans taille posée sur le sous-titre
  await charge([{ id: 't1', type: 'texte', lignes: [{ html: 'titre un', genre: 'soustitre' }, { html: 'titre deux', genre: 'soustitre' }, { html: 'texte', taille: 'grand' }] }]);
  await evalue(choisir('t1', 0, 1, 1, 3)); await attendre(250);
  mesure();
  if (!(await evalue(`document.querySelector('.bmf [data-mf="taille"]').disabled`))) echec('taille active sur deux sous-titres');
  if ((await libelles()) !== 'Sous-titre,Gauche,Normal') echec('libellés sur un sous-titre : ' + await libelles());
  await evalue(choisir('t1', 1, 1, 2, 2)); await attendre(250);
  mesure();
  if (await evalue(`document.querySelector('.bmf [data-mf="taille"]').disabled`)) echec('taille désactivée sur un sous-titre et un texte');
  await choix('taille', 'petit');
  await verifie('Petit sur un sous-titre et un texte', 't1', [{ html: 'titre un', genre: 'soustitre' }, { html: 'titre deux', genre: 'soustitre' }, { html: 'texte', taille: 'petit' }]);
  // une ligne Grand passée en sous-titre perd sa taille
  await charge([{ id: 't1', type: 'texte', lignes: [{ html: 'texte', taille: 'grand', align: 'droite' }] }]);
  await evalue(curseur('t1', 0, 2)); await attendre(250);
  await choix('genre', 'soustitre');
  await verifie('Grand en sous-titre', 't1', [{ html: 'texte', genre: 'soustitre', align: 'droite' }]);

  // Entrée garde l'alignement et la taille ; après un sous-titre, l'alignement seul
  await charge([{ id: 't1', type: 'texte', lignes: [{ html: 'abcd', genre: 'puce', align: 'centre', taille: 'petit' }, { html: 'titre', genre: 'soustitre', align: 'droite' }] }]);
  await evalue(curseur('t1', 0, 2)); await touche(...ENTREE);
  await evalue(curseur('t1', 2, 5)); await touche(...ENTREE);
  await verifie('Entrée', 't1', [{ html: 'ab', genre: 'puce', align: 'centre', taille: 'petit' }, { html: 'cd', genre: 'puce', align: 'centre', taille: 'petit' },
    { html: 'titre', genre: 'soustitre', align: 'droite' }, { html: '', align: 'droite' }]);

  // à 1000 px, la barre aux libellés les plus longs tient à côté du menu, même dans un groupe (règle du lot 4a)
  await charge([{ id: 'gr', type: 'group', title: 'Groupe', blocks: [{ id: 't1', type: 'texte', lignes: [{ html: 'titre', genre: 'soustitre', align: 'justifie' }] }] }]);
  await evalue(curseur('t1', 0, 2)); await attendre(250);
  mesure();
  {
    const x = await evalue(`(() => { const b = document.querySelector('.bmf'), m = b.parentElement.querySelector(':scope > .blk-bar'), r = b.getBoundingClientRect(), rm = m.getBoundingClientRect();
      return { droite: r.right, bas: r.bottom, mGauche: rm.left, mBas: rm.bottom }; })()`);
    if (!(Math.abs(x.bas - x.mBas) <= 1 && x.droite <= x.mGauche - 2)) echec('groupe à 1000 px : barre et menu pas sur la même ligne ' + JSON.stringify(x));
    if ((await libelles()) !== 'Sous-titre,Justifié,Normal') echec('libellés dans le groupe : ' + await libelles());
  }

  // lecture : alignement et taille rendus
  await charge([{ id: 't1', type: 'texte', lignes: [{ html: 'grand', align: 'centre', taille: 'grand' }, { html: 'petit', align: 'droite', taille: 'petit' }, { html: 'just', align: 'justifie' }] }]);
  await evalue(`document.querySelector('#ui [data-ui="mode"]').click()`); await attendre(150);
  mesure();
  {
    const st = await evalue(`[...document.querySelectorAll('.texte > .lg')].map((x) => { const c = getComputedStyle(x); return c.textAlign + ' ' + c.fontSize; })`);
    if (JSON.stringify(st) !== JSON.stringify(['center 18px', 'right 13px', 'justify 15px'])) echec('lecture : ' + JSON.stringify(st));
  }
  await evalue(`document.querySelector('#ui [data-ui="mode"]').click()`); await attendre(100);
}
