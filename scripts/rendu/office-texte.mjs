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
  { id: 'tx', type: 'texte', lignes: [{ html: 'un ' + P('OK') }, { html: 'deux', lv: 2 }, { html: '' }, { html: 'fin <b>gras</b>', lv: 1 }] },
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

test('office (texte) : bloc texte, un paragraphe par ligne, retrait par niveau, lignes serrées, ligne vide gardée', () => {
  const { html, texte, e } = office('tx');
  egal(e.map((x) => [x.t, x.retrait || 0, !!x.serre]), [['para', 0, true], ['para', 2, true], ['para', 0, true], ['para', 1, false]], 'éléments neutres');
  const ps = [...html.matchAll(/<p style="([^"]*)">([\s\S]*?)<\/p>/g)];
  egal(ps.length, 4, html);
  egal(ps.map((m) => (m[1].match(/margin-left:([\d.]+pt)/) || [])[1] || '0'), ['0', '45pt', '0', '22.5pt'], 'retrait de 2em par niveau (comme p.ind-N)');
  egal(ps.map((m) => /^margin:0pt 0pt 0pt;/.test(m[1])), [true, true, true, false], 'lignes sans espace entre elles, sauf après la dernière');
  vrai(/^margin:0pt 0pt 6pt;/.test(ps[3][1]), 'dernière ligne : espace du paragraphe');
  egal(ps[2][2], '&nbsp;', 'ligne vide : Writer réduit un paragraphe vide');
  vrai(ps[3][2] === 'fin <b>gras</b>', ps[3][2]);
  egal(texte, 'un #OK\n    deux\n\n  fin gras', 'texte brut : deux espaces par niveau, ligne vide gardée');
});

// Formules (lot 9, ticket 07) : texte brut `$source$` et `$$source$$` sur sa ligne ; le HTML écrit `$source$` jusqu'aux images (ticket 08)
const FO = (s) => '<span class="formule">' + s + '</span>';
const DOCF = { v: 6, title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'fp', type: 'p', html: 'Aire ' + FO('x^2') + ' et <b>' + FO('\\frac{a}{b}') + '</b> fin' },
  { id: 'ft', type: 'texte', lignes: [{ html: 'avant' }, { html: FO('a &lt; b') }] },
  { id: 'fb', type: 'formule', tex: '\\frac{a}{b}' }, { id: 'fv', type: 'formule', tex: '  ' },
  { id: 'fh', type: 'table', rows: [['Valeur ' + FO('\\alpha'), 'B'], ['1', '2']] },
] }] };
test('office (texte) : formule en ligne en $source$ dans le texte brut et le HTML, un segment à part qui porte sa source', () => {
  const r = monterOffice(DOCF, 'fp'); verifierSocle(r.html, 'fp');
  egal(r.texte, 'Aire $x^2$ et $\\frac{a}{b}$ fin');
  egal(r.e[0].segs.filter((g) => g.formule), [{ texte: '$x^2$', formule: 'x^2' }, { texte: '$\\frac{a}{b}$', gras: true, formule: '\\frac{a}{b}' }]);
  vrai(r.html.includes('Aire $x^2$ et <b>$\\frac{a}{b}$</b> fin'), 'HTML : ' + r.html);
  egal(monterOffice(DOCF, 'ft').texte, 'avant\n$a < b$');
});
test('office (texte) : bloc formule en $$source$$ sur sa ligne dans le texte brut, rien pour une source vide', () => {
  egal(monterOffice(DOCF, 'fb').texte, '$$\\frac{a}{b}$$');
  egal(monterOffice(DOCF, 'fv').texte, '');
});
test('office (texte) : formule d\'un en-tête de tableau gardée telle quelle, hors capitales', () => {
  const r = monterOffice(DOCF, 'fh');
  vrai(r.html.includes('VALEUR $\\alpha$'), 'en-tête : ' + r.html);
});

