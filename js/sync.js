// סנכרון התקדמות בין מכשירים דרך מאגר הנתונים של הדף (אם זמין), ללא תלות בו
(function () {
  var P = window.Progress;
  if (!P || !window.claude || typeof window.claude.use !== "function") return;

  (async function () {
    try {
      var db = await window.claude.use("db");
      var user = await window.claude.use("user");
      if (!db || !user) return;
      var id = await user.id();
      if (!id) return;
      var ref = db.doc("data/users/" + id + "/progress");

      var snap = await ref.get();
      var body = snap.exists ? snap.data() : null;
      if (body && typeof body.state === "string") {
        try { P.merge(JSON.parse(body.state)); } catch (e) {}
      }

      var timer = null;
      var push = function () {
        ref.set({ state: JSON.stringify(P.state()), updated: Date.now() }).catch(function () {});
      };
      P.onSave(function () {
        clearTimeout(timer);
        timer = setTimeout(push, 1500);
      });
      push();
      window.dispatchEvent(new Event("progress-synced"));
    } catch (e) {
      /* אין מאגר או אין הרשאה: ממשיכים עם השמירה בדפדפן בלבד */
    }
  })();
})();
