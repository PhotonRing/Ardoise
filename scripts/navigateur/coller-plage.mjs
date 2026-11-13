// Sujet : coller une plage de cellules. Dans une cellule, la plage remplit le tableau à partir de cette cellule et l'agrandit,
// en une étape « cellules collées », sans les styles du tableur ; ailleurs, elle crée un bloc tableau (à la place d'un
// paragraphe vide, sinon après le bloc) ; un texte de plusieurs lignes sans tabulation reste dans sa cellule.
// Origine : spec saisie-et-tableaux, élément 53. Assainissement, focus et rendu ne se voient que dans un vrai navigateur.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DOC = { v: 5, id: 'doc-plage', title: 'Plage', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 't1', type: 'table', rows: [['Ville', 'Pays'], ['Lyon', 'France']] },
  { id: 'v1', type: 'p', html: '' },
  { id: 'x1', type: 'p', html: 'Texte' },
] }] };
const fixture = (n) => readFileSync(new URL('../fixtures/presse-papier/' + n + '.html', import.meta.url), 'utf8');
const TSV = 'Nom\tÂge\tSite\r\nAlice\t31\tExemple\r\nBob & Co\t\t"deux\nlignes"\r\n';

export const nom = 'coller une plage';
export default async function ({ ecran, cdp, evalue, attendre, mesure, echec }) {
  const dir = mkdtempSync(join(tmpdir(), 'ardoise-plage-'));
  try {
    const source = readFileSync(new URL('../../dist/ardoise.html', import.meta.url), 'utf8');
    const balise = '<script id="ardoise-doc" type="application/json">{}</script>';
    if (!source.includes(balise)) throw new Error('document embarqué introuvable dans dist/ardoise.html');
    const fichier = join(dir, 'plage.html');
    writeFileSync(fichier, source.replace(balise, balise.replace('{}', JSON.stringify(DOC).replace(/<\//g, '<\\/'))));
    await ecran(1000, false);
    await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp('Page.navigate', { url: 'file://' + fichier });
    for (let i = 0; i < 100 && !(await evalue('document.readyState === "complete" && !!document.querySelector("#app table")')); i++) await attendre(50);
    const touche = async (k) => {
      for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, modifiers: 2, key: k, code: 'Key' + k.toUpperCase(), windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) });
      await attendre(150);
    };
    await touche('e');   // Ctrl+E : édition
    for (let i = 0; i < 40 && !(await evalue('!!document.querySelector(".fld[data-b=t1]")')); i++) await attendre(50);

    // collage synthétique (DataTransfer) dans le champ choisi, qui reçoit d'abord le focus
    // avecImage : comme LibreOffice Calc et Excel, le presse-papier porte aussi une image de la plage
    const coller = async (sel, html, texte, avecImage) => {
      const ok = await evalue(`(() => { const f = document.querySelector(${JSON.stringify(sel)}); if (!f) return false; f.focus();
        const dt = new DataTransfer(); if (${JSON.stringify(html)}) dt.setData('text/html', ${JSON.stringify(html)}); dt.setData('text/plain', ${JSON.stringify(texte)});
        if (${!!avecImage}) dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'plage.png', { type: 'image/png' }));
        f.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return true; })()`);
      if (!ok) echec('champ introuvable : ' + sel);
      await attendre(150);
    };
    // grille d'un bloc tableau lue sur ses cellules (data-k = rows.r.c) : texte, ou HTML
    const grille = (b, html) => evalue(`(() => { const g = []; document.querySelectorAll('.fld[data-b="${b}"][data-k^="rows."]').forEach((f) => {
      const [, r, c] = f.dataset.k.split('.'); (g[+r] = g[+r] || [])[+c] = ${html ? 'f.innerHTML' : 'f.textContent'}; }); return g; })()`);
    const blocs = () => evalue('[...document.querySelectorAll("#app .blk[data-id]")].map((b) => b.querySelector("table") ? "table" : b.dataset.id)');
    const tableau = () => evalue('(() => { const b = [...document.querySelectorAll("#app .blk[data-id]")].find((x) => x.querySelector("table") && x.dataset.id !== "t1"); return b ? b.dataset.id : null; })()');
    const annuler = () => evalue('document.querySelector(\'[data-ui="undo"]\').title');
    const PLAGE = [['Ville', 'Pays', 'Colonne', 'Colonne'], ['Lyon', 'Nom', 'Âge', 'Site'], ['', 'Alice', '31', 'Exemple'], ['', 'Bob & Co', '', 'deux lignes']];

    // cellule : la plage d'Excel remplit le tableau à partir de la cellule et l'agrandit, sans les styles d'Excel
    mesure();
    await coller('.fld[data-b="t1"][data-k="rows.1.1"]', fixture('excel'), TSV);
    const g = await grille('t1');
    if (JSON.stringify(g) !== JSON.stringify(PLAGE)) echec(`cellule : grille ${JSON.stringify(g)} au lieu de ${JSON.stringify(PLAGE)}`);
    const h = (await grille('t1', true)).flat().join('|');
    if (/style=|class="?xl|<font|mso-/i.test(h)) echec('cellule : des styles d\'Excel restent : ' + h);
    if (!h.includes('<a href="https://exemple.fr/"')) echec('cellule : le lien est perdu : ' + h);
    if (!/cellules collées/.test(await annuler())) echec('cellule : libellé d\'annulation « ' + (await annuler()) + ' »');
    const actif = await evalue('document.activeElement && document.activeElement.dataset.k');
    if (actif !== 'rows.1.1') echec(`cellule : le curseur est dans ${actif} au lieu de la cellule de départ rows.1.1`);
    await touche('z');
    const avant = await grille('t1');
    if (JSON.stringify(avant) !== JSON.stringify(DOC.pages[0].blocks[0].rows)) echec('Ctrl+Z ne retire pas la plage d\'un coup : ' + JSON.stringify(avant));

    // cellule : un texte de plusieurs lignes sans tabulation reste dans la cellule
    mesure();
    await coller('.fld[data-b="t1"][data-k="rows.1.0"]', '', 'un\ndeux');
    const seul = await grille('t1');
    if (seul.length !== 2 || seul[1][0] !== 'Lyonun deux' && seul[1][0] !== 'un deuxLyon') echec('texte multiligne : ' + JSON.stringify(seul));

    // paragraphe vide : remplacé par un tableau, première ligne en en-tête, gras et lien de Calc gardés, couleurs perdues ;
    // l'image de la plage que Calc joint au presse-papier ne l'emporte pas sur le tableau
    mesure();
    await coller('.fld[data-b="v1"]', fixture('calc'), TSV, true);
    const ordre = await blocs();
    if (JSON.stringify(ordre) !== JSON.stringify(['table', 'table', 'x1'])) echec('paragraphe vide : blocs ' + JSON.stringify(ordre));
    const nt = await tableau();
    if (nt) {
      const gc = await grille(nt), hc = await grille(nt, true);
      if (JSON.stringify(gc) !== JSON.stringify([['Nom', 'Âge', 'Site'], ['Alice', '31', 'Exemple'], ['Bob & Co', '', 'deux lignes']])) echec('paragraphe vide : grille ' + JSON.stringify(gc));
      if (!/<b>Alice<\/b>/.test(hc[1][0])) echec('paragraphe vide : gras perdu : ' + hc[1][0]);
      if (/color|font|bgcolor/i.test(hc.flat().join('|'))) echec('paragraphe vide : couleurs de Calc gardées : ' + hc.flat().join('|'));
      if (!(await evalue(`!!document.querySelector('thead .fld[data-b="${nt}"][data-k="rows.0.0"]')`))) echec('paragraphe vide : la première ligne n\'est pas l\'en-tête');
    }

    // paragraphe non vide : le tableau vient après lui
    mesure();
    await coller('.fld[data-b="x1"]', '', 'a\tb\nc\td');
    const fin = await blocs();
    if (JSON.stringify(fin) !== JSON.stringify(['table', 'table', 'x1', 'table'])) echec('paragraphe non vide : blocs ' + JSON.stringify(fin));
    if ((await evalue('document.querySelector(\'.fld[data-b="x1"]\').textContent')) !== 'Texte') echec('paragraphe non vide : son texte a changé');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
