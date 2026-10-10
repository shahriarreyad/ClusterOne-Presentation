"""Bundle the deck into one self-contained HTML file (no server, no extra files).

Run from the project root:  python tools/build_single.py
Writes ClusterOne-Presentation.html next to README.md.
"""
import base64, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRES = os.path.join(ROOT, "presentation")
read = lambda p: open(p, encoding="utf-8").read()

html = read(os.path.join(PRES, "index.html"))
css = read(os.path.join(PRES, "assets", "style.css"))
data_js = read(os.path.join(PRES, "assets", "diagrams-data.js"))
deck_js = read(os.path.join(PRES, "assets", "deck.js"))

# the "Open SVG" button points at a separate file; drop it in the single-file build
deck_js = deck_js.replace("if (host.dataset.svg) {", "if (false) {")

html = html.replace('<link rel="stylesheet" href="assets/style.css">', "<style>\n" + css + "\n</style>")
html = html.replace('<script src="assets/diagrams-data.js"></script>', "<script>\n" + data_js + "\n</script>")
html = html.replace('<script src="assets/deck.js"></script>', "<script>\n" + deck_js + "\n</script>")

def inline_png(m):
    path = os.path.normpath(os.path.join(PRES, m.group(1)))
    b64 = base64.b64encode(open(path, "rb").read()).decode()
    return 'src="data:image/png;base64,' + b64 + '"'

html = re.sub(r'src="(\.\./assets/screenshots/[^"]+\.png)"', inline_png, html)
html = re.sub(r'\sdata-svg="[^"]*"', "", html)

left = re.findall(r'(?:src|href)="(?!data:|#|https?:)[^"]+"', html)
out = os.path.join(ROOT, "ClusterOne-Presentation.html")
open(out, "w", encoding="utf-8").write(html)
print("wrote", out, round(len(html) / 1024), "KB; unresolved refs:", left)
