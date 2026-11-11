#!/usr/bin/env bash
# גיליון מגע לבדיקה ויזואלית: פריים כל שנייה (מסרטון) או כל הפריימים בתיקייה (פריימי בדיקה).
# שימוש: bash contact_sheet.sh <video.mp4 | frames_dir> <out.png> [cols=7]
#   TILE_W: רוחב כל תמונה בגיליון (ברירת מחדל 240; לסרטון 16:9 מומלץ 400)
set -e
IN="${1:?usage: contact_sheet.sh <video.mp4|frames_dir> <out.png> [cols]}"; OUT="${2:?}"; COLS="${3:-7}"
if [ -d "$IN" ]; then
  N=$(ls "$IN"/f*.png | wc -l); ROWS=$(( (N + COLS - 1) / COLS ))
  ffmpeg -y -loglevel error -pattern_type glob -i "$IN/f*.png" -vf "scale=${TILE_W:-240}:-1,tile=${COLS}x${ROWS}" -frames:v 1 "$OUT"
else
  D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN"); N=${D%.*}; ROWS=$(( (N + COLS) / COLS ))
  ffmpeg -y -loglevel error -i "$IN" -vf "fps=1,scale=${TILE_W:-216}:-1,tile=${COLS}x${ROWS}" -frames:v 1 "$OUT"
fi
echo "$OUT"
