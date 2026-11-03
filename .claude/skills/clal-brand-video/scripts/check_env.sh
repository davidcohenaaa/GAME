#!/usr/bin/env bash
# בודק שכל הכלים שהסקיל צריך מותקנים, ומדפיס פקודת התקנה לכל מה שחסר.
# שימוש: bash check_env.sh
ok=1
miss() { echo "✗ $1 — להתקנה: $2"; ok=0; }
have() { echo "✓ $1"; }

command -v node >/dev/null && have "node $(node -v)" || miss node "https://nodejs.org (גרסה 18 ומעלה)"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
if node -e "require('playwright')" 2>/dev/null; then
  have "playwright"
  if node -e "require('playwright').chromium.launch().then(b=>b.close()).catch(()=>process.exit(1))" 2>/dev/null; then have "chromium (playwright)"
  else miss "chromium" "npx playwright install chromium"; fi
else miss playwright "npm install -g playwright && npx playwright install chromium"; fi
command -v ffmpeg >/dev/null && have "ffmpeg" || miss ffmpeg "Mac: brew install ffmpeg | Windows: winget install ffmpeg | Linux: apt install ffmpeg"
command -v pdftocairo >/dev/null && have "pdftocairo (poppler, לחילוץ סילואטות נוספות)" || miss "pdftocairo (רק לחילוץ סילואטות חדשות מהספר)" "Mac: brew install poppler | Linux: apt install poppler-utils"
command -v python3 >/dev/null && have "python3 $(python3 -V 2>&1 | cut -d' ' -f2)" || miss python3 "https://python.org"
for m in numpy pikepdf fontTools; do
  python3 -c "import $m" 2>/dev/null && have "python: $m" || miss "python: $m" "python3 -m pip install numpy pikepdf fonttools"
done
[ $ok = 1 ] && echo "הכל מוכן." || { echo "יש להתקין את החסר ולהריץ שוב."; exit 1; }
