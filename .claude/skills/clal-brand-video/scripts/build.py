# מזריק את קבצי ה-SVG של המותג לתוך עמוד המקור: כל <!--ASSET:name--> מוחלף בתוכן assets/name.svg
# שימוש: python3 build.py <video.src.html> <video.html> [assets_dir] [--inline-fonts] [--cues cues.json]
#   נכסים בתיקיות משנה: <!--ASSET:icons/wallet-->, <!--ASSET:icons/drawn/piggy-->
#   --cues: מחליף את /*CUES*/null בעמוד בתוכן קובץ ה-JSON (תזמוני הקריינות מ-vo_cues.py)
#   --inline-fonts: מטמיע גם את קבצי הפונט (brand-fonts/, fonts/) כ-data URI, כך שמתקבל קובץ HTML יחיד
#   שמתנגן בכל דפדפן בלי תיקיות נלוות (לשימוש בסביבה בלי רינדור וידאו, למשל שיחה ב-claude.ai).
import re, sys, base64, pathlib

argv = sys.argv[1:]
cues_file = None
if '--cues' in argv:
    k = argv.index('--cues'); cues_file = argv[k + 1]; del argv[k:k + 2]
args = [a for a in argv if not a.startswith('--')]
inline_fonts = '--inline-fonts' in argv
if len(args) < 2:
    sys.exit('usage: build.py <src.html> <out.html> [assets_dir] [--inline-fonts]')
src, out = pathlib.Path(args[0]), pathlib.Path(args[1])
assets = pathlib.Path(args[2]) if len(args) > 2 else pathlib.Path(__file__).resolve().parent.parent / 'assets'


def inline(m):
    f = assets / f'{m.group(1)}.svg'
    if not f.exists():
        sys.exit(f'missing asset: {f}')
    return f.read_text(encoding='utf-8')


MIME = {'.otf': 'font/otf', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.woff': 'font/woff'}


def inline_font(m):
    f = src.parent / m.group(1)
    if not f.exists():  # פונט שלא חולץ – משאירים את הקישור; הדפדפן יעבור לגיבוי
        print(f'note: font not found, kept as link: {m.group(1)}')
        return m.group(0)
    data = base64.b64encode(f.read_bytes()).decode()
    return f'url(data:{MIME.get(f.suffix, "application/octet-stream")};base64,{data})'


html = re.sub(r'<!--ASSET:([\w/-]+)-->', inline, src.read_text(encoding='utf-8'))
if cues_file:
    html = html.replace('/*CUES*/null', pathlib.Path(cues_file).read_text(encoding='utf-8'))
if inline_fonts:
    html = re.sub(r'url\(((?:brand-fonts|fonts)/[^)]+)\)', inline_font, html)
out.write_text(html, encoding='utf-8')
print(f'{out} ({len(html)} bytes{", fonts inlined" if inline_fonts else ""})')
