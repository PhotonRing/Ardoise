/* ---------- Protection de l'édition par mot de passe ----------
   Le mot de passe n'est jamais stocké : seul un hachage PBKDF2-SHA256 salé l'est.
   Sans chiffrement, cela verrouille l'éditeur intégré ; le fichier reste lisible et modifiable dans un éditeur de texte.
   Avec chiffrement, le contenu est enregistré chiffré (AES-256-GCM, clé dérivée du mot de passe par PBKDF2-SHA256) :
   le mot de passe devient nécessaire pour lire le document. La clé ne quitte jamais la mémoire de l'onglet. */
var unlocked = false, ENC_ITER = 600000, encKeys = {};
function b64(buf) {
  var u = new Uint8Array(buf), s = '';
  for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
function derive(pw, salt, iter) {
  if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('Chiffrement indisponible dans ce navigateur'));
  return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (k) {
    return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, k, 256);
  }).then(b64);
}
function deriveKey(pw, salt, iter) {
  if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('Chiffrement indisponible dans ce navigateur (ouvrez le fichier en local ou en https)'));
  return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (k) {
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  });
}
function sealJSON(json) {
  // enveloppe chiffrée : un IV neuf à chaque enregistrement
  var key = doc.lock && encKeys[doc.lock.encSalt];
  if (!key) return Promise.reject(new Error('clé de chiffrement absente : redéfinissez le mot de passe (Fichier → Changer le mot de passe)'));
  var iv = crypto.getRandomValues(new Uint8Array(12));
  return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(json)).then(function (ct) {
    return { v: 1, alg: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iter: doc.lock.encIter, salt: doc.lock.encSalt, iv: b64(iv), ct: b64(ct) };
  });
}
function openSealed(env, pw) {
  return deriveKey(pw, unb64(env.salt), +env.iter || ENC_ITER).then(function (key) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, key, unb64(env.ct)).then(function (plain) {
      encKeys[env.salt] = key;
      return new TextDecoder().decode(plain);
    }, function () { return null; });   // échec d'authentification : mauvais mot de passe (ou fichier altéré)
  });
}
function isSealed() { return !!(doc && doc.lock && doc.lock.enc); }
function forgetDraft() { try { localStorage.removeItem(LS + 'draft:' + doc.id); } catch (_) {} }
function checkPassword(pw) {
  return derive(pw, unb64(doc.lock.salt), doc.lock.iter).then(function (h) {
    if (h.length !== doc.lock.hash.length) return false;
    var d = 0; for (var i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ doc.lock.hash.charCodeAt(i);
    return d === 0;
  });
}
var pwFails = 0;
function pwModal(title, intro, fields, okLabel, onOk, extra) {
  var body = '<p class="muted">' + intro + '</p>' + fields.map(function (f, i) {
    return '<label style="display:flex;flex-direction:column;gap:4px;font-size:13px">' + f + '<input type="password" class="menu-q" data-pw="' + i + '" autocomplete="' + (fields.length > 1 ? 'new-password' : 'current-password') + '"></label>';
  }).join('') + (extra || '') + '<p class="muted" data-pwerr style="color:var(--bad);min-height:1.2em"></p>';
  var bg = modal(title, body, [{ label: 'Annuler' }, { label: okLabel, primary: true, fn: function (bg) { run(bg); return false; } }]);
  var busy = false;
  function run(bg) {
    if (busy) return;
    var vals = $$('[data-pw]', bg).map(function (i) { return i.value; }), err = $('[data-pwerr]', bg);
    busy = true; err.textContent = ''; var okBtn = $('.row .primary', bg); if (okBtn) okBtn.disabled = true;
    Promise.resolve(onOk(vals, bg)).then(function (msg) {
      if (okBtn) okBtn.disabled = false;
      busy = false;
      if (msg) { err.textContent = msg; var f = $('[data-pw]', bg); f.select(); return; }
      bg.remove();
    }).catch(function (e) { busy = false; if (okBtn) okBtn.disabled = false; err.textContent = e.message; });
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
var ENC_NOTE = '<label class="pw-enc"><input type="checkbox" data-enc %CHK%><span><b>Chiffrer aussi le contenu</b><small>Le mot de passe sera demandé pour <b>ouvrir</b> le document, même en lecture. Le fichier enregistré ne contient plus rien de lisible. Mot de passe perdu = contenu perdu.</small></span></label>';
function setPassword() {
  var has = !!doc.lock;
  pwModal(has ? 'Changer le mot de passe' : 'Protéger par mot de passe',
    'Le mot de passe sera demandé pour passer en édition. Il n’est pas récupérable s’il est perdu.',
    ['Nouveau mot de passe', 'Confirmer'], has ? 'Enregistrer' : 'Protéger', function (v, bg) {
      if (v[0].length < 4) return 'Au moins 4 caractères.';
      if (v[0] !== v[1]) return 'Les deux mots de passe ne correspondent pas.';
      var enc = $('[data-enc]', bg).checked;
      if (enc && v[0].length < 10) return 'Pour chiffrer le contenu, choisissez au moins 10 caractères (une phrase de passe est idéale).';
      var salt = crypto.getRandomValues(new Uint8Array(16)), iter = 210000, esalt = crypto.getRandomValues(new Uint8Array(16));
      return Promise.all([derive(v[0], salt, iter), enc ? deriveKey(v[0], esalt, ENC_ITER) : null]).then(function (r) {
        var lock = { salt: b64(salt), hash: r[0], iter: iter };
        if (enc) { lock.enc = true; lock.encSalt = b64(esalt); lock.encIter = ENC_ITER; encKeys[lock.encSalt] = r[1]; forgetDraft(); }
        change(function () { doc.lock = lock; });
        unlocked = true;
        toast((enc ? 'Contenu chiffré et édition protégée' : 'Édition protégée') + ' · enregistrez pour l’appliquer au fichier', 3500); return null;
      });
    }, ENC_NOTE.replace('%CHK%', (!has || isSealed()) ? 'checked' : ''));
}
function sealExisting() {
  // chiffrer le contenu d'un document déjà protégé : le mot de passe actuel suffit
  pwModal('Chiffrer le contenu', 'Entrez le mot de passe actuel. Il sera ensuite demandé pour ouvrir le document, même en lecture.', ['Mot de passe actuel'], 'Chiffrer', function (v) {
    return checkPassword(v[0]).then(function (ok) {
      if (!ok) return 'Mot de passe incorrect.';
      var esalt = crypto.getRandomValues(new Uint8Array(16));
      return deriveKey(v[0], esalt, ENC_ITER).then(function (key) {
        var s = b64(esalt); encKeys[s] = key; forgetDraft();
        change(function () { doc.lock.enc = true; doc.lock.encSalt = s; doc.lock.encIter = ENC_ITER; });
        toast('Contenu chiffré · enregistrez pour l’appliquer au fichier'); return null;
      });
    });
  });
}
function unsealExisting() {
  if (!confirm('Ne plus chiffrer le contenu ? Le document redeviendra lisible sans mot de passe (l’édition reste protégée).')) return;
  change(function () { delete doc.lock.enc; delete doc.lock.encSalt; delete doc.lock.encIter; });
  toast('Contenu non chiffré · enregistrez pour l’appliquer au fichier');
}
function removePassword() {
  if (!confirm('Retirer la protection par mot de passe' + (isSealed() ? ' et le chiffrement' : '') + ' ? Le document redeviendra lisible et modifiable sans mot de passe.')) return;
  change(function () { delete doc.lock; }); toast('Protection retirée · enregistrez pour l’appliquer au fichier');
}
function lockScreen(env) {
  // ouverture d'un fichier chiffré : rien n'est affiché avant le bon mot de passe
  var r = document.documentElement;
  ['palette', 'typo'].forEach(function (k) { if (env[k]) r.setAttribute('data-' + k, env[k]); });
  if (env.theme && env.theme !== 'auto') r.setAttribute('data-theme', env.theme);
  document.title = 'Document protégé';
  app.innerHTML = '<div class="wrap lockscr"><form class="lock-card" autocomplete="off"><div class="lock-ic">🔒</div><h1>Document protégé</h1>' +
    '<p class="lede">Le contenu de ce fichier est chiffré. Entrez le mot de passe pour l’ouvrir.</p>' +
    '<input type="password" class="menu-q" autocomplete="current-password" aria-label="Mot de passe" placeholder="Mot de passe">' +
    '<button type="submit" class="ub primary">Ouvrir</button><p class="lock-err" aria-live="polite"></p></form></div>';
  var form = $('.lock-card', app), inp = $('input', form), btn = $('button', form), err = $('.lock-err', form), fails = 0, busy = false;
  inp.focus();
  form.addEventListener('submit', function (e) {
    e.preventDefault(); if (busy || !inp.value) return;
    busy = true; btn.disabled = true; err.textContent = 'Déchiffrement…';
    var pw = inp.value;
    new Promise(function (res) { setTimeout(res, Math.min(4000, fails * 600)); }).then(function () { return openSealed(env.enc, pw); }).then(function (json) {
      if (json === null) { fails++; busy = false; btn.disabled = false; err.textContent = 'Mot de passe incorrect.'; inp.select(); return; }
      var d = normalize(JSON.parse(json));
      if (!d) throw new Error('contenu illisible');
      d.id = env.id || d.id; unlocked = true; sealed = null;
      boot(d);
    }).catch(function (x) { busy = false; btn.disabled = false; err.textContent = 'Ouverture impossible : ' + x.message; });
  });
}
function lockNow() {
  unlocked = false; if (mode === 'edit') toggleMode(); else renderChrome();
  toast('Page verrouillée');
}

