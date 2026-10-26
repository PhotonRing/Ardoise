/* ---------- Images ---------- */
var filePick = document.createElement('input'); filePick.type = 'file'; filePick.accept = 'image/*';
function pickImage(b) {
  filePick.value = '';
  filePick.onchange = function () { var f = filePick.files[0]; if (f) readImage(f, function (src) { change(function () { b.src = src; }); }); };
  filePick.click();
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

