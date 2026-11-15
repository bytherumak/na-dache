# Собирает всю игру в ОДИН файл dist/index.html (и копию ../На даче.html).
# Такой файл открывается двойным щелчком, без сервера, и его можно просто выложить на любой хостинг.
# Запуск: python build.py   (или Собрать игру.bat)
import re, base64, shutil, pathlib

root = pathlib.Path(__file__).parent
lib = root / 'lib'

def names_of(block):
    out = []
    for part in block.split(','):
        part = part.strip()
        if not part: continue
        m = re.match(r'^(\S+)\s+as\s+(\S+)$', part)
        out.append((m.group(1), m.group(2)) if m else (part, part))
    return out

def to_scope(src, imports):
    """Превращает ES-модуль в кусок кода внутри функции. imports: {'three': '__three', './X.js': '__x'}"""
    exports = []
    def imp(m):
        names, mod = m.group(1), m.group(2)
        var = imports[mod]
        if names.strip().startswith('*'):
            return f'const {names.split("as")[1].strip()} = {var};'
        return f'const {names.strip()} = {var};'
    src = re.sub(r"import\s*(\*\s+as\s+\w+|\{[^}]*\})\s*from\s*['\"]([^'\"]+)['\"];?", imp, src)
    def exp_block(m):
        exports.extend(names_of(m.group(1)))
        return ''
    src = re.sub(r'^export\s*\{([^}]*)\};?', exp_block, src, flags=re.M)
    def exp_decl(m):
        exports.append((m.group(2), m.group(2)))
        return m.group(1) + ' ' + m.group(2)
    src = re.sub(r'^export\s+((?:async\s+)?function\*?|const|let|class)\s+(\w+)', exp_decl, src, flags=re.M)
    return src, exports

def module_fn(var, src, imports):
    body, exports = to_scope(src, imports)
    ret = ', '.join(a if a == b else f'{b}: {a}' for a, b in exports)
    return f'const {var} = (() => {{\n{body}\nreturn {{ {ret} }};\n}})();\n'

parts = []
parts.append(module_fn('__three', (lib / 'three.module.js').read_text(encoding='utf-8-sig'), {}))
parts.append(module_fn('__bgu', (lib / 'BufferGeometryUtils.js').read_text(encoding='utf-8-sig'), {'three': '__three'}))
parts.append(module_fn('__gltf', (lib / 'GLTFLoader.js').read_text(encoding='utf-8-sig'), {'three': '__three', './BufferGeometryUtils.js': '__bgu'}))
main = (root / 'main.js').read_text(encoding='utf-8-sig')
main = re.sub(r"import \* as THREE from 'three';", 'const THREE = __three;', main)
main = re.sub(r"import \{ GLTFLoader \} from '\./lib/GLTFLoader\.js';", 'const { GLTFLoader } = __gltf;', main)
parts.append(main)
js = '\n'.join(parts).replace('</script', '<\\/script')

embed = {}
for glb in (root / 'assets').glob('*.glb'):
    embed[glb.stem] = 'data:model/gltf-binary;base64,' + base64.b64encode(glb.read_bytes()).decode()
embed_js = 'window.EMBED = {' + ','.join(f'"{k}":"{v}"' for k, v in embed.items()) + '};'

html = (root / 'index.html').read_text(encoding='utf-8-sig')
html = html.replace('<!--EMBED-->', f'<script>{embed_js}</script>')
html = re.sub(r'<script type="importmap">.*?</script>\s*', '', html, flags=re.S)
html = re.sub(r'<script type="module" src="\./main\.js"></script>', lambda m: '<script type="module">\n' + js + '\n</script>', html)

out = root / 'dist'
out.mkdir(exist_ok=True)
(out / 'index.html').write_text(html, encoding='utf-8-sig')
shutil.copyfile(out / 'index.html', root.parent / 'На даче.html')
print(f'Готово: {out / "index.html"}  ({len(html) / 1e6:.1f} МБ)')

