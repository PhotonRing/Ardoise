// Sujet : bloc formule. Inséré par le menu d'insertion (juste après le bloc de code) et par « / » ; la frappe dans le champ
// de la source change l'aperçu, sauts de ligne gardés dans le document, Ctrl+Z défait la frappe ; un bloc vide montre une
// invite en édition et rien en lecture ; en lecture, la formule seule, centrée, sans le champ ; page statique et impression.
// Origine : spec formules, ticket 05.

const DOC = { title: 'Bloc formule', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'v', type: 'texte', lignes: [{ html: '' }] },
  { id: 'fx', type: 'formule', tex: 'x^2' },
  { id: 'fv', type: 'formule', tex: '' },
  { id: 'fin', type: 'texte', lignes: [{ html: 'Fin' }] },
] }] };
const BLOCS = `window.ardoise.doc.pages[0].blocks`;
const BASCULER = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
const ANNULER = `document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }))`;
const GUET = `(() => { window.__export = null; const o = URL.createObjectURL, c = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (b) => { window.__blob = b; return o.call(URL, b); };
  HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__blob.text().then((t) => { window.__export = t; }); return; } return c.call(this); }; return true; })()`;
// aperçu d'un bloc à l'écran : source de l'annotation, largeur de la formule, invite affichée
const APERCU = (id) => `(() => { const a = document.querySelector('.blk[data-id="${id}"] .formule-apercu'); if (!a) return null; const m = a.querySelector('math');
  const i = a.querySelector('.formule-invite');
  return { src: m ? m.querySelector('annotation').textContent : null, l: m ? Math.round(m.querySelector('semantics > :first-child').getBoundingClientRect().width) : 0, invite: i && i.getClientRects().length ? i.textContent : null }; })()`;

