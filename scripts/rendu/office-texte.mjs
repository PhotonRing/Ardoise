// Copier pour Office, famille Texte (src/js/09-office-texte.js) : en-tête, titres, étape, paragraphe, pastilles, pied, séparateur, image.
import { test, egal, vrai } from './commun.mjs';
import { monterOffice, verifierSocle } from './office-socle.mjs';

const P = (t, cls) => '<span class="pill' + (cls ? ' ' + cls : '') + '">' + t + '</span>';
const TITRE = "font-family:'Segoe UI Semibold','Segoe UI',sans-serif";
// document en thème sombre à la palette indigo : le collage reste clair, à l'accent clair de la palette (#4848c0 / #ececfb)
const DOC = { v: 6, title: 'Doc', theme: 'dark', palette: 'indigo', tags: { ok: { c: 0 } }, pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'hd', type: 'header', eyebrow: 'Rapport', title: 'Incident <i>42</i>', lede: 'Résumé court' },
  { id: 'hn', type: 'header', eyebrow: 'Caché', noEyebrow: true, title: 'Seul', lede: '' },
  { id: 's1', type: 'h2', html: 'Section' }, { id: 's2', type: 'h3', html: 'Sous-section' }, { id: 's3', type: 'subtitle', html: 'Petit titre' },
  { id: 'e1', type: 'step', num: '', title: 'Isoler' }, { id: 'e2', type: 'step', num: '', title: 'Nettoyer' }, { id: 'e3', type: 'step', nonum: true, title: 'Sans numéro' },
  { id: 'p1', type: 'p', html: 'A <b>gras</b> <i>it</i> <u>sou</u> <s>bar</s> <code>x&lt;y</code> <a href="https://ex.fr/a">web</a> <a href="#pg-p2">interne</a> ' + P('OK') + ' ' + P('Inconnue') },
  { id: 'p2', type: 'p', indent: 2, html: 'retrait' },
  { id: 'pc', type: 'p', html: 'a <span class="c-vert">vert</span> <span class="s-jaune">jaune</span> <span class="c-violet s-rose">les deux <code>x</code> ' + P('OK') + '</span> <span class="alert">rouge</span>' },
  { id: 'pn', type: 'p', html: 'a vert jaune les deux <code>x</code> ' + P('OK') + ' rouge' },
  { id: 'ft', type: 'footer', html: 'Sources' }, { id: 'dv', type: 'divider' },
  { id: 'im', type: 'image', src: 'data:image/png;base64,AAAA', caption: 'Légende', alt: '' },
] }, { id: 'p2', title: 'Suite', blocks: [] }] };
const office = (id, opts) => { const r = monterOffice(DOC, id, opts); verifierSocle(r.html, id); return r; };

test('office (texte) : en-tête en surtitre Consolas capitales accent, titre de 30 pt, chapeau gris, même en thème sombre', () => {
  const { html } = office('hd');
  vrai(/<p style="[^"]*"><span style="font-family:Consolas,monospace;font-size:9pt;color:#4848c0;letter-spacing:0\.72pt">RAPPORT<\/span><\/p>/.test(html), 'surtitre : ' + html);
  // Writer ignore text-transform : les capitales sont écrites dans le texte
  vrai(/<h1 style="[^"]*font-family:'Segoe UI',sans-serif;[^"]*font-size:30pt;[^"]*font-weight:bold[^"]*">Incident <i>42<\/i><\/h1>/.test(html), 'titre : ' + html);
  vrai(/<p style="[^"]*font-size:11\.25pt;[^"]*color:#566573[^"]*">Résumé court<\/p>/.test(html), 'chapeau : ' + html);
  const seul = office('hn').html;
  vrai(!seul.includes('Caché') && !/<p/.test(seul), 'surtitre masqué et chapeau vide omis : ' + seul);
});

test('office (texte) : titre de section, sous-section et sous-titre à la taille et à la graisse d\'Ardoise', () => {
  vrai(new RegExp('<h1 style="[^"]*' + TITRE + ';[^"]*font-size:15\\.75pt;[^"]*font-weight:600[^"]*">Section</h1>').test(office('s1').html), office('s1').html);
  vrai(new RegExp('<h2 style="[^"]*' + TITRE + ';[^"]*font-size:11\\.25pt;[^"]*font-weight:600[^"]*">Sous-section</h2>').test(office('s2').html), office('s2').html);
  vrai(new RegExp('<h3 style="[^"]*' + TITRE + ';[^"]*font-size:11\\.25pt;[^"]*font-weight:600[^"]*">Petit titre</h3>').test(office('s3').html), office('s3').html);
});

