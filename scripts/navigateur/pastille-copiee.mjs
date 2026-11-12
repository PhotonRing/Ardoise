// Sujet : pastille copiée. Ctrl+C sur un passage qui contient des pastilles met « #nom » dans le texte brut (édition et lecture) ;
// Ctrl+V dans un champ riche la recolle en pastille peinte aussitôt, avec son exception de couleur si elle vient du même document ;
// dans un champ non riche, « #nom » ; un « #nom » brut ne devient pas une pastille.
// Origine : spec saisie-et-tableaux, élément 55. Le presse-papier et la peinture ne se voient que dans un vrai navigateur.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const P = (t, c) => `<span class="pill${c ? ' ' + c : ''}">${t}</span>`;
const DOC = { v: 5, id: 'doc-pastilles', title: 'Pastilles', tags: { ok: { c: 0 } }, pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'a1', type: 'p', html: 'Statut ' + P('OK') + ' et ' + P('Urgent', 'pc-5') + ' fin' },
  { id: 'a2', type: 'p', html: 'Cible' },
  { id: 'a3', type: 'p', html: 'Autre' },
  { id: 'a4', type: 'kanban', cols: [{ id: 'c1', title: 'Colonne', cards: [] }] },
] }] };

export const nom = 'pastille copiée';
export default async function ({ ecran, cdp, evalue, attendre, mesure, echec }) {
  const dir = mkdtempSync(join(tmpdir(), 'ardoise-pastille-'));
  try {
    const source = readFileSync(new URL('../../dist/ardoise.html', import.meta.url), 'utf8');
    const balise = '<script id="ardoise-doc" type="application/json">{}</script>';
    if (!source.includes(balise)) throw new Error('document embarqué introuvable dans dist/ardoise.html');
    const fichier = join(dir, 'pastilles.html');
    writeFileSync(fichier, source.replace(balise, balise.replace('{}', JSON.stringify(DOC).replace(/<\//g, '<\\/'))));
    await ecran(1000, false);
    await cdp('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
    await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp('Page.navigate', { url: 'file://' + fichier });
    for (let i = 0; i < 100 && !(await evalue('document.readyState === "complete" && !!document.querySelector("#app .pill")')); i++) await attendre(50);

    const touche = async (k, cmd) => {
      for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, modifiers: 2, key: k, code: 'Key' + k.toUpperCase(), windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0), commands: type === 'keyDown' && cmd ? [cmd] : [] });
      await attendre(150);
    };
    const presse = () => evalue(`(async () => { const o = {}; for (const i of await navigator.clipboard.read()) for (const t of i.types) o[t] = await (await i.getType(t)).text(); return o; })()`);
    const choisir = (sel, fin) => evalue(`(() => { const f = document.querySelector(${JSON.stringify(sel)}); if (!f) return false; if (f.focus) f.focus(); const r = document.createRange(); r.selectNodeContents(f); if (${!!fin}) r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
    const pastilles = (sel) => evalue(`[...document.querySelectorAll(${JSON.stringify(sel + ' span.pill')})].map((p) => ({ t: p.textContent, c: p.className, fond: getComputedStyle(p).backgroundColor }))`);
    const ATTENDU = 'Statut #OK et #Urgent fin';

    // lecture d'abord (le fichier s'ouvre en lecture)
    mesure();
    if (!(await choisir('#app [data-bid="a1"]'))) echec('lecture : paragraphe introuvable');
    await touche('c', 'copy');
    const lu = await presse();
    if (lu['text/plain'] !== ATTENDU) echec(`lecture, copie : text/plain « ${lu['text/plain']} » au lieu de « ${ATTENDU} »`);

    await touche('e');   // Ctrl+E : édition
    for (let i = 0; i < 40 && !(await evalue('!!document.querySelector(".fld[data-b=a1]")')); i++) await attendre(50);
    const origine = await pastilles('.fld[data-b="a1"]');

    // édition : copie
    mesure();
    await choisir('.fld[data-b="a1"]');
    await touche('c', 'copy');
    const ed = await presse();
    if (ed['text/plain'] !== ATTENDU) echec(`édition, copie : text/plain « ${ed['text/plain']} » au lieu de « ${ATTENDU} »`);
    if (/\bpa-\d/.test(ed['text/html'] || '')) echec('édition, copie : le HTML garde la couleur calculée pa-N');
    if (!/class="pill"/.test(ed['text/html'] || '')) echec('édition, copie : pas de pastille dans le HTML');

    // collage dans un champ riche : pastilles peintes aussitôt, exception gardée (même document)
    mesure();
    await choisir('.fld[data-b="a2"]', true);
    await touche('v', 'paste');
    const collees = await pastilles('.fld[data-b="a2"]');
    if (collees.length !== 2) echec(`collage riche : ${collees.length} pastille(s) au lieu de 2`);
    else {
      if (collees[0].fond !== origine[0].fond) echec(`collage riche : « OK » non peinte (${collees[0].fond} au lieu de ${origine[0].fond})`);
      if (!/\bpc-5\b/.test(collees[1].c) || collees[1].fond !== origine[1].fond) echec(`collage riche : exception de « Urgent » perdue (${collees[1].c})`);
    }
    if (/data-ad/.test(await evalue('document.querySelector(\'.fld[data-b="a2"]\').innerHTML'))) echec('collage riche : la marque de provenance reste dans le champ');

    // collage dans un champ non riche : #nom
    mesure();
    await choisir('.fld[data-b="a4"][data-k="cols.0.title"]', true);
    await touche('v', 'paste');
    const titre = await evalue('document.querySelector(\'.fld[data-b="a4"][data-k="cols.0.title"]\').textContent');
    if (titre !== 'Colonne' + ATTENDU) echec(`collage non riche : « ${titre} » au lieu de « Colonne${ATTENDU} »`);

    // collage venu d'un autre document : l'exception laisse la place au registre d'arrivée ; « #nom » brut reste du texte
    mesure();
    const coller = (html, texte) => evalue(`(() => { const dt = new DataTransfer(); if (${JSON.stringify(html)}) dt.setData('text/html', ${JSON.stringify(html)}); dt.setData('text/plain', ${JSON.stringify(texte)});
      const f = document.querySelector('.fld[data-b="a3"]'); f.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return true; })()`);
    await choisir('.fld[data-b="a3"]', true);
    await coller('<span class="pill pc-5" data-ad="un-autre-doc">OK</span>', '#OK');
    const ailleurs = await pastilles('.fld[data-b="a3"]');
    if (ailleurs.length !== 1 || /\bpc-/.test(ailleurs[0].c) || ailleurs[0].fond !== origine[0].fond) echec(`collage d'un autre document : ${JSON.stringify(ailleurs)} au lieu de « OK » à la couleur du registre`);
    await coller('', ' #Brut');
    const brut = await evalue('document.querySelector(\'.fld[data-b="a3"]\').textContent');
    if (!/#Brut/.test(brut) || (await pastilles('.fld[data-b="a3"]')).length !== 1) echec(`collage de « #Brut » : ${brut}, une pastille a été créée`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
