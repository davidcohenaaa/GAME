# מזריק את קבצי ה-SVG של המותג לתוך עמוד המקור: כל <!--ASSET:name--> מוחלף בתוכן assets/name.svg
# שימוש: python3 build.py <video.src.html> <video.html> [assets_dir]
import re, sys, pathlib

if len(sys.argv) < 3:
    sys.exit('usage: build.py <src.html> <out.html> [assets_dir]')
src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
assets = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else pathlib.Path(__file__).resolve().parent.parent / 'assets'


def inline(m):
    f = assets / f'{m.group(1)}.svg'
    if not f.exists():
        sys.exit(f'missing asset: {f}')
    return f.read_text(encoding='utf-8')


html = re.sub(r'<!--ASSET:([\w-]+)-->', inline, src.read_text(encoding='utf-8'))
out.write_text(html, encoding='utf-8')
print(f'{out} ({len(html)} bytes)')
