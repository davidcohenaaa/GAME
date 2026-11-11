#!/usr/bin/env bash
# יוצר תיקיית עבודה לסרטון חדש: תבנית, גופן גיבוי, ופונטי Polin שחולצו מספר המותג.
# שימוש: bash new_project.sh <project_dir> [brand_book.pdf]
#   TEMPLATE=explainer: תבנית סרטון הסבר 16:9 עם קריינות (ברירת מחדל: מודעה 9:16)
set -e
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:?usage: new_project.sh <project_dir> [brand_book.pdf]}"
mkdir -p "$DIR/fonts" "$DIR/brand-fonts"
cp "$SKILL"/fonts/heebo-*.woff2 "$DIR/fonts/"
TPL="$SKILL/templates/example-behave-wfh.src.html"; [ "${TEMPLATE:-}" = explainer ] && TPL="$SKILL/templates/explainer-16x9.src.html"
[ -f "$DIR/video.src.html" ] || cp "$TPL" "$DIR/video.src.html"
printf 'brand-fonts/\nframes*/\n' > "$DIR/.gitignore"
if [ -n "$2" ]; then
  python3 -I "$SKILL/scripts/extract_fonts.py" "$2" "$DIR/brand-fonts"
else
  echo "אזהרה: לא ניתן PDF של ספר המותג – הטקסט יוצג בגופן הגיבוי (Heebo) עד שיחולצו פונטי Polin."
fi
echo "נוצר: $DIR/video.src.html (מבוסס על הדוגמה). ערכו את הסצנות ואז הריצו make_video.sh."
