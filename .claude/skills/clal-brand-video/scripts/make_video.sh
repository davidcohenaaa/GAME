#!/usr/bin/env bash
# בונה, מרנדר ומקודד סרטון מלא מתיקיית עבודה (ראו new_project.sh).
# שימוש: bash make_video.sh <project_dir> [query] [out.mp4]
#   query: אופציות לעמוד, למשל "car=key&style=round"
#   משתני סביבה: W/H (ברירת מחדל 1080x1920), MUSIC_END (מתי התופים נעצרים; ברירת מחדל: תחילת הסצנה האחרונה)
set -e
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$(cd "${1:?usage: make_video.sh <project_dir> [query] [out.mp4]}" && pwd)"
Q="${2:-}"; OUT="${3:-$DIR/video.mp4}"
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
python3 "$SKILL/scripts/build.py" "$DIR/video.src.html" "$DIR/video.html"
DUR=$(grep -oE 'const T = [0-9.]+' "$DIR/video.src.html" | head -1 | grep -oE '[0-9.]+$')
# תחילת הסצנה האחרונה (sc(<start>, T, ...)) = רגע הלוגו
LAST=$(grep -oE "sc\([0-9.]+, T," "$DIR/video.src.html" | tail -1 | grep -oE '[0-9.]+')
END="${MUSIC_END:-${LAST:-$(python3 -c "print(max(0, $DUR - 2.5))")}}"
FR="$DIR/frames-full"; rm -rf "$FR"
node "$SKILL/scripts/render.js" "$DIR/video.html${Q:+?$Q}" "$FR"
python3 "$SKILL/scripts/music.py" "$DIR/music.wav" "$DUR" "$END"
ffmpeg -y -loglevel error -framerate "${FPS:-30}" -i "$FR/f%05d.png" -i "$DIR/music.wav" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 160k -shortest -movflags +faststart "$OUT"
bash "$SKILL/scripts/contact_sheet.sh" "$OUT" "${OUT%.mp4}-sheet.png" >/dev/null
echo "סרטון: $OUT ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")s)"
echo "גיליון מגע לבדיקה: ${OUT%.mp4}-sheet.png"