// Formules en images (lot 9, ticket 08) : opts.formules = { ligne: { source: image }, bloc: { source: image } }, images préparées
// par Copier pour Office (22-copier-office.js) ; image en ligne { src, l, h } à 15 px, ligne de base au milieu (align="middle", et
// vertical-align d'une demi-hauteur affichée pour Google Docs, ticket 12)
const IMG = (n) => ({ src: 'data:image/png;base64,' + n, l: 30, h: 24 });
const FORMULES = { ligne: { 'x^2': IMG('X2'), '\\frac{a}{b}': IMG('FR'), '\\alpha': IMG('AL') }, bloc: { '\\frac{a}{b}': { src: 'data:image/png;base64,BL', l: 900, h: 90 } } };
const officeF = (id) => { const r = monterOffice(DOCF, id, { page: 0, formules: FORMULES }); verifierSocle(r.html, id); return r; };
test('office (texte) : formule en ligne en image à sa place dans le texte, source en texte de remplacement, ligne de base au milieu', () => {
  const r = officeF('fp');
  vrai(r.html.includes('Aire <img src="data:image/png;base64,X2" alt="x^2" width="30" height="24" align="middle" style="vertical-align:-12px"> et <b><img src="data:image/png;base64,FR" alt="\\frac{a}{b}" width="30" height="24" align="middle" style="vertical-align:-12px"></b> fin'), 'HTML : ' + r.html);
  egal(r.texte, 'Aire $x^2$ et $\\frac{a}{b}$ fin', 'texte brut inchangé');
});
test('office (texte) : formule sans image dessinée en $source$', () => {
  const r = officeF('ft');
  vrai(r.html.includes('$a &lt; b$') && !r.html.includes('<img'), 'HTML : ' + r.html);
});
test('office (texte) : bloc formule en image centrée ramenée à 680 px, $$source$$ centré sans image', () => {
  const r = officeF('fb');
  vrai(/^<div[^>]*><p align="center" style="margin:0pt 0pt 6pt;text-align:center"><img src="data:image\/png;base64,BL" alt="\\frac\{a\}\{b\}" width="680" height="68"><\/p><\/div>$/.test(r.html), 'HTML : ' + r.html);
  egal(r.e, [{ t: 'formule', tex: '\\frac{a}{b}', image: FORMULES.bloc['\\frac{a}{b}'] }]);
  const sans = monterOffice(DOCF, 'fb'); verifierSocle(sans.html, 'fb sans image');
  vrai(/<p align="center" style="margin:0pt 0pt 6pt;text-align:center">\$\$\\frac\{a\}\{b\}\$\$<\/p>/.test(sans.html), 'repli : ' + sans.html);
  egal(monterOffice(DOCF, 'fv', { page: 0, formules: FORMULES }).html.includes('<p'), false);
});
test('office (texte) : formule d\'un titre à la taille du titre, d\'une ligne Grand à la taille de la ligne', () => {
  const d = { v: 6, title: 'Doc', pages: [{ id: 'p1', title: 'A', blocks: [
    { id: 'hd', type: 'header', title: 'Aire ' + FO('x^2'), eyebrow: '', lede: '' }, { id: 'h2', type: 'h2', html: FO('x^2') },
    { id: 'tg', type: 'texte', lignes: [{ html: FO('x^2'), taille: 'grand' }] }] }] };
  const img = (id) => { const r = monterOffice(d, id, { page: 0, formules: FORMULES }); verifierSocle(r.html, id); return (r.html.match(/<img[^>]*>/) || [''])[0]; };
  // décalage d'une demi-hauteur affichée (Google Docs ignore align="middle")
  vrai(/width="80" height="64" align="middle" style="vertical-align:-32px"/.test(img('hd')), 'en-tête 40 px : ' + img('hd'));
  vrai(/width="42" height="34" align="middle" style="vertical-align:-17px"/.test(img('h2')), 'section 21 px : ' + img('h2'));
  vrai(/width="36" height="29" align="middle" style="vertical-align:-14.5px"/.test(img('tg')), 'ligne Grand 18 px : ' + img('tg'));
});
test('office (texte) : formules d\'éléments neutres, une fois par source et par mode', () => {
  const { ctx, d } = monterOffice(DOCF, 'fp');
  const e = ctx.officeBlocs(d.pages[0].blocks.concat(d.pages[0].blocks), d, { page: 0 });
  egal(ctx.officeFormulesDe(e), { ligne: ['x^2', '\\frac{a}{b}', 'a < b', '\\alpha'], bloc: ['\\frac{a}{b}'] });
});
test('office (socle) : une image dans le texte se centre par align="middle" (Writer ignore vertical-align, absmiddle la pose plus haut), vertical-align en plus pour Google Docs', () => {
  const refuse = (html) => { try { verifierSocle(html, 'essai'); return false; } catch (_) { return true; } };
  vrai(refuse('<p style="margin:0pt">a <img src="x" alt="y" width="1" height="1" align="absmiddle"></p>'), 'align="absmiddle" accepté');
  vrai(refuse('<p style="margin:0pt">a <img src="x" alt="y" width="1" height="1" style="vertical-align:-3pt"></p>'), 'vertical-align accepté');
  vrai(!refuse('<p style="margin:0pt">a <img src="x" alt="y" width="1" height="1" align="middle"></p>'), 'middle refusé');
  vrai(!refuse('<p style="margin:0pt">a <img src="x" alt="y" width="2" height="2" align="middle" style="vertical-align:-1px"></p>'), 'middle et vertical-align refusé');
});
