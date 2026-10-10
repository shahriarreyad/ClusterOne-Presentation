"""Phase 5: automated browser test of presentation/index.html (Playwright + Chromium).

Run from the project root:  python3 tools/test_presentation.py
Writes captures to presentation/assets/test-captures/ and a PDF to the scratch path given by OUT_PDF (optional).
"""
import os, sys, json, functools, http.server, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAP = os.path.join(ROOT, "presentation/assets/test-captures")
os.makedirs(CAP, exist_ok=True)
OUT_PDF = os.environ.get("OUT_PDF", os.path.join(CAP, "deck-print-test.pdf"))

# serve over http so the run mirrors "open with a local server"
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
handler = functools.partial(Quiet, directory=ROOT)
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{srv.server_address[1]}/presentation/index.html"

results = []
def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""))

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    errors, failed = [], []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.on("requestfailed", lambda r: failed.append(r.url))
    pg.on("response", lambda r: failed.append(f"{r.status} {r.url}") if r.status >= 400 else None)
    pg.goto(URL); pg.wait_for_load_state("networkidle")

    n = pg.locator(".slide").count()
    check("14 slides present", n == 14, str(n))
    cur = lambda: pg.evaluate("[...document.querySelectorAll('.slide')].findIndex(s=>s.classList.contains('active'))")

    # every image loads
    bad = pg.evaluate("[...document.images].filter(i=>i.getAttribute('src') && i.complete && i.naturalWidth===0 && i.closest('#lightbox')===null).map(i=>i.src)")
    imgs = pg.evaluate("[...document.images].filter(i=>i.closest('#lightbox')===null).length")
    check("all screenshots load", not bad, f"{imgs} images, broken={bad}")
    # every diagram renders nodes
    dn = pg.evaluate("[...document.querySelectorAll('.diagram')].map(d=>d.querySelectorAll('.dnode').length)")
    check("3 interactive diagrams render", len(dn) == 3 and all(x > 5 for x in dn), str(dn))

    # buttons
    pg.click("#next"); pg.wait_for_timeout(450); check("Next button", cur() == 1)
    pg.click("#prev"); pg.wait_for_timeout(450); check("Previous button", cur() == 0)
    pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(300); check("ArrowRight key", cur() == 1)
    pg.keyboard.press("PageDown"); pg.wait_for_timeout(300); check("PageDown key", cur() == 2)
    pg.keyboard.press("PageUp"); pg.wait_for_timeout(300); check("PageUp key", cur() == 1)
    pg.keyboard.press("ArrowLeft"); pg.wait_for_timeout(300); check("ArrowLeft key", cur() == 0)
    check("counter + progress", pg.inner_text("#counter").strip() == "1 / 14" and "%" in pg.get_attribute("#progress", "style"))

    # TOC: every entry goes to the right slide
    ok = True
    for k in range(14):
        pg.click("#toc-btn"); pg.wait_for_timeout(120)
        pg.locator("#toc ol button").nth(k).click()
        pg.wait_for_timeout(120)
        ok = ok and cur() == k
    check("TOC navigates to all 14 slides", ok)
    check("hash deep-link updates", pg.evaluate("location.hash") == "#14")

    # per-slide render capture
    for k in range(14):
        pg.evaluate(f"location.hash='#{k+1}'"); pg.wait_for_timeout(450)
        if k == 0: pg.screenshot(path=os.path.join(CAP, "test-01-cover.png"))
        if k == 3: pg.screenshot(path=os.path.join(CAP, "test-02-feature-slide.png"))
        if k == 9: pg.screenshot(path=os.path.join(CAP, "test-03-architecture.png"))

    # lightbox
    pg.evaluate("location.hash='#4'"); pg.wait_for_timeout(450)
    pg.click(".slide.active .shot")
    pg.wait_for_timeout(250)
    opened = pg.evaluate("document.getElementById('lightbox').classList.contains('open') && document.querySelector('#lightbox img').naturalWidth>0")
    pg.screenshot(path=os.path.join(CAP, "test-06-lightbox.png"))
    check("screenshot lightbox opens", opened)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
    check("Escape closes lightbox", not pg.evaluate("document.getElementById('lightbox').classList.contains('open')"))

    # diagram: click shows info, drag moves node + edges, reset restores
    pg.evaluate("location.hash='#10'"); pg.wait_for_timeout(500)
    node = pg.locator(".slide.active .dnode").nth(5)   # Web console (SPA)
    box = node.bounding_box()
    before = node.get_attribute("transform")
    node.click(); pg.wait_for_timeout(150)
    info = pg.inner_text("#arch-info")
    check("diagram click shows explanation", "Web console" in info and len(info) > 40, info[:60].replace("\n", " "))
    edge_before = pg.evaluate("document.querySelector('.slide.active .diagram line').getAttribute('x1')")
    pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    pg.mouse.down(); pg.mouse.move(box["x"] + 140, box["y"] + 60, steps=8); pg.mouse.up()
    pg.wait_for_timeout(150)
    after = node.get_attribute("transform")
    check("diagram node drags", before != after, f"{before} -> {after}")
    pg.locator(".slide.active .dtools .btn", has_text="Reset layout").click(); pg.wait_for_timeout(150)
    node.click(); pg.wait_for_timeout(100)
    pg.screenshot(path=os.path.join(CAP, "test-04-diagram-dragged.png"))  # overwritten below with dragged state
    check("reset layout restores node", node.get_attribute("transform") == before)
    # capture a dragged state for the report
    pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    pg.mouse.down(); pg.mouse.move(box["x"] + 200, box["y"] - 40, steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
    pg.screenshot(path=os.path.join(CAP, "test-04-diagram-dragged.png"))
    pg.reload(); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(400)
    check("dragged layout persists after reload", pg.locator(".slide.active .dnode").nth(5).get_attribute("transform") != before)
    pg.locator(".slide.active .dtools .btn", has_text="Reset layout").click()

    # keyboard: Enter on a focused node shows info, Alt+Arrow moves it
    pg.evaluate("location.hash='#11'"); pg.wait_for_timeout(450)
    fnode = pg.locator(".slide.active .dnode").nth(0)
    t0 = fnode.get_attribute("transform"); fnode.focus(); pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    check("keyboard Enter on node shows info", "Sign in" in pg.inner_text("#flow-info"))
    pg.keyboard.press("Alt+ArrowRight"); pg.wait_for_timeout(100)
    check("Alt+Arrow moves node", fnode.get_attribute("transform") != t0)
    pg.locator(".slide.active .dtools .btn", has_text="Reset layout").click()

    # notes
    pg.click("#notes-btn"); pg.wait_for_timeout(100)
    check("speaker notes toggle", pg.evaluate("document.getElementById('notes').classList.contains('open')") and "speaker notes" in pg.inner_text("#notes").lower())
    pg.click("#notes-btn")

    # fullscreen
    pg.click("#fs-btn"); pg.wait_for_timeout(400)
    fs = pg.evaluate("!!document.fullscreenElement")
    check("fullscreen request", fs, "headless may refuse; button wired to requestFullscreen")
    if fs: pg.evaluate("document.exitFullscreen()")

    # smaller viewports
    for w, h, tag in [(1024, 640, "laptop"), (390, 844, "mobile")]:
        pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(300)
        pg.evaluate("location.hash='#5'"); pg.wait_for_timeout(450)
        hscroll = pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
        check(f"{tag} {w}px: no horizontal scroll", not hscroll)
        if tag == "mobile": pg.screenshot(path=os.path.join(CAP, "test-05-mobile.png"), full_page=True)
    pg.set_viewport_size({"width": 1440, "height": 900})

    # print / PDF
    pg.emulate_media(media="print")
    pg.pdf(path=OUT_PDF, width="1280px", height="720px", print_background=True)
    pg.emulate_media(media="screen")
    from pypdf import PdfReader
    pages = len(PdfReader(OUT_PDF).pages)
    check("print stylesheet → PDF with one page per slide", pages == 14, f"{pages} pages")

    check("no JS errors", not errors, "; ".join(errors[:3]))
    check("no failed / 4xx requests", not failed, "; ".join(failed[:3]))
    b.close()

srv.shutdown()
passed = sum(1 for r in results if r[1])
print(f"\n{passed}/{len(results)} checks passed")
json.dump([{"check": n, "pass": ok, "detail": d} for n, ok, d in results], open(os.path.join(CAP, "test-results.json"), "w"), indent=1)
