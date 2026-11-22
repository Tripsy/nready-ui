"""Hand-edit helpers. Run from the project root (or set I18N_ROOT):
    import sys; sys.path.insert(0, "<this folder>"); from m import *
"""
import json
import os
import re

ROOT = os.environ.get('I18N_ROOT', os.getcwd())
SCRIPTS = os.path.dirname(os.path.abspath(__file__))
# keys/ (and backup/) live here, per project - never next to the scripts
SCRATCH = os.environ.get('I18N_WORK', os.path.join(ROOT, '.i18n-work'))
os.makedirs(os.path.join(SCRATCH, 'keys'), exist_ok=True)
DASH = os.environ.get('I18N_DASH', f'{ROOT}/src/app/(dashboard)/dashboard')


def _path(f):
    return f if f.startswith('/') else f'{DASH}/{f}'


def rep(f, old, new, count=1):
    """Replace exactly `count` occurrences (0 = all, at least one)."""
    p = _path(f)
    s = open(p).read()
    n = s.count(old)
    if (count and n != count) or n == 0:
        raise SystemExit(f'{f}: expected {count or ">=1"} of {old!r}, found {n}')
    open(p, 'w').write(s.replace(old, new))


def addkeys(f, *keys):
    """Append keys to the file's TRANSLATION_KEYS list (skips ones already there)."""
    p = _path(f)
    s = open(p).read()
    m = re.search(r'const TRANSLATION_KEYS = \[\n([\s\S]*?)\] as const;', s)
    if not m:
        raise SystemExit(f'{f}: no TRANSLATION_KEYS')
    present = set(re.findall(r"'([^']+)'", m.group(1)))
    add = ''.join(f"\t'{k}',\n" for k in keys if k not in present)
    # keys first, spreads (enumTranslationKeys) last
    body = m.group(1)
    spread = body.find('\t...')
    body = body[:spread] + add + body[spread:] if spread >= 0 else body + add
    open(p, 'w').write(s[:m.start(1)] + body + s[m.end(1):])


def key(ns, k, en, lang='en'):
    """Record one key text in keys/<ns>.<lang>.json. Refuses to change an existing text."""
    p = f'{SCRATCH}/keys/{ns}.{lang}.json'
    d = json.load(open(p)) if os.path.exists(p) else {}
    full = k if k.startswith(f'{ns}.') else f'{ns}.{k}'
    if full in d and d[full] != en:
        raise SystemExit(f'{full}: already "{d[full]}", not "{en}"')
    d[full] = en
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent='\t')
    open(p, 'a').write('\n')


def dropkey(ns, k, lang='en'):
    p = f'{SCRATCH}/keys/{ns}.{lang}.json'
    d = json.load(open(p))
    d.pop(k if k.startswith(f'{ns}.') else f'{ns}.{k}', None)
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent='\t')
    open(p, 'a').write('\n')


def after_imports(f, block):
    """Insert `block` (a statement) after the file's last import, separated by blank lines."""
    p = _path(f)
    s = open(p).read()
    ends = [m.end() for m in re.finditer(r"^import[\s\S]*?from '[^']+';\n", s, re.M)]
    at = ends[-1]
    open(p, 'w').write(s[:at] + '\n' + block.strip('\n') + '\n' + s[at:])


def _dedupe_lists(s):
    """Drop repeated entries, but only inside TRANSLATION_KEYS / translateBatch key lists."""
    def fix(m):
        seen, out = set(), []
        for line in m.group(2).split('\n'):
            k = line.strip()
            if re.fullmatch(r"'[^']+',", k):
                if k in seen:
                    continue
                seen.add(k)
            out.append(line)
        return m.group(1) + '\n'.join(out) + m.group(3)
    s = re.sub(r"(const TRANSLATION_KEYS = \[\n)([\s\S]*?)(\] as const;)", fix, s)
    s = re.sub(r"(translateBatch\(\n\t+\[\n)([\s\S]*?)(\t+\] as const,)", fix, s)
    return s


def rekey(ns, old, new, *files, en=None):
    """Rename/merge <ns>.<old> to <ns>.<new> in the given files and the key files.
    In definitions the short form (labels['old']) and the batch list entry are renamed too.
    `en` sets the English text of the new key (needed when merging two texts)."""
    o, n = f'{ns}.{old}', f'{ns}.{new}'
    for f in files:
        p = _path(f)
        s = open(p).read()
        s2 = s.replace(f"'{o}'", f"'{n}'")
        if p.endswith('.definition.ts'):
            s2 = s2.replace(f"labels['{old}']", f"labels['{new}']").replace(f"\t'{old}',\n", f"\t'{new}',\n")
        s2 = _dedupe_lists(s2)
        if s2 != s:
            open(p, 'w').write(s2)
    for lang in ('en', 'ro'):
        kp = f'{SCRATCH}/keys/{ns}.{lang}.json'
        if not os.path.exists(kp):
            continue
        d = json.load(open(kp))
        if o in d:
            v = d.pop(o)
            if lang == 'en' and en is not None:
                v = en
            if n in d and d[n] != v and not (lang == 'en' and en is not None):
                print(f'NOTE {lang} {n} keeps "{d[n]}" (dropped "{v}")')
            else:
                d[n] = v
        elif lang == 'en' and en is not None and n in d:
            d[n] = en
        json.dump(d, open(kp, 'w'), ensure_ascii=False, indent='\t')
        open(kp, 'a').write('\n')


