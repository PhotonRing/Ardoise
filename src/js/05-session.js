/* ---------- Session du document ----------
   Seule propriétaire de l'historique d'annulation : pile des états, position, délai de regroupement de la frappe.
   Seule à réaffecter le document courant (vérifié par scripts/check.mjs). Les autres modules lisent `doc` et demandent les changements à la session ; le rendu, l'état modifié et les
   boutons annuler/rétablir sont des abonnés. La synchronisation n'est connue que par un adaptateur (marque, envoyer,
   rebaser, oublier, reprendre : voir 05-synchro-adaptateur.js, qui crée l'instance `session`). Au chargement, ce fichier ne touche ni au DOM ni au
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
var SESSION_GARDE_FICHIER = ['id', 'lock', 'mapKey', 'savedAt'];   // import, externe : le fichier reste le même
var SESSION_ORIGINES = {
  demarrage: { page: 'lien', historique: 'repart' },
  deverrouillage: { page: 'lien', historique: 'repart' },
  nouveau: { neuf: true, page: 'premiere', historique: 'repart', nouveauFichier: true },
  import: { garde: SESSION_GARDE_FICHIER, renumeroter: true, page: 'premiere', historique: 'etape', plusRecent: true },
  externe: { garde: SESSION_GARDE_FICHIER, renumeroter: true, page: 'gardee', historique: 'etape', plusRecent: true, verrou: true },
  brouillon: { garde: ['id', 'lock'], page: 'gardee', historique: 'etape', plusRecent: true }
};
function creerSession(adaptateur) {
  var sy = adaptateur;
  var pile = [], marques = [], pos = -1, minuteur = null;   // marques : repère des modifications reçues (synchronisation)
  // libelles : ce que chaque étape a changé, calculé à sa validation entre deux états qui ont reçu les mêmes
  // modifications des autres copies (recevoir réécrit l'état courant) : seule l'étape locale y figure
  var libelles = [];
  // étape ouverte (fenêtre d'une puce de requête) : ses modifications se fondent dans une seule étape, à sa nature ;
  // pos : position de cette étape dans la pile (-1 tant qu'aucune modification, ou après annuler, rétablir, remplacer)
  var groupe = null;
  var abonnes = { rendu: [], modifie: [], historique: [], nouveauFichier: [] };
  function prevenir(ev) { var a = Array.prototype.slice.call(arguments, 1); abonnes[ev].forEach(function (fn) { fn.apply(null, a); }); }
  function etat() {
    var a = pos > 0, r = pos < pile.length - 1;
    return { annuler: a, retablir: r, libelleAnnuler: a ? libelles[pos] : '', libelleRetablir: r ? libelles[pos + 1] : '' };
  }
  // une étape d'historique, seulement si l'état a changé ; renvoie vrai si elle a été ajoutée
  function etape(nature) {
    clearTimeout(minuteur); minuteur = null;
    var s = JSON.stringify(doc);
    if (pile[pos] === s) return false;
    libelles = libelles.slice(0, pos + 1); libelles.push(pos >= 0 ? libelleEtape(JSON.parse(pile[pos]), doc, nature) : '');
    pile = pile.slice(0, pos + 1); pile.push(s); marques = marques.slice(0, pos + 1); marques.push(sy.marque());
    if (pile.length > SESSION_MAX) { pile.shift(); marques.shift(); libelles.shift(); sy.oublier(marques[0]); }
    pos = pile.length - 1;
    sy.envoyer();   // synchronisation : la modification part vers les autres copies
    return true;
  }
  // modification dans l'étape ouverte, déjà au sommet de la pile : l'état remplace celui de l'étape (même libellé) ;
  // revenu à l'état d'avant l'étape, l'étape disparaît
  function fondre() {
    clearTimeout(minuteur); minuteur = null;
    var s = JSON.stringify(doc);
    if (pile[pos] === s) return;
    if (pos > 0 && pile[pos - 1] === s) { pile.pop(); marques.pop(); libelles.pop(); pos--; groupe.pos = -1; }
    else { pile[pos] = s; marques[pos] = sy.marque(); }
    sy.envoyer();
  }
  function valider() { if (minuteur) { etape(); prevenir('historique', etat()); } }
  function aller(d, focus) {
    valider();
    if (groupe) groupe.pos = -1;
    var vers = pos + d;
    if (vers >= 0 && vers < pile.length) {
      pos = vers;
      var c = doc.cur, ancien = doc;
      doc = attach(JSON.parse(sy.rebaser(pile[pos], marques[pos]))); sy.reprendre(ancien, doc);
      doc.cur = Math.min(c, doc.pages.length - 1);
      sy.envoyer();
      prevenir('rendu', focus, { historique: true });
      prevenir('modifie');
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
    if (groupe) groupe.pos = -1;
    if (r.neuf) { nd.id = uid() + uid(); nd.savedAt = null; delete nd.lock; delete nd.mapKey; delete nd.sync; }
    (r.garde || []).forEach(function (k) { if (ancien[k] !== undefined && ancien[k] !== null) nd[k] = ancien[k]; else delete nd[k]; });
    if (r.garde && !ancien.savedAt) nd.savedAt = null;   // normalize écrit toujours savedAt
    if (r.renumeroter) { var vus = {}; nd.pages.forEach(function (pg) { blocsDe(pg.blocks, function (b) { if (vus[b.id]) b.id = uid(); vus[b.id] = 1; }); }); }   // blocs des groupes compris
    if (r.historique === 'etape') { delete nd.sync; sy.reprendre(ancien, nd); }   // la synchronisation reste celle du document courant
    var p = r.page === 'lien' && options && +options.page >= 0 ? Math.floor(+options.page) : 0;
    if (r.page === 'gardee') p = ancien.cur < nd.pages.length ? ancien.cur : 0;
    nd.cur = Math.min(p, nd.pages.length - 1);
    doc = nd;
    // avant la remise à zéro de l'historique : la synchronisation du document précédent s'arrête sur « nouveau fichier »,
    // et la marque du nouvel état ne doit pas venir d'elle
    if (r.nouveauFichier) prevenir('nouveauFichier');
    if (r.historique === 'repart') { clearTimeout(minuteur); minuteur = null; pile = [JSON.stringify(doc)]; marques = [sy.marque()]; libelles = ['']; pos = 0; }
    if (r.historique === 'etape') { etape(); prevenir('rendu', null, {}); prevenir('modifie'); }
    else prevenir('rendu', null, {});
    prevenir('historique', etat());
    return { ok: true };
  }
  return {
    // applique fn au document, valide une étape si l'état a changé, puis prévient les abonnés ; nature : celle du geste (« cellules collées »), sinon déduite
    modifier: function (fn, focus, nature) {
      fn();
      if (groupe && groupe.pos >= 0 && groupe.pos === pos && pos === pile.length - 1) fondre();
      else if (groupe) { if (etape(groupe.nature)) groupe.pos = pos; }
      else etape(nature);
      prevenir('rendu', focus, {}); prevenir('modifie'); prevenir('historique', etat());
    },
    // étape ouverte : les modifications suivantes forment une seule étape, nommée par nature ({ etape }), jusqu'à fermerEtape
    ouvrirEtape: function (nature) { valider(); groupe = { nature: nature, pos: -1 }; },
    fermerEtape: function () { if (groupe) { groupe = null; prevenir('historique', etat()); } },
    // modification de frappe (déjà écrite dans le champ) : pas de rendu, étape validée après SESSION_DELAI sans frappe
    saisir: function (fn) { if (fn) fn(); clearTimeout(minuteur); minuteur = setTimeout(function () { minuteur = null; etape(); prevenir('historique', etat()); }, SESSION_DELAI); prevenir('modifie'); },
    // valide tout de suite la frappe en attente, s'il y en a
    valider: valider,
    annuler: function (focus) { aller(-1, focus); },
    retablir: function (focus) { aller(1, focus); },
    abonner: function (ev, fn) { if (!abonnes[ev]) throw new Error('session : événement inconnu ' + ev); abonnes[ev].push(fn); },
    // lecture seule : possibilité d'annuler ou de rétablir (boutons, menu mobile)
    historique: etat,
    // modifications reçues d'une autre copie : les clés données par l'appelant (cles) sont appliquées en place, la page
    // affichée est retrouvée par son identifiant et l'état courant de l'historique est remplacé sans créer d'étape.
    // Rien ne repart vers les autres copies et la frappe en attente n'est pas validée ici : après l'arrivée, l'envoi
    // défairait ce qui vient d'arriver (l'adaptateur valide avant d'intégrer).
    recevoir: function (recu, cles) {
      var pgId = doc.pages[doc.cur] && doc.pages[doc.cur].id;
      cles.forEach(function (k) { if (recu[k] === undefined) delete doc[k]; else doc[k] = JSON.parse(JSON.stringify(recu[k])); });
      if (!doc.pages || !doc.pages.length) doc.pages = [{ id: uid(), title: '', blocks: [] }];
      var pi = -1; doc.pages.forEach(function (pg, i) { if (pg.id === pgId) pi = i; });
      doc.cur = pi >= 0 ? pi : Math.min(doc.cur, doc.pages.length - 1);
      if (pos >= 0) pile[pos] = JSON.stringify(doc);
      prevenir('rendu', null, { distant: true });
      prevenir('modifie');
      prevenir('historique', etat());
    },
    remplacer: remplacer
  };
}
