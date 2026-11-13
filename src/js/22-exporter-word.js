/* ---------- Exporter en Word (.docx) ----------
   La page affichée (menu Fichier, menu Lecture) ou un bloc (menu ⋯) en fichier Word (08-docx.js), images comprises : cartes et
   chronologies en PNG à la largeur de la page, comme « Copier pour Office ». Hors historique : le document n'est pas modifié. */
var DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
function exporterPageWord() { return exporterWord(doc.blocks, nomExportWord(null, doc, doc.cur)); }
function exporterBlocWord(b) { return exporterWord([b], nomExportWord(b, doc, doc.cur)); }
// nom du fichier Word : titre du bloc exporté (s'il en a un), sinon celui de la page
function nomExportWord(b, d, pi) {
  var t = '';
  if (b) t = textOf(b.type === 'h2' || b.type === 'h3' || b.type === 'subtitle' ? b.html : b.type === 'header' || b.type === 'step' || b.type === 'group' || b.type === 'diamond' || b.type === 'details' || b.type === 'summary' || b.type === 'query' ? b.title : '');
  return nomDeFichier(t || pageTitle(d.pages[pi], pi)) + '.docx';
}
function exporterWord(blocs, nom) {
  if (isSealed() && !confirm('Le fichier Word n’est pas chiffré : il sera lisible par toute personne qui l’obtient. Continuer ?')) return Promise.resolve(false);
  var pi = doc.cur, attente = setTimeout(function () { toast('Préparation du fichier Word…', 60000); }, 1000);
  return imagesOffice(blocs, { png: true, cartes: true }).then(function (r) {
    var octets = docxDepuisElements(officeBlocs(blocs, doc, { page: pi, images: r.images }), doc);
    clearTimeout(attente);
    download(octets, nom, DOCX_TYPE);
    toast(r.horsLigne ? 'Fichier Word téléchargé, cartes sur le fond hors ligne : le fond en ligne ne peut pas être copié' : 'Fichier Word téléchargé', r.horsLigne ? 6000 : 0);
    return true;
  }).catch(function () { clearTimeout(attente); toast('L’export Word a échoué'); return false; });
}
