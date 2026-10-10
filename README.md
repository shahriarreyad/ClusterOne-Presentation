# ClusterOne — Website Audit & Interactive Presentation

An evidence-based audit of **the ClusterOne console** (the ClusterOne GPU cluster console, v0.1.0), with research notes, SVG diagrams and a 14-slide interactive HTML presentation.

## Open the presentation

**Quickest:** double-click `presentation/index.html`. It runs from disk with no back end and no internet. It uses only local HTML, CSS and JS.

**With a local server** (recommended if your browser blocks local files):

```bash
cd ClusterOne-Presentation
python -m http.server 8000
# then open http://localhost:8000/presentation/index.html
```

Keep the folder structure intact. The deck loads screenshots from `../assets/screenshots/`.

## Navigate

| Action | Mouse / touch | Keyboard |
|---|---|---|
| Next / previous slide | ‹ › buttons, or swipe | → ↓ Space PageDown / ← ↑ PageUp |
| First / last slide | – | Home / End |
| Table of contents | ☰ button (bottom left) | `T` |
| Speaker notes | notes button | `N` |
| Fullscreen | ⛶ button | `F` |
| Close any overlay | click outside or ✕ | `Esc` |
| Jump to a slide | – | open `index.html#7` (URL hash) |

The progress bar and the `n / 14` counter sit at the bottom.

## Use the interactive parts

- **Screenshots:** click one, or press Enter on it, to enlarge it in a lightbox. Hover over a numbered callout in the list to highlight its pin on the image.
- **Diagrams** (slides 3, 10 and 11):
  - **Click** a box to see what it is, its evidence level and its source.
  - **Drag** a box to rearrange the diagram; arrows follow. Keyboard: Tab to a box, Enter for details, **Alt + arrow keys** to move it.
  - **Reset layout** restores the original positions. Moved layouts are remembered in your browser until you reset.
  - **Open SVG** opens the static vector file from `assets/diagrams/`.

## Export to PDF

1. Click the **print** button, or press Ctrl/Cmd + P.
2. Choose **Save as PDF**.
3. Set *Margins: None* and enable **Background graphics**.

The print stylesheet outputs one 1280×720 page per slide (14 pages) and hides the controls.

## Folder structure

```
ClusterOne-Presentation/
├── presentation/
│   ├── index.html               ← the deck
│   └── assets/
│       ├── style.css, deck.js   ← styling + navigation / diagrams (no dependencies)
│       ├── diagrams-data.js     ← generated diagram spec
│       └── test-captures/       ← Phase-5 self-test screenshots + test-results.json
├── assets/
│   ├── screenshots/             ← 5 real screenshots of the live site
│   └── diagrams/                ← system-architecture.svg, feature-map.svg, user-workflow.svg
├── research/
│   ├── site-map.md              ← pages, routes, inspection status
│   ├── feature-inventory.md     ← 30 features with status + evidence
│   ├── interaction-test-results.md ← 18 interactions tested
│   ├── architecture-notes.md    ← confirmed / inferred / team-stated / unknown
│   ├── screenshot-index.md      ← what each screenshot proves
│   └── issues.md                ← observations, limitations, open questions
└── tools/
    ├── build_diagrams.py        ← regenerates the 3 SVGs + diagrams-data.js
    └── test_presentation.py     ← automated browser test (Playwright)
```

## Rebuild and re-test

```bash
python3 tools/build_diagrams.py          # after editing the diagram spec
pip install playwright pypdf && python -m playwright install chromium
python3 tools/test_presentation.py       # 27 checks: navigation, TOC, lightbox, drag/reset, notes, fullscreen, mobile, PDF, JS errors
```

## How the evidence was gathered

- The audit sandbox could not reach the site; its proxy returned HTTP 403. A plain HTTP fetch returns only an empty single-page-app shell.
- All site evidence was therefore captured in the project owner's own browser with a **`User · default`** account: 5 screenshots plus the copied text of Overview, Nodes, Showcase, Mounted GPUs and Guide.
- Testing was read-only. No jobs, LLM sessions or GPU mounts were started.
- Every claim in the deck is labelled: verified, inference, team-stated, unknown or recommendation. The site's own performance figures are shown as claims.
- See `research/issues.md` (A-01 to A-04) for the full list of audit limitations.
