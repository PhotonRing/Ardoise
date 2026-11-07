// Vérification de fermeture, lancée par build.mjs : une fonction recopiée par toString() dans la page exportée ne doit citer
// aucun nom déclaré au premier niveau du bundle (fonctions et var du corps de l'IIFE commune). Simple recherche de mots,
// sans dépendance : faux positif possible sur un nom local identique ; les noms après un point et les clés d'objet
// (« { x: » ou « , x: ») ne comptent pas. src/js est en ES5 : ni gabarits, ni let, ni const, ni flèches.

const KEYWORDS_BEFORE_REGEX = /^(return|typeof|case|in|of|else|do|void|delete|new|instanceof)$/;

// Jetons sans chaînes, commentaires ni regex : { t, id } (id vrai pour un identifiant)
function tokens(s) {
  const out = []; let i = 0, prev = '';
  const ident = /[A-Za-z_$][\w$]*/y, num = /[0-9][\w.]*/y;
  while (i < s.length) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') { const j = s.indexOf('\n', i); i = j < 0 ? s.length : j; continue; }
    if (c === '/' && s[i + 1] === '*') { const j = s.indexOf('*/', i + 2); if (j < 0) throw new Error('commentaire non fermé'); i = j + 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1; while (j < s.length && s[j] !== c) { if (s[j] === '\\') j++; j++; }
      i = j + 1; prev = 'str'; out.push({ t: 'str' }); continue;
    }
    // une barre ouvre une regex sauf après une valeur (identifiant, nombre, chaîne, parenthèse ou crochet fermants)
    if (c === '/' && (!/[\w$)\]]$/.test(prev) || KEYWORDS_BEFORE_REGEX.test(prev)) && prev !== 'str') {
      let j = i + 1, cls = false;
      while (j < s.length && (cls || s[j] !== '/')) { if (s[j] === '\\') j++; else if (s[j] === '[') cls = true; else if (s[j] === ']') cls = false; j++; }
      j++; while (/[a-z]/.test(s[j])) j++;
      i = j; prev = 're'; out.push({ t: 're' }); continue;
    }
    ident.lastIndex = i; let m = ident.exec(s);
    if (m) { out.push({ t: m[0], id: true }); prev = m[0]; i += m[0].length; continue; }
    num.lastIndex = i; m = num.exec(s);
    if (m) { out.push({ t: m[0] }); prev = m[0]; i += m[0].length; continue; }
    if (/\s/.test(c)) { i++; continue; }
    out.push({ t: c }); prev = c; i++;
  }
  return out;
}

const OPEN = '{([', CLOSE = '})]';

// noms déclarés par une instruction var qui commence au jeton k (déclarateurs à la profondeur de l'instruction)
function varNames(T, k, add) {
  let e = 0;
  for (let j = k + 1; j < T.length; j++) {
    const u = T[j].t;
    if (e === 0 && (j === k + 1 || T[j - 1].t === ',') && T[j].id) add(u);
    if (OPEN.includes(u)) e++; else if (CLOSE.includes(u)) e--;
    if ((e === 0 && u === ';') || e < 0) break;
  }
}

// Identifiants de premier niveau cités par la fonction `name`, hors ses propres déclarations, dans l'ordre d'apparition
export function closureLeaks(js, name) {
  const T = tokens(js);
  // premier niveau : le corps de l'IIFE commune « (function () { », soit la profondeur 2
  const top = new Set(); let d = 0;
  for (let k = 0; k < T.length; k++) {
    const t = T[k].t;
    if (OPEN.includes(t)) d++; else if (CLOSE.includes(t)) d--;
    else if (d === 2 && t === 'function' && T[k + 1].id) top.add(T[k + 1].t);
    else if (d === 2 && t === 'var') varNames(T, k, (n) => top.add(n));
  }
  if (d !== 0) throw new Error('vérification de fermeture : accolades déséquilibrées (' + d + '), lecture du bundle à revoir');
  // texte de la fonction : de « function name » à son accolade fermante
  const k0 = T.findIndex((t, i) => t.t === 'function' && T[i + 1] && T[i + 1].t === name);
  if (k0 < 0) throw new Error('vérification de fermeture : fonction ' + name + ' introuvable');
  let e = 0, k1 = k0;
  for (; k1 < T.length; k1++) { if (T[k1].t === '{') e++; else if (T[k1].t === '}' && --e === 0) break; }
  const F = T.slice(k0, k1 + 1);
  // ses propres déclarations : fonctions, paramètres, var, catch
  const own = new Set([name]);
  for (let a = 0; a < F.length - 1; a++) {
    if (F[a].t === 'function') {
      let b = a + 1; if (F[b].id) { own.add(F[b].t); b++; }
      for (b++; b < F.length && F[b].t !== ')'; b++) if (F[b].id) own.add(F[b].t);
    } else if (F[a].t === 'var') varNames(F, a, (n) => own.add(n));
    else if (F[a].t === 'catch' && F[a + 2]) own.add(F[a + 2].t);
  }
  const leaks = [];
  for (let a = 1; a < F.length; a++) {
    const x = F[a];
    if (!x.id || !top.has(x.t) || own.has(x.t) || leaks.includes(x.t)) continue;
    if (F[a - 1].t === '.') continue;   // propriété
    if ((F[a - 1].t === '{' || F[a - 1].t === ',') && F[a + 1] && F[a + 1].t === ':') continue;   // clé d'objet
    leaks.push(x.t);
  }
  return leaks;
}
