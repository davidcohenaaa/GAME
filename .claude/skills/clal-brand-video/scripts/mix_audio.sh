#!/usr/bin/env bash
# ממקסס קריינות עם מוזיקת רקע: המוזיקה מונמכת ו"מתכופפת" אוטומטית מתחת לדיבור (sidechain ducking).
# שימוש: bash mix_audio.sh <vo.wav> <music.wav> <out.wav> [music_level=0.30]
# העוצמה הכוללת מנורמלת ל--16 LUFS (תקן לרשת ולרשתות חברתיות).
set -e
VO="${1:?usage: mix_audio.sh <vo.wav> <music.wav> <out.wav> [music_level]}"; MU="${2:?}"; OUT="${3:?}"; LVL="${4:-0.30}"
ffmpeg -y -loglevel error -i "$VO" -i "$MU" -filter_complex \
 "[0]aformat=channel_layouts=mono,asplit=2[v1][v2];[1]aformat=channel_layouts=mono,volume=${LVL}[m];[m][v1]sidechaincompress=threshold=0.03:ratio=6:attack=30:release=500[md];[md][v2]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-16:TP=-1.5:LRA=11[a]" \
 -map "[a]" -ar 44100 "$OUT"
echo "$OUT ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")s)"
