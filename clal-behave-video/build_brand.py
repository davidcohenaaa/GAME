# בונה את brand.html מ-brand.src.html ע"י הזרקת קבצי ה-SVG מ-brand-assets
import re, pathlib
here = pathlib.Path(__file__).parent
src = (here / 'brand.src.html').read_text(encoding='utf-8')
out = re.sub(r'<!--ASSET:([\w-]+)-->', lambda m: (here / 'brand-assets' / f'{m.group(1)}.svg').read_text(encoding='utf-8'), src)
(here / 'brand.html').write_text(out, encoding='utf-8')
print('brand.html', len(out))
