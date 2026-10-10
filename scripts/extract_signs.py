#!/usr/bin/env python3
"""Build content/signs.json and images/signs/*.png from the official
Ministry of Transport traffic-sign table (לוח התמרורים, PDF).

Usage:   python3 scripts/extract_signs.py <path-to-pdf>
Needs:   pip install pymupdf

How it works
- Each table page draws its lines as thin filled rectangles. The top line gives
  the column spans (image | number | meaning | validity); the lines inside a
  column give that column's rows.
- A meaning cell can be merged across several signs, so meaning/validity are
  read from their own column's row containing the sign, not from the sign's row.
- A row with no number is a second picture of the sign above it; it is merged.
- The picture of every row is rendered straight from the page, so signs that
  are drawn as vectors (not embedded images) come out exactly like the PDF.
- Rows that are blank in the original (cancelled signs) are dropped.
"""
import json
import os
import re
import sys

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "images", "signs")
OUT_JSON = os.path.join(ROOT, "content", "signs.json")
FIRST_TABLE_PAGE, LAST_TABLE_PAGE = 7, 89  # 1-based, inclusive
DPI = 150
TABLE_BOTTOM = 556  # points from the top; the page footer starts below this

PARTS = {
    1: "תמרורי אזהרה והתראה",
    2: "תמרורי הוריה",
    3: "תמרורי זכות קדימה",
    4: "תמרורי איסורים והגבלות",
    5: "תמרורי תחבורה ציבורית",
    6: "תמרורי מודיעין והדרכה",
    7: "תמרורי רמזורים ובקרת נתיבים",
    8: "תמרורי סימון על פני הדרך",
    9: "תמרורים באתר עבודה",
    10: "נספח סמלים",
}
PUNCT_ONLY = re.compile(r'^[\s.,:;!?"\'()\[\]\-–־/]+$')


def thin_rects(page):
    out = []
    for d in page.get_drawings():
        r = d["rect"]
        if d.get("fill") and r.height < 1.2 and r.width > 3:
            out.append((r.x0, r.y0, r.x1, r.y1))
    return out


def column_spans(rects):
    top = min(r[1] for r in rects)
    return sorted((r[0], r[2]) for r in rects if abs(r[1] - top) < 1.5)


def row_bands(rects, span):
    a, b = span
    ys = sorted({round(r[1], 1) for r in rects if r[0] < b - 2 and r[2] > a + 2})
    pts = []
    for y in ys:
        if not pts or y - pts[-1] >= 1.5:
            pts.append(y)
    # The last row of a page often has no closing line: run it to the footer.
    if pts and pts[-1] < TABLE_BOTTOM - 20:
        pts.append(TABLE_BOTTOM)
    return list(zip(pts, pts[1:]))[1:]  # drop the header band


def band_at(bands, y):
    return next((i for i, (t, b) in enumerate(bands) if t <= y < b), None)


def join_words(words):
    """words: (x0,y0,x1,y1,text) of a Hebrew (RTL) cell -> one clean string."""
    lines = []
    for w in sorted(words, key=lambda w: (w[1] + w[3]) / 2):
        cy = (w[1] + w[3]) / 2
        for line in lines:
            if abs(line[0] - cy) < 4:
                line[1].append(w)
                break
        else:
            lines.append([cy, [w]])
    out = []
    for _, ws in sorted(lines, key=lambda l: l[0]):
        text, prev = "", None
        for w in sorted(ws, key=lambda w: -w[2]):  # right to left
            if prev is None:
                text = w[4]
            elif prev[0] - w[2] < 1.6 or PUNCT_ONLY.match(w[4]):
                text += w[4]
            else:
                text += " " + w[4]
            prev = w
        out.append(text)
    return re.sub(r"\s+", " ", " ".join(out)).strip()


def make_id(number):
    return "s" + number.replace("ס-", "sym").replace("פ", "p")


def short_title(meaning):
    first = re.split(r"[:;]|\.\s|\s[–-]\s", meaning, maxsplit=1)[0].strip(" .,")
    if len(first) > 60:
        first = first[:60].rsplit(" ", 1)[0] + "…"
    return first or meaning


def render_cell(page, span, band, path):
    rect = pymupdf.Rect(span[0] + 3.0, band[0] + 1.8, span[1] - 3.0, band[1] - 1.8)
    pix = page.get_pixmap(clip=rect, dpi=DPI, alpha=False)
    if pix.is_unicolor:
        return False
    pix.save(path)
    return True


def main(pdf_path):
    doc = pymupdf.open(pdf_path)
    os.makedirs(IMG_DIR, exist_ok=True)
    signs = []

    for pno in range(FIRST_TABLE_PAGE - 1, LAST_TABLE_PAGE):
        page = doc[pno]
        rects = thin_rects(page)
        if not rects:
            continue
        spans = column_spans(rects)
        if len(spans) < 3:
            continue
        img_span, num_span, mean_span = spans[-1], spans[-2], spans[-3]
        valid_span = spans[-4] if len(spans) >= 4 else None

        num_bands = row_bands(rects, num_span)
        mean_bands = row_bands(rects, mean_span)
        valid_bands = row_bands(rects, valid_span) if valid_span else []
        words = [w[:5] for w in page.get_text("words")]

        def cell_text(span, bands, y):
            i = band_at(bands, y)
            if i is None:
                return ""
            t, b = bands[i]
            return join_words([
                w for w in words
                if span[0] <= (w[0] + w[2]) / 2 <= span[1] and t <= (w[1] + w[3]) / 2 < b
            ])

        for t, b in num_bands:
            cy = (t + b) / 2
            number = join_words([
                w for w in words
                if num_span[0] <= (w[0] + w[2]) / 2 <= num_span[1] and t <= (w[1] + w[3]) / 2 < b
            ])
            if number:
                sign = {
                    "id": make_id(number), "number": number,
                    "meaning": cell_text(mean_span, mean_bands, cy),
                    "validity": cell_text(valid_span, valid_bands, cy) if valid_span else "",
                    "page": pno + 1, "images": [],
                }
                signs.append(sign)
            elif signs:
                sign = signs[-1]  # a second picture of the sign above
            else:
                continue
            name = f"{sign['id']}-{len(sign['images']) + 1}.png"
            if render_cell(page, img_span, (t, b), os.path.join(IMG_DIR, name)):
                sign["images"].append("images/signs/" + name)

    kept = [s for s in signs if s["images"] or s["meaning"]]
    for s in kept:
        digit = s["number"][0]
        s["part"] = 10 if not digit.isdigit() else int(digit)
        s["category"] = PARTS[s["part"]]
        s["title"] = short_title(s["meaning"]) if s["meaning"] else f"תמרור {s['number']}"
    out = [{k: s[k] for k in ("id", "number", "part", "category", "title", "meaning", "validity", "images", "page")}
           for s in kept]
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    dropped = len(signs) - len(kept)
    print(f"{len(out)} signs written to content/signs.json ({dropped} blank rows dropped)")
    return out


if __name__ == "__main__":
    main(sys.argv[1])
