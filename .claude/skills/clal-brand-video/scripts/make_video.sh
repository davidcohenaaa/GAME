#!/usr/bin/env bash
# בונה, מרנדר ומקודד סרטון מלא מתיקיית עבודה (ראו new_project.sh).
# שימוש: bash make_video.sh <project_dir> [query] [out.mp4]
#   query: אופציות לעמוד, למשל "car=key&style=round"
#   משתני סביבה:
#     W/H        גודל (ברירת מחדל 1080x1920; לסרטון הסבר 16:9: W=1920 H=1080)
#     JOBS       מספר תהליכי רינדור מקבילים (ברירת מחדל: מספר המעבדים, עד 4)
#     MUSIC_END  מתי התופים נעצרים (ברירת מחדל: תחילת הסצנה האחרונה)
#   סרטון עם קריינות: אם בתיקייה יש cues.json ו-vo.wav (מ-vo_cues.py), התזמונים מוזרקים לעמוד,
#   המוזיקה נוצרת במצב soft ומונמכת אוטומטית מתחת לדיבור (mix_audio.sh).
set -e
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$(cd "${1:?usage: make_video.sh <project_dir> [query] [out.mp4]}" && pwd)"
Q="${2:-}"; OUT="${3:-$DIR/video.mp4}"
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
CUES=(); [ -f "$DIR/cues.json" ] && CUES=(--cues "$DIR/cues.json")
python3 "$SKILL/scripts/build.py" "$DIR/video.src.html" "$DIR/video.html" "${CUES[@]}"
if [ -f "$DIR/cues.json" ]; then
  DUR=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['duration'])" "$DIR/cues.json")
else
  DUR=$(grep -oE 'const T = [0-9.]+' "$DIR/video.src.html" | head -1 | grep -oE '[0-9.]+$')
fi
# תחילת הסצנה האחרונה (sc(<start>, T, ...)) = רגע הלוגו
LAST=$(grep -oE "sc\([0-9.]+, T," "$DIR/video.src.html" | tail -1 | grep -oE '[0-9.]+' || true)
END="${MUSIC_END:-${LAST:-$(python3 -c "print(max(0, $DUR - 2.5))")}}"

# רינדור מקבילי בטווחי פריימים
FR="$DIR/frames-full"; rm -rf "$FR"; mkdir -p "$FR"
NF=$(python3 -c "print(round(${FPS:-30} * $DUR))")
J="${JOBS:-$(n=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 2); [ "$n" -gt 4 ] && echo 4 || echo "$n")}"
STEP=$(( (NF + J - 1) / J ))
for k in $(seq 0 $((J - 1))); do
  FROM=$((k * STEP)) TO=$(((k + 1) * STEP)) node "$SKILL/scripts/render.js" "$DIR/video.html${Q:+?$Q}" "$FR" &
done
wait
[ "$(ls "$FR" | wc -l)" -eq "$NF" ] || { echo "שגיאה: חסרים פריימים ב-$FR"; exit 1; }

if [ -f "$DIR/vo.wav" ]; then
  python3 "$SKILL/scripts/music.py" "$DIR/music.wav" "$DUR" "$END" soft
  bash "$SKILL/scripts/mix_audio.sh" "$DIR/vo.wav" "$DIR/music.wav" "$DIR/mix.wav" >/dev/null
  AUDIO="$DIR/mix.wav"
else
  python3 "$SKILL/scripts/music.py" "$DIR/music.wav" "$DUR" "$END"
  AUDIO="$DIR/music.wav"
fi
ffmpeg -y -loglevel error -framerate "${FPS:-30}" -i "$FR/f%05d.png" -i "$AUDIO" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
bash "$SKILL/scripts/contact_sheet.sh" "$OUT" "${OUT%.mp4}-sheet.png" >/dev/null
echo "סרטון: $OUT ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")s)"
echo "גיליון מגע לבדיקה: ${OUT%.mp4}-sheet.png"
