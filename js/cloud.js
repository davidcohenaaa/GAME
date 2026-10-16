// סנכרון התקדמות בענן עם Firebase (התחברות Google + Firestore). פעיל רק אם הוגדר FIREBASE_CONFIG
// ורק מחוץ ל-claude.ai (שם משתמשים במאגר של הדף עצמו, ראו sync.js).
(function () {
  var P = window.Progress;
  var cfg = window.FIREBASE_CONFIG;
  if (!P || !cfg || window.claude) return;

  var V = "10.12.2";
  var BASE = "https://www.gstatic.com/firebasejs/" + V + "/";
  var Cloud = { status: "loading", email: "", error: "" };
  window.Cloud = Cloud;

  function emit(name) { try { window.dispatchEvent(new Event(name)); } catch (e) {} }
  function setStatus(s, extra) {
    Cloud.status = s;
    Cloud.error = extra || "";
    emit("cloud-status");
  }
  function load(src) {
    return new Promise(function (ok, fail) {
      var el = document.createElement("script");
      el.src = src;
      el.onload = ok;
      el.onerror = function () { fail(new Error("load " + src)); };
      document.head.appendChild(el);
    });
  }

  var hooked = false;
  var timer = null;

  (async function () {
    try {
      await load(BASE + "firebase-app-compat.js");
      await load(BASE + "firebase-auth-compat.js");
      await load(BASE + "firebase-firestore-compat.js");
      var app = window.firebase.initializeApp(cfg);
      var auth = window.firebase.auth(app);
      var store = window.firebase.firestore(app);

      Cloud.signIn = function () {
        var provider = new window.firebase.auth.GoogleAuthProvider();
        return auth.signInWithPopup(provider).catch(function (err) {
          if (err && (err.code === "auth/popup-blocked" || err.code === "auth/cancelled-popup-request")) {
            return auth.signInWithRedirect(provider);
          }
          setStatus("signedout", err && err.code ? err.code : "signin");
        });
      };
      Cloud.signOut = function () { return auth.signOut(); };

      auth.onAuthStateChanged(function (user) {
        if (!user) {
          Cloud.email = "";
          setStatus("signedout");
          return;
        }
        Cloud.email = user.email || "";
        var ref = store.collection("users").doc(user.uid);
        var push = function () {
          return ref.set({ state: JSON.stringify(P.state()), updated: Date.now() }).catch(function () { setStatus("error", "save"); });
        };
        ref.get().then(function (snap) {
          var body = snap.exists ? snap.data() : null;
          if (body && typeof body.state === "string") {
            try { P.merge(JSON.parse(body.state)); } catch (e) {}
          }
          if (!hooked) {
            hooked = true;
            P.onSave(function () {
              clearTimeout(timer);
              timer = setTimeout(push, 1500);
            });
          }
          return push();
        }).then(function () {
          setStatus("signedin");
          emit("progress-synced");
        }).catch(function () { setStatus("error", "load"); });
      });
    } catch (e) {
      setStatus("error", "init");
    }
  })();
})();
