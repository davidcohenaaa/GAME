# הפעלת סנכרון התקדמות בין מכשירים (Firebase, חבילה חינמית)

1. https://console.firebase.google.com ← Add project (אפשר לכבות Google Analytics).
2. Build ← **Authentication** ← Get started ← Sign-in method ← **Google** ← Enable ← Save.
3. Authentication ← Settings ← **Authorized domains** ← Add domain: `davidcohenaaa.github.io` (או הדומיין שלכם).
4. Build ← **Firestore Database** ← Create database ← מצב Production, אזור קרוב (למשל europe-west).
5. Firestore ← **Rules** ← הדביקו ופרסמו:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

6. Project settings (גלגל שיניים) ← Your apps ← **Web** (`</>`) ← Register app ← העתיקו את אובייקט ה-`firebaseConfig`.
7. הדביקו אותו ב-`js/firebase-config.js` במקום `null`, ודחפו לריפו. אל תדביקו מפתחות סודיים: ערכי ה-config של אפליקציית Web ציבוריים בעיצובם והגנת המידע נעשית בכללים שלמעלה.
8. באתר: "על הקורס והגדרות" ← "התחברות עם Google".

אופציונלי, כדי שרק אתם תוכלו לכתוב: בכלל, הוסיפו `&& request.auth.token.email == "המייל-שלכם@gmail.com"`.
