# מוריד סרטונים

מוריד סרטונים מפינטרסט ומאלפי אתרים נוספים (אינסטגרם, טיקטוק, X, פייסבוק, יוטיוב, ריידיט…) באמצעות [yt-dlp](https://github.com/yt-dlp/yt-dlp).

```bash
pip install -r requirements.txt
python app.py                       # ממשק web ב-http://127.0.0.1:8000
python app.py URL                   # הורדה משורת פקודה
python app.py URL --audio           # אודיו בלבד
python app.py URL --quality 720 --out ./videos
```

- `ffmpeg` (אופציונלי): נדרש לאיכויות גבוהות שמופרדות לוידאו+אודיו ולהמרה ל-mp3.
- אם אתר מפסיק לעבוד: `pip install -U yt-dlp`.
- השרת מאזין ל-127.0.0.1 בלבד כברירת מחדל. אל תחשוף אותו לאינטרנט בלי הגנה.
- השתמש רק בתכנים שיש לך זכות להוריד.
