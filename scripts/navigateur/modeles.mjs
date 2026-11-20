// Sujet : modèles de document. Chacun s'ouvre par le menu Fichier, chaque page de la visite s'affiche, sans erreur ; la visite
// montre les genres de ligne du bloc texte. Origine : spec bloc-texte, ticket 12 (user stories 73 et 74).

const ECOUTER = `(() => { window.__erreurs = []; const note = (m) => window.__erreurs.push(String(m));
  addEventListener('error', (e) => note(e.message)); addEventListener('unhandledrejection', (e) => note(e.reason && e.reason.message || e.reason)); return true; })()`;
const ouvrir = (k) => `(() => { document.querySelector('[data-ui=file]').click(); const b = document.querySelector('[data-f="new-${k}"]'); if (!b) return false; b.click(); return true; })()`;
const page = (i) => `(() => { const b = [...document.querySelectorAll('[data-pg="${i}"]')].find((x) => x.getClientRects().length); if (!b) return false; b.click(); return true; })()`;

export const nom = 'modèles';
export default async function ({ ecran, charger, evalue, attendre, visibles, mesure, echec }) {
  await ecran(1200, false);
  await charger();
  await evalue(ECOUTER);
  for (const k of ['vide', 'runbook', 'outil', 'tour']) {
    if (!(await evalue(ouvrir(k)))) { echec(`${k} : entrée du menu Fichier absente`); continue; }
    await attendre(300);
    const types = await evalue(`JSON.stringify(window.ardoise.doc.pages.map((p) => p.blocks.flatMap((b) => [b.type].concat((b.blocks || []).map((x) => x.type)))))`);
    const pages = JSON.parse(types);
    mesure();
    const anciens = pages.flat().filter((t) => ['p', 'list', 'check', 'subtitle'].includes(t));
    if (anciens.length) echec(`${k} : anciens blocs ${anciens.join(', ')}`);
    for (let i = 0; i < pages.length; i++) {
      if (pages.length > 1) {
        if (!(await evalue(page(i)))) { echec(`${k} : page ${i} introuvable dans le sommaire`); continue; }
        await attendre(300);
      }
      mesure();
      if (!(await visibles('.blk')).length) echec(`${k} : page ${i} sans bloc affiché`);
    }
    if (k === 'tour') {
      await evalue(page(0)); await attendre(300);
      mesure();
      const genres = new Set(await visibles('.lg[data-g]', 'return x.dataset.g'));
      const manquants = ['puce', 'numero', 'case', 'soustitre'].filter((g) => !genres.has(g));
      if (manquants.length) echec(`visite : genres de ligne non affichés : ${manquants.join(', ')}`);
    }
    const err = await evalue('JSON.stringify(window.__erreurs.splice(0))');
    mesure();
    if (err !== '[]') echec(`${k} : erreurs ${err}`);
  }
}
