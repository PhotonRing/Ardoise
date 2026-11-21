// Sujet : saisie `$…$`. Le `$` qui ferme `$…$` change la source en formule (règle des dollars de Pandoc) dans chaque champ
// riche, jamais dans le code, un lien, une pastille ni un champ en texte brut ; Ctrl+Z rend la source et ses dollars ; le
// curseur saute la formule et Retour arrière la supprime d'un coup ; Effacer la garde, gras et couleur l'enveloppent ; la copie
// met le MathML annoté en text/html et `$source$` en text/plain. Origine : spec formules, ticket 02. Frappe par Input.insertText.

const F = (s) => '<span class="formule">' + s + '</span>';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const DOC = { title: 'Saisie', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'hd', type: 'header', eyebrow: '', title: 'Titre', lede: '' },
  { id: 't', type: 'texte', lignes: [{ html: '' }] },
  { id: 'nav', type: 'texte', lignes: [{ html: 'a' + F('y') + 'b' }] },
  { id: 'eff', type: 'texte', lignes: [{ html: '<b>a ' + F('y') + ' b</b>' }] },
  { id: 'nn', type: 'texte', lignes: [{ html: 'du <code>code</code>, un <a href="https://exemple.fr">lien</a>, une <span class="pill">Pastille</span>' }] },
  { id: 'h2', type: 'h2', html: 'Section' },
  { id: 'h3', type: 'h3', html: 'Sous' },
  { id: 'st', type: 'step', num: '', title: 'Étape', nonum: false },
  { id: 'tb', type: 'table', rows: [['Nom', 'Valeur'], ['a', 'Cellule ' + F('\\frac{1}{2}')], ['', '']] },
  { id: 'no', type: 'note', variant: 'info', html: 'Encadré' },
  { id: 'de', type: 'details', title: 'Dépliable', html: 'Corps', open: false },
  { id: 'fa', type: 'facts', items: [{ k: 'Clé', v: 'Valeur', alert: false }] },
  { id: 'ca', type: 'cards', min: 340, cards: [{ title: 'Carte', text: 'Texte', checks: [{ html: 'Case', done: false }] }] },
  { id: 'kb', type: 'kanban', cols: [{ id: 'c1', title: 'Colonne', cards: [{ id: 'k1', title: 'Tâche', html: 'Détail', who: 'Moi' }] }] },
  { id: 'tl', type: 'timeline', orient: 'v', items: [{ date: '2026', title: 'Événement', text: 'Récit', color: 'accent' }] },
  { id: 'di', type: 'diamond', title: 'Losange', adversaire: 'Qui', capacite: '', infrastructure: '', victime: '' },
  { id: 'im', type: 'image', src: PNG, caption: 'Légende', alt: '' },
  { id: 'gr', type: 'group', title: 'Groupe', folded: false, blocks: [{ id: 'gt', type: 'texte', lignes: [{ html: '' }] }] },
  { id: 'fo', type: 'footer', html: 'Pied' },
] }] };
const CHAMP = (b, k) => `.fld[data-b="${b}"]` + (k ? `[data-k="${k}"]` : '');
// champs « oui » : [bloc, clé (ou null pour un bloc texte), nom]
const OUI = [
  ['t', null, 'bloc texte'], ['hd', 'eyebrow', 'surtitre'], ['hd', 'title', 'titre de l\'en-tête'], ['hd', 'lede', 'chapeau'],
  ['h2', 'html', 'section'], ['h3', 'html', 'sous-section'], ['st', 'title', 'étape'], ['tb', 'rows.2.0', 'cellule'],
  ['no', 'html', 'encadré'], ['de', 'title', 'titre du dépliable'], ['de', 'html', 'corps du dépliable'], ['fa', 'items.0.v', 'valeur de fiche de faits'],
  ['ca', 'cards.0.title', 'titre de carte'], ['ca', 'cards.0.text', 'texte de carte'], ['ca', 'cards.0.checks.0.html', 'case de carte'],
  ['kb', 'cols.0.cards.0.title', 'titre de carte de kanban'], ['kb', 'cols.0.cards.0.html', 'texte de carte de kanban'],
  ['tl', 'items.0.title', 'titre d\'événement'], ['tl', 'items.0.text', 'texte d\'événement'], ['di', 'adversaire', 'sommet du diamant'],
  ['im', 'caption', 'légende d\'image'], ['gr', 'title', 'titre de groupe'], ['fo', 'html', 'pied de page'],
];
// champs en texte brut : la frappe y reste du texte
const NON = [['fa', 'items.0.k', 'clé de fiche de faits'], ['kb', 'cols.0.title', 'colonne de kanban'], ['kb', 'cols.0.cards.0.who', 'responsable'], ['tl', 'items.0.date', 'date']];
// curseur à la fin d'un champ (dans sa dernière ligne pour un bloc texte), ou à la fin du texte de sel
const FIN = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; const h = el.closest('[contenteditable="true"]'); h.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'center' }); const lg = el.matches('[data-texte]') ? [...el.querySelectorAll('.lg')].pop() : el;
  const r = document.createRange(); r.selectNodeContents(lg); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