export const nom = 'bloc formule';
export default async function ({ ecran, charger, evalue, cdp, attendre, visibles, ordreEcran, mesure, echec }) {
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(150);

  // menu d'insertion : Formule juste après Bloc de code ; le choix insère un bloc formule, curseur dans le champ
  await evalue(`document.querySelector('.blk[data-id="fin"] > .collant [data-act="add-after"]').click(), true`); await attendre(80);
  const menu = await ordreEcran('.pop .mi[data-t]', 'return x.dataset.t');
  attendu('menu d\'insertion : Formule après Bloc de code', menu[menu.indexOf('code') + 1] === 'formule', menu);
  await evalue(`document.querySelector('.pop .mi[data-t="formule"]').click(), true`); await attendre(150);
  const insere = await evalue(`(() => { const b = ${BLOCS}.at(-1), a = document.activeElement; return { t: b.type, tex: b.tex, champ: !!a && a.matches('textarea.formule-ta') && a.dataset.b === b.id }; })()`);
  attendu('menu d\'insertion : bloc formule vide, curseur dans le champ', insere.t === 'formule' && insere.tex === '' && insere.champ, insere);

  // « / » dans un bloc texte vide, recherche « formule »
  await evalue(`document.querySelector('.fld[data-b="v"]').focus(), true`);
  await cdp('Input.insertText', { text: '/' }); await attendre(150);
  await evalue(`(() => { const q = document.querySelector('.pop .menu-q'); q.value = 'formule'; q.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`); await attendre(80);
  const trouves = await visibles('.pop .mi[data-t]', 'return x.dataset.t');
  attendu('« / » : la recherche propose Formule', trouves[0] === 'formule', trouves);
  await evalue(`document.querySelector('.pop .mi[data-t="formule"]').click(), true`); await attendre(150);
  const slash = await evalue(`(() => { const b = ${BLOCS}[0], a = document.activeElement; return { t: b.type, id: b.id, champ: !!a && a.matches('textarea.formule-ta') }; })()`);
  attendu('« / » : le bloc texte vide devient un bloc formule', slash.t === 'formule' && slash.champ, slash);

  // frappe dans le champ : l'aperçu suit, la source garde ses sauts de ligne, le curseur reste dans le champ
  const avant = await evalue(APERCU('fx'));
  await evalue(`(() => { const t = document.querySelector('textarea.formule-ta[data-b="fx"]'); t.focus(); t.setSelectionRange(3, 3); return true; })()`);
  await cdp('Input.insertText', { text: '+1' });
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await cdp('Input.insertText', { text: '= \\frac{1}{2}' }); await attendre(120);
  const tex = await evalue(`${BLOCS}.find((b) => b.id === 'fx').tex`);
  attendu('source sur deux lignes gardée telle quelle', tex === 'x^2+1\n= \\frac{1}{2}', tex);
  const apres = await evalue(APERCU('fx'));
  attendu('aperçu mis à jour pendant la frappe', avant.src === 'x^2' && apres.src === tex && apres.l > avant.l, [avant, apres]);
  const focus = await evalue(`document.activeElement.matches('textarea.formule-ta[data-b="fx"]')`);
  attendu('le curseur reste dans le champ', focus, focus);
  const haut = await evalue(`(() => { const t = document.querySelector('textarea.formule-ta[data-b="fx"]'); return t.scrollHeight <= t.clientHeight + 2; })()`);
  attendu('le champ grandit avec ses lignes', haut, haut);
  const pos = await evalue(`(() => { const t = document.querySelector('textarea.formule-ta[data-b="fx"]').getBoundingClientRect(), m = document.querySelector('.blk[data-id="fx"] .formule-apercu math').getBoundingClientRect(); return [t.bottom, m.top]; })()`);
  attendu('champ au-dessus de l\'aperçu', pos[0] <= pos[1], pos);
  await evalue(ANNULER); await attendre(150);
  const defait = await evalue(`${BLOCS}.find((b) => b.id === 'fx').tex`);
  attendu('Ctrl+Z défait la frappe', defait === 'x^2', defait);

  // bloc vide : invite en édition
  const vide = await evalue(APERCU('fv'));
  attendu('bloc vide : invite en édition', vide && vide.src === null && /Tapez une formule LaTeX/.test(vide.invite || ''), vide);

  // lecture : formule seule et centrée, pas de champ ; bloc vide : rien
  await evalue(BASCULER); await attendre(200);
  const champs = await visibles('textarea.formule-ta');
  attendu('lecture : pas de champ', champs.length === 0, champs);
  const lec = await evalue(`(() => { const b = document.querySelector('[data-bid="fx"]'); if (!b) return null; const r = b.getBoundingClientRect(), m = b.querySelector('math semantics > :first-child').getBoundingClientRect();   // math en bloc : toute la largeur ; son contenu est centré
    return { g: Math.round(m.left - r.left), d: Math.round(r.right - m.right), l: Math.round(m.width), t: parseFloat(getComputedStyle(b.querySelector('math')).fontSize), p: parseFloat(getComputedStyle(document.querySelector('[data-bid="fin"]')).fontSize) }; })()`);
  attendu('lecture : formule centrée et en grand', lec && lec.l > 0 && Math.abs(lec.g - lec.d) <= 2 && lec.t > lec.p * 1.4, lec);
  const rien = await evalue(`(() => { const b = document.querySelector('[data-bid="fv"]'); return b ? b.getClientRects().length : 0; })()`);
  attendu('lecture : bloc vide sans rien à l\'écran', rien === 0, rien);
  const invites = await visibles('.formule-invite');
  attendu('lecture : pas d\'invite', invites.length === 0, invites);

  // impression : la formule reste visible
  await cdp('Emulation.setEmulatedMedia', { media: 'print' }); await attendre(80);
  const imp = await evalue(`(() => { const m = document.querySelector('[data-bid="fx"] math'); return m ? Math.round(m.getBoundingClientRect().width) : 0; })()`);
  attendu('impression : formule visible', imp > 0, imp);
  await cdp('Emulation.setEmulatedMedia', { media: '' });
  await evalue(BASCULER); await attendre(200);

  // page statique : la formule du bloc, pas le bloc vide ni le champ
  await evalue(GUET);
  await evalue(`document.querySelector('[data-ui="file"]').click(), document.querySelector('[data-f="export"]').click(), true`);
  for (let i = 0; i < 50 && !(await evalue('!!window.__export')); i++) await attendre(100);
  const ex = await evalue(`(() => { const t = window.__export || ''; return { blocs: (t.match(/class="formule-bloc"><math display="block">/g) || []).length, champ: t.includes('formule-ta'), src: t.includes('<annotation encoding="application/x-tex">x^2</annotation>') }; })()`);
  attendu('page statique : le bloc formule écrit, sans champ', ex.blocs === 1 && !ex.champ && ex.src, ex);
}
