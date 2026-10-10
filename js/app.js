// ניווט ורינדור
(function () {
  var C = window.CURRICULUM;
  var P = window.Progress;
  var esc = window.Charts.esc;
  var main = document.getElementById("main");
  var nav = document.getElementById("nav");
  var headerPct = document.getElementById("header-pct");
  var FINAL_COUNT = 30;

  function moduleById(id) { return C.find(function (m) { return m.id === id; }); }
  function lessonById(id) {
    for (var i = 0; i < C.length; i++) {
      for (var j = 0; j < C[i].lessons.length; j++) {
        if (C[i].lessons[j].id === id) return { m: C[i], l: C[i].lessons[j], i: j };
      }
    }
    return null;
  }

  function renderNav() {
    var route = location.hash;
    var html = '<a class="nav-link' + (route === "" || route === "#/" ? " active" : "") + '" href="#/">📊 לוח התקדמות</a>';
    C.forEach(function (m, idx) {
      var pct = P.moduleProgress(m);
      html += '<a class="nav-link' + (route.indexOf("#/module/" + m.id) === 0 || route.indexOf("#/lesson/" + m.id) === 0 || route === "#/exam/" + m.id ? " active" : "") +
        '" href="#/module/' + m.id + '"><span>' + m.icon + " " + (idx + 1) + ". " + esc(m.title) +
        '</span><span class="badge' + (pct === 100 ? " full" : "") + '">' + pct + "%</span></a>";
    });
    html += '<a class="nav-link' + (route === "#/final" ? " active" : "") + '" href="#/final">🏁 מבחן מסכם' +
      (P.finalPassed() ? ' <span class="badge full">✔</span>' : "") + "</a>";
    html += '<a class="nav-link' + (route === "#/about" ? " active" : "") + '" href="#/about">ℹ️ על הקורס והגדרות</a>';
    nav.innerHTML = html;
    headerPct.textContent = P.overall() + "%";
    document.getElementById("header-bar").style.width = P.overall() + "%";
  }

  function view(html) {
    main.innerHTML = html;
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    renderNav();
  }

  // ---------- לוח התקדמות ----------
  function dashboard() {
    var c = P.counts();
    var overall = P.overall();
    var next = P.nextLesson();
    var html = '<h1>לוח התקדמות</h1>';
    html += '<section class="card hero"><div class="hero-ring">' + window.Charts.ring(overall, "התקדמות כללית") + "</div>";
    html += '<div class="hero-info"><h2>' + (overall === 100 ? "סיימתם את הקורס! 🎓" : "ממשיכים ללמוד") + "</h2>";
    html += '<ul class="stats">' +
      "<li><b>" + c.lessonsDone + "/" + c.lessonsTotal + "</b> שיעורים הושלמו</li>" +
      "<li><b>" + c.examsDone + "/" + c.examsTotal + "</b> מבחני מודולים עברו</li>" +
      "<li><b>" + (c.finalDone ? "עבר" : "טרם") + "</b> מבחן מסכם</li>" +
      "<li><b>" + P.streak() + "</b> ימי למידה ברצף</li></ul>";
    if (overall === 100) {
      html += '<a class="btn primary" href="#/cert">🎓 לתעודת המוכנות</a>';
    } else if (next) {
      html += '<a class="btn primary" href="#/lesson/' + next.id + '">המשך: ' + esc(next.title) + "</a>";
    } else if (!P.allModulesPassed()) {
      html += '<p class="muted">נשארו מבחני מודולים לעבור.</p>';
    } else {
      html += '<a class="btn primary" href="#/final">למבחן המסכם</a>';
    }
    html += "</div></section>";

    html += '<section class="card"><h2>התקדמות לפי מודול</h2>' +
      window.Charts.bars(C.map(function (m, i) { return { label: (i + 1) + ". " + m.title, value: P.moduleProgress(m) }; })) + "</section>";

    var hist = P.state().history.filter(function (h) { return h.kind !== "lesson" || true; }).map(function (h) {
      var lab = h.kind === "final" ? "מבחן מסכם" : h.kind === "exam" ? "מבחן מודול" : "חידון שיעור";
      return { score: h.score, label: lab + " – " + new Date(h.t).toLocaleDateString("he-IL") };
    });
    html += '<section class="card"><h2>ציונים לאורך זמן</h2>' + window.Charts.line(hist) + "</section>";

    html += '<section class="card"><h2>איך מחושב האחוז?</h2><ul class="plain">' +
      "<li><b>" + P.WEIGHTS.lessons + "%</b> – שיעורים שעברתם בחידון (מינימום " + P.PASS_LESSON + "%)</li>" +
      "<li><b>" + P.WEIGHTS.exams + "%</b> – מבחני מודולים (מינימום " + P.PASS_EXAM + "%)</li>" +
      "<li><b>" + P.WEIGHTS.final + "%</b> – מבחן מסכם (מינימום " + P.PASS_FINAL + "%)</li></ul>" +
      '<p class="muted">100% = כל השיעורים, כל מבחני המודולים והמבחן המסכם. אז תקבלו תעודת מוכנות וצ׳קליסט ללקוח ראשון.</p></section>';
    view(html);
  }

  // ---------- מודול ----------
  function modulePage(id) {
    var m = moduleById(id);
    if (!m) return dashboard();
    var html = '<p class="crumbs"><a href="#/">לוח התקדמות</a> › ' + esc(m.title) + "</p>";
    html += "<h1>" + m.icon + " " + esc(m.title) + "</h1><p class='lead'>" + esc(m.summary) + "</p>";
    html += '<div class="progress-line"><div style="width:' + P.moduleProgress(m) + '%"></div></div>';
    html += '<ol class="lesson-list">';
    m.lessons.forEach(function (l) {
      var ok = P.lessonPassed(l.id);
      html += '<li class="' + (ok ? "done" : "") + '"><a href="#/lesson/' + l.id + '"><span class="check">' + (ok ? "✔" : "○") + "</span>" +
        "<span class='lt'>" + esc(l.title) + '</span><span class="muted">' + l.minutes + " דק׳ · חידון " + P.lessonScore(l.id) + "</span></a></li>";
    });
    html += "</ol>";
    var best = P.state().exams[m.id];
    html += '<section class="card"><h2>מבחן מודול</h2><p>' + m.exam.length + " שאלות · מעבר ב-" + P.PASS_EXAM + "%" +
      (best != null ? " · הציון הטוב ביותר: <b>" + best + "%</b>" + (P.examPassed(m.id) ? " ✔" : "") : "") + "</p>" +
      '<a class="btn primary" href="#/exam/' + m.id + '">' + (best != null ? "לנסות שוב" : "התחלת מבחן") + "</a></section>";
    view(html);
  }
  P.lessonScore = function (id) {
    var s = P.state().lessons[id];
    return s == null ? "—" : s + "%";
  };

  // ---------- שיעור ----------
  function lessonPage(id) {
    var f = lessonById(id);
    if (!f) return dashboard();
    var m = f.m, l = f.l;
    var prev = m.lessons[f.i - 1], nxt = m.lessons[f.i + 1];
    var html = '<p class="crumbs"><a href="#/">לוח התקדמות</a> › <a href="#/module/' + m.id + '">' + esc(m.title) + "</a> › " + esc(l.title) + "</p>";
    html += "<h1>" + esc(l.title) + '</h1><p class="muted">' + l.minutes + " דקות קריאה" + (P.lessonPassed(l.id) ? " · ✔ הושלם" : "") + "</p>";
    html += '<article class="card lesson">' + l.html + "</article>";
    html += '<section class="card"><h2>חידון קצר</h2><p class="muted">עברו ב-' + P.PASS_LESSON + "% כדי להשלים את השיעור. אפשר לנסות שוב ללא הגבלה.</p>" +
      '<div id="quiz"></div></section>';
    html += '<nav class="pager">' +
      (prev ? '<a class="btn" href="#/lesson/' + prev.id + '">→ ' + esc(prev.title) + "</a>" : "<span></span>") +
      (nxt ? '<a class="btn" href="#/lesson/' + nxt.id + '">' + esc(nxt.title) + " ←</a>" : '<a class="btn" href="#/exam/' + m.id + '">למבחן המודול ←</a>') + "</nav>";
    view(html);
    window.Quiz.render(document.getElementById("quiz"), l.quiz, {
      pass: P.PASS_LESSON,
      onDone: function (pct) { P.recordLesson(l.id, pct); renderNav(); }
    });
  }

  // ---------- מבחן מודול ----------
  function examPage(id) {
    var m = moduleById(id);
    if (!m) return dashboard();
    var html = '<p class="crumbs"><a href="#/">לוח התקדמות</a> › <a href="#/module/' + m.id + '">' + esc(m.title) + "</a> › מבחן</p>";
    html += "<h1>מבחן: " + esc(m.title) + '</h1><p class="muted">' + m.exam.length + " שאלות · מעבר ב-" + P.PASS_EXAM + "%</p>";
    var unfinished = m.lessons.filter(function (l) { return !P.lessonPassed(l.id); }).length;
    if (unfinished) html += '<div class="note">שימו לב: ' + unfinished + " שיעורים במודול עוד לא הושלמו. מומלץ ללמוד אותם קודם.</div>";
    html += '<section class="card"><div id="quiz"></div></section>';
    view(html);
    window.Quiz.render(document.getElementById("quiz"), m.exam, {
      pass: P.PASS_EXAM,
      onDone: function (pct) { P.recordExam(m.id, pct); renderNav(); }
    });
  }

  // ---------- מבחן מסכם ----------
  function finalPage() {
    var html = '<p class="crumbs"><a href="#/">לוח התקדמות</a> › מבחן מסכם</p><h1>🏁 מבחן מסכם</h1>';
    if (!P.allModulesPassed()) {
      html += '<div class="note">המבחן המסכם נפתח לאחר שעברתם את כל מבחני המודולים. נותרו: ' +
        C.filter(function (m) { return !P.examPassed(m.id); }).map(function (m) { return esc(m.title); }).join(", ") + ".</div>";
      return view(html);
    }
    html += '<p class="muted">' + FINAL_COUNT + " שאלות אקראיות מכל החומר · מעבר ב-" + P.PASS_FINAL + "%" +
      (P.state().final ? " · הציון הטוב ביותר: <b>" + P.state().final + "%</b>" : "") + "</p>";
    html += '<section class="card"><div id="quiz"></div></section>';
    view(html);
    window.Quiz.render(document.getElementById("quiz"), window.Quiz.finalPool(FINAL_COUNT), {
      pass: P.PASS_FINAL,
      onDone: function (pct) { P.recordFinal(pct); renderNav(); }
    });
  }

  // ---------- תעודה ----------
  function certPage() {
    if (P.overall() < 100) {
      return view('<h1>תעודת מוכנות</h1><div class="note">התעודה נפתחת ב-100%. כרגע: ' + P.overall() + "%.</div>");
    }
    var name = P.state().name || "";
    var html = '<h1 class="no-print">🎓 תעודת מוכנות</h1>' +
      '<div class="card no-print"><label>השם לתעודה: <input id="cert-name" type="text" value="' + esc(name) + '" placeholder="השם שלכם"></label> ' +
      '<button class="btn" id="cert-print">הדפסה / שמירה כ-PDF</button></div>' +
      '<section class="cert" id="cert"><div class="cert-inner"><p class="cert-top">תעודת סיום</p><h2>SEO ו-GEO – מהבסיס ועד פרויקט ראשון</h2>' +
      '<p>מוענקת ל</p><p class="cert-name" id="cert-name-out">' + esc(name || "________") + "</p>" +
      "<p>על השלמת כל השיעורים, מבחני המודולים והמבחן המסכם</p><p class=\"muted\">" + new Date().toLocaleDateString("he-IL") + "</p></div></section>" +
      '<section class="card no-print"><h2>צעדים ראשונים ללקוח הראשון</h2><ol class="steps">' +
      "<li>בצעו ביקורת SEO+GEO על אתר אמיתי (שלכם או של חבר) ותעדו לפני/אחרי.</li>" +
      "<li>בנו אתר או עמוד אישי עם שירותים, אודות ודוגמת ביקורת.</li>" +
      "<li>הכינו הצעת מחיר של עמוד אחד לביקורת במחיר קבוע.</li>" +
      "<li>פנו ל-10 עסקים מקומיים עם ממצא אחד אישי כל אחד.</li>" +
      "<li>הגדירו חוזה בסיסי: היקף, תשלום, בלי הבטחת דירוג (מומלץ ייעוץ משפטי).</li>" +
      "<li>אספו המלצה ופרסמו מקרה בוחן.</li></ol>" +
      '<p class="muted">האתר הזה נותן בסיס ידע. הוא אינו הסמכה רשמית ואינו מבטיח הכנסה.</p></section>';
    view(html);
    var input = document.getElementById("cert-name");
    input.addEventListener("input", function () {
      P.setName(input.value);
      document.getElementById("cert-name-out").textContent = input.value || "________";
    });
    document.getElementById("cert-print").addEventListener("click", function () { window.print(); });
  }

  // ---------- אודות והגדרות ----------
  function aboutPage() {
    var html = "<h1>על הקורס והגדרות</h1>" +
      '<section class="card"><h2>מה הקורס נותן</h2><p>9 מודולים, ' + P.allLessons().length + " שיעורים עם חידונים, מבחן לכל מודול ומבחן מסכם. נכתב כבסיס לימודי בעברית ל-SEO ול-GEO, כולל עבודה מול לקוחות.</p>" +
      "<p><b>גילוי נאות:</b> התחום משתנה במהירות, ובפרט GEO. בדקו מידע מול מקורות רשמיים (Google Search Central ותיעוד של מערכות AI). אין כאן הבטחה להכנסה.</p></section>" +
      '<section class="card"><h2>הנתונים שלכם</h2><p class="muted">ההתקדמות נשמרת בדפדפן הזה בלבד. כדי לעבור למכשיר אחר, ייצאו וייבאו קובץ.</p>' +
      '<div class="row"><button class="btn" id="exp">ייצוא התקדמות</button> <label class="btn">ייבוא<input id="imp" type="file" accept="application/json" hidden></label> ' +
      '<button class="btn danger" id="rst">איפוס הכל</button></div><p id="msg" class="muted" role="status"></p></section>';
    view(html);
    var msg = document.getElementById("msg");
    document.getElementById("exp").addEventListener("click", function () {
      var blob = new Blob([P.exportJSON()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "seo-geo-progress.json";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    document.getElementById("imp").addEventListener("change", function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { P.importJSON(r.result); msg.textContent = "ההתקדמות יובאה בהצלחה."; renderNav(); }
        catch (err) { msg.textContent = "הקובץ אינו תקין."; }
      };
      r.readAsText(f);
    });
    document.getElementById("rst").addEventListener("click", function () {
      if (confirm("למחוק את כל ההתקדמות? אי אפשר לבטל.")) { P.reset(); location.hash = "#/"; route(); }
    });
  }

  function route() {
    var h = location.hash || "#/";
    var parts = h.replace(/^#\//, "").split("/");
    switch (parts[0]) {
      case "module": return modulePage(parts[1]);
      case "lesson": return lessonPage(parts[1]);
      case "exam": return examPage(parts[1]);
      case "final": return finalPage();
      case "cert": return certPage();
      case "about": return aboutPage();
      default: return dashboard();
    }
  }

  document.getElementById("menu-btn").addEventListener("click", function () {
    document.body.classList.toggle("nav-open");
  });
  nav.addEventListener("click", function () { document.body.classList.remove("nav-open"); });
  window.addEventListener("hashchange", route);
  route();
})();
