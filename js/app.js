// ניווט ורינדור
(function () {
  var C = window.CURRICULUM;
  var P = window.Progress;
  var esc = window.Charts.esc;
  var main = document.getElementById("main");
  var nav = document.getElementById("nav");
  var headerPct = document.getElementById("header-pct");

  function moduleById(id) { return C.find(function (m) { return m.id === id; }); }
  function lessonById(id) {
    for (var i = 0; i < C.length; i++) {
      for (var j = 0; j < C[i].lessons.length; j++) {
        if (C[i].lessons[j].id === id) return { m: C[i], l: C[i].lessons[j], i: j };
      }
    }
    return null;
  }
  function moduleNumber(id) { return C.findIndex(function (m) { return m.id === id; }) + 1; }

  // באנר "מומלץ לסיים קודם" כשהרמה הקודמת עוד לא הושלמה
  function prevLevelNote(lv) {
    var prev = P.prevLevel(lv);
    if (!prev || P.finalPassed(prev.id)) return "";
    return '<div class="note">מומלץ לסיים קודם את <a href="#/level/' + prev.id + '">' + esc(prev.name) +
      "</a> (כולל מבחן הרמה). אפשר להמשיך גם בלי, אבל החומר כאן בנוי על הקודם.</div>";
  }

  function renderNav() {
    var route = location.hash || "#/";
    var html = '<a class="nav-link' + (route === "#/" ? " active" : "") + '" href="#/">📊 לוח התקדמות</a>';
    P.levels().forEach(function (lv) {
      var lp = P.levelProgress(lv);
      html += '<a class="nav-level' + (route === "#/level/" + lv.id ? " active" : "") + '" href="#/level/' + lv.id + '"><span>' +
        lv.icon + " " + esc(lv.name) + '</span><span class="badge' + (lp === 100 ? " full" : "") + '">' + lp + "%</span></a>";
      P.levelModules(lv).forEach(function (m) {
        var pct = P.moduleProgress(m);
        var active = route.indexOf("#/module/" + m.id) === 0 || route.indexOf("#/lesson/" + m.id) === 0 || route === "#/exam/" + m.id;
        html += '<a class="nav-link sub' + (active ? " active" : "") + '" href="#/module/' + m.id + '"><span>' + m.icon + " " +
          moduleNumber(m.id) + ". " + esc(m.title) + '</span><span class="badge' + (pct === 100 ? " full" : "") + '">' + pct + "%</span></a>";
      });
      html += '<a class="nav-link sub' + (route === "#/final/" + lv.id ? " active" : "") + '" href="#/final/' + lv.id + '">🏁 מבחן ' + esc(lv.short) +
        (P.finalPassed(lv.id) ? ' <span class="badge full">✔</span>' : "") + "</a>";
    });
    html += '<a class="nav-link' + (route === "#/about" ? " active" : "") + '" href="#/about">ℹ️ על הקורס והגדרות</a>';
    nav.innerHTML = html;
    var o = P.overall();
    headerPct.textContent = o + "%";
    document.getElementById("header-bar").style.width = o + "%";
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
    var next = P.nextAction();
    var html = "<h1>לוח התקדמות</h1>";
    html += '<section class="card hero"><div class="hero-ring">' + window.Charts.ring(overall, "התקדמות כללית") + "</div>";
    html += '<div class="hero-info"><h2>' + (overall === 100 ? "סיימתם את כל המסלול! 🎓" : "ממשיכים ללמוד") + "</h2>";
    html += '<ul class="stats">' +
      "<li><b>" + c.lessonsDone + "/" + c.lessonsTotal + "</b> שיעורים הושלמו</li>" +
      "<li><b>" + c.examsDone + "/" + c.examsTotal + "</b> מבחני מודולים עברו</li>" +
      "<li><b>" + c.finalsDone + "/" + c.finalsTotal + "</b> מבחני רמה עברו</li>" +
      "<li><b>" + c.msDone + "/" + c.msTotal + "</b> אבני דרך מעשיות</li>" +
      "<li><b>" + P.streak() + "</b> ימי למידה ברצף</li></ul>";
    if (next) html += '<a class="btn primary" href="' + next.href + '">' + esc(next.label) + "</a>";
    html += "</div></section>";

    html += '<section class="card"><h2>הרמות שלכם</h2><div class="levels-grid">';
    P.levels().forEach(function (lv) {
      var lp = P.levelProgress(lv);
      html += '<a class="level-card" href="#/level/' + lv.id + '"><div class="level-ring">' + window.Charts.ring(lp, lv.short) + "</div>" +
        "<b>" + lv.icon + " " + esc(lv.name) + "</b><span class='muted'>" + (lp === 100 ? "הושלמה ✔" : esc(lv.summary)) + "</span></a>";
    });
    html += "</div></section>";

    html += '<section class="card"><h2>התקדמות לפי מודול</h2>' +
      window.Charts.bars(C.map(function (m, i) { return { label: (i + 1) + ". " + m.title, value: P.moduleProgress(m) }; })) + "</section>";

    var hist = P.state().history.map(function (h) {
      var lab = h.kind === "final" ? "מבחן רמה" : h.kind === "exam" ? "מבחן מודול" : "חידון שיעור";
      return { score: h.score, label: lab + " – " + new Date(h.t).toLocaleDateString("he-IL") };
    });
    html += '<section class="card"><h2>ציונים לאורך זמן</h2>' + window.Charts.line(hist) + "</section>";

    var w = P.WEIGHTS;
    html += '<section class="card"><h2>איך מחושב האחוז?</h2><ul class="plain">' +
      "<li><b>" + w.lessons + "%</b> – שיעורים שעברתם בחידון (מינימום " + P.PASS_LESSON + "%)</li>" +
      "<li><b>" + w.exams + "%</b> – מבחני מודולים (מינימום " + P.PASS_EXAM + "%)</li>" +
      "<li><b>" + w.finals + "%</b> – מבחני רמה (80%, ובמומחה 85%)</li>" +
      "<li><b>" + w.milestones + "%</b> – אבני דרך מעשיות שסימנתם כבוצעו</li></ul>" +
      '<p class="muted">100% = כל הרמות הושלמו. אבני הדרך נמדדות בסימון עצמי, כי מומחיות נבנית בעבודה אמיתית ולא רק בלימוד.</p></section>';
    view(html);
  }

  // ---------- עמוד רמה ----------
  function levelPage(id) {
    var lv = P.levelById(id);
    if (!lv) return dashboard();
    var lp = P.levelProgress(lv);
    var c = P.counts(lv);
    var html = '<p class="crumbs"><a href="#/">לוח התקדמות</a> › ' + esc(lv.name) + "</p>";
    html += "<h1>" + lv.icon + " " + esc(lv.name) + "</h1><p class='lead'>" + esc(lv.summary) + "</p>";
    html += prevLevelNote(lv);
    html += '<div class="progress-line"><div style="width:' + lp + '%"></div></div><p class="muted">' + lp + "% · " + c.lessonsDone + "/" + c.lessonsTotal +
      " שיעורים · " + c.examsDone + "/" + c.examsTotal + " מבחני מודולים · " + (P.finalPassed(lv.id) ? "מבחן רמה עבר" : "מבחן רמה טרם") + "</p>";

    html += '<section class="card"><h2>מודולים</h2><ol class="lesson-list">';
    P.levelModules(lv).forEach(function (m) {
      var pct = P.moduleProgress(m);
      html += '<li class="' + (pct === 100 ? "done" : "") + '"><a href="#/module/' + m.id + '"><span class="check">' + (pct === 100 ? "✔" : m.icon) + "</span>" +
        '<span class="lt">' + moduleNumber(m.id) + ". " + esc(m.title) + '</span><span class="muted">' + m.lessons.length + " שיעורים · " + pct + "%</span></a></li>";
    });
    html += "</ol></section>";

    html += '<section class="card"><h2>מבחן הרמה</h2><p>' + lv.finalCount + " שאלות אקראיות מחומר הרמה · מעבר ב-" + lv.pass + "%" +
      (P.state().finals[lv.id] != null ? " · הציון הטוב ביותר: <b>" + P.state().finals[lv.id] + "%</b>" + (P.finalPassed(lv.id) ? " ✔" : "") : "") + "</p>" +
      '<a class="btn primary" href="#/final/' + lv.id + '">' + (P.state().finals[lv.id] != null ? "לנסות שוב" : "למבחן הרמה") + "</a></section>";

    html += '<section class="card"><h2>אבני דרך מעשיות</h2><p class="muted">סמנו כשביצעתם בפועל. אלה ' + P.WEIGHTS.milestones + '% מהאחוז הכללי, ובלעדיהן אי אפשר להגיע ל-100%.</p><ul class="milestones">';
    lv.milestones.forEach(function (ms) {
      var done = !!P.state().milestones[ms.id];
      html += '<li><label><input type="checkbox" data-ms="' + ms.id + '"' + (done ? " checked" : "") + "> <span>" + esc(ms.text) + "</span></label></li>";
    });
    html += "</ul></section>";

    html += '<section class="card"><h2>תעודה</h2>' + (lp === 100
      ? '<p>הרמה הושלמה!</p><a class="btn primary" href="#/cert/' + lv.id + '">🎓 לתעודה</a>'
      : '<p class="muted">התעודה נפתחת כשהרמה מגיעה ל-100% (שיעורים, מבחנים, מבחן רמה ואבני דרך). כרגע: ' + lp + "%.</p>") + "</section>";
    view(html);
    main.querySelectorAll("input[data-ms]").forEach(function (box) {
      box.addEventListener("change", function () {
        P.toggleMilestone(box.getAttribute("data-ms"));
        levelPage(id);
      });
    });
  }

  // ---------- מודול ----------
  function modulePage(id) {
    var m = moduleById(id);
    if (!m) return dashboard();
    var lv = P.levelOfModule(m.id);
    var html = '<p class="crumbs"><a href="#/">לוח התקדמות</a> › <a href="#/level/' + lv.id + '">' + esc(lv.short) + "</a> › " + esc(m.title) + "</p>";
    html += "<h1>" + m.icon + " " + esc(m.title) + "</h1><p class='lead'>" + esc(m.summary) + "</p>";
    html += prevLevelNote(lv);
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

  // ---------- מבחן רמה ----------
  function finalPage(levelId) {
    var lv = P.levelById(levelId);
    if (!lv) return dashboard();
    var html = '<p class="crumbs"><a href="#/">לוח התקדמות</a> › <a href="#/level/' + lv.id + '">' + esc(lv.short) + "</a> › מבחן רמה</p><h1>🏁 מבחן " + esc(lv.short) + "</h1>";
    if (!P.levelExamsPassed(lv)) {
      html += '<div class="note">מבחן הרמה נפתח אחרי שעוברים את כל מבחני המודולים של הרמה. נותרו: ' +
        P.levelModules(lv).filter(function (m) { return !P.examPassed(m.id); }).map(function (m) { return esc(m.title); }).join(", ") + ".</div>";
      return view(html);
    }
    var best = P.state().finals[lv.id];
    html += '<p class="muted">' + lv.finalCount + " שאלות אקראיות מחומר הרמה · מעבר ב-" + lv.pass + "%" + (best != null ? " · הציון הטוב ביותר: <b>" + best + "%</b>" : "") + "</p>";
    html += '<section class="card"><div id="quiz"></div></section>';
    view(html);
    window.Quiz.render(document.getElementById("quiz"), window.Quiz.finalPool(lv, lv.finalCount), {
      pass: lv.pass,
      onDone: function (pct) { P.recordFinal(lv.id, pct); renderNav(); }
    });
  }

  // ---------- תעודה ----------
  function certPage(levelId) {
    var lv = P.levelById(levelId || "l2") || P.levelById("l2");
    if (!P.levelComplete(lv)) {
      return view('<h1>תעודה</h1><div class="note">התעודה של "' + esc(lv.name) + '" נפתחת ב-100% ברמה. כרגע: ' + P.levelProgress(lv) +
        '%. <a href="#/level/' + lv.id + '">לעמוד הרמה</a></div>');
    }
    var name = P.state().name || "";
    var html = '<h1 class="no-print">🎓 ' + esc(lv.certTitle) + "</h1>" +
      '<div class="card no-print"><label>השם לתעודה: <input id="cert-name" type="text" value="' + esc(name) + '" placeholder="השם שלכם"></label> ' +
      '<button class="btn" id="cert-print">הדפסה / שמירה כ-PDF</button></div>' +
      '<section class="cert" id="cert"><div class="cert-inner"><p class="cert-top">תעודת סיום</p><h2>' + esc(lv.certTitle) + "</h2>" +
      '<p>מוענקת ל</p><p class="cert-name" id="cert-name-out">' + esc(name || "________") + "</p>" +
      "<p>" + esc(lv.certNote) + '</p><p class="muted">' + new Date().toLocaleDateString("he-IL") + "</p>" +
      '<p class="muted small">תעודה פנימית של האתר, אינה הסמכה רשמית.</p></div></section>';
    if (lv.id === "l2") {
      html += '<section class="card no-print"><h2>צעדים ראשונים ללקוח הראשון</h2><ol class="steps">' +
        "<li>בצעו ביקורת SEO+GEO על אתר אמיתי (שלכם או של חבר) ותעדו לפני/אחרי.</li>" +
        "<li>בנו אתר או עמוד אישי עם שירותים, אודות ודוגמת ביקורת.</li>" +
        "<li>הכינו הצעת מחיר של עמוד אחד לביקורת במחיר קבוע.</li>" +
        "<li>פנו ל-10 עסקים מקומיים עם ממצא אחד אישי כל אחד.</li>" +
        "<li>הגדירו חוזה בסיסי: היקף, תשלום, בלי הבטחת דירוג (מומלץ ייעוץ משפטי).</li>" +
        "<li>אספו המלצה ופרסמו מקרה בוחן.</li></ol>" +
        '<p class="muted">האתר הזה נותן בסיס ידע. הוא אינו הסמכה רשמית ואינו מבטיח הכנסה.</p></section>';
    }
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
      '<section class="card"><h2>מה הקורס נותן</h2><p>4 רמות, ' + C.length + " מודולים ו-" + P.allLessons().length + " שיעורים עם חידונים, מבחן לכל מודול, מבחן לכל רמה ואבני דרך מעשיות. נכתב כבסיס לימודי בעברית ל-SEO ול-GEO, עד רמת מומחה.</p>" +
      "<p><b>גילוי נאות:</b> התחום משתנה במהירות, ובפרט GEO. בדקו מידע מול מקורות רשמיים (Google Search Central ותיעוד של מערכות AI). אין כאן הבטחה להכנסה, וקורס לבדו אינו הופך למומחה: מומחיות נבנית בפרויקטים אמיתיים.</p></section>" +
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
      case "level": return levelPage(parts[1]);
      case "module": return modulePage(parts[1]);
      case "lesson": return lessonPage(parts[1]);
      case "exam": return examPage(parts[1]);
      case "final": return finalPage(parts[1]);
      case "cert": return certPage(parts[1]);
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
