// Sujet : importer du Markdown. L'entrée n'existe qu'en édition ; la fenêtre refuse un texte vide, lit un fichier .md
// (BOM et fins de ligne Windows), avertit avant de remplacer une page qui a du contenu, remplace la page courante seulement
// (en-tête et pied de page gardés), assainit le HTML, et Ctrl+Z défait l'import d'un coup. Origine : spec pages-et-fichiers, élément 35.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DOC = { v: 5, id: 'doc-md', title: 'Import', pages: [
  { id: 'p1', title: 'Accueil', blocks: [{ id: 'h1', type: 'header', eyebrow: 'Surtitre', title: 'Accueil', lede: '' }, { id: 'x1', type: 'p', html: 'Texte existant' }, { id: 'f1', type: 'footer', html: 'Pied gardé' }] },
  { id: 'p2', title: 'Vide', blocks: [{ id: 'h2', type: 'header', eyebrow: '', title: 'Vide', lede: '' }, { id: 'v1', type: 'p', html: '' }] },
] };
const NOTE = readFileSync(new URL('../fixtures/markdown/note-obsidian.md', import.meta.url), 'utf8') +
  '\nPiège <b onclick="window.piege=1">gras</b><script>window.piege=2<\/script> <img src=x onerror="window.piege=3">\n';

