# התקנת הסקיל במחשב שלך (Claude Code מקומי)

## 1. פריסת הסקיל
מחלצים את ה-zip כך שתתקבל התיקייה `clal-brand-video` עם `SKILL.md` בתוכה, בתוך תיקיית הסקילים האישית:

| מערכת | נתיב |
|---|---|
| Mac / Linux | `~/.claude/skills/clal-brand-video/SKILL.md` |
| Windows | `%USERPROFILE%\.claude\skills\clal-brand-video\SKILL.md` |

Mac / Linux, מהתיקייה שבה נמצא קובץ ה-zip:
```bash
mkdir -p ~/.claude/skills && unzip clal-brand-video-skill.zip -d ~/.claude/skills/
```

## 2. התקנת הכלים (פעם אחת)
- **Node.js** 18 ומעלה: https://nodejs.org
- **Playwright** ו-Chromium:
  ```bash
  npm install -g playwright && npx playwright install chromium
  ```
- **ffmpeg:**
  - Mac: `brew install ffmpeg`
  - Windows: `winget install ffmpeg`
- **Python** 3.9 ומעלה, וספריות:
  ```bash
  python3 -m pip install numpy pikepdf fonttools
  ```
- **רשות:** poppler, רק לחילוץ סילואטות חדשות מהספר.
  - Mac: `brew install poppler`

בדיקה שהכל מותקן:
```bash
bash ~/.claude/skills/clal-brand-video/scripts/check_env.sh
```
ב-Windows מריצים את סקריפטי ה-`.sh` דרך Git Bash או WSL.

## 3. שימוש
1. פותחים Claude Code בתיקייה כלשהי, למשל `~/clal-videos`.
2. כותבים בקשה, למשל: "תעשה סרטון כלל לפי ספר המותג עם הקופי הזה: …".
3. מצרפים את ה-PDF של ספר המותג, כדי לחלץ ממנו את הפונטים.

הסקיל נטען אוטומטית. אפשר להפעיל אותו גם ישירות עם `/clal-brand-video`.

## עדכון
מחליפים את התיקייה בגרסה החדשה מהריפו `davidcohenaaa/GAME` (הנתיב `.claude/skills/clal-brand-video`).

## הערות
- **הפונטים:** פונטי Polin מחולצים מהספר לתרגיל/המחשה בלבד. לפרסום צריך קבצים מורשים.
- **זמן רינדור:** סרטון של 26 שניות הוא כ-780 פריימים, כ-4 דקות.
