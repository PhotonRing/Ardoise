/* ---------- Coloration syntaxique (légère, sans dépendance) ---------- */
var HL = (function () {
  function set(s) { var o = {}; s.split(' ').forEach(function (w) { o[w] = 1; }); return o; }
  var K = {
    bash: set('if then else elif fi for while until do done case esac in function return local export readonly declare typeset set unset shift exit break continue select time trap source alias'),
    bashB: set('echo printf cd pwd test read eval exec sudo grep egrep awk sed find xargs cat ls cp mv rm mkdir rmdir chmod chown curl wget tar gzip ssh scp rsync systemctl service journalctl docker podman kubectl git apt apt-get dnf yum pip pip3 python python3 bash sh kill pkill ps head tail sort uniq wc cut tr tee touch ln date sleep whoami id hostname uname dpkg rpm openssl nmap ip ss netstat ping dig nslookup iptables nft crontab true false'),
    py: set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'),
    pyB: set('print len range open str int float dict list set tuple bool bytes type isinstance enumerate zip map filter sorted reversed sum min max abs any all super object input repr format hasattr getattr setattr iter next Exception ValueError KeyError TypeError IndexError RuntimeError OSError self cls'),
    js: set('break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield async await of from as static get set null undefined true false NaN Infinity interface type enum implements'),
    jsB: set('console document window Math JSON Object Array String Number Boolean Promise Map Set Date RegExp Error fetch require module exports process setTimeout setInterval'),
    sql: set('select from where and or not insert into values update set delete create table drop alter add column index primary key foreign references join left right inner outer full cross on as group by order having limit offset distinct union all case when then else end null is in like ilike between exists view with returning asc desc default unique constraint check if truncate grant revoke begin commit rollback'),
    sqlB: set('count sum avg min max coalesce cast concat substring lower upper now date trim length round'),
    ps: set('begin break catch class continue data define do dynamicparam else elseif end exit filter finally for foreach from function if in param process return switch throw trap try until using var while'),
    c: set('auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while class public private protected new delete this throw throws try catch finally namespace using template typename bool boolean true false null nullptr package import func go defer chan map range type interface var let fn mut impl pub use mod match loop where trait self Self string byte final abstract extends implements override virtual'),
    yaml: set('true false null yes no on off True False Null Yes No')
  };
  var NUM = /(?:0x[\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?![\w.])/y;
  var DQ = /"(?:\\[\s\S]|[^"\\\n])*"?/y, SQ = /'(?:\\[\s\S]|[^'\\\n])*'?/y;
  function atWordStart(code, pos) { return pos === 0 || !/[\w$.-]/.test(code[pos - 1]); }
  function lineStartOrSpace(code, pos) { return pos === 0 || /\s/.test(code[pos - 1]); }
  function prevWord(out) {
    for (var i = out.length - 1; i >= 0; i--) { var t = out[i][1]; if (/\S/.test(t)) return t.trim(); }
    return '';
  }
  function ident(kw, bi, opt) {
    opt = opt || {};
    return function (w, code, end, out) {
      var lw = opt.ci ? w.toLowerCase() : w;
      if (kw[lw]) return 'k';
      if (opt.defs && opt.defs[prevWord(out)]) return 'f';
      if (bi && bi[lw]) return 'f';
      if (opt.call && /^\s*\(/.test(code.slice(end, end + 40))) return 'f';
      if (opt.cap && /^[A-Z][a-z]/.test(w)) return 't';
      return null;
    };
  }
  var R = {
    bash: [
      { c: 'c', re: /#[^\n]*/y, when: lineStartOrSpace },
      { c: 's', re: DQ }, { c: 's', re: SQ },
      { c: 'v', re: /\$\{[^}\n]*\}?|\$\([^)\n]*\)?|\$[A-Za-z_]\w*|\$[0-9#?@*!$-]/y },
      { c: 't', re: /--?[A-Za-z][\w-]*/y, when: lineStartOrSpace },
      { c: 'n', re: NUM, when: atWordStart },
      { c: ident(K.bash, K.bashB), re: /[A-Za-z_][\w-]*/y, when: atWordStart },
      { c: 'p', re: /&&|\|\||[|;&<>]/y }
    ],
    py: [
      { c: 'c', re: /#[^\n]*/y },
      { c: 's', re: /[rRbBuUfF]{0,2}(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\[\s\S]|[^"\\\n])*"?|'(?:\\[\s\S]|[^'\\\n])*'?)/y, when: atWordStart },
      { c: 'f', re: /@[\w.]+/y },
      { c: 'n', re: NUM, when: atWordStart },
      { c: ident(K.py, K.pyB, { call: 1, defs: set('def class'), cap: 1 }), re: /[A-Za-z_]\w*/y, when: atWordStart }
    ],
    js: [
      { c: 'c', re: /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y },
      { c: 's', re: /`(?:\\[\s\S]|[^`\\])*`?/y }, { c: 's', re: DQ }, { c: 's', re: SQ },
      { c: 'n', re: NUM, when: atWordStart },
      { c: ident(K.js, K.jsB, { call: 1, defs: set('function class new'), cap: 1 }), re: /[A-Za-z_$][\w$]*/y, when: atWordStart },
      { c: 'p', re: /=>|[{}()[\];,]/y }
    ],
    json: [
      { c: function (w, code, end) { return /^\s*:/.test(code.slice(end, end + 20)) ? 't' : 's'; }, re: DQ },
      { c: 'n', re: /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y },
      { c: 'k', re: /\b(?:true|false|null)\b/y }
    ],
    yaml: [
      { c: 'c', re: /#[^\n]*/y, when: lineStartOrSpace },
      { c: 't', re: /[ \t]*(?:-[ \t]+)?[^\s:#'"\-][^:\n#]*?(?=:(?:[ \t]|$))/my, when: function (code, pos) { return pos === 0 || code[pos - 1] === '\n'; } },
      { c: 's', re: DQ }, { c: 's', re: SQ },
      { c: 'v', re: /[&*][\w-]+/y, when: lineStartOrSpace },
      { c: 'n', re: NUM, when: atWordStart },
      { c: ident(K.yaml), re: /[A-Za-z_]\w*/y, when: atWordStart },
      { c: 'p', re: /^[ \t]*-(?=\s)|[|>](?=\s*$)/my }
    ],
    sql: [
      { c: 'c', re: /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y },
      { c: 's', re: /'(?:''|[^'])*'?/y }, { c: 't', re: /"[^"\n]*"?|`[^`\n]*`?/y },
      { c: 'n', re: NUM, when: atWordStart },
      { c: ident(K.sql, K.sqlB, { ci: 1, call: 1 }), re: /[A-Za-z_]\w*/y, when: atWordStart }
    ],
    ps: [
      { c: 'c', re: /<#[\s\S]*?(?:#>|$)|#[^\n]*/y },
      { c: 's', re: /@"[\s\S]*?(?:"@|$)|@'[\s\S]*?(?:'@|$)/y }, { c: 's', re: DQ }, { c: 's', re: SQ },
      { c: 'v', re: /\$\{[^}\n]*\}?|\$[\w:]+/y },
      { c: 'f', re: /[A-Za-z]+-[A-Za-z]+\w*/y, when: atWordStart },
      { c: 't', re: /-[A-Za-z]\w*/y, when: lineStartOrSpace },
      { c: 'n', re: NUM, when: atWordStart },
      { c: ident(K.ps, null, { ci: 1 }), re: /[A-Za-z_]\w*/y, when: atWordStart },
      { c: 'p', re: /\|/y }
    ],
    html: [
      { c: 'c', re: /<!--[\s\S]*?(?:-->|$)/y },
      { c: 'k', re: /<\/?[A-Za-z][\w:.-]*|\/?>|<!DOCTYPE[^>]*>?|<\?[\s\S]*?(?:\?>|$)/iy },
      { c: 't', re: /[A-Za-z_:@][\w:.-]*(?=\s*=)/y },
      { c: 's', re: DQ }, { c: 's', re: SQ }
    ],
    c: [
      { c: 'c', re: /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y },
      { c: 'k', re: /#[ \t]*[a-z]+/y, when: function (code, pos) { return pos === 0 || code[pos - 1] === '\n'; } },
      { c: 's', re: /`[^`]*`?/y }, { c: 's', re: DQ }, { c: 's', re: SQ },
      { c: 'n', re: NUM, when: atWordStart },
      { c: ident(K.c, null, { call: 1, cap: 1 }), re: /[A-Za-z_]\w*/y, when: atWordStart }
    ]
  };
  var NAMES = { auto: 'Auto', bash: 'Bash / shell', py: 'Python', ps: 'PowerShell', js: 'JavaScript / TS', json: 'JSON', yaml: 'YAML', sql: 'SQL', html: 'HTML / XML', c: 'C / Java / Go / Rust', text: 'Texte brut' };
  var EXT = { sh: 'bash', bash: 'bash', zsh: 'bash', conf: 'bash', py: 'py', pyw: 'py', ps1: 'ps', psm1: 'ps', psd1: 'ps', js: 'js', mjs: 'js', cjs: 'js', ts: 'js', tsx: 'js', jsx: 'js', json: 'json', geojson: 'json', yml: 'yaml', yaml: 'yaml', sql: 'sql',
    html: 'html', htm: 'html', xml: 'html', svg: 'html', c: 'c', h: 'c', cpp: 'c', hpp: 'c', cc: 'c', java: 'c', go: 'c', rs: 'c', cs: 'c', kt: 'c', swift: 'c', php: 'c', txt: 'text', md: 'text', log: 'text' };
  function detect(code, name) {
    var m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    if (m && EXT[m[1]]) return EXT[m[1]];
    var head = code.slice(0, 200), t = code.trim();
    if (/^#!.*\bpython/.test(head)) return 'py';
    if (/^#!.*\b(bash|sh|zsh|ksh)\b/.test(head)) return 'bash';
    if (/^#!.*\b(node|deno)\b/.test(head)) return 'js';
    if (/^#!.*\bpwsh\b/.test(head)) return 'ps';
    if (/^[\[{]/.test(t)) { try { JSON.parse(t); return 'json'; } catch (_) {} }
    if (/^<(!doctype|!--|html|\?xml|[a-z][\w-]*[\s>/])/i.test(t)) return 'html';
    if (/^\s*(def |class \w+.*:|import \w|from [\w.]+ import )/m.test(code)) return 'py';
    if (/\b(select\s+[\s\S]+?\s+from|insert\s+into|create\s+table|update\s+\w+\s+set|delete\s+from)\b/i.test(code)) return 'sql';
    if (/\b(Get|Set|New|Remove|Write|Invoke|Start|Stop|Test)-[A-Z]\w+/.test(code) || /^\s*\$\w+\s*=/m.test(code) && /\b[A-Z][a-z]+-[A-Z]/.test(code)) return 'ps';
    if (/(^|\n)\s*(function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|import\s+.+\s+from\s+['"])|=>/.test(code)) return 'js';
    if (/(^|\n)\s*#include\s*<|\bpublic\s+static\s+void\b|\bfunc\s+\w+\s*\(|\bfn\s+\w+\s*\(/.test(code)) return 'c';
    if (/^[\w.-]+:(\s|$)/m.test(code) && !/[;{}()]/.test(code)) return 'yaml';
    return 'bash';
  }
  function tokens(code, lang) {
    var rules = R[lang];
    if (!rules) return [[null, code]];
    var out = [], pos = 0, n = code.length, plain = '';
    while (pos < n) {
      var hit = null;
      for (var r = 0; r < rules.length; r++) {
        var ru = rules[r];
        if (ru.when && !ru.when(code, pos)) continue;
        ru.re.lastIndex = pos;
        var m = ru.re.exec(code);
        if (m && m[0].length) { hit = [ru.c, m[0]]; break; }
      }
      if (!hit) { plain += code[pos++]; continue; }
      if (plain) { out.push([null, plain]); plain = ''; }
      var cls = typeof hit[0] === 'function' ? hit[0](hit[1], code, pos + hit[1].length, out) : hit[0];
      out.push([cls, hit[1]]); pos += hit[1].length;
    }
    if (plain) out.push([null, plain]);
    return out;
  }
  function escT(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  // renvoie un tableau de lignes HTML (les jetons sur plusieurs lignes sont refermés et rouverts à chaque ligne)
  function lines(code, lang) {
    var res = [''], toks = tokens(String(code || ''), lang);
    toks.forEach(function (t) {
      var parts = t[1].split('\n');
      parts.forEach(function (p, j) {
        if (j) res.push('');
        if (p) res[res.length - 1] += t[0] ? '<span class="tk-' + t[0] + '">' + escT(p) + '</span>' : escT(p);
      });
    });
    return res;
  }
  function resolve(lang, code, name) { return (!lang || lang === 'auto') ? detect(String(code || ''), name) : lang; }
  return { lines: lines, html: function (code, lang) { return lines(code, lang).join('\n'); }, detect: detect, resolve: resolve, names: NAMES };
})();

