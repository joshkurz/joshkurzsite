---
name: slides-to-pdf
description: Export a cmux browser-based HTML slideshow to a PDF. Navigates to the slides URL, captures each slide as a PNG via html2canvas, then combines them into a single PDF. Use when asked to export, save, or generate a PDF of the talk slides.
argument-hint: [url] [output_path]
allowed-tools: Bash(cmux *), Bash(python3 *), Bash(pip3 *)
---

# Slides → PDF Exporter

Captures every slide from an HTML slideshow running in a cmux browser pane and writes a PDF.

## Supporting files

- **[scripts/capture_slides.sh](scripts/capture_slides.sh)** — navigates to the URL, injects html2canvas, captures all slides, writes numbered PNGs to a temp dir
- **[scripts/make_pdf.py](scripts/make_pdf.py)** — combines the PNGs into a single PDF via img2pdf (auto-installs if missing)

---

## Arguments

- `$ARGUMENTS[0]` — URL to capture (default: `https://joshkurz.github.io/joshkurzsite/`)
- `$ARGUMENTS[1]` — output PDF path (default: `talk/slides.pdf`)

---

## Step 1 — Resolve arguments

```
URL=${ARGUMENTS[0]:-https://joshkurz.github.io/joshkurzsite/}
OUTPUT=${ARGUMENTS[1]:-talk/slides.pdf}
TMPDIR=/tmp/slides-pdf-$$
```

## Step 2 — Identify the browser surface

```bash
cmux identify --json
```

Look for a surface where `is_browser_surface` is true. Use that surface ref (e.g. `surface:15`) for all subsequent commands. If none exists, open one:

```bash
cmux browser open "$URL" --json
```

## Step 3 — Capture slides

Run the capture script with the resolved surface, URL, and temp dir:

```bash
bash .claude/skills/slides-to-pdf/scripts/capture_slides.sh <surface> "$URL" "$TMPDIR"
```

The script will:
1. Navigate to the URL and wait for load
2. Count `.slide` elements to determine total pages
3. Inject html2canvas from CDN
4. Run a JS capture loop — calls `show(n)` for each slide, renders to canvas, stores base64 in `window._slides`
5. Extract each PNG from the browser into `$TMPDIR/slide_NN.png`

## Step 4 — Build the PDF

```bash
python3 .claude/skills/slides-to-pdf/scripts/make_pdf.py "$TMPDIR" "$OUTPUT"
```

## Step 5 — Report

Tell the user:
- The output path and file size
- How many pages were captured
- Any slides that failed (if count mismatched)

Clean up the temp dir:

```bash
rm -rf "$TMPDIR"
```
