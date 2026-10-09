# GEO Tracker

בודק אם האתר שלך מוזכר/מקושר בתשובות של ChatGPT, Perplexity, Gemini, Claude ו-Google AI Overview / AI Mode (דרך Apify), מול מתחרים, ונותן המלצות + בדיקת סריקת לינק.

```bash
npm install
npm run dev        # http://localhost:3000
```
1. `/settings` – מותג, דומיין, מתחרים, פרומפטים, מפתחות API (או "מצב הדגמה" בלי מפתחות).
2. דשבורד – "הרץ בדיקה".
3. `/check-link` – בדיקה אם לינק נגיש לבוטי AI.

בדיקות: `npm test` · טייפצ'ק: `npm run typecheck`. מפתחות נשמרים ב-`data/settings.json` (מחוץ ל-git).
