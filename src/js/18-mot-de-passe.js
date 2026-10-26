/* ---------- Protection de l'édition par mot de passe ----------
   Le mot de passe n'est jamais stocké : seul un hachage PBKDF2-SHA256 salé l'est.
   Cela verrouille l'éditeur intégré ; le fichier reste modifiable dans un éditeur de texte. */
var unlocked = false;
function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))); }
function unb64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
function derive(pw, salt, iter) {
  if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('Chiffrement indisponible dans ce navigateur'));
  return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (k) {
    return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, k, 256);
  }).then(b64);
}
function checkPassword(pw) {
  return derive(pw, unb64(doc.lock.salt), doc.lock.iter).then(function (h) {
    if (h.length !== doc.lock.hash.length) return false;
    var d = 0; for (var i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ doc.lock.hash.charCodeAt(i);
    return d === 0;
  });
}
var pwFails = 0;
function pwModal(title, intro, fields, okLabel, onOk) {
  var body = '<p class="muted">' + intro + '</p>' + fields.map(function (f, i) {
    return '<label style="display:flex;flex-direction:column;gap:4px;font-size:13px">' + f + '<input type="password" class="menu-q" data-pw="' + i + '" autocomplete="' + (fields.length > 1 ? 'new-password' : 'current-password') + '"></label>';
  }).join('') + '<p class="muted" data-pwerr style="color:var(--bad);min-height:1.2em"></p>';
  var bg = modal(title, body, [{ label: 'Annuler' }, { label: okLabel, primary: true, fn: function (bg) { run(bg); return false; } }]);
  var busy = false;
  function run(bg) {
    if (busy) return;
    var vals = $$('[data-pw]', bg).map(function (i) { return i.value; }), err = $('[data-pwerr]', bg);
    busy = true; err.textContent = '';
    Promise.resolve(onOk(vals)).then(function (msg) {
      busy = false;
      if (msg) { err.textContent = msg; var f = $('[data-pw]', bg); f.select(); return; }
      bg.remove();
    }).catch(function (e) { busy = false; err.textContent = e.message; });
  }
  bg.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('[data-pw]')) { e.preventDefault(); run(bg); } });
  $('[data-pw]', bg).focus();
}
function askPassword(then) {
  pwModal('Page protégée', 'L’édition de cette page est protégée. Entrez le mot de passe pour la modifier.', ['Mot de passe'], 'Déverrouiller', function (v) {
    return new Promise(function (res) { setTimeout(res, Math.min(4000, pwFails * 600)); }).then(function () { return checkPassword(v[0]); }).then(function (ok) {
      if (!ok) { pwFails++; return 'Mot de passe incorrect.'; }
      pwFails = 0; unlocked = true; then(); return null;
    });
  });
}
function setPassword() {
  var has = !!doc.lock;
  pwModal(has ? 'Changer le mot de passe' : 'Protéger l’édition',
    'Le mot de passe sera demandé pour passer en édition. Il n’est pas récupérable s’il est perdu. Limite : il verrouille l’éditeur de la page, mais le fichier reste modifiable dans un éditeur de texte.',
    ['Nouveau mot de passe', 'Confirmer'], 'Protéger', function (v) {
      if (v[0].length < 4) return 'Au moins 4 caractères.';
      if (v[0] !== v[1]) return 'Les deux mots de passe ne correspondent pas.';
      var salt = crypto.getRandomValues(new Uint8Array(16)), iter = 210000;
      return derive(v[0], salt, iter).then(function (h) {
        change(function () { doc.lock = { salt: b64(salt), hash: h, iter: iter }; });
        unlocked = true; toast('Édition protégée · enregistrez pour l’appliquer au fichier'); return null;
      });
    });
}
function removePassword() {
  if (!confirm('Retirer la protection par mot de passe de cette page ?')) return;
  change(function () { delete doc.lock; }); toast('Protection retirée · enregistrez pour l’appliquer au fichier');
}
function lockNow() {
  unlocked = false; if (mode === 'edit') toggleMode(); else renderChrome();
  toast('Page verrouillée');
}