test('office (texte) : étape numérotée, numéro dans une cellule accent-soft au texte accent, sous un filet', () => {
  const { html } = office('e2');
  vrai(/^<div[^>]*><p style="[^"]*border-top:1px solid #d9e0e5[^"]*">&nbsp;<\/p><table/.test(html), 'filet au-dessus : ' + html);
  vrai(/<td valign="middle" width="6%" style="[^"]*background:#ececfb;[^"]*color:#4848c0;[^"]*font-weight:bold[^"]*">2<\/td>/.test(html), 'numéro : ' + html);
  vrai(/<td valign="middle" width="94%"[^>]*><h1 style="[^"]*font-size:15\.75pt[^"]*">Nettoyer<\/h1><\/td>/.test(html), 'titre : ' + html);
  const sans = office('e3').html;
  vrai(!/<table|#ececfb/.test(sans) && /<h1 [^>]*>Sans numéro<\/h1>/.test(sans), 'sans numéro : ' + sans);
});

test('office (texte) : paragraphe et ses formes, code en ligne sur accent-soft, liens accent, retrait', () => {
  const { html, texte } = office('p1');
  vrai(html.includes('<b>gras</b>') && html.includes('<i>it</i>') && html.includes('<u>sou</u>') && html.includes('<s>bar</s>'), html);
  vrai(/<code style="font-family:Consolas,monospace;font-size:9\.75pt;background:#ececfb;color:#17212b">x&lt;y<\/code>/.test(html), 'code en ligne : ' + html);
  vrai(html.includes('<a href="https://ex.fr/a" style="color:#4848c0">web</a>'), 'lien accent');
  vrai(html.includes('<u>interne</u>') && !html.includes('#pg-p2'), 'lien interne en texte souligné, sans adresse');
  egal(texte, 'A gras it sou bar x<y web interne #OK #Inconnue', 'texte brut inchangé');
  vrai(/<p style="[^"]*margin-left:45pt[^"]*">retrait<\/p>/.test(office('p2').html), office('p2').html);
});

test('office (texte) : pastille en texte modifiable, fond, couleur et semi-gras d\'Ardoise en thème clair, petite taille', () => {
  const { html } = office('p1');
  vrai(new RegExp('<span style="background:#e3f3ea;color:#1f7a4d;' + TITRE + ';font-weight:600;font-size:9pt;[^"]*">OK</span>').test(html), html);
  vrai(html.includes('<span style="background:#d9e0e5;color:#17212b;'), 'pastille hors registre : gris de --line');
});

test('office (texte) : pied de page gris sous un filet, séparateur fin, image au cadre fin et légende centrée', () => {
  vrai(/<p style="[^"]*border-top:1px solid #d9e0e5;[^"]*font-size:9\.75pt;[^"]*color:#566573[^"]*">Sources<\/p>/.test(office('ft').html), office('ft').html);
  // filet en bordure de paragraphe : Writer dessine un <hr> en trait sombre, sans sa couleur
  vrai(/^<div[^>]*><p style="[^"]*border-top:1px solid #d9e0e5;[^"]*">&nbsp;<\/p><\/div>$/.test(office('dv').html), office('dv').html);
  const im = office('im', { page: 0, images: { im: { src: 'data:image/png;base64,AAAA', mime: 'image/png', l: 1360, h: 400 } } }).html;
  vrai(/<img src="data:image\/png;base64,AAAA" alt="Légende" width="680" height="200" style="border:1px solid #d9e0e5[^"]*">/.test(im), 'image : ' + im);
  vrai(/<p style="[^"]*text-align:center;[^"]*font-size:9\.75pt;[^"]*color:#566573[^"]*">Légende<\/p>/.test(im), 'légende : ' + im);
});

test('office (texte) : couleur du texte et surlignage en styles en ligne aux teintes claires, pastille et code gardent leur fond, texte brut inchangé', () => {
  const { html, texte } = office('pc');
  vrai(html.includes('<span style="color:#18794e">vert</span>'), 'couleur seule : ' + html);
  vrai(html.includes('<span style="background:#fff0a6">jaune</span>'), 'surlignage seul : ' + html);
  vrai(html.includes('<span style="color:#6d3fc0;background:#fadbe8">les deux </span>'), 'couleur et surlignage : ' + html);
  vrai(/<span style="color:#6d3fc0;background:#fadbe8"><code style="[^"]*background:#ececfb[^"]*">x<\/code><\/span>/.test(html), 'code sur son propre fond : ' + html);
  vrai(/<span style="background:#e3f3ea;color:#1f7a4d;[^"]*">OK<\/span>/.test(html), 'pastille à ses couleurs : ' + html);
  vrai(html.includes('<span style="color:#b42318">rouge</span>'), 'alert toujours rouge : ' + html);
  egal(texte, office('pn').texte, 'texte brut');
});
