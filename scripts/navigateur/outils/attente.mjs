// Attente d'un état après une action (clic, touche, navigation) : relit `expr` dans la page jusqu'à ce qu'elle soit vraie,
// au plus `delai` ms, et rend sa dernière valeur (fausse si le délai est dépassé : le sujet écrit alors son message
// d'échec). Remplace les attentes à durée fixe, trop courtes sous charge (ticket 13 du lot 9 : « déplacer un bloc » et
// « groupe repliable » échouaient de temps en temps en CI). Une évaluation qui échoue (page en cours de navigation)
// compte comme fausse.
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
export async function jusqua(evalue, expr, delai = 5000) {
  const fin = Date.now() + delai; let v;
  for (;;) {
    try { v = await evalue(expr); } catch (_) { v = undefined; }
    if (v || Date.now() >= fin) return v;
    await pause(20);
  }
}
