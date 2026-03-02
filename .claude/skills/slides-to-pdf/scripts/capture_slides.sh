#!/usr/bin/env bash
# capture_slides.sh <surface> <url> <output_dir>
# Navigates to a cmux browser surface, captures each slide via html2canvas,
# and writes numbered PNGs to <output_dir>.
set -e

SURFACE="$1"
URL="$2"
OUT_DIR="$3"

if [ -z "$SURFACE" ] || [ -z "$URL" ] || [ -z "$OUT_DIR" ]; then
  echo "Usage: capture_slides.sh <surface> <url> <output_dir>" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "→ Navigating to $URL"
cmux browser "$SURFACE" goto "$URL"
cmux browser "$SURFACE" wait --load-state complete --timeout-ms 15000

TOTAL=$(cmux browser "$SURFACE" eval "document.querySelectorAll('.slide').length")
echo "→ Found $TOTAL slides"

echo "→ Injecting html2canvas"
cmux browser "$SURFACE" eval "var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';document.head.appendChild(s);s.src"
sleep 2

LOADED=$(cmux browser "$SURFACE" eval "typeof html2canvas")
if [ "$LOADED" != "function" ]; then
  echo "Error: html2canvas failed to load" >&2
  exit 1
fi

echo "→ Starting slide capture..."
cmux browser "$SURFACE" eval "window._slides=[]; window._cur=0; window._total=document.querySelectorAll('.slide').length; window._done=false; function captureSlide(){ if(window._cur>=window._total){window._done=true;return;} show(window._cur); setTimeout(function(){ html2canvas(document.querySelector('.slide.active'),{scale:2,useCORS:true,logging:false}).then(function(c){ window._slides.push(c.toDataURL('image/png')); window._cur++; captureSlide(); }); },600); } captureSlide(); 'started'"

# Wait for all slides to be captured (600ms each + buffer)
WAIT_S=$(( TOTAL + 4 ))
echo "→ Waiting ${WAIT_S}s for all slides to render..."
sleep "$WAIT_S"

CAPTURED=$(cmux browser "$SURFACE" eval "window._slides.length")
echo "→ Captured: $CAPTURED / $TOTAL"

if [ "$CAPTURED" != "$TOTAL" ]; then
  echo "Error: only $CAPTURED of $TOTAL slides captured" >&2
  exit 1
fi

echo "→ Extracting PNGs to $OUT_DIR"
for i in $(seq 0 $((TOTAL - 1))); do
  B64=$(cmux browser "$SURFACE" eval "window._slides[$i].replace('data:image/png;base64,','')")
  OUT_FILE="$OUT_DIR/slide_$(printf '%02d' $((i + 1))).png"
  echo "$B64" | base64 -d > "$OUT_FILE"
  echo "  slide $((i+1)): $(wc -c < "$OUT_FILE") bytes"
done

echo "→ Done. PNGs in $OUT_DIR"
