// Socle du style de Copier pour Office (src/js/08-office.js, officeHtmlBloc) : vérifications communes à toutes les familles de blocs.
// Les familles (scripts/rendu/office-<famille>.mjs) importent monterOffice et verifierSocle.
import { readFileSync } from 'node:fs';
import { monter, test, vrai } from './commun.mjs';

const CSS = readFileSync(new URL('../../src/css/page.css', import.meta.url), 'utf8');
// couleurs des règles :root sans condition (thème clair) et accent clair de chaque palette
const CLAIRES = new Set(['#ffffff']);
for (const m of CSS.matchAll(/^:root(?:\[data-palette="\w+"\])?\{([^}]*)\}/gm)) for (const d of m[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) if (!/-d$/.test(d[1])) CLAIRES.add(d[2].toLowerCase());
// jetons du bloc de code sombre (règle .code de page.css) : ce bloc reste sombre quel que soit le thème
for (const d of CSS.match(/^\.code\{(--tk-[^}]*)\}/m)[1].matchAll(/--tk-\w:(#[0-9a-f]{6})/g)) CLAIRES.add(d[1].toLowerCase());
export const POLICES = ["'Segoe UI',sans-serif", "'Segoe UI Semibold','Segoe UI',sans-serif", 'Consolas,monospace'];

// HTML stylé d'un bloc (point d'entrée unique), texte brut et éléments neutres
export function monterOffice(doc, id, opts) {
  const { ctx, d } = monter(doc);
  const b = d.pages[0].blocks.find((x) => x.id === id);
  const o = opts || { page: 0 };
  const e = ctx.officeBloc(b, d, o);
  return { html: ctx.officeHtmlBloc(b, d, o), texte: ctx.officeTexte(e), e, ctx, d };
}
// règles du socle : sans classe, tableaux pleine largeur (attribut et style), 680 px au plus, polices d'Office, couleurs claires de page.css
export function verifierSocle(html, nom, couleursEnPlus = []) {
  const ou = nom + ' : ' + html;
  vrai(!/\sclass=/.test(html), 'classe dans le HTML (' + ou + ')');
  for (const t of html.match(/<table[^>]*>/g) || []) vrai(/ width="100%"/.test(t) && /style="[^"]*width:100%/.test(t), 'tableau sans width="100%" (' + nom + ') : ' + t);
  for (const m of html.matchAll(/width(?:="|:)(\d+)(?:px)?/g)) vrai(+m[1] <= 680, 'largeur au-delà de 680 px (' + ou + ')');
  for (const m of html.matchAll(/font-family:([^;"]*)/g)) vrai(POLICES.includes(m[1]), 'police hors du socle « ' + m[1] + ' » (' + nom + ')');
  vrai(!/Plex|Archivo|Arial/.test(html), 'police d\'Ardoise ou Arial (' + ou + ')');
  // Writer prend la première valeur d'un raccourci margin pour la marge gauche (margin:12pt 0 6pt décale le bloc) : raccourci à 0 en tête, sinon margin-top
  for (const m of html.matchAll(/(?:^|[;"])margin:([^;"]*)/g)) vrai(/^0(pt|px)?(\s|$)/.test(m[1].trim()), 'marge en raccourci sans 0 en tête « ' + m[1] + ' » (' + nom + ')');
  // Writer ignore tout ce qui suit un letter-spacing dans un style (bordures, couleur) : il est le dernier du style
  for (const m of html.matchAll(/style="([^"]*)"/g)) vrai(!/letter-spacing:[^;]*;\s*\S/.test(m[1]), 'letter-spacing suivi d’autres propriétés « ' + m[1] + ' » (' + nom + ')');
  // Writer remet l'espacement par défaut sur une marge sans unité (margin:0) et lit mal une valeur en .N : 0pt, 0.5pt
  for (const m of html.matchAll(/(?:^|[;"])margin(?:-\w+)?:([^;"]*)/g)) vrai(/\d(pt|px|em|%)/.test(m[1]), 'marge sans unité « ' + m[0] + ' » (' + nom + ')');
  for (const m of html.matchAll(/style="([^"]*)"/g)) vrai(!/(^|[\s:,(])\.\d/.test(m[1]), 'valeur commençant par un point « ' + m[1] + ' » (' + nom + ')');
  // Writer ignore vertical-align dans le style : seul l'attribut valign cale une cellule
  for (const m of html.matchAll(/<\w+[^>]*vertical-align[^>]*>/g)) vrai(/\svalign="/.test(m[0]), 'vertical-align sans valign ' + m[0] + ' (' + nom + ')');
  // image dans le texte (formule, ligne de base en son milieu) : Writer ignore vertical-align sur une image ; align="middle" y pose
  // le milieu sur la ligne de base, absmiddle plus haut quand une formule plus grande est sur la ligne (vu par soffice → PDF)
  for (const m of html.matchAll(/<img[^>]*\salign="([^"]*)"/g)) vrai(m[1] === 'middle', 'image alignée par align="' + m[1] + '" (' + nom + ')');
  // Writer ignore text-transform (capitales par officeMajuscules) et dessine <hr> en trait noir épais (filet : paragraphe bordé en haut)
  vrai(!/text-transform/.test(html), 'text-transform dans le HTML (' + ou + ')');
  vrai(!/<hr[\s>/]/.test(html), '<hr> dans le HTML (' + ou + ')');
  // la police ne s'hérite pas dans un tableau : officeCellule la pose sur chaque cellule qui porte du texte (une cellule d'espace est vide ou n'a que &nbsp;)
  for (const m of html.matchAll(/<t[dh][^>]*>(?!(?:&nbsp;)?<\/t)/g)) vrai(/font-family:/.test(m[0]), 'cellule sans police ' + m[0] + ' (' + nom + ')');
  // Word fusionne deux tableaux qui se suivent : un paragraphe les sépare
  vrai(!/<\/table>\s*<table/.test(html), 'deux tableaux qui se suivent (' + ou + ')');
  for (const m of html.matchAll(/#[0-9a-f]{6}\b/gi)) vrai(CLAIRES.has(m[0].toLowerCase()) || couleursEnPlus.includes(m[0].toLowerCase()), 'couleur hors page.css ' + m[0] + ' (' + nom + ')');
}

const P = (t, cls) => '<span class="pill' + (cls ? ' ' + cls : '') + '">' + t + '</span>';
// un bloc de chaque type, document en thème sombre à la palette indigo
const TOUS = { v: 6, title: 'Doc', theme: 'dark', palette: 'indigo', tags: { ok: { c: 0 } }, pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'hd', type: 'header', eyebrow: 'Rapport', title: 'Titre', lede: 'Chapeau' },
  { id: 'h2', type: 'h2', html: 'Section' }, { id: 'h3', type: 'h3', html: 'Sous' }, { id: 'st', type: 'subtitle', html: 'Petit' },
  { id: 'sp', type: 'step', title: 'Isoler' },
  { id: 'p', type: 'p', indent: 1, html: 'a <b>b</b> <code>c</code> <a href="https://ex.fr">d</a> ' + P('OK') },
  { id: 'sm', type: 'summary', title: 'Sommaire' },
  { id: 'l', type: 'list', items: [{ html: 'un' }] }, { id: 'c', type: 'check', items: [{ html: 'fait', done: true }] },
  { id: 't', type: 'table', rows: [['Nom', 'État'], ['a', P('OK')]] },
  { id: 'f', type: 'facts', items: [{ k: 'Hôte', v: 'srv', alert: true }] },
  { id: 'n', type: 'note', variant: 'info', html: 'Info' },
  { id: 'k', type: 'code', variant: 'dark', name: 'a.sh', code: 'ls\n' },
  { id: 'kb', type: 'kanban', cols: [{ id: 'c1', title: 'À faire', cards: [{ id: 'x', title: 'T', due: '2026-03-12' }] }] },
  { id: 'q', type: 'query', title: 'Hôtes', src: 'facts', scope: 'doc', tags: [], match: 'any', view: 'table' },
  { id: 'dt', type: 'details', title: 'Plus', html: 'Caché' },
  { id: 'im', type: 'image', src: 'data:image/png;base64,AAAA', caption: 'Légende' },
  { id: 'cd', type: 'cards', cards: [{ title: 'A', text: 'x' }] },
  { id: 'g', type: 'group', title: 'Groupe', blocks: [{ id: 'gp', type: 'p', html: 'dedans' }] },
  { id: 'dm', type: 'diamond', title: 'C', adversaire: 'A', capacite: '', infrastructure: 'I', victime: 'V' },
  { id: 'dv', type: 'divider' }, { id: 'ft', type: 'footer', html: 'Sources' },
  { id: 'tx', type: 'texte', lignes: [{ html: 'un' }, { html: 'deux', lv: 2 }, { html: '' }, { html: 'fin <b>gras</b>', lv: 1 }] },
  // bloc texte mêlé : puces et numéros imbriqués, numéro de départ, cases, sous-titre, alignements, Petit et Grand
  { id: 'tm', type: 'texte', lignes: [{ html: 'a', genre: 'numero' }, { html: 'b', genre: 'puce', lv: 1 }, { html: 'c', genre: 'numero', lv: 3 }, { html: 'd', genre: 'numero' },
    { html: 'e', genre: 'case', done: true, lv: 1 }, { html: 'f', genre: 'soustitre', align: 'centre' }, { html: 'g', align: 'justifie', taille: 'petit' },
    { html: 'h', genre: 'numero', lv: 2, align: 'droite', taille: 'grand' }, { html: '', genre: 'puce' }] },
] }] };

test('office (socle) : chaque type de bloc suit le socle (sans classe, tableaux pleine largeur, polices d\'Office, couleurs claires)', () => {
  const images = { im: { src: 'data:image/png;base64,AAAA', mime: 'image/png', l: 1360, h: 400 } };
  for (const b of TOUS.pages[0].blocks) verifierSocle(monterOffice(TOUS, b.id, { page: 0, images }).html, b.type);
});

test('office (socle) : le texte part en Segoe UI avec remplaçant, à la taille du corps d\'Ardoise en points', () => {
  const { html } = monterOffice(TOUS, 'p');
  vrai(/^<div style="[^"]*font-family:'Segoe UI',sans-serif;[^"]*font-size:11\.25pt/.test(html), html);
});

test('office (socle) : le rendu stylé garde la marque de Copier pour Office (ticket 02) et les règles du socle', () => {
  const { html, ctx } = monterOffice(TOUS, 'hd'), copie = ctx.htmlCopieOffice(html);
  vrai(ctx.copieOffice(copie) && copie.includes(html), copie.slice(0, 120));
  verifierSocle(copie, 'header marqué');
});
