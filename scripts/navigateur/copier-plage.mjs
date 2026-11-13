// Sujet : plage de cellules. En édition, Maj+clic ou Maj+flèche au bord d'une cellule sélectionne une plage surlignée ;
// Ctrl+C la copie en texte à tabulations (pastilles en #nom) et en tableau HTML qui se recolle dans Ardoise ; Ctrl+X et
// Suppr la vident en une étape « cellules vidées » ; un clic simple la défait ; les lignes masquées par le filtre sont
// exclues. En lecture, copier un tableau sélectionné donne déjà des tabulations (constat de Chromium, pas de gestionnaire).
// Origine : spec saisie-et-tableaux, élément 53. Gestes, presse-papier et surlignage ne se voient que dans un vrai navigateur.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROWS = [['Nom', 'Statut', 'Note'], ['A &amp; B', '<span class="pill">OK</span>', 'bien'], ['C', 'x', 'y'], ['D', 'z', 'bon']];
const DOC = { v: 5, id: 'doc-plage-copie', title: 'Plage', tags: { ok: { c: 0 } }, pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 't1', type: 'table', rows: ROWS },
  { id: 't2', type: 'table', rows: [['Cible', 'B'], ['', '']] },
] }] };
const K = { c: 'copy', x: 'cut', v: 'paste' };