def unkey(ns, k, literal, *files):
    """Put a non-copy key back as a literal string and drop it from the key file."""
    full = f'{ns}.{k}'
    for f in files:
        p = _path(f)
        s = open(p).read()
        s = s.replace(f"={{translations['{full}']}}", f'="{literal}"')
        s = s.replace(f"{{translations['{full}']}}", literal).replace(f"translations['{full}']", repr(literal))
        s = re.sub(rf"\n\t'{re.escape(full)}',", '', s)
        open(p, 'w').write(s)
    dropkey(ns, full)


def create_label(ns, f, noun_key, english):
    """createLabel: (value) => `Create x "${value}"`  ->  replaceVars(translations[k], { value })"""
    p = _path(f)
    s = open(p).read()
    m = re.search(r"createLabel: \((\w+)\) =>\s*`Create [^`]*\"\$\{\1\}\"`", s)
    if not m:
        raise SystemExit(f'{f}: no createLabel template')
    v = m.group(1)
    k = f'{ns}.text.{noun_key}'
    new = f"createLabel: ({v}) =>\n\t\t\t\t\t\treplaceVars(translations['{k}'], {{ value: {v} }})"
    open(p, 'w').write(s[:m.start()] + new + s[m.end():])
    addkeys(f, k)
    key(ns, k, english)
    import subprocess
    subprocess.run(['node', f'{SCRIPTS}/addimport.cjs', p, 'replaceVars', '@/helpers/string.helper'], check=True)


def _node_import(p, name, frm):
    import subprocess
    subprocess.run(['node', f'{SCRIPTS}/addimport.cjs', p, name, frm], check=True)


def cap_column(ns, f, field, prefix_rel, enum, enum_from):
    """Definition column `capitalize: true` on `field` -> customValue via translateEnumLabel(labels)."""
    p = _path(f)
    s = open(p).read()
    m = re.search(rf"field: '{field}',[\s\S]*?capitalize: true,", s)
    if not m or s[m.start():m.end()].count("field: '") > 1:
        raise SystemExit(f'{f}: capitalize column {field} not found')
    seg = s[m.start():m.end()].replace('capitalize: true,', f"customValue: translateEnumLabel(\n\t\t\t\t\t\t\t\tlabels,\n\t\t\t\t\t\t\t\t'{prefix_rel}',\n\t\t\t\t\t\t\t\tentry.{field},\n\t\t\t\t\t\t\t),")
    s = s[:m.start()] + seg + s[m.end():]
    mm = re.search(rf"^\t+\] as const,\n\t+'{re.escape(ns)}',\n", s, re.M)
    if not mm:
        raise SystemExit(f'{f}: labels batch not found')
    i = mm.start()
    spread = f"\t\t\t\t...enumTranslationKeys('{prefix_rel}', {enum}),\n"
    if spread not in s:
        s = s[:i] + spread + s[i:]
    open(p, 'w').write(s)
    _node_import(p, 'enumTranslationKeys', '@/helpers/string.helper')
    _node_import(p, 'translateEnumLabel', '@/helpers/string.helper')
    _node_import(p, enum, enum_from)


def enum_value(f, old, expr, prefix, enum, enum_from, count=1):
    """Replace `old` (e.g. "value={entry.status}") with the same attribute/child showing
    translateEnumLabel(translations, prefix, expr); adds the enum keys and imports."""
    p = _path(f)
    s = open(p).read()
    call = f"translateEnumLabel(translations, '{prefix}', {expr})"
    if old.startswith('{') and old.endswith('}'):
        new = '{' + call + '}'
    elif '={' in old:
        new = old.split('={', 1)[0] + '={' + call + '}'
    else:
        new = call
    n = s.count(old)
    if (count and n != count) or n == 0:
        raise SystemExit(f'{f}: expected {count} of {old!r}, found {n}')
    s = s.replace(old, new)
    spread = f"\t...enumTranslationKeys('{prefix}', {enum}),\n"
    m = re.search(r'const TRANSLATION_KEYS = \[\n([\s\S]*?)\] as const;', s)
    if not m:
        raise SystemExit(f'{f}: no TRANSLATION_KEYS')
    if spread not in m.group(1):
        s = s[:m.end(1)] + spread + s[m.end(1):]
    open(p, 'w').write(s)
    _node_import(p, 'enumTranslationKeys', '@/helpers/string.helper')
    _node_import(p, 'translateEnumLabel', '@/helpers/string.helper')
    _node_import(p, enum, enum_from)


