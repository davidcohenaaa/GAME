# בונה קבצי OTF מתת-הגופנים (Polin, Leon) שמוטמעים ב-PDF של ספר המותג.
# לתרגיל/המחשה בלבד – הגופנים מסחריים; לפרסום יש להשתמש בקבצים מורשים.
# שימוש: python3 -I extract_fonts.py <book.pdf> <out_dir>
import sys, re, io, os
import pikepdf
from fontTools.cffLib import CFFFontSet
from fontTools.fontBuilder import FontBuilder
from fontTools.agl import toUnicode
from fontTools.misc.psCharStrings import T2WidthExtractor
from fontTools.pens.t2CharStringPen import T2CharStringPen

FAMILIES = ('Polin', 'Leon')


def width_of(c):
    pr = c.private
    ext = T2WidthExtractor(getattr(pr, 'Subrs', []), c.globalSubrs, pr.nominalWidthX, pr.defaultWidthX)
    ext.execute(c)
    return ext.width


def redraw(c, w):
    # מצייר מחדש את הגליף (פותר הפניות ל-subrs של הגופן המקורי)
    pen = T2CharStringPen(w, None)
    c.draw(pen)
    return pen.getCharString()


def tounicode(f):
    tu = f.get('/ToUnicode')
    m = {}
    if tu is None:
        return m
    s = tu.read_bytes().decode('latin1')
    for blk in re.findall(r'beginbfchar(.*?)endbfchar', s, re.S):
        for a, b in re.findall(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', blk):
            m[int(a, 16)] = bytes.fromhex(b).decode('utf-16-be')
    for blk in re.findall(r'beginbfrange(.*?)endbfrange', s, re.S):
        for a, b, c in re.findall(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', blk):
            a, b, c = int(a, 16), int(b, 16), int(c, 16)
            for i in range(b - a + 1):
                m[a + i] = chr(c + i)
    return m


def collect(pdf):
    """לכל משקל: רשימת (מפת תווים, גופן CFF, שמות גליפים) מכל תת-הגופנים בספר."""
    found, seen = {}, set()
    for pg in pdf.pages:
        res = pg.obj.get('/Resources') or {}
        for _, f in (res.get('/Font') or {}).items():
            if f.objgen in seen:
                continue
            seen.add(f.objgen)
            base = str(f.get('/BaseFont')).split('+')[-1]
            if not base.startswith(FAMILIES):
                continue
            fd = f.get('/FontDescriptor')
            ff = fd.get('/FontFile3') if fd else None
            if ff is None:
                continue
            cff = CFFFontSet()
            cff.decompile(io.BytesIO(ff.read_bytes()), None)
            top = cff[cff.fontNames[0]]
            names = top.getGlyphOrder()
            enc = f.get('/Encoding')
            diffs = {}
            if isinstance(enc, pikepdf.Dictionary) and '/Differences' in enc:
                code = 0
                for it in enc['/Differences']:
                    if isinstance(it, int):
                        code = int(it)
                    else:
                        diffs[code] = str(it)[1:]
                        code += 1
            tu = tounicode(f)
            builtin = top.Encoding if isinstance(getattr(top, 'Encoding', None), list) else None
            cmap = {}
            for code in range(256):
                g = diffs.get(code)
                if g is None and builtin:
                    g = builtin[code] if builtin[code] != '.notdef' else None
                if g is None:
                    ch = bytes([code]).decode('mac_roman')
                    cand = [n for n in names if toUnicode(n) == ch]
                    g = cand[0] if cand else None
                if g is None or g not in names:
                    continue
                u = tu.get(code) or toUnicode(g) or bytes([code]).decode('mac_roman')
                if u and len(u) == 1:
                    cmap[ord(u)] = g
            found.setdefault(base, []).append((cmap, top))
    return found


def build(base, lst, out_dir):
    # מאחד את כל תת-הגופנים של אותו משקל לגופן אחד
    gl, cmap, widths, order = {}, {}, {}, ['.notdef']
    for cm, top in sorted(lst, key=lambda x: -len(x[0])):
        cs = top.CharStrings
        for u, g in cm.items():
            if u in cmap:
                continue
            nn = f'u{u:04X}'
            if nn not in gl:
                w = width_of(cs[g])
                gl[nn] = redraw(cs[g], w)
                widths[nn] = int(round(w))
                order.append(nn)
            cmap[u] = nn
        if '.notdef' not in gl:
            c = top.CharStrings['.notdef']
            w = width_of(c)
            gl['.notdef'] = redraw(c, w)
            widths['.notdef'] = int(round(w))
    if 0x20 not in cmap and 0xA0 in cmap:
        cmap[0x20] = cmap[0xA0]
    fam, style = (base.split('-', 1) + ['Regular'])[:2]
    fb = FontBuilder(1000, isTTF=False)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupCFF(base, {'FullName': base}, {n: gl[n] for n in order}, {})
    fb.setupHorizontalMetrics({n: (widths[n], 0) for n in order})
    fb.setupHorizontalHeader(ascent=900, descent=-250)
    fb.setupNameTable({'familyName': fam, 'styleName': style})
    fb.setupOS2(sTypoAscender=900, sTypoDescender=-250, usWinAscent=950, usWinDescent=300)
    fb.setupPost()
    out = os.path.join(out_dir, base + '.otf')
    fb.save(out)
    heb = ''.join(sorted(chr(u) for u in cmap if 0x5D0 <= u <= 0x5EA))
    print(f'{base}: {len(cmap)} glyphs, Hebrew: {heb}')


def main():
    if len(sys.argv) != 3:
        sys.exit('usage: extract_fonts.py <book.pdf> <out_dir>')
    pdf_path, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    found = collect(pikepdf.open(pdf_path))
    if not found:
        sys.exit('no Polin/Leon fonts found in the PDF')
    for base, lst in sorted(found.items()):
        build(base, lst, out_dir)


if __name__ == '__main__':
    main()
