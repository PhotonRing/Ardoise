// Sujet : saisie propre à chaque type (spec saisie-par-bloc, ticket 01), écrit sur le code d'avant le déplacement vers les facettes.
// Un cas par branche : saisie, changement ou touche, puis modèle, étape d'historique (libellé d'Annuler, Ctrl+Z) et effet visible.
// Couverts ailleurs : formule-ta (bloc-formule), « / » d'Android (bloc-texte-menus, bloc-formule), raccourcis (bloc-texte-genres).
import { jusqua } from './outils/attente.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const CARTE = { id: 'm', type: 'map', height: 300, bg: 'vector', view: { lat: 47, lon: -3, z: 4 }, list: true,
  markers: [{ lat: 48.38, lon: -4.47, label: 'Brest', color: 'accent' }],
  zones: [{ shape: 'circle', c: [47.5, -2.5], r: 20000, label: 'Golfe', color: 'accent' }],
  routes: [{ label: 'Côte', color: 'accent', pts: [[48.38, -4.47], [47.75, -3.36]] }] };
const PAYS = { id: 'c', type: 'map', height: 300, bg: 'vector', view: { lat: 47, lon: 5, z: 3 }, markers: [], zones: [], routes: [],
  choro: { data: { FRA: 10, DEU: 20 }, scale: 'lin', pal: 'blues' } };
const TABLEAU = { id: 'tb', type: 'table', rows: [['Pays', 'Valeur'], ['France', '3'], ['Espagne', '4']] };
const KANBAN = { id: 'k', type: 'kanban', cols: [{ id: 'c1', title: 'À faire', cards: [{ id: 'k1', title: 'Carte', due: '2027-01-10' }] }] };
const CODE = { id: 'cd', type: 'code', variant: 'box', name: 'notes.txt', code: 'def f():\n  return 1', tall: false };
const doc = (blocks, pages = []) => ({ title: 'Saisie', pages: [{ id: 'p1', title: 'Accueil', blocks }].concat(pages) });
const BLOC = (id) => `JSON.parse(JSON.stringify(window.ardoise.doc.pages[0].blocks.find((b) => b.id === ${JSON.stringify(id)}) || null))`;
const ANNULER = `(document.querySelector('#ui [data-ui=undo]') || {}).title || ''`;
const LIB = (lib) => 'Annuler : ' + lib + ' (Ctrl+Z)';
const CARTE_BLOC = 'Accueil · Carte « Brest Golfe Côte » : bloc modifié', PAYS_BLOC = 'Accueil · Carte : bloc modifié', KANBAN_BLOC = 'Accueil · Kanban « À faire Carte » : bloc modifié';
const TOAST = `(() => { const t = document.querySelector('#ui .toast'); return t && t.style.display === 'block' ? t.textContent : ''; })()`;
const ACTIF = `(() => { const a = document.activeElement; return a ? (a.className || a.tagName) + '|' + (a.dataset.k || a.dataset.p || '') : ''; })()`;
// curseur en fin de champ (zone de texte ou champ modifiable)
const auBout = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.focus();
  if ('value' in el && el.tagName !== 'SELECT') { el.setSelectionRange(el.value.length, el.value.length); return true; }
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
// nouvelle valeur d'un champ validée à la sortie : tout sélectionné, frappe, puis sortie (évènement change natif)
const remplacer = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.focus(); el.select(); return true; })()`;
const choisir = (sel, v) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`;
const TOUCHES = { Enter: ['Enter', 13], Escape: ['Escape', 27], Tab: ['Tab', 9], ArrowDown: ['ArrowDown', 40], ArrowUp: ['ArrowUp', 38], z: ['KeyZ', 90] };