// curseur au milieu du texte de sel (à la fin d'un lien, Chromium écrit la frappe hors du lien)
const MILIEU = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.closest('[contenteditable="true"]').focus({ preventScroll: true }); el.scrollIntoView({ block: 'center' });
  const t = el.firstChild, r = document.createRange(); r.setStart(t, 2); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
// curseur dans le bloc nav : 'avant' (fin du texte qui précède la formule) ou 'apres' (début du texte qui la suit)
const NAV = (cote) => `(() => { const f = document.querySelector('.fld[data-b="nav"] .formule'); const n = ${cote === 'avant' ? 'f.previousSibling' : 'f.nextSibling'};
  f.closest('[contenteditable="true"]').focus(); const r = document.createRange(); r.setStart(n, ${cote === 'avant' ? 'n.length' : '0'}); r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
// formules visibles d'un champ : source (annotation) et MathML affiché
const VUES = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel + ' .formule')})].filter((x) => x.getClientRects().length)
  .map((x) => (x.querySelector('math') && x.querySelector('math').getBoundingClientRect().width > 0 ? '' : '!') + (x.querySelector('annotation') || {}).textContent)`;
// toutes les chaînes du document (html enregistré)
const TEXTES = `(() => { const o = []; const v = (x) => { if (typeof x === 'string') o.push(x); else if (x && typeof x === 'object') Object.values(x).forEach(v); }; v(window.ardoise.doc); return o; })()`;
const LIGNES = (id) => `(() => { const t = (bs) => { for (const b of bs) { if (b.id === ${JSON.stringify(id)}) return b; if (b.blocks) { const x = t(b.blocks); if (x) return x; } } };
  return t(window.ardoise.doc.pages[0].blocks).lignes.map((l) => l.html).join('<br>').replace(/\\u200B/g, ''); })()`;
