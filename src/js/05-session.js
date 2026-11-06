/* ---------- Session du document ----------
   Seule propriétaire de l'historique d'annulation : pile des états, position, délai de regroupement de la frappe.
   Les autres modules lisent `doc` et demandent les changements à la session ; le rendu, l'état modifié et les
   boutons annuler/rétablir sont des abonnés. La synchronisation n'est connue que par un adaptateur (marque, envoyer,
   rebaser, oublier, reprendre : voir 05-synchro-adaptateur.js). Au chargement, ce fichier ne touche ni au DOM ni au
   stockage. */
var SESSION_DELAI = 500, SESSION_MAX = 300;
// Règles de remplacement du document, par origine (voir la table des origines de la spec) :
//   neuf : nouvel identifiant, sans mot de passe, clé de carte, date d'enregistrement ni synchronisation
//   garde : champs repris du document courant (copiés, ou retirés s'il ne les a pas)
//   page : 'lien' (options.page, index borné au nombre de pages, sinon la première), 'premiere' ou 'gardee' (la page
//     affichée si le nouveau document l'a, sinon la première)
//   historique : 'repart' (l'état chargé devient le seul état de l'historique) ou 'etape' (étape annulable)
//   renumeroter : les identifiants de blocs en double sont renouvelés
//   plusRecent : un format plus récent est refusé ; verrou : refusé si le document courant est verrouillé et pas
//     déverrouillé (options.deverrouille) ; nouveauFichier : l'enregistrement oublie le fichier choisi
// Hors 'neuf', la configuration de synchronisation est toujours celle du document courant (adaptateur, reprendre).
var SESSION_ORIGINES = {
  demarrage: { page: 'lien', historique: 'repart' },
  deverrouillage: { page: 'lien', historique: 'repart' },
  nouveau: { neuf: true, page: 'premiere', historique: 'repart', nouveauFichier: true },
  import: { garde: ['id', 'lock', 'mapKey', 'savedAt'], renumeroter: true, page: 'premiere', historique: 'etape', plusRecent: true },
  externe: { garde: ['id', 'lock', 'mapKey', 'savedAt'], renumeroter: true, page: 'gardee', historique: 'etape', plusRecent: true, verrou: true },
  brouillon: { garde: ['id', 'lock'], page: 'gardee', historique: 'etape', plusRecent: true }
};
var ADAPTATEUR_INERTE = { marque: function () { return 0; }, envoyer: function () {}, rebaser: function (json) { return json; }, oublier: function () {}, reprendre: function () {} };
function creerSession(adaptateur) {
  var sy = adaptateur || ADAPTATEUR_INERTE;
  var pile = [], marques = [], pos = -1, minuteur = null;   // marques : repère des modifications reçues (synchronisation)
  var abonnes = { rendu: [], modifie: [], historique: [], nouveauFichier: [] };
  function prevenir(ev) { var a = Array.prototype.slice.call(arguments, 1); abonnes[ev].forEach(function (fn) { fn.apply(null, a); }); }
  function etat() { return { annuler: pos > 0, retablir: pos < pile.length - 1 }; }
  // une étape d'historique, seulement si l'état a changé ; renvoie vrai si elle a été ajoutée
  function etape() {
    clearTimeout(minuteur); minuteur = null;
    var s = JSON.stringify(doc);
    if (pile[pos] === s) return false;
    pile = pile.slice(0, pos + 1); pile.push(s); marques = marques.slice(0, pos + 1); marques.push(sy.marque());
    if (pile.length > SESSION_MAX) { pile.shift(); marques.shift(); sy.oublier(marques[0]); }
    pos = pile.length - 1;
    sy.envoyer();   // synchronisation : la modification part vers les autres copies
    return true;
  }
  function valider() { if (minuteur) { etape(); prevenir('historique', etat()); } }
  function aller(d, focus) {
    valider();
    var vers = pos + d;
    if (vers >= 0 && vers < pile.length) {
      pos = vers;
      var c = doc.cur, ancien = doc;
      doc = attach(JSON.parse(sy.rebaser(pile[pos], marques[pos]))); sy.reprendre(ancien, doc);
      doc.cur = Math.min(c, doc.pages.length - 1);
      sy.envoyer();
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
    var nd = null, err = null; try { nd = normalize(donnees); } catch (e) { nd = null; err = e; }
    if (!nd) return err && err.message ? { refus: 'illisible', message: err.message } : { refus: 'illisible' };
    if (nd.newer && r.plusRecent) return { refus: 'plus-recent', format: nd.newer };
    if (r.verrou && doc && doc.lock && !(options && options.deverrouille)) return { refus: 'verrouille' };
    var ancien = doc;
    if (r.neuf) { nd.id = uid() + uid(); nd.savedAt = null; delete nd.lock; delete nd.mapKey; delete nd.sync; }
    (r.garde || []).forEach(function (k) { if (ancien[k] !== undefined && ancien[k] !== null) nd[k] = ancien[k]; else delete nd[k]; });
    if (r.garde && !ancien.savedAt) nd.savedAt = null;   // normalize écrit toujours savedAt
    if (r.renumeroter) { var vus = {}; nd.pages.forEach(function (pg) { pg.blocks.forEach(function (b) { if (vus[b.id]) b.id = uid(); vus[b.id] = 1; }); }); }
    if (r.historique === 'etape') { delete nd.sync; sy.reprendre(ancien, nd); }   // la synchronisation reste celle du document courant
    var p = r.page === 'lien' && options && +options.page >= 0 ? Math.floor(+options.page) : 0;
    if (r.page === 'gardee') p = ancien.cur < nd.pages.length ? ancien.cur : 0;
    nd.cur = Math.min(p, nd.pages.length - 1);
    doc = nd;
    if (r.historique === 'repart') { clearTimeout(minuteur); minuteur = null; pile = [JSON.stringify(doc)]; marques = [sy.marque()]; pos = 0; }
    if (r.nouveauFichier) prevenir('nouveauFichier');
    if (r.historique === 'etape') { etape(); prevenir('rendu', null, {}); prevenir('modifie', true); }
    else prevenir('rendu', null, {});
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
    // modifications reçues d'une autre copie : les clés synchronisées de l'état reçu sont appliquées en place, la page
    // affichée est retrouvée par son identifiant et l'état courant de l'historique est remplacé sans créer d'étape.
    // Rien ne repart vers les autres copies et la frappe en attente n'est pas validée ici : après l'arrivée, l'envoi
    // défairait ce qui vient d'arriver (l'adaptateur valide avant d'intégrer).
    recevoir: function (recu) {
      var pgId = doc.pages[doc.cur] && doc.pages[doc.cur].id;
      SYN_KEYS.forEach(function (k) { if (recu[k] === undefined) delete doc[k]; else doc[k] = JSON.parse(JSON.stringify(recu[k])); });
      if (!doc.pages || !doc.pages.length) doc.pages = [{ id: uid(), title: '', blocks: [] }];
      var pi = -1; doc.pages.forEach(function (pg, i) { if (pg.id === pgId) pi = i; });
      doc.cur = pi >= 0 ? pi : Math.min(doc.cur, doc.pages.length - 1);
      if (pos >= 0) pile[pos] = JSON.stringify(doc);
      prevenir('rendu', null, { distant: true });
      prevenir('modifie', true);
      prevenir('historique', etat());
    },
    remplacer: remplacer,
    // --- transitoire, absorbé au ticket 05 (pastilles, saisie des cases et des cartes) ---
    // ancien snapshot : étape immédiate, sans rendu ni marque « modifié »
    consigner: function () { etape(); prevenir('historique', etat()); }
  };
}
var session = creerSession(adaptateurSynchro());   // adaptateurSynchro : 05-synchro-adaptateur.js (déclaration remontée)
