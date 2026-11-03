#!/usr/bin/env bash
# יוצר תיקיית עבודה לסרטון חדש: תבנית, גופן גיבוי, ופונטי Polin שחולצו מספר המותג.
# שימוש: bash new_project.sh <project_dir> [brand_book.pdf]
set -e
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:?usage: new_project.sh <project_dir> [brand_book.pdf]}"
mkdir -p "$DIR/fonts" "$DIR/brand-fonts"
cp "$SKILL"/fonts/heebo-*.woff2 "$DIR/fonts/"
[ -f "$DIR/video.src.html" ] || cp "$SKILL/templates/example-behave-wfh.src.html" "$DIR/video.src.html"
printf 'brand-fonts/\nframes*/\n' > "$DIR/.gitignore"
if [ -n "$2" ]; then
  python3 -I "$SKILL/scripts/extract_fonts.py" "$2" "$DIR/brand-fonts"
else
  echo "אזהרה: לא ניתן PDF של ספר המותג – הטקסט יוצג בגופן הגיבוי (Heebo) עד שיחולצו פונטי Polin."
fi
echo "נוצר: $DIR/video.src.html (מבוסס על הדוגמה). ערכו את הסצנות ואז הריצו make_video.sh."
