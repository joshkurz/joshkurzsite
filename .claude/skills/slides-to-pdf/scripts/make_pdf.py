#!/usr/bin/env python3
# make_pdf.py <input_dir> <output_path>
# Combines numbered slide PNGs into a single PDF using img2pdf.
import sys
import os
import glob
import subprocess

def ensure_img2pdf():
    try:
        import img2pdf
        return img2pdf
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "img2pdf"])
        import img2pdf
        return img2pdf

def main():
    if len(sys.argv) != 3:
        print("Usage: make_pdf.py <input_dir> <output_path>", file=sys.stderr)
        sys.exit(1)

    input_dir = sys.argv[1]
    output_path = sys.argv[2]

    slides = sorted(glob.glob(os.path.join(input_dir, "slide_*.png")))
    if not slides:
        print(f"Error: no slide_*.png files found in {input_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"→ Combining {len(slides)} slides into PDF...")
    img2pdf = ensure_img2pdf()

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(img2pdf.convert(slides))

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"→ PDF written: {output_path} ({size_mb:.1f} MB, {len(slides)} pages)")

if __name__ == "__main__":
    main()