def module_list_to_memo(f, old_block, name, body, after_hook=True):
    """Delete a module-level list and re-create it as a useMemo right after the hook."""
    rep(f, old_block, '')
    p = _path(f)
    s = open(p).read()
    hook = '\tconst { translations } = useTranslation(TRANSLATION_KEYS);\n'
    if s.count(hook) != 1:
        raise SystemExit(f'{f}: expected exactly one hook')
    s = s.replace(hook, hook + f'\n\tconst {name} = useMemo(\n\t\t() =>\n{body},\n\t\t[translations],\n\t);\n')
    open(p, 'w').write(s)
    _node_import(p, 'useMemo', 'react')


node_import = _node_import


def yes_no(f):
    """`cond ? 'Yes' : 'No'` -> the shared dashboard.text.yes / no keys."""
    p = _path(f)
    s = open(p).read()
    n = len(re.findall(r"\? 'Yes' : 'No'", s))
    if not n:
        raise SystemExit(f'{f}: no Yes/No')
    s = s.replace("? 'Yes' : 'No'", "? translations['dashboard.text.yes'] : translations['dashboard.text.no']")
    open(p, 'w').write(s)
    addkeys(f, 'dashboard.text.yes', 'dashboard.text.no')
    return n


def merge_local(f):
    """Fold a component's local `const translationsKeys = [...]` into the module TRANSLATION_KEYS."""
    p = _path(f)
    s = open(p).read()
    m = re.search(r"\n\tconst translationsKeys = \[\n([\s\S]*?)\t\] as const;\n", s)
    if not m:
        raise SystemExit(f'{f}: no local translationsKeys')
    keys = re.findall(r"'([^']+)'", m.group(1))
    if re.search(r"^\t\t[^'\t]", m.group(1), re.M):
        raise SystemExit(f'{f}: local list has non-literal entries - merge by hand')
    s = s[:m.start()] + '\n' + s[m.end():]
    s = s.replace('useTranslation(translationsKeys)', 'useTranslation(TRANSLATION_KEYS)')
    if 'const TRANSLATION_KEYS = [' not in s:
        open(p, 'w').write(s)
        after_imports(f, 'const TRANSLATION_KEYS = [\n' + ''.join(f"\t'{k}',\n" for k in keys) + '] as const;')
    else:
        open(p, 'w').write(s)
        addkeys(f, *keys)


def to_shared(ns, k, shared_key, files, en=None, ro=None):
    """Move <ns>.<k> to a shared key (e.g. dashboard.text.x) in the given files; drop it from ns."""
    full = f'{ns}.{k}'
    for f in files:
        p = _path(f)
        s = open(p).read()
        s2 = _dedupe_lists(s.replace(f"'{full}'", f"'{shared_key}'"))
        if s2 != s:
            open(p, 'w').write(s2)
    d = json.load(open(f'{SCRATCH}/keys/{ns}.en.json'))
    en = en or d.get(full)
    dropkey(ns, full)
    rp = f'{SCRATCH}/keys/{ns}.ro.json'
    if os.path.exists(rp):
        dr = json.load(open(rp))
        ro = ro or dr.get(full)
        dropkey(ns, full, 'ro')
    sns, sk = shared_key.split('.', 1)
    if en:
        key(sns, sk, en)
    if ro:
        key(sns, sk, ro, 'ro')

dedupe_lists = _dedupe_lists


def set_status_label(ns, f, enum, enum_from):
    """A status-transition button's aria-label -> shared dashboard.text.label_set_status_to,
    with the translated status in the slot."""
    p = _path(f)
    s = open(p).read()
    s = s.replace(f"'{ns}.text.label_set_status_to'", "'dashboard.text.label_set_status_to'")
    old = "aria-label={replaceVars(translations['dashboard.text.label_set_status_to'], { status })}"
    if old not in s:
        raise SystemExit(f'{f}: aria-label pattern not found')
    s = s.replace(old, "aria-label={replaceVars(\n\t\t\t\t\t\t\t\ttranslations['dashboard.text.label_set_status_to'],\n\t\t\t\t\t\t\t\t{\n\t\t\t\t\t\t\t\t\tstatus: translateEnumLabel(\n\t\t\t\t\t\t\t\t\t\ttranslations,\n\t\t\t\t\t\t\t\t\t\t'" + ns + ".status',\n\t\t\t\t\t\t\t\t\t\tstatus,\n\t\t\t\t\t\t\t\t\t),\n\t\t\t\t\t\t\t\t},\n\t\t\t\t\t\t\t)}")
    s = _dedupe_lists(s)
    i = s.index('] as const;', s.index('const TRANSLATION_KEYS'))
    s = s[:i] + f"\t...enumTranslationKeys('{ns}.status', {enum}),\n" + s[i:]
    open(p, 'w').write(s)
    for n in ('enumTranslationKeys', 'translateEnumLabel'):
        _node_import(p, n, '@/helpers/string.helper')
    _node_import(p, enum, enum_from)
    dropkey(ns, 'text.label_set_status_to')
    if os.path.exists(f'{SCRATCH}/keys/{ns}.ro.json'):
        dropkey(ns, 'text.label_set_status_to', 'ro')