export const nom = 'importer du Markdown';
export default async function ({ ecran, cdp, evalue, attendre, dialogues, mesure, echec }) {
  const dir = mkdtempSync(join(tmpdir(), 'ardoise-md-'));
  try {
    const source = readFileSync(new URL('../../dist/ardoise.html', import.meta.url), 'utf8');
    const balise = '<script id="ardoise-doc" type="application/json">{}</script>';
    if (!source.includes(balise)) throw new Error('document embarqué introuvable dans dist/ardoise.html');
    const fichier = join(dir, 'import.html'), note = join(dir, 'note.md');
    writeFileSync(fichier, source.replace(balise, balise.replace('{}', JSON.stringify(DOC).replace(/<\//g, '<\\/'))));
    writeFileSync(note, '﻿' + NOTE.replace(/\n/g, '\r\n'));
    await ecran(1000, false);
    await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp('Page.navigate', { url: 'file://' + fichier });
    for (let i = 0; i < 100 && !(await evalue('document.readyState === "complete" && !!document.querySelector("#app .b-header")')); i++) await attendre(50);
    const touche = async (k, modifiers = 2, code = 'Key' + k.toUpperCase(), vk = k.toUpperCase().charCodeAt(0)) => {
      for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, modifiers, key: k, code, windowsVirtualKeyCode: vk });
      await attendre(150);
    };
    const clic = async (sel) => { const ok = await evalue(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`); await attendre(120); return ok; };
    const ouvrir = async () => { await clic('[data-ui="file"]'); if (!(await clic('[data-f="md-import"]'))) echec('entrée « Importer du Markdown… » absente du menu Fichier'); };
    const fenetre = '.modal-bg [role=dialog][aria-label="Importer du Markdown"]';
    const texte = (sel) => evalue(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.textContent : null; })()`);

    // lecture : ni bouton Fichier, ni entrée dans le menu de lecture
    mesure();
    await clic('[data-ui="vmenu"]');
    if (await evalue('!!document.querySelector(\'[data-ui="file"], [data-f="md-import"]\')')) echec('lecture : l\'import Markdown est proposé');
    await touche('Escape', 0, 'Escape', 27);

    await touche('e');   // Ctrl+E : édition
    for (let i = 0; i < 40 && !(await evalue('!!document.querySelector(".fld[data-b=x1]")')); i++) await attendre(50);

    // texte vide : erreur dans la fenêtre, qui reste ouverte, page intacte
    mesure();
    await ouvrir();
    if (!(await evalue(`!!document.querySelector('${fenetre}')`))) echec('la fenêtre ne s\'ouvre pas');
    await evalue(`document.querySelector('${fenetre} textarea').value = '  \\n '`);
    await clic(fenetre + ' [data-m="2"]');
    if (!(await texte('#mderr'))) echec('texte vide : pas de message d\'erreur');
    if (!(await evalue(`!!document.querySelector('${fenetre}')`))) echec('texte vide : la fenêtre s\'est fermée');

    // fichier .md (BOM, \r\n) injecté dans le champ de fichier : il remplit la zone de texte
    mesure();
    const { root } = (await cdp('DOM.getDocument', { depth: -1, pierce: true })).result;
    const { nodeId } = (await cdp('DOM.querySelector', { nodeId: root.nodeId, selector: fenetre + ' input[type=file]' })).result;
    await cdp('DOM.setFileInputFiles', { nodeId, files: [note] });
    for (let i = 0; i < 40 && !(await evalue(`document.querySelector('${fenetre} textarea').value.length > 10`)); i++) await attendre(50);
    const zone = await evalue(`document.querySelector('${fenetre} textarea').value`);
    if (!zone.startsWith('# Réunion de lancement\n')) echec('fichier : zone de texte ' + JSON.stringify(zone.slice(0, 40)));
    if (await texte('#mderr')) echec('fichier : l\'erreur précédente reste affichée');

    // page avec du contenu : avertissement, puis la page est remplacée, en-tête (titre) et pied de page gardés
    mesure();
    const nd = dialogues.length;
    await clic(fenetre + ' [data-m="2"]');
    await attendre(200);
    if (dialogues.length !== nd + 1 || dialogues[nd].type !== 'confirm' || !/Accueil/.test(dialogues[nd].message)) echec('pas d\'avertissement avant de remplacer la page : ' + JSON.stringify(dialogues.slice(nd)));
    if (await evalue(`!!document.querySelector('${fenetre}')`)) echec('import : la fenêtre reste ouverte');
    const vu = await evalue(`(() => { const a = document.querySelector('#app'); return {
      titre: a.querySelector('.b-header [data-k="title"]').textContent, surtitre: a.querySelector('.b-header [data-k="eyebrow"]').textContent,
      h2: [...a.querySelectorAll('h2')].map((e) => e.textContent), h3: [...a.querySelectorAll('h3')].map((e) => e.textContent),
      ol: a.querySelectorAll('ol.list li').length, cases: [...a.querySelectorAll('input[type=checkbox]')].map((c) => c.checked),
      warn: (a.querySelector('.note.n-warn') || {}).innerHTML, info: a.querySelectorAll('.note.n-info').length, plie: !!a.querySelector('.fold-edit'),
      table: [...a.querySelectorAll('table th')].map((e) => e.textContent), lien: !!a.querySelector('table a[href="https://exemple.fr/devis"]'),
      code: (a.querySelector('.code textarea') || {}).value, sep: a.querySelectorAll('hr').length, pied: a.textContent.includes('Pied gardé'), ancien: a.textContent.includes('Texte existant'),
      piege: window.piege || 0, onclick: !!a.querySelector('[onclick], img, script') }; })()`);
    const attendu = { titre: 'Réunion de lancement', surtitre: 'Surtitre', h2: ['Ordre du jour'], h3: ['Tâches'], ol: 4, cases: [true, false, false, false],
      info: 1, plie: true, table: ['Poste', 'Montant'], lien: true, code: '# installation\nnpm install', sep: 1, pied: true, ancien: false, piege: 0, onclick: false };
    for (const k in attendu) if (JSON.stringify(vu[k]) !== JSON.stringify(attendu[k])) echec(`import : ${k} = ${JSON.stringify(vu[k])} au lieu de ${JSON.stringify(attendu[k])}`);
    if (!/<b>Budget serré<\/b>/.test(vu.warn || '')) echec('import : titre de l\'encadré perdu : ' + vu.warn);

    // une seule étape « page importée du Markdown », défaite d'un Ctrl+Z
    mesure();
    const libelle = await evalue('document.querySelector(\'[data-ui="undo"]\').title');
    if (!/page importée du Markdown/.test(libelle)) echec('libellé d\'annulation « ' + libelle + ' »');
    await touche('z');
    const apres = await evalue('[document.querySelector("#app .b-header [data-k=title]").textContent, document.querySelector("#app").textContent.includes("Texte existant"), document.querySelectorAll("#app h2").length]');
    if (JSON.stringify(apres) !== JSON.stringify(['Accueil', true, 0])) echec('Ctrl+Z ne rend pas la page d\'avant : ' + JSON.stringify(apres));

    // page vide : pas d'avertissement, seule la page courante change ; sans titre #, l'en-tête garde son titre
    mesure();
    await touche('PageDown', 1, 'PageDown', 34);
    await ouvrir();
    await evalue(`document.querySelector('${fenetre} textarea').value = '## Section\\n\\n- a\\n- b'`);
    const nv = dialogues.length;
    await clic(fenetre + ' [data-m="2"]');
    if (dialogues.length !== nv) echec('page vide : avertissement inutile');
    const p2 = await evalue('[document.querySelector("#app .b-header [data-k=title]").textContent, [...document.querySelectorAll("#app h2")].map((e) => e.textContent), document.querySelectorAll("#app ul.list li").length]');
    if (JSON.stringify(p2) !== JSON.stringify(['Vide', ['Section'], 2])) echec('page vide : ' + JSON.stringify(p2));
    await touche('PageUp', 1, 'PageUp', 33);
    if (!(await evalue('document.querySelector("#app").textContent.includes("Texte existant")'))) echec('l\'import a touché une autre page que la page courante');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
