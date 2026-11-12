// Sujet : pastille au clavier. « # » en début de mot puis des lettres ouvre la liste des pastilles du document ;
// Entrée pose la pastille au nom exact de la liste, en une étape d'annulation ; « C# », « # 3 », un champ non riche n'ouvrent rien.
// Origine : spec saisie-et-tableaux, ticket 05. Les lettres arrivent par Input.insertText, sans keydown, comme le clavier virtuel d'Android.

const P = (t) => '<span class="pill">' + t + '</span>';
const DOC = {
  title: 'Pastilles', tags: { 'priorité': { c: 3 } },
  pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 'a1', type: 'p', html: 'Déjà ' + P('Priorité') },
    { id: 'a2', type: 'p', html: '' },
    { id: 'k1', type: 'kanban', cols: [{ id: 'c1', title: 'Colonne', cards: [] }] },
  ] }],
};
const CHARGE = `window.ardoise.load(${JSON.stringify(DOC)})`;
// curseur à la fin d'un champ, qu'on vide d'abord
const vider = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.focus(); el.innerHTML = ''; el.dispatchEvent(new Event('input', { bubbles: true }));
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
const LISTE = `(() => { const p = document.querySelector('#ui .diese-pop'); return p ? [...p.querySelectorAll('.mi')].map((m) => m.textContent.trim()) : null; })()`;
const HTML = (bid) => `(window.ardoise.doc.pages[0].blocks.find((b) => b.id === ${JSON.stringify(bid)}) || {}).html`;
const PARA = '.fld[data-b="a2"]';

export const nom = 'pastille au clavier';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const taper = async (t) => { for (const c of t) { await cdp('Input.insertText', { text: c }); await attendre(15); } await attendre(30); };
  const touche = async (key, code, vk, modifiers = 0) => {
    for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers });
    await attendre(60);
  };
  // une seule navigation ici : la page modifiée demande confirmation avant d'être quittée (voir la fin)
  const debut = async () => { if (!(await evalue(CHARGE))) throw new Error('document refusé'); await attendre(100); await evalue(vider(PARA)); await attendre(30); };
  await ecran(1000, false);
  await charger();

  // #pri puis Entrée : « Priorité », nom exact ; curseur hors de la pastille ; une étape d'annulation
  await debut();
  await taper('#pri');
  mesure();
  const l = await evalue(LISTE);
  if (!l) echec('#pri : la liste ne s\'ouvre pas');
  else if (!/Priorité/.test(l[0] || '') || !/Créer la pastille « pri »/.test(l[l.length - 1])) echec('#pri : lignes ' + JSON.stringify(l));
  await touche('Enter', 'Enter', 13);
  await taper(' suite');
  mesure();
  const h = await evalue(HTML('a2'));
  if (!/^<span class="pill">Priorité<\/span>\u200B?(&nbsp;| )suite$/.test(h)) echec('après Entrée : modèle ' + JSON.stringify(h));
  if (await evalue(LISTE)) echec('après Entrée : la liste reste ouverte');
  await attendre(1200);   // la frappe « suite » devient une étape
  await touche('z', 'KeyZ', 90, 2); await touche('z', 'KeyZ', 90, 2);
  mesure();
  const h2 = await evalue(HTML('a2'));
  if (h2 !== '#pri') echec('deux Ctrl+Z (frappe, puis pose) : attendu « #pri », obtenu ' + JSON.stringify(h2));

  // « Créer » par un clic : nom tapé, inscrit au registre
  await debut();
  await taper('#neuf');
  const r = await evalue(`(() => { const m = [...document.querySelectorAll('#ui .diese-pop .mi')].pop(); if (!m) return null; const b = m.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  mesure();
  if (!r) echec('#neuf : pas de ligne « Créer »');
  else {
    for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
    await attendre(80);
    const h3 = await evalue(HTML('a2')), reg = await evalue('!!(window.ardoise.doc.tags || {}).neuf');
    if (!/^<span class="pill">neuf<\/span>/.test(h3) || !reg) echec('clic sur « Créer » : modèle ' + JSON.stringify(h3) + ', registre ' + reg);
  }

  // Échap : le texte reste tel quel
  await debut();
  await taper('#pri');
  await touche('Escape', 'Escape', 27);
  mesure();
  if (await evalue(LISTE)) echec('Échap : la liste reste ouverte');
  if ((await evalue(HTML('a2'))) !== '#pri') echec('Échap : texte ' + JSON.stringify(await evalue(HTML('a2'))));

  // rien ne s'ouvre : # collé à un mot, # suivi d'une espace, champ non riche
  for (const [cas, sel, texte] of [['C#pri', PARA, 'C#pri'], ['# pri', PARA, '# pri'], ['titre de colonne', '.fld[data-k="cols.0.title"]', '#pri']]) {
    await debut(); await evalue(vider(sel)); await taper(texte);
    mesure();
    if (await evalue(LISTE)) echec(cas + ' : la liste s\'ouvre');
  }

  // la page est modifiée : la quitter en acceptant l'avertissement de sortie, pour que le sujet suivant puisse naviguer
  await cdp('Page.enable');
  const part = cdp('Page.navigate', { url: 'about:blank' });
  await attendre(300); await cdp('Page.handleJavaScriptDialog', { accept: true }); await part;
}
