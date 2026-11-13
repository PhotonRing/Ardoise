/* ---------- Menu d'un bloc (⋯ dans sa barre) ----------
   Une liste d'entrées { ic, label, quand(b) facultatif, fn(b) } : chaque fonction qui agit sur un bloc entier y ajoute la sienne. */
var ENTREES_BLOC = [
  { ic: '⎘', label: 'Copier pour Office', fn: function (b) { copierPourOffice(b); } },
  { ic: 'W', label: 'Exporter en Word (.docx)', fn: function (b) { exporterBlocWord(b); } },
  { ic: '⊟', label: 'Mettre dans un groupe', quand: function (b) { var o = position(b); return !!o && !o.parent && !HORS_GROUPE[b.type]; }, fn: function (b) { gesteMettreDansGroupe(b); } },
  { ic: '⇱', label: 'Sortir du groupe', quand: function (b) { var o = position(b); return !!o && !!o.parent; }, fn: function (b) { gesteSortirDuGroupe(b); } },
  { ic: '⊞', label: 'Dégrouper', quand: function (b) { return b.type === 'group'; }, fn: function (b) { gesteDegrouper(b); } }
];
function ouvrirMenuBloc(ancre, b) {
  closePop();
  var p = document.createElement('div'); p.className = 'pop menu-bloc'; pop = p;
  var vues = ENTREES_BLOC.filter(function (x) { return !x.quand || x.quand(b); });
  p.innerHTML = vues.map(function (x, i) { return '<button class="mi" type="button" data-mb="' + i + '"><span class="ic">' + x.ic + '</span><span>' + esc(x.label) + '</span></button>'; }).join('');
  p.addEventListener('click', function (e) { var x = e.target.closest('[data-mb]'); if (!x) return; closePop(); vues[+x.dataset.mb].fn(b); });
  placePop(p, ancre);
}