export const nom = 'saisie par type';
export default async function ({ ecran, charger, evalue, cdp, mesure, echec }) {
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  const touche = async (key, mods = 0) => { const [code, vk] = TOUCHES[key]; for (const type of ['rawKeyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods }); };
  const tape = (text) => cdp('Input.insertText', { text });
  const sortir = () => evalue(`document.activeElement && document.activeElement.blur(), true`);
  const bloc = (id) => evalue(BLOC(id));
  const charge = async (blocks, pages, pret) => {
    if (!(await evalue(`window.ardoise.load(${JSON.stringify(doc(blocks, pages))})`))) throw new Error('document refusé');
    if (!(await jusqua(evalue, pret || `!!document.querySelector('.blk[data-id="${blocks[blocks.length - 1].id}"]')`))) throw new Error('document non affiché');
  };
  // carte choisie d'un clic : son panneau « Éléments de la carte » s'affiche
  const activer = async (id) => {
    const p = await evalue(`(() => { const r = document.querySelector('.map[data-mapid="${id}"]').getBoundingClientRect(); return { x: r.left + 20, y: r.top + 20 }; })()`);
    for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
    if (!(await jusqua(evalue, `!!document.querySelector('.mk-panel.show[data-b="${id}"]')`))) throw new Error('panneau de la carte ' + id + ' absent');
  };
  const carteActive = async (blocks) => { await charge(blocks, null, `!!document.querySelector('.map[data-mapid="${blocks[0].id}"] canvas')`); await activer(blocks[0].id); };
  // étape d'historique : libellé d'Annuler une fois l'étape posée (la frappe est validée après le délai de session)
  const etape = async (cas, lib) => { const t = await jusqua(evalue, `(${ANNULER}) === ${JSON.stringify(LIB(lib))}`); attendu(cas + ' : étape', t, await evalue(ANNULER)); };
  const annuler = async (cas, id, test) => { await touche('z', 2); const b = await jusqua(evalue, `(() => { const b = ${BLOC(id)}; return (${test})(b) && b; })()`); attendu(cas + ' : Ctrl+Z', b, await bloc(id)); };
  // effet attendu : expr vraie, ou égale à la valeur donnée
  const vu = async (cas, expr, egal) => { const v = await jusqua(evalue, egal === undefined ? expr : `(${expr}) === ${JSON.stringify(egal)}`); attendu(cas, v, await evalue(expr)); };
  await ecran(1000, false);
  await charger();

  // ---------- Bloc carte : libellés en direct sur la carte (input), validés à la sortie (change) ----------
  const PRET_CARTE = `!!document.querySelector('.map[data-mapid="m"] .pin') && !!document.querySelector('.map[data-mapid="m"] .rlab')`;
  await carteActive([CARTE]);
  const libelles = [
    ['.mk-in[data-b="m"][data-mk="0"][data-p=label]', '.map[data-mapid="m"] .pin span', (b) => b.markers[0].label, 'Brest'],
    ['.zn-in[data-b="m"][data-zn="0"]', '.map[data-mapid="m"] .zlab span', (b) => b.zones[0].label, 'Golfe'],
    ['.rt-in[data-b="m"][data-rt="0"]', '.map[data-mapid="m"] .rlab b', (b) => b.routes[0].label, 'Côte'],
  ];
  const textes = ['Brest sud Golfe Côte', 'Brest Golfe sud Côte', 'Brest Golfe Côte sud'];
  for (const [champ, carte, lu, avant] of libelles) {
    await evalue(auBout(champ)); await tape(' sud');
    const b = await bloc('m');
    attendu(champ + ' : modèle', lu(b) === avant + ' sud', lu(b));
    await vu(champ + ' : carte redessinée', `(document.querySelector('${carte}') || {}).textContent`, avant + ' sud');
    await etape(champ, 'Accueil · Carte « ' + textes[libelles.findIndex((x) => x[0] === champ)] + ' » : texte modifié');
    await annuler(champ, 'm', `(b) => (${lu})(b) === ${JSON.stringify(avant)}`);
  }
  // étape d'un itinéraire : champs ouverts par « Modifier sur la carte »
  await evalue(`document.querySelector('.blk[data-id="m"] [data-act="shape-edit"][data-kind="route"]').click(), true`);
  await jusqua(evalue, `!!document.querySelector('.st-in[data-b="m"][data-rt="0"][data-s="1"]')`);
  await evalue(auBout('.st-in[data-b="m"][data-rt="0"][data-s="1"]')); await tape('Lorient');
  attendu('.st-in : modèle', JSON.stringify((await bloc('m')).routes[0].names) === '["","Lorient"]', (await bloc('m')).routes[0]);
  await vu('.st-in : carte redessinée', `(document.querySelector('.map[data-mapid="m"] .slab[data-s="1"] span') || {}).textContent`, 'Lorient');
  await etape('.st-in', CARTE_BLOC);
  await annuler('.st-in', 'm', `(b) => !(b.routes[0].names || []).some((n) => n)`);
  await touche('Escape');
  // rayon d'un cercle : rien pendant la frappe ; à la sortie, kilomètres validés, ou message et valeur d'avant
  await carteActive([CARTE]);
  const avantRayon = await evalue(ANNULER);
  await evalue(remplacer('.rd-in[data-b="m"]')); await tape('5,5');
  attendu('.rd-in : rien pendant la frappe', (await bloc('m')).zones[0].r === 20000 && (await evalue(ANNULER)) === avantRayon, [(await bloc('m')).zones[0].r, await evalue(ANNULER)]);
  await sortir();
  attendu('.rd-in : rayon validé à la sortie', (await bloc('m')).zones[0].r === 5500, (await bloc('m')).zones[0]);
  await etape('.rd-in', CARTE_BLOC);
  await annuler('.rd-in', 'm', `(b) => b.zones[0].r === 20000`);
  await jusqua(evalue, `!!document.querySelector('.rd-in[data-b="m"]')`);
  await evalue(remplacer('.rd-in[data-b="m"]')); await tape('loin'); await sortir();
  await vu('.rd-in refusé : message', TOAST, 'Rayon non reconnu : indiquez un nombre de kilomètres');
  attendu('.rd-in refusé : valeur d\'avant', (await evalue(`document.querySelector('.rd-in[data-b="m"]').value`)) === '20' && (await bloc('m')).zones[0].r === 20000, await evalue(`document.querySelector('.rd-in[data-b="m"]').value`));
  // coordonnées d'un point : Entrée sort du champ, qui valide ; erreur : message et valeur d'avant
  await evalue(remplacer('.mk-in[data-b="m"][data-p=ll]')); await tape('47.5, -3.2'); await touche('Enter');
  attendu('.mk-in coordonnées : Entrée valide', JSON.stringify((({ lat, lon }) => [lat, lon])((await bloc('m')).markers[0])) === '[47.5,-3.2]', (await bloc('m')).markers[0]);
  await etape('.mk-in coordonnées', CARTE_BLOC);
  await annuler('.mk-in coordonnées', 'm', `(b) => b.markers[0].lat === 48.38 && b.markers[0].lon === -4.47`);
  await jusqua(evalue, `!!document.querySelector('.mk-in[data-b="m"][data-p=ll]')`);
  await evalue(remplacer('.mk-in[data-b="m"][data-p=ll]')); await tape('nulle part'); await sortir();
  await vu('.mk-in coordonnées refusées : message', TOAST, 'Coordonnées non reconnues. Format : latitude, longitude (ex. 48.38, -4.47)');
  attendu('.mk-in coordonnées refusées : valeur d\'avant', (await evalue(`document.querySelector('.mk-in[data-b="m"][data-p=ll]').value`)) === '48.38, -4.47', await evalue(`document.querySelector('.mk-in[data-b="m"][data-p=ll]').value`));
  // couleurs : même sélecteur pour les points, les zones et les itinéraires, la vue de la carte est gardée
  for (const [sel, lu, carte] of [['.mk-color', (b) => b.markers[0].color, '.pin.c-bad'], ['.zn-color', (b) => b.zones[0].color, '.zlab.c-bad'], ['.rt-color', (b) => b.routes[0].color, '.rlab.c-bad']]) {
    await carteActive([CARTE]);
    await evalue(`window.__vue = JSON.stringify(window.ardoise.doc.pages[0].blocks[0].view), true`);
    await evalue(choisir(sel + '[data-b="m"]', 'bad'));
    const b = await bloc('m');
    attendu(sel + ' : modèle', lu(b) === 'bad', lu(b));
    await vu(sel + ' : carte redessinée', `!!document.querySelector('.map[data-mapid="m"] ${carte}')`);
    await etape(sel, CARTE_BLOC);
    await annuler(sel, 'm', `(b) => (${lu})(b) === 'accent'`);
  }
  // recherche d'un lieu : résultats, flèches, Entrée ajoute le point ; Échap vide ; quitter le champ masque les résultats
  await carteActive([CARTE]);
  const RES = (q) => `(() => { const r = document.querySelector('${q}').parentNode.querySelector('.map-res'); return r.getClientRects().length ? [...r.querySelectorAll('.mi')].map((m) => (m.classList.contains('act') ? '>' : '') + m.querySelector('b').textContent) : null; })()`;
  await evalue(auBout('.map-q[data-b="m"]')); await tape('Lorient');
  const lieux = await jusqua(evalue, RES('.map-q'));
  attendu('.map-q : résultats', lieux && lieux.length > 0 && lieux[0][0] === '>', lieux);
  await touche('ArrowDown');
  attendu('.map-q : flèche bas', lieux && lieux.length > 1 ? (await evalue(RES('.map-q')))[1][0] === '>' : true, await evalue(RES('.map-q')));
  await touche('ArrowUp');
  attendu('.map-q : flèche haut', (await evalue(RES('.map-q')))[0][0] === '>', await evalue(RES('.map-q')));
  await touche('Enter');
  await vu('.map-q : Entrée ajoute le point', `(() => { const b = ${BLOC('m')}; return b.markers.length === 2 && b.markers[1].label; })()`);
  attendu('.map-q : champ vidé, résultats masqués', (await evalue(`document.querySelector('.map-q[data-b="m"]').value`)) === '' && (await evalue(RES('.map-q'))) === null, await evalue(RES('.map-q')));
  await etape('.map-q', 'Accueil · Carte « Brest Lorient Golfe Côte » : bloc modifié');
  await annuler('.map-q', 'm', `(b) => b.markers.length === 1`);
  await evalue(auBout('.map-q[data-b="m"]')); await tape('Brest'); await jusqua(evalue, RES('.map-q'));
  await touche('Escape');
  attendu('.map-q : Échap vide et masque', (await evalue(`document.querySelector('.map-q[data-b="m"]').value`)) === '' && (await evalue(RES('.map-q'))) === null, await evalue(RES('.map-q')));
  await evalue(auBout('.map-q[data-b="m"]')); await tape('Brest'); await jusqua(evalue, RES('.map-q'));
  await sortir();
  await vu('.map-q : quitter le champ masque les résultats', `${RES('.map-q')} === null`);
  attendu('.map-q : rien d\'ajouté sans choix', (await bloc('m')).markers.length === 1, (await bloc('m')).markers.length);

  // ---------- Choroplèthe ----------
  const PRET_PAYS = `!!document.querySelector('.ch-v[data-b="c"][data-id="FRA"]') && !!document.querySelector('.map[data-mapid="c"] canvas')`;
  const choro = async () => (await bloc('c')).choro;
  await carteActive([PAYS, TABLEAU]);
  // recherche d'un pays : comme celle d'un lieu
  await evalue(auBout('.ch-q[data-b="c"]')); await tape('Ital');
  const pays = await jusqua(evalue, RES('.ch-q'));
  attendu('.ch-q : résultats', pays && pays[0] === '>Italie', pays);
  await touche('Enter');
  await vu('.ch-q : Entrée ajoute le pays', `'ITA' in ${BLOC('c')}.choro.data`);
  await vu('.ch-q : la valeur du pays prend le curseur', `document.activeElement.matches('.ch-v[data-id="ITA"]')`);
  await etape('.ch-q', PAYS_BLOC);
  await annuler('.ch-q', 'c', `(b) => !('ITA' in b.choro.data)`);
  await evalue(auBout('.ch-q[data-b="c"]')); await tape('Esp'); await jusqua(evalue, RES('.ch-q'));
  await touche('Escape');
  attendu('.ch-q : Échap vide et masque', (await evalue(`document.querySelector('.ch-q[data-b="c"]').value`)) === '' && (await evalue(RES('.ch-q'))) === null, await evalue(RES('.ch-q')));
  await evalue(auBout('.ch-q[data-b="c"]')); await tape('Esp'); await jusqua(evalue, RES('.ch-q'));
  await sortir();
  await vu('.ch-q : quitter le champ masque les résultats', `${RES('.ch-q')} === null`);
  // titre et unité : en direct ; la sortie du champ valide l'étape aussitôt, une par champ
  await evalue(auBout('.ch-txt[data-b="c"][data-p="title"]')); await tape('Taux');
  attendu('.ch-txt titre : en direct', (await choro()).title === 'Taux', await choro());
  await sortir();
  attendu('.ch-txt titre : étape validée à la sortie', (await evalue(ANNULER)) === LIB('Accueil · Carte « Taux » : bloc modifié'), await evalue(ANNULER));
  await evalue(auBout('.ch-txt[data-b="c"][data-p="unit"]')); await tape('%');
  attendu('.ch-txt unité : en direct', (await choro()).unit === '%', await choro());
  await sortir();
  await annuler('.ch-txt unité', 'c', `(b) => !b.choro.unit && b.choro.title === 'Taux'`);
  // centre : rien pendant la frappe ; validé à la sortie, ou message et valeur d'avant
  await carteActive([PAYS, TABLEAU]);
  await evalue(remplacer('.ch-txt[data-b="c"][data-p=mid]')); await tape('12');
  attendu('.ch-txt centre : rien pendant la frappe', !('mid' in (await choro())), await choro());
  await sortir();
  attendu('.ch-txt centre : validé à la sortie', (await choro()).mid === 12, await choro());
  await etape('.ch-txt centre', PAYS_BLOC);
  await annuler('.ch-txt centre', 'c', `(b) => !('mid' in b.choro)`);
  await jusqua(evalue, `!!document.querySelector('.ch-txt[data-b="c"][data-p=mid]')`);
  await evalue(remplacer('.ch-txt[data-b="c"][data-p=mid]')); await tape('milieu'); await sortir();
  await vu('.ch-txt centre refusé : message', TOAST, 'Centre non reconnu : indiquez un nombre, ou laissez vide');
  attendu('.ch-txt centre refusé : valeur d\'avant', (await evalue(`document.querySelector('.ch-txt[data-b="c"][data-p=mid]').value`)) === '', await evalue(`document.querySelector('.ch-txt[data-b="c"][data-p=mid]').value`));
  // valeurs : rien pendant la frappe ; validées à la sortie (pastille recolorée) ; flèches et Entrée passent d'une valeur à l'autre
  const PASTILLE = `document.querySelector('.ch-row[data-b="c"][data-id="FRA"] .ch-sw').style.background`;
  const teinte = await evalue(PASTILLE);
  await evalue(remplacer('.ch-v[data-b="c"][data-id="FRA"]')); await tape('30');
  attendu('.ch-v : rien pendant la frappe', (await choro()).data.FRA === 10, (await choro()).data);
  await sortir();
  attendu('.ch-v : validée à la sortie', (await choro()).data.FRA === 30, (await choro()).data);
  attendu('.ch-v : pastille recolorée', (await evalue(PASTILLE)) !== teinte, [teinte, await evalue(PASTILLE)]);
  await etape('.ch-v', PAYS_BLOC);
  await evalue(remplacer('.ch-v[data-b="c"][data-id="FRA"]')); await tape('beaucoup'); await sortir();
  await vu('.ch-v refusée : message', TOAST, 'Valeur non reconnue : indiquez un nombre (ex. 12,5 ou 1 250)');
  attendu('.ch-v refusée : valeur d\'avant', (await evalue(`document.querySelector('.ch-v[data-b="c"][data-id="FRA"]').value`)) === '30', await evalue(`document.querySelector('.ch-v[data-b="c"][data-id="FRA"]').value`));
  const ORDRE_V = `[...document.querySelectorAll('.ch-v[data-b="c"]')].map((x) => x.dataset.id)`;
  const ordre = await evalue(ORDRE_V);
  await evalue(remplacer(`.ch-v[data-b="c"][data-id="${ordre[0]}"]`));
  await touche('ArrowDown');
  attendu('.ch-v : flèche bas, valeur suivante', (await evalue(`document.activeElement.dataset.id`)) === ordre[1], [ordre, await evalue(ACTIF)]);
  await touche('ArrowUp');
  attendu('.ch-v : flèche haut, valeur d\'avant', (await evalue(`document.activeElement.dataset.id`)) === ordre[0], await evalue(ACTIF));
  await touche('Enter');
  attendu('.ch-v : Entrée, valeur suivante', (await evalue(`document.activeElement.dataset.id`)) === ordre[1], await evalue(ACTIF));
  await touche('Enter');
  attendu('.ch-v : Entrée sur la dernière, sortie du champ', !(await evalue(`document.activeElement.matches('.ch-v')`)), await evalue(ACTIF));
  // réglages par liste : échelle, palette (personnalisée : couleurs vidées), classes ; couleurs personnalisées ; source
  await carteActive([PAYS, TABLEAU]);
  await evalue(choisir('.ch-set[data-b="c"][data-p="scale"]', 'quant'));
  await vu('.ch-set échelle', `${BLOC('c')}.choro.scale === 'quant' && !!document.querySelector('.ch-set[data-b="c"][data-p="classes"]')`);
  await evalue(choisir('.ch-set[data-b="c"][data-p="classes"]', '4'));
  await vu('.ch-set classes (nombre)', `${BLOC('c')}.choro.classes === 4`);
  await evalue(choisir('.ch-set[data-b="c"][data-p="pal"]', 'perso'));
  await vu('.ch-set palette personnalisée', `JSON.stringify(${BLOC('c')}.choro.cols) === '[]' && document.querySelectorAll('.ch-col[data-b="c"]').length === 2`);
  await evalue(choisir('.ch-col[data-b="c"][data-k="1"]', '#ff0000'));
  await vu('.ch-col', `JSON.stringify(${BLOC('c')}.choro.cols) === '[null,"#ff0000"]'`);
  await etape('.ch-col', PAYS_BLOC);
  await annuler('.ch-col', 'c', `(b) => JSON.stringify(b.choro.cols) === '[]'`);
  await evalue(choisir('.ch-src[data-b="c"]', 'tb'));
  await vu('.ch-src : tableau lié', `JSON.stringify(${BLOC('c')}.choro.src) === '{"b":"tb","k":0,"v":1}'`);
  await vu('.ch-src : colonnes du tableau proposées', `!!document.querySelector('.ch-set[data-b="c"][data-p="src.v"]')`);
  await evalue(choisir('.ch-set[data-b="c"][data-p="src.v"]', '0'));
  await vu('.ch-set colonne des valeurs', `${BLOC('c')}.choro.src.v === 0`);
  await evalue(choisir('.ch-src[data-b="c"]', ''));
  await vu('.ch-src : valeurs saisies ici', `!('src' in ${BLOC('c')}.choro)`);
  // zone de collage : la frappe ne touche pas le document
  await evalue(`document.querySelector('.blk[data-id="c"] [data-act="ch-paste"]').click(), true`);
  await jusqua(evalue, `!!document.querySelector('.ch-ta[data-b="c"]')`);
  const avantCollage = JSON.stringify(await choro());
  await evalue(auBout('.ch-ta[data-b="c"]')); await tape('Italie\t5');
  attendu('.ch-ta : rien pendant la frappe', JSON.stringify(await choro()) === avantCollage, await choro());

  // ---------- Kanban : priorité et échéance ----------
  await charge([KANBAN]);
  const carte = async () => (await bloc('k')).cols[0].cards[0];
  await evalue(choisir('.kb-prio-in[data-b="k"]', 'p1'));
  await vu('.kb-prio-in : priorité posée', `${BLOC('k')}.cols[0].cards[0].prio === 'p1' && !!document.querySelector('.kb-prio-in.p1')`);
  await etape('.kb-prio-in', KANBAN_BLOC);
  await evalue(choisir('.kb-prio-in[data-b="k"]', ''));
  await vu('.kb-prio-in : sans priorité, champ retiré', `!('prio' in ${BLOC('k')}.cols[0].cards[0])`);
  await annuler('.kb-prio-in', 'k', `(b) => b.cols[0].cards[0].prio === 'p1'`);
  const DUE = `document.querySelector('.kb-due-in[data-b="k"]')`;
  await evalue(remplacer('.kb-due-in[data-b="k"]')); await tape('15/03/2027'); await touche('Enter');
  await vu('.kb-due-in : Entrée valide jj/mm/aaaa, le fichier garde l\'ISO', `${BLOC('k')}.cols[0].cards[0].due === '2027-03-15'`);
  attendu('.kb-due-in : Entrée sort du champ', !(await evalue(`document.activeElement.matches('.kb-due-in')`)), await evalue(ACTIF));
  await etape('.kb-due-in', KANBAN_BLOC);
  await jusqua(evalue, `!!${DUE}`);
  await evalue(remplacer('.kb-due-in[data-b="k"]')); await tape('demain ?'); await sortir();
  attendu('.kb-due-in refusée : refus marqué, valeur d\'avant', (await evalue(`[${DUE}.value, ${DUE}.classList.contains('refus')]`)).join() === '15/03/2027,true' && (await carte()).due === '2027-03-15', await evalue(`[${DUE}.value, ${DUE}.className]`));
  await evalue(remplacer('.kb-due-in[data-b="k"]')); await tape('01/01/2030'); await touche('Escape');
  attendu('.kb-due-in : Échap rend la valeur et sort', (await evalue(`${DUE}.value`)) === '15/03/2027' && !(await evalue(`document.activeElement.matches('.kb-due-in')`)) && (await carte()).due === '2027-03-15', [await evalue(`${DUE}.value`), await evalue(ACTIF)]);
  await evalue(remplacer('.kb-due-in[data-b="k"]')); await tape('15/03/2027'); await sortir();
  attendu('.kb-due-in : même date, inchangée', (await carte()).due === '2027-03-15', await carte());
  await annuler('.kb-due-in : même date, pas d\'étape', 'k', `(b) => b.cols[0].cards[0].due === '2027-01-10'`);
  await evalue(remplacer('.kb-due-in[data-b="k"]')); await tape(' '); await sortir();
  await vu('.kb-due-in vide : échéance retirée', `!('due' in ${BLOC('k')}.cols[0].cards[0])`);
  await evalue(choisir('.kb-due-pick[data-b="k"]', '2027-04-01'));
  await vu('.kb-due-pick : date du sélecteur natif', `${BLOC('k')}.cols[0].cards[0].due === '2027-04-01' && document.querySelector('.kb-due-in[data-b="k"]').value === '01/04/2027'`);
  await annuler('.kb-due-pick', 'k', `(b) => !('due' in b.cols[0].cards[0])`);

  // ---------- Code : coloration pendant la frappe, Tab et Maj+Tab, défilement, nom ----------
  await charge([CODE]);
  const HL = `document.querySelector('.blk[data-id="cd"] .ta-hl')`;
  await evalue(auBout('textarea.code-ta[data-b="cd"]')); await tape('\nx = 2');
  attendu('code-ta : modèle', (await bloc('cd')).code === 'def f():\n  return 1\nx = 2', (await bloc('cd')).code);
  attendu('code-ta : coloration repeinte', /x = 2/.test(await evalue(`${HL}.textContent`)), await evalue(`${HL}.textContent`));
  await etape('code-ta', 'Accueil · Bloc de code « notes.txt def f(): return 1 x = 2 » : texte modifié');
  await touche('Tab');
  attendu('code-ta : Tab indente de deux espaces', (await bloc('cd')).code === 'def f():\n  return 1\nx = 2  ' && (await evalue(`document.activeElement.matches('textarea.code-ta')`)), [(await bloc('cd')).code, await evalue(ACTIF)]);
  await evalue(`(() => { const t = document.querySelector('textarea.code-ta[data-b="cd"]'); t.setSelectionRange(14, 14); return true; })()`);
  await touche('Tab', 8);
  attendu('code-ta : Maj+Tab retire l\'indentation de la ligne', (await bloc('cd')).code === 'def f():\nreturn 1\nx = 2  ', (await bloc('cd')).code);
  await touche('Enter');
  attendu('code-ta : Entrée reste au champ', (await evalue(`document.activeElement.matches('textarea.code-ta')`)), await evalue(ACTIF));
  await evalue(`(() => { const t = document.querySelector('textarea.code-ta[data-b="cd"]'); t.value += '\\n' + 'y'.repeat(400); t.dispatchEvent(new Event('input', { bubbles: true })); t.scrollLeft = 120; return true; })()`);
  await vu('code-ta : la coloration défile avec le champ', `${HL}.scrollLeft === document.querySelector('textarea.code-ta[data-b="cd"]').scrollLeft && ${HL}.scrollLeft > 0`);
  // nom du fichier : la coloration change de langage pendant la frappe
  await charge([CODE]);
  const avantNom = await evalue(`${HL}.innerHTML`);
  await evalue(`(() => { const f = document.querySelector('.fld[data-b="cd"][data-k="name"]'); f.focus(); const r = document.createRange(); r.selectNodeContents(f); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  await tape('calcul.py');
  attendu('code nom : modèle', (await bloc('cd')).name === 'calcul.py', (await bloc('cd')).name);
  attendu('code nom : coloration repeinte', (await evalue(`${HL}.innerHTML`)) !== avantNom && (await evalue(`${HL}.querySelectorAll('span').length`)) > 0, [avantNom, await evalue(`${HL}.innerHTML`)]);

  // ---------- Image : Entrée dans l'adresse charge l'image ----------
  await charge([{ id: 'im', type: 'image', src: '', caption: '', alt: '' }]);
  await evalue(auBout('.img-url-in[data-b="im"]')); await tape(PNG); await touche('Enter');
  await vu('img-url-in : Entrée intègre l\'image', `${BLOC('im')}.src.indexOf('data:image/png') === 0 && !!document.querySelector('.blk[data-id="im"] img')`);

  // ---------- Chronologie : style d'un lien, frise horizontale redessinée après la frappe ----------
  await charge([{ id: 'tv', type: 'timeline', orient: 'v', items: [{ date: '1', title: 'A', text: '' }, { date: '2', title: 'B', text: '' }] },
    { id: 'th', type: 'timeline', orient: 'h', items: [{ date: '1', title: 'Début', text: '' }, { date: '2', title: 'Fin', text: '' }] }]);
  await evalue(choisir('.tl-seg-sel[data-b="tv"]', 'dashed'));
  await vu('.tl-seg-sel : style posé', `${BLOC('tv')}.items[0].segs === 'dashed' && !!document.querySelector('.blk[data-id="tv"] .rl.full.s-dashed')`);
  await etape('.tl-seg-sel', 'Accueil · Chronologie « 1 A 2 B » : bloc modifié');
  await evalue(choisir('.tl-seg-sel[data-b="tv"]', 'solid'));
  await vu('.tl-seg-sel : plein, champ retiré', `!('segs' in ${BLOC('tv')}.items[0])`);
  await annuler('.tl-seg-sel', 'tv', `(b) => b.items[0].segs === 'dashed'`);
  const FRISE = `[...document.querySelectorAll('.blk[data-id="th"] .tl-h .tl-h-item')].map((x) => x.textContent).join('|')`;
  await evalue(auBout('.fld[data-b="th"][data-k="items.0.title"]')); await tape(' du projet');
  attendu('chronologie horizontale : modèle', (await bloc('th')).items[0].title === 'Début du projet', (await bloc('th')).items[0]);
  await vu('chronologie horizontale : frise redessinée', `/Début du projet/.test(${FRISE})`);

  // ---------- Requête : nombre d'un filtre et sous-pages, dans la fenêtre de la puce (le bloc n'a pas ces champs) ----------
  await charge([KANBAN, { id: 'q', type: 'query', title: '', src: 'kanban', scope: 'here', view: 'table', filtres: [{ id: 'f1', prop: 'kbDue', vals: ['next'], n: 7 }] }]);
  attendu('requête : ni nombre ni sous-pages dans le bloc', (await evalue(`document.querySelectorAll('#app .q-num, #app [data-qsub]').length`)) === 0, null);
  await evalue(`document.querySelector('.blk[data-id="q"] [data-qpuce="f:f1"]').click(), true`);
  await jusqua(evalue, `!!document.querySelector('#ui .q-fen .q-num')`);
  await evalue(`(() => { const n = document.querySelector('#ui .q-fen .q-num'); n.value = '3'; n.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await vu('q-num (fenêtre) : nombre du filtre', `${BLOC('q')}.filtres[0].n === 3`);
  await touche('Escape');
  await evalue(`document.querySelector('.blk[data-id="q"] [data-qpuce="scope"]').click(), true`);
  await jusqua(evalue, `!!document.querySelector('#ui .q-fen [data-qsub]')`);
  await evalue(`document.querySelector('#ui .q-fen [data-qsub]').click(), true`);
  await vu('data-qsub (fenêtre) : sous-pages', `${BLOC('q')}.sub === true`);
  await touche('Escape');

  // ---------- En-tête : le titre nomme la page en direct ; Entrée passe au champ suivant ----------
  const HD = { id: 'hd', type: 'header', eyebrow: 'Dossier', title: 'Rapport', lede: 'Résumé' };
  await charge([HD, { id: 'fin', type: 'h2', html: 'Fin' }], [{ id: 'p2', title: 'Annexe', blocks: [{ id: 'a', type: 'texte', lignes: [{ html: '' }] }] }]);
  await evalue(auBout('.fld[data-b="hd"][data-k="title"]')); await tape(' annuel');
  const NOM = `({ fen: document.title, barre: document.querySelector('#ui .doc-name').textContent, onglets: [...document.querySelectorAll('.pnav-tabs [data-pg="0"], .pnav-side [data-pg="0"]')].map((x) => x.textContent.trim()) })`;
  const nomPage = await evalue(NOM);
  attendu('header titre : modèle', (await bloc('hd')).title === 'Rapport annuel', (await bloc('hd')).title);
  attendu('header titre : onglet, barre, onglets et sommaire', /Rapport annuel/.test(nomPage.fen) && nomPage.barre === 'Rapport annuel' && nomPage.onglets.length >= 1 && nomPage.onglets.every((t) => t === 'Rapport annuel'), nomPage);
  await etape('header titre', 'Rapport annuel · En-tête « Dossier Rapport annuel Résumé » : texte modifié');
  for (const [k, suivant] of [['eyebrow', 'title'], ['title', 'lede']]) {
    await evalue(auBout(`.fld[data-b="hd"][data-k="${k}"]`)); await touche('Enter');
    attendu('header ' + k + ' : Entrée passe au champ suivant', (await evalue(`document.activeElement.dataset.k`)) === suivant && (await evalue('window.ardoise.doc.pages[0].blocks.length')) === 2, await evalue(ACTIF));
  }
  // le bloc qui suit n'est pas un texte : passer au champ suivant ne se confond pas avec l'insertion
  const apres = async (cas, id, sel) => {
    const n = await evalue('window.ardoise.doc.pages[0].blocks.length');
    await evalue(auBout(sel)); await touche('Enter');
    await vu(cas + ' : Entrée crée un bloc texte après', `(() => { const bs = window.ardoise.doc.pages[0].blocks, i = bs.findIndex((b) => b.id === ${JSON.stringify(id)}); return bs.length === ${n} + 1 && bs[i + 1].type === 'texte' && document.activeElement.matches('.fld[data-b="' + bs[i + 1].id + '"]'); })()`);
  };
  await apres('header chapeau', 'hd', '.fld[data-b="hd"][data-k="lede"]');
  await charge([{ ...HD, noLede: true }, { id: 'fin', type: 'h2', html: 'Fin' }]);
  await apres('header sans chapeau, titre', 'hd', '.fld[data-b="hd"][data-k="title"]');
  // titres : Entrée crée un bloc texte après eux
  await charge([{ id: 'h2', type: 'h2', html: 'Section' }, { id: 'h3', type: 'h3', html: 'Sous-section' }, { id: 'st', type: 'subtitle', html: 'Sous-titre' },
    { id: 'sp', type: 'step', num: '', title: 'Étape', nonum: false }, { id: 'fin', type: 'h2', html: 'Fin' }]);
  await apres('h2', 'h2', '.fld[data-b="h2"]');
  await apres('h3', 'h3', '.fld[data-b="h3"]');
  await apres('subtitle', 'st', '.fld[data-b="st"]');
  await apres('step titre', 'sp', '.fld[data-b="sp"][data-k="title"]');
  await apres('step numéro', 'sp', '.fld[data-b="sp"][data-k="num"]');

  // ---------- Texte : repère de champ vide, numérotation, raccourci en deux étapes ----------
  await charge([{ id: 't', type: 'texte', lignes: [{ html: '' }] }]);
  const VIDE = `document.querySelector('.fld[data-b="t"]').hasAttribute('data-vide')`;
  attendu('texte vide : repère', await evalue(VIDE), null);
  await evalue(auBout('.fld[data-b="t"]')); await tape('a');
  attendu('texte : repère retiré pendant la frappe', !(await evalue(VIDE)), null);
  await charge([{ id: 't', type: 'texte', lignes: [{ html: 'a', genre: 'numero' }, { html: 'x' }, { html: 'b', genre: 'numero' }] }]);
  const NUMS = `[...document.querySelectorAll('.fld[data-b="t"] > .lg')].map((l) => l.dataset.n || '')`;
  const nums0 = await evalue(NUMS);
  // la ligne du milieu disparaît sous la frappe (sélection de la fin de « a » à la fin de « x ») : « b » devient le 2
  await evalue(`(() => { const ls = document.querySelectorAll('.fld[data-b="t"] > .lg'); ls[0].parentNode.focus(); const r = document.createRange(); r.setStart(ls[0].firstChild, 1); r.setEnd(ls[1].firstChild, 1);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  await tape('y');
  attendu('texte : numérotation suivie pendant la frappe', JSON.stringify((await bloc('t')).lignes.map((l) => l.html)) === '["ay","b"]' && JSON.stringify(await evalue(NUMS)) === '["1","2"]', [nums0, await evalue(NUMS), (await bloc('t')).lignes]);
  // raccourci tapé d'un coup, délai de session passé : la frappe puis la transformation, deux Ctrl+Z
  await charge([{ id: 't', type: 'texte', lignes: [{ html: '' }] }]);
  await evalue(auBout('.fld[data-b="t"]')); await tape('- ');
  await vu('texte raccourci : puce', `JSON.stringify(${BLOC('t')}.lignes) === '[{"html":"","genre":"puce"}]'`);
  await annuler('texte raccourci : la transformation', 't', `(b) => b.lignes.length === 1 && !b.lignes[0].genre && b.lignes[0].html.replace(/&nbsp;/g, ' ') === '- '`);
  await annuler('texte raccourci : la frappe', 't', `(b) => b.lignes.length === 1 && b.lignes[0].html === ''`);
}
