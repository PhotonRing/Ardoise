/* ---------- Session du document ----------
   Seule propriétaire de l'historique d'annulation : pile des états, position, délai de regroupement de la frappe.
   Les autres modules lisent `doc` et demandent les changements à la session ; le rendu, l'état modifié et les
   boutons annuler/rétablir sont des abonnés. Au chargement, ce fichier ne touche ni au DOM ni au stockage. */
var SESSION_DELAI = 500, SESSION_MAX = 300;
function creerSession() {
  var pile = [], marques = [], pos = -1, minuteur = null;   // marques : repère des modifications reçues (synchronisation)
  var abonnes = { rendu: [], modifie: [], historique: [] };
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
    // --- transitoires, absorbés par remplacer / recevoir (tickets 02, 03, 05) ---
    // ancien snapshot : étape immédiate, sans rendu ni marque « modifié »
    consigner: function () { etape(); prevenir('historique', etat()); },
    // l'historique repart du document courant
    repartir: function () { clearTimeout(minuteur); minuteur = null; pile = []; marques = []; pos = -1; etape(); prevenir('historique', etat()); },
    // l'état courant de l'historique devient le document, sans créer d'étape (arrivée de synchronisation)
    remplacerCourant: function () { if (pos >= 0) pile[pos] = JSON.stringify(doc); }
  };
}
var session = creerSession();
