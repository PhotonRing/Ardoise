// Banc d'essai du rendu (src/js/07-rendu.js, 07-requetes.js, 07-kanban.js) et du runtime de lecture (01-lecture.js,
// scripts/fermeture.mjs). Une page, le sommaire, les requêtes et le fichier enregistré sont rendus dans node:vm, sans DOM, à partir d'un document et d'un contexte explicite. Les
// fonctions qui exigent le DOM (assainisseur R, textOf, linesHTML) et la couleur des pastilles (paintPills) sont
// remplacées par des équivalents purs : l'assainissement n'est pas couvert ici. La globale `doc` est piégée et l'état
// de vue de l'éditeur (mode, tris, plis) est rempli : le rendu ne doit lire ni l'un ni l'autre.  node scripts/test-rendu.mjs
// Les essais sont rangés par sujet dans scripts/rendu/ : un fichier par sujet, pour que des tickets parallèles n'éditent pas le même fichier.
import { readdirSync } from 'node:fs';
import { tests } from './rendu/commun.mjs';

const dossier = new URL('./rendu/', import.meta.url);
for (const f of readdirSync(dossier).filter((f) => f.endsWith('.mjs') && f !== 'commun.mjs').sort()) await import(new URL(f, dossier));
let n = 0;
for (const [nom, fn] of tests) {
  try { fn(); n++; } catch (e) { console.error(`ÉCHEC : ${nom}\n${e.stack || e.message}`); process.exit(1); }
}
console.log(`rendu : OK (${n} tests)`);
