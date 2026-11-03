/* ---------- Images ---------- */
var filePick = document.createElement('input'); filePick.type = 'file'; filePick.accept = 'image/*';
function pickImage(b) {
  filePick.value = '';
  filePick.onchange = function () { var f = filePick.files[0]; if (f) readImage(f, function (src) { change(function () { b.src = src; }); }); };
  filePick.click();
}
function imageFromUrl(url, cb) {
  // le navigateur télécharge l'image si le site l'autorise (CORS) ; dans Obsidian, le plugin peut s'en charger
  url = String(url || '').trim(); if (!url) return;
  if (!/^(https?:|data:image\/)/i.test(url)) url = 'https://' + url;
  toast('Téléchargement de l’image…', 20000);
  var host = window.ardoiseHost && typeof window.ardoiseHost.fetchImage === 'function';
  function blobOf(u) { return fetch(u, { credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); }); }
  blobOf(url).catch(function (e) {
    if (!host || /^data:/i.test(url)) throw e;
    return Promise.resolve(window.ardoiseHost.fetchImage(url)).then(blobOf);
  }).then(function (blob) {
    if (/^image\//.test(blob.type)) return blob;
    // type absent ou générique : on vérifie que le contenu est bien une image
    if (!window.createImageBitmap) throw new Error('not-image');
    return createImageBitmap(blob).then(function () {
      var ext = (url.match(/\.(png|jpe?g|gif|webp|avif|bmp)(?:[?#]|$)/i) || [])[1] || 'png';
      return new Blob([blob], { type: 'image/' + ext.toLowerCase().replace('jpg', 'jpeg') });
    }, function () { throw new Error('not-image'); });
  }).then(function (blob) {
    readImage(blob, function (src) { toast('Image intégrée au document'); cb(src); });
  }).catch(function (e) {
    toast(e && e.message === 'not-image' ? 'Cette adresse ne renvoie pas une image.'
      : 'Image inaccessible : le site n’autorise pas sa copie depuis une page' + (host ? ' (ou le téléchargement a été refusé)' : '') + '. Enregistrez-la, puis déposez-la ici.', 7000);
  });
}
function readImage(file, cb) {
  var fr = new FileReader();
  fr.onload = function () {
    var src = fr.result;
    if (/image\/(gif|svg)/.test(file.type)) { cb(src); return; }
    var img = new Image();
    img.onload = function () {
      var max = 1600, w = img.naturalWidth, h = img.naturalHeight;
      if (w <= max && file.size < 600000) { cb(src); return; }
      var s = Math.min(1, max / w), c = document.createElement('canvas');
      c.width = Math.round(w * s); c.height = Math.round(h * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      var out = c.toDataURL('image/webp', 0.86);
      if (out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/jpeg', 0.86);
      cb(out.length < src.length ? out : src);
    };
    img.onerror = function () { cb(src); };
    img.src = src;
  };
  fr.readAsDataURL(file);
}

