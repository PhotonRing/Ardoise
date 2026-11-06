/* ---------- Session du document ----------
   Seule propriétaire de l'historique d'annulation : pile des états, position, délai de regroupement de la frappe.
   Les autres modules lisent `doc` et demandent les changements à la session ; le rendu, l'état modifié et les
   boutons annuler/rétablir sont des abonnés. Au chargement, ce fichier ne touche ni au DOM ni au stockage. */
var SESSION_DELAI = 500, SESSION_MAX = 300;
// Règles de remplacement du document, par origine (voir la table des origines de la spec) :
//   neuf : nouvel identifiant, sans mot de passe, clé de carte, date d'enregistrement ni synchronisation
//   page : 'lien' (options.page, index borné au nombre de pages, sinon la première) ou 'premiere'
//   historique : 'repart' (l'état chargé devient le seul état de l'historique)
//   plusRecent : un format plus récent est refusé ; nouveauFichier : l'enregistrement oublie le fichier choisi
var SESSION_ORIGINES = {
  demarrage: { page: 'lien', historique: 'repart' },
  deverrouillage: { page: 'lien', historique: 'repart' },
  nouveau: { neuf: true, page: 'premiere', historique: 'repart', nouveauFichier: true }
};
function creerSession() {
  var pile = [], marques = [], pos = -1, minuteur = null;   // marques : repère des modifications reçues (synchronisation)
  var abonnes = { rendu: [], modifie: [], historique: [], nouveauFichier: [] };
  function prevenir(ev) { var a = Array.prototype.slice.call(arguments, 1); abonnes[ev].forEach(function (fn) { fn.apply(null, a); }); }
  function etat() { return { annuler: pos > 0, retablir: pos < pile.length - 1 }; }
  // une étape d'historique, seulement si l'état a changé ; renvoie vrai si elle a été ajoutée
  function etape() {
    clearTimeout(minuteur); minuteur = null;
    var s = JSON.stringify(doc);
    if (pile[pos] === s) return false;
    pile = pile.slice(0, pos + 1); pile.push(s); marques = marques.slice(0, pos + 1); marques.push(synHistMark());
    if (pile.length > SESSION_MAX) { pile.shift(); marques.shift(); synTrim(marques[0]); }
    pos = pile.length - 1;
    synLocal();   // synchronisation : la modification part vers les autres copies
    return true;
  }
  function valider() { if (minuteur) { etape(); prevenir('historique', etat()); } }
  function aller(d, focus) {
    valider();
    var vers = pos + d;
    if (vers >= 0 && vers < pile.length) {
      pos = vers;
      var c = doc.cur, ancien = doc;
      doc = attach(JSON.parse(synRebase(pile[pos], marques[pos]))); synKeep(ancien, doc);
      doc.cur = Math.min(c, doc.pages.length - 1);
      synLocal();
      prevenir('rendu', focus, { historique: true });
      prevenir('modifie', true);
    }
    prevenir('historique', etat());
  }
  // remplace le document entier selon la règle de son origine ; renvoie { ok: true } ou { refus: … } sans rien changer
  function remplacer(donnees, origine, options) {
    var r = SESSION_ORIGINES[origine];
    if (!r) throw new Error('session : origine inconnue ' + origine);
    valider();
    var nd = null; try { nd = normalize(donnees); } catch (e) { nd = null; }
    if (!nd) return { refus: 'illisible' };
    if (nd.newer && r.plusRecent) return { refus: 'plus-recent' };
    if (r.neuf) { nd.id = uid() + uid(); nd.savedAt = null; delete nd.lock; delete nd.mapKey; delete nd.sync; }
    var p = r.page === 'lien' && options && +options.page >= 0 ? Math.floor(+options.page) : 0;
    nd.cur = Math.min(p, nd.pages.length - 1);
    doc = nd;
    if (r.historique === 'repart') { clearTimeout(minuteur); minuteur = null; pile = [JSON.stringify(doc)]; marques = [synHistMark()]; pos = 0; }
    if (r.nouveauFichier) prevenir('nouveauFichier');
    prevenir('rendu', null, {});
    prevenir('historique', etat());
    return { ok: true };
  }
  return {
    // applique fn au document, valide une étape si l'état a changé, puis prévient les abonnés
    modifier: function (fn, focus) { fn(); etape(); prevenir('rendu', focus, {}); prevenir('modifie', true); prevenir('historique', etat()); },
    // modification de frappe (déjà écrite dans le champ) : pas de rendu, étape validée après SESSION_DELAI sans frappe
    saisir: function (fn) { if (fn) fn(); clearTimeout(minuteur); minuteur = setTimeout(function () { minuteur = null; etape(); prevenir('historique', etat()); }, SESSION_DELAI); prevenir('modifie', false); },
    // valide tout de suite la frappe en attente, s'il y en a
    valider: valider,
    annuler: function (focus) { aller(-1, focus); },
    retablir: function (focus) { aller(1, focus); },
    abonner: function (ev, fn) { if (!abonnes[ev]) throw new Error('session : événement inconnu ' + ev); abonnes[ev].push(fn); },
    historique: etat,
    remplacer: remplacer,
    // --- transitoires, absorbés par remplacer / recevoir (tickets 02, 03, 05) ---
    // ancien snapshot : étape immédiate, sans rendu ni marque « modifié »
    consigner: function () { etape(); prevenir('historique', etat()); },
    // l'état courant de l'historique devient le document, sans créer d'étape (arrivée de synchronisation)
    remplacerCourant: function () { if (pos >= 0) pile[pos] = JSON.stringify(doc); }
  };
}
var session = creerSession();