export const nom = 'copier une plage';
export default async function ({ ecran, cdp, evalue, attendre, mesure, echec }) {
  const dir = mkdtempSync(join(tmpdir(), 'ardoise-plage-copie-'));
  try {
    const source = readFileSync(new URL('../../dist/ardoise.html', import.meta.url), 'utf8');
    const balise = '<script id="ardoise-doc" type="application/json">{}</script>';
    if (!source.includes(balise)) throw new Error('document embarqué introuvable dans dist/ardoise.html');
    const fichier = join(dir, 'plage.html');
    writeFileSync(fichier, source.replace(balise, balise.replace('{}', JSON.stringify(DOC).replace(/<\//g, '<\\/'))));
    await ecran(1000, false);
    await cdp('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
    await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp('Page.navigate', { url: 'file://' + fichier });
    for (let i = 0; i < 100 && !(await evalue('document.readyState === "complete" && !!document.querySelector("#app table")')); i++) await attendre(50);

    // touches réelles (Ctrl = 2, Maj = 8) ; Ctrl+C, X, V portent la commande d'édition du navigateur
    const touche = async (key, mods = 0) => {
      const code = key.length === 1 ? 'Key' + key.toUpperCase() : key, vk = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46, Escape: 27 }[key] || key.toUpperCase().charCodeAt(0);
      for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, modifiers: mods, key, code, windowsVirtualKeyCode: vk, commands: type === 'rawKeyDown' && mods === 2 && K[key] ? [K[key]] : [] });
      await attendre(150);
    };
    const sel = (b, r, c) => `.fld[data-b="${b}"][data-k="rows.${r}.${c}"]`;
    const clic = async (s, mods = 0) => {
      const p = await evalue(`(() => { const f = document.querySelector(${JSON.stringify(s)}); if (!f) return null; f.scrollIntoView({ block: 'center' }); const r = f.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (!p) { echec('cellule introuvable : ' + s); return; }
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1, modifiers: mods });
      await attendre(120);
    };
    const finDeCellule = (s) => evalue(`(() => { const f = document.querySelector(${JSON.stringify(s)}); f.focus(); const r = document.createRange(); r.selectNodeContents(f); r.collapse(false); const x = getSelection(); x.removeAllRanges(); x.addRange(r); return true; })()`);
    const surlignees = () => evalue('[...document.querySelectorAll(".fld.plage")].map((f) => f.dataset.b + ":" + f.dataset.k)');
    const presse = () => evalue(`(async () => { const o = {}; for (const i of await navigator.clipboard.read()) for (const t of i.types) o[t] = await (await i.getType(t)).text(); return o; })()`);
    const textes = (b) => evalue(`(() => { const g = []; document.querySelectorAll('.fld[data-b="${b}"][data-k^="rows."]').forEach((f) => { const [, r, c] = f.dataset.k.split('.'); (g[+r] = g[+r] || [])[+c] = f.textContent; }); return g; })()`);
    const annuler = () => evalue('document.querySelector(\'[data-ui="undo"]\').title');
    const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const T1 = [['Nom', 'Statut', 'Note'], ['A & B', 'OK', 'bien'], ['C', 'x', 'y'], ['D', 'z', 'bon']];

    await touche('e', 2);   // Ctrl+E : édition
    for (let i = 0; i < 40 && !(await evalue('!!document.querySelector(".fld[data-b=t1]")')); i++) await attendre(50);

    // Maj+clic : plage surlignée ; Ctrl+C : texte à tabulations, pastille en #nom
    mesure();
    await clic(sel('t1', 1, 0));
    await clic(sel('t1', 2, 1), 8);
    const s1 = await surlignees();
    if (!egal(s1.sort(), ['t1:rows.1.0', 't1:rows.1.1', 't1:rows.2.0', 't1:rows.2.1'])) echec('Maj+clic : cellules surlignées ' + JSON.stringify(s1));
    const fonds = await evalue(`[${JSON.stringify(sel('t1', 1, 0))}, ${JSON.stringify(sel('t1', 3, 2))}].map((s) => getComputedStyle(document.querySelector(s)).backgroundColor)`);
    if (fonds[0] === fonds[1]) echec('surlignage invisible : même fond dans et hors de la plage (' + fonds[0] + ')');
    await touche('c', 2);
    const p1 = await presse();
    if (p1['text/plain'] !== 'A & B\t#OK\nC\tx') echec(`Ctrl+C : text/plain ${JSON.stringify(p1['text/plain'])}`);

    // un clic simple défait la plage ; Ctrl+V dans un autre tableau recolle la plage, pastille comprise
    mesure();
    await clic(sel('t2', 1, 0));
    if ((await surlignees()).length) echec('clic simple : la plage reste surlignée');
    await touche('v', 2);
    const t2 = await textes('t2');
    if (!egal(t2, [['Cible', 'B'], ['A & B', 'OK'], ['C', 'x']])) echec('recollage : ' + JSON.stringify(t2));
    if (!(await evalue(`!!document.querySelector(${JSON.stringify(sel('t2', 1, 1) + ' span.pill')})`))) echec('recollage : la pastille n\'est plus une pastille');

    // Maj+flèche au bord d'une cellule : la plage part de la cellule et s'étend ; Ctrl+X la coupe en « cellules vidées »
    mesure();
    await finDeCellule(sel('t1', 2, 0));
    await touche('ArrowRight', 8);
    await touche('ArrowDown', 8);
    const s2 = await surlignees();
    if (!egal(s2.sort(), ['t1:rows.2.0', 't1:rows.2.1', 't1:rows.3.0', 't1:rows.3.1'])) echec('Maj+flèche : cellules surlignées ' + JSON.stringify(s2));
    await touche('x', 2);
    const p2 = await presse();
    if (p2['text/plain'] !== 'C\tx\nD\tz') echec(`Ctrl+X : text/plain ${JSON.stringify(p2['text/plain'])}`);
    const coupe = await textes('t1');
    if (!egal(coupe, [T1[0], T1[1], ['', '', 'y'], ['', '', 'bon']])) echec('Ctrl+X : cellules ' + JSON.stringify(coupe));
    if (!/cellules vidées/.test(await annuler())) echec('Ctrl+X : libellé « ' + (await annuler()) + ' »');
    await touche('z', 2);
    if (!egal(await textes('t1'), T1)) echec('Ctrl+Z après Ctrl+X : ' + JSON.stringify(await textes('t1')));

    // sans Maj, la flèche passe à la cellule voisine, sans plage ; Suppr vide une plage
    mesure();
    await finDeCellule(sel('t1', 1, 2));
    await touche('ArrowRight');
    const ici = await evalue('document.activeElement.dataset.k');
    if (ici !== 'rows.2.0' || (await surlignees()).length) echec(`flèche sans Maj : curseur en ${ici}, plage ${JSON.stringify(await surlignees())}`);
    await clic(sel('t1', 3, 2), 8);
    await touche('Delete');
    const vide = await textes('t1');
    if (!egal(vide, [T1[0], T1[1], ['', '', ''], ['', '', '']])) echec('Suppr : cellules ' + JSON.stringify(vide));
    if (!/cellules vidées/.test(await annuler())) echec('Suppr : libellé « ' + (await annuler()) + ' »');
    // une plage dont une seule cellule était pleine : toujours « cellules vidées »
    await clic(sel('t1', 1, 2));
    await clic(sel('t1', 2, 2), 8);
    await touche('Delete');
    if (!/cellules vidées/.test(await annuler())) echec('Suppr d\'une seule cellule pleine : libellé « ' + (await annuler()) + ' »');
    await touche('z', 2);
    await touche('z', 2);

    // glisser d'une cellule à une autre : plage, sans texte sélectionné
    mesure();
    const centre = (s) => evalue(`(() => { const r = document.querySelector(${JSON.stringify(s)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const a = await centre(sel('t1', 0, 1)), z = await centre(sel('t1', 1, 2));
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x, y: a.y, button: 'none' });
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: a.x, y: a.y, button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 5; i++) await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x + (z.x - a.x) * i / 5, y: a.y + (z.y - a.y) * i / 5, button: 'left', buttons: 1 });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: z.x, y: z.y, button: 'left', buttons: 0, clickCount: 1 });
    await attendre(120);
    const s4 = await surlignees();
    if (!egal(s4.sort(), ['t1:rows.0.1', 't1:rows.0.2', 't1:rows.1.1', 't1:rows.1.2'])) echec('glisser : cellules surlignées ' + JSON.stringify(s4));
    await touche('c', 2);
    if ((await presse())['text/plain'] !== 'Statut\tNote\n#OK\tbien') echec('glisser puis Ctrl+C : ' + JSON.stringify((await presse())['text/plain']));
    await touche('Escape');
    if ((await surlignees()).length) echec('Échap : la plage reste');

    // filtre : les lignes masquées ne sont ni surlignées ni copiées
    mesure();
    await evalue(`document.querySelector('.filtre[data-filtre="t1"] .filtre-b').click()`);
    await attendre(100);
    await evalue(`(() => { const q = document.querySelector('.filtre[data-filtre="t1"] .filtre-q'); q.value = 'b'; q.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await attendre(100);
    if (!(await evalue(`!!document.querySelector(${JSON.stringify(sel('t1', 2, 0))}).closest('tr[hidden]')`))) echec('filtre : la ligne « C » devrait être masquée');
    await clic(sel('t1', 1, 0));
    await clic(sel('t1', 3, 0), 8);
    const s3 = await surlignees();
    if (!egal(s3.sort(), ['t1:rows.1.0', 't1:rows.3.0'])) echec('filtre : cellules surlignées ' + JSON.stringify(s3));
    await touche('c', 2);
    const p3 = await presse();
    if (p3['text/plain'] !== 'A & B\nD') echec(`filtre : text/plain ${JSON.stringify(p3['text/plain'])}`);
    await evalue(`document.querySelector('.filtre[data-filtre="t1"] .filtre-x').click()`);

    // lecture : un tableau sélectionné se copie déjà en tabulations
    mesure();
    await touche('e', 2);
    for (let i = 0; i < 40 && (await evalue('!!document.querySelector(".fld")')); i++) await attendre(50);
    await evalue(`(() => { const t = document.querySelector('#app table'), r = document.createRange(); r.selectNode(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); })()`);
    await touche('c', 2);
    const lu = (await presse())['text/plain'] || '';
    if (lu.replace(/\n$/, '') !== 'Nom\tStatut\tNote\nA & B\t#OK\tbien\nC\tx\ty\nD\tz\tbon') echec(`lecture : text/plain ${JSON.stringify(lu)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