const SELECTION_LIGNE = (id) => `(() => { const el = document.querySelector('.fld[data-b="${id}"]'); el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'center' }); const r = document.createRange();
  r.selectNodeContents(el.querySelector('.lg')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;

export const nom = 'formules : saisie `$…$`';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  const taper = async (t) => { for (const c of t) { await cdp('Input.insertText', { text: c }); await attendre(15); } await attendre(60); };
  const touche = async (key, code, vk, modifiers = 0, commands = []) => {
    for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers, commands: type === 'rawKeyDown' ? commands : [] });
    await attendre(80);
  };
  const clic = async (sel) => {
    const p = await evalue(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || !b.getClientRects().length) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!p) { echec(`${sel} absent de l'écran`); return false; }
    for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await attendre(60); return true;
  };
  const charge = async () => { if (!(await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`))) throw new Error('document refusé'); await attendre(150); };
  await ecran(1000, false);
  await cdp('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await charger();
  await charge();

  // `$x^2$` tapé : une formule ; Ctrl+Z rend la source et ses dollars en texte
  await evalue(FIN(CHAMP('t'))); await taper('Aire $x^2$');
  attendu('`$x^2$` tapé dans un bloc texte', JSON.stringify(await evalue(VUES(CHAMP('t')))) === '["x^2"]' && (await evalue(LIGNES('t'))) === 'Aire ' + F('x^2'), [await evalue(VUES(CHAMP('t'))), await evalue(LIGNES('t'))]);
  await touche('z', 'KeyZ', 90, 2); await attendre(150);
  attendu('Ctrl+Z après la transformation', (await evalue(LIGNES('t'))) === 'Aire $x^2$' && !(await evalue(VUES(CHAMP('t')))).length, [await evalue(LIGNES('t')), await evalue(VUES(CHAMP('t')))]);

  // Retour arrière juste après une formule tapée : supprimée d'un coup
  await charge(); await evalue(FIN(CHAMP('t'))); await taper('a $y$');
  await touche('Backspace', 'Backspace', 8);
  attendu('Retour arrière après une formule tapée', (await evalue(LIGNES('t'))).replace(/&nbsp;/g, ' ') === 'a ' && !(await evalue(VUES(CHAMP('t')))).length, await evalue(LIGNES('t')));

  // prix en dollars, `$` dans le code, un lien, une pastille : du texte
  await charge(); await evalue(FIN(CHAMP('t'))); await taper('5 $ et 10 $, $ x$, $x $');
  attendu('« 5 $ et 10 $ », espaces aux bords', !(await evalue(VUES(CHAMP('t')))).length && (await evalue(LIGNES('t'))).replace(/&nbsp;/g, ' ') === '5 $ et 10 $, $ x$, $x $', await evalue(LIGNES('t')));
  for (const [sel, quoi] of [['code', 'code en ligne'], ['a', 'lien'], ['span.pill', 'pastille']]) {
    await charge(); await evalue(MILIEU(CHAMP('nn') + ' ' + sel)); await taper('$z$');
    attendu('`$z$` dans un ' + quoi, !(await evalue(VUES(CHAMP('nn')))).length && /\$z\$/.test(await evalue(LIGNES('nn'))), await evalue(LIGNES('nn')));
  }

  // curseur qui saute la formule, Retour arrière et Suppr qui la retirent d'un coup
  await charge(); await evalue(NAV('avant')); await touche('ArrowRight', 'ArrowRight', 39); await taper('Z');
  attendu('flèche droite avant la formule', (await evalue(LIGNES('nav'))) === 'a' + F('y') + 'Zb', await evalue(LIGNES('nav')));
  await charge(); await evalue(NAV('apres')); await touche('ArrowLeft', 'ArrowLeft', 37); await taper('W');
  attendu('flèche gauche après la formule', (await evalue(LIGNES('nav'))) === 'aW' + F('y') + 'b', await evalue(LIGNES('nav')));
  await charge(); await evalue(NAV('apres')); await touche('Backspace', 'Backspace', 8);
  attendu('Retour arrière après la formule', (await evalue(LIGNES('nav'))) === 'ab', await evalue(LIGNES('nav')));
  await charge(); await evalue(NAV('avant')); await touche('Delete', 'Delete', 46);
  attendu('Suppr avant la formule', (await evalue(LIGNES('nav'))) === 'ab', await evalue(LIGNES('nav')));

  // chaque champ riche transforme ; un champ en texte brut, jamais
  await charge();
  for (let i = 0; i < OUI.length; i++) {
    const [b, k, quoi] = OUI[i], sel = CHAMP(b, k), src = 'w' + i;
    if (!(await evalue(FIN(sel)))) { attendu(quoi, false, 'champ introuvable'); continue; }
    await taper(' $' + src + '$'); await attendre(300);
    const vues = await evalue(VUES(sel)), garde = (await evalue(TEXTES)).some((t) => t.includes(F(src)));
    attendu('`$…$` dans : ' + quoi, vues.includes(src) && garde, { vues, garde });
  }
  for (const [b, k, quoi] of NON) {
    if (!(await evalue(FIN(CHAMP(b, k))))) { attendu(quoi, false, 'champ introuvable'); continue; }
    await taper(' $v$'); await attendre(200);
    const vues = await evalue(VUES(CHAMP(b, k))), texte = await evalue(`document.querySelector(${JSON.stringify(CHAMP(b, k))}).textContent`);
    attendu('`$v$` reste du texte dans : ' + quoi, !vues.length && texte.includes('$v$'), { vues, texte });
  }

  // Effacer garde la formule ; gras et couleur l'enveloppent
  await charge(); await evalue(SELECTION_LIGNE('eff')); await attendre(100);
  await clic('.bmf [data-mf="clear"]'); await attendre(250);
  attendu('Effacer sur une sélection avec formule', (await evalue(LIGNES('eff'))) === 'a ' + F('y') + ' b', await evalue(LIGNES('eff')));
  await evalue(SELECTION_LIGNE('eff')); await touche('b', 'KeyB', 66, 2); await attendre(150);
  attendu('gras autour de la formule', (await evalue(LIGNES('eff'))) === '<b>a ' + F('y') + ' b</b>' && JSON.stringify(await evalue(VUES(CHAMP('eff')))) === '["y"]', [await evalue(LIGNES('eff')), await evalue(VUES(CHAMP('eff')))]);
  await evalue(SELECTION_LIGNE('eff'));
  if (await clic('.bmf [data-mf="couleur"]')) { await clic('.bmf-pal [aria-label="Bleu"]'); await attendre(250); }
  const bleu = await evalue(LIGNES('eff'));
  attendu('couleur autour de la formule', /c-bleu/.test(bleu) && bleu.includes(F('y')) && JSON.stringify(await evalue(VUES(CHAMP('eff')))) === '["y"]', [bleu, await evalue(VUES(CHAMP('eff')))]);

  // copie : MathML annoté en text/html, `$source$` en text/plain ; recollée dans Ardoise, la formule revient
  const presse = () => evalue(`(async () => { const o = {}; for (const i of await navigator.clipboard.read()) for (const t of i.types) o[t] = await (await i.getType(t)).text(); return o; })()`);
  const coller = (sel, html, texte) => evalue(`(() => { const f = document.querySelector(${JSON.stringify(sel)}); f.focus(); const lg = f.matches('[data-texte]') ? f.querySelector('.lg') : f;
    const r = document.createRange(); r.selectNodeContents(lg); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const dt = new DataTransfer(); dt.setData('text/html', ${JSON.stringify(html)}); dt.setData('text/plain', ${JSON.stringify(texte)});
    (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentNode).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return true; })()`);
  for (const [b, k, quoi, brut, src] of [['tb', 'rows.1.1', 'cellule', 'Cellule $\\frac{1}{2}$', '\\frac{1}{2}'], ['nav', null, 'bloc texte', 'a$y$b', 'y']]) {
    await charge();
    await evalue(`(() => { const f = document.querySelector(${JSON.stringify(CHAMP(b, k))}); f.focus(); const r = document.createRange(); r.selectNodeContents(f.matches('[data-texte]') ? f.querySelector('.lg') : f);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
    await touche('c', 'KeyC', 67, 2, ['copy']); await attendre(150);
    const cp = await presse();
    attendu('copie d\'une ' + quoi + ' avec formule', /<math[\s\S]*<annotation encoding="application\/x-tex">/.test(cp['text/html'] || '') && cp['text/plain'] === brut, cp);
    await coller(CHAMP('t'), cp['text/html'] || '', cp['text/plain'] || ''); await attendre(150);
    attendu('collage dans Ardoise d\'une ' + quoi + ' copiée', (await evalue(VUES(CHAMP('t')))).includes(src) && (await evalue(LIGNES('t'))).includes(F(src)), [await evalue(VUES(CHAMP('t'))), await evalue(LIGNES('t'))]);
  }
  await charge();   // document d'origine remis : rien à confirmer au chargement suivant
}
