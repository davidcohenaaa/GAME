// ניהול התקדמות: שמירה ב-localStorage וחישוב אחוזים (4 רמות)
(function () {
  var KEY = "seogeo.progress.v1";
  var PASS_LESSON = 70;
  var PASS_EXAM = 70;
  var WEIGHTS = { lessons: 50, exams: 20, finals: 15, milestones: 15 };

  var memory = null; // גיבוי כשה-localStorage חסום

  function empty() {
    return { lessons: {}, exams: {}, finals: {}, milestones: {}, history: [], days: [], name: "" };
  }

  function migrate(s) {
    var out = Object.assign(empty(), s);
    // גרסה ישנה: מבחן מסכם יחיד (על רמות 1-2). מעבירים לרמות 1 ו-2
    if (s && typeof s.final === "number" && s.final > 0 && (!s.finals || !Object.keys(s.finals).length)) {
      out.finals = { l1: s.final, l2: s.final };
    }
    delete out.final;
    return out;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) {}
    return empty();
  }

  var state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      memory = state; // ממשיכים לעבוד בזיכרון בלבד
    }
  }

  function fmt(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function touchDay() {
    var t = fmt(new Date());
    if (state.days.indexOf(t) === -1) state.days.push(t);
  }

  function moduleById(id) {
    return window.CURRICULUM.find(function (m) { return m.id === id; });
  }

  function allLessons() {
    var out = [];
    window.CURRICULUM.forEach(function (m) {
      m.lessons.forEach(function (l) { out.push(l); });
    });
    return out;
  }

  var P = {
    PASS_LESSON: PASS_LESSON,
    PASS_EXAM: PASS_EXAM,
    WEIGHTS: WEIGHTS,
    state: function () { return state; },

    levels: function () { return window.LEVELS; },
    levelById: function (id) { return window.LEVELS.find(function (l) { return l.id === id; }); },
    levelModules: function (lv) { return lv.modules.map(moduleById); },
    levelOfModule: function (moduleId) {
      return window.LEVELS.find(function (l) { return l.modules.indexOf(moduleId) !== -1; });
    },
    prevLevel: function (lv) {
      var i = window.LEVELS.indexOf(lv);
      return i > 0 ? window.LEVELS[i - 1] : null;
    },

    recordLesson: function (id, pct) {
      touchDay();
      state.lessons[id] = Math.max(state.lessons[id] || 0, pct);
      state.history.push({ t: Date.now(), kind: "lesson", id: id, score: pct });
      save();
    },
    recordExam: function (moduleId, pct) {
      touchDay();
      state.exams[moduleId] = Math.max(state.exams[moduleId] || 0, pct);
      state.history.push({ t: Date.now(), kind: "exam", id: moduleId, score: pct });
      save();
    },
    recordFinal: function (levelId, pct) {
      touchDay();
      state.finals[levelId] = Math.max(state.finals[levelId] || 0, pct);
      state.history.push({ t: Date.now(), kind: "final", id: levelId, score: pct });
      save();
    },
    toggleMilestone: function (id) {
      touchDay();
      if (state.milestones[id]) delete state.milestones[id];
      else state.milestones[id] = Date.now();
      save();
    },
    setName: function (n) { state.name = n; save(); },

    lessonPassed: function (id) { return (state.lessons[id] || 0) >= PASS_LESSON; },
    examPassed: function (id) { return (state.exams[id] || 0) >= PASS_EXAM; },
    finalPassed: function (levelId) {
      var lv = P.levelById(levelId);
      return (state.finals[levelId] || 0) >= lv.pass;
    },
    lessonScore: function (id) {
      var s = state.lessons[id];
      return s == null ? "—" : s + "%";
    },

    // מבחני המודולים של הרמה עברו (תנאי לפתיחת מבחן הרמה)
    levelExamsPassed: function (lv) {
      return lv.modules.every(function (id) { return P.examPassed(id); });
    },

    // אחוז התקדמות של מודול: 70% שיעורים, 30% מבחן
    moduleProgress: function (m) {
      var done = m.lessons.filter(function (l) { return P.lessonPassed(l.id); }).length;
      var lessonsPart = done / m.lessons.length;
      var examPart = P.examPassed(m.id) ? 1 : 0;
      return Math.round((lessonsPart * 0.7 + examPart * 0.3) * 100);
    },

    // ספירות לרמה אחת (או לכל הקורס אם lv חסר)
    counts: function (lv) {
      var levels = lv ? [lv] : window.LEVELS;
      var c = { lessonsDone: 0, lessonsTotal: 0, examsDone: 0, examsTotal: 0, finalsDone: 0, finalsTotal: levels.length, msDone: 0, msTotal: 0 };
      levels.forEach(function (l) {
        P.levelModules(l).forEach(function (m) {
          m.lessons.forEach(function (ls) {
            c.lessonsTotal++;
            if (P.lessonPassed(ls.id)) c.lessonsDone++;
          });
          c.examsTotal++;
          if (P.examPassed(m.id)) c.examsDone++;
        });
        if (P.finalPassed(l.id)) c.finalsDone++;
        l.milestones.forEach(function (ms) {
          c.msTotal++;
          if (state.milestones[ms.id]) c.msDone++;
        });
      });
      return c;
    },

    // אחוז משוקלל: שיעורים 50, מבחני מודולים 20, מבחני רמה 15, אבני דרך 15
    percent: function (lv) {
      var c = P.counts(lv);
      var pct =
        (c.lessonsDone / c.lessonsTotal) * WEIGHTS.lessons +
        (c.examsDone / c.examsTotal) * WEIGHTS.exams +
        (c.finalsDone / c.finalsTotal) * WEIGHTS.finals +
        (c.msDone / c.msTotal) * WEIGHTS.milestones;
      return Math.round(pct);
    },
    overall: function () { return P.percent(); },
    levelProgress: function (lv) { return P.percent(lv); },
    levelComplete: function (lv) { return P.percent(lv) === 100; },

    // רצף ימים רצופים של למידה (נספר גם אם היום עדיין לא למדו)
    streak: function () {
      var set = {};
      state.days.forEach(function (d) { set[d] = true; });
      var d = new Date();
      if (!set[fmt(d)]) d.setDate(d.getDate() - 1);
      var n = 0;
      while (set[fmt(d)]) {
        n++;
        d.setDate(d.getDate() - 1);
      }
      return n;
    },

    // הצעד הבא: שיעור, אחר כך מבחן מודול, מבחן רמה, אבן דרך
    nextAction: function () {
      for (var i = 0; i < window.LEVELS.length; i++) {
        var lv = window.LEVELS[i];
        var mods = P.levelModules(lv);
        for (var j = 0; j < mods.length; j++) {
          var m = mods[j];
          for (var k = 0; k < m.lessons.length; k++) {
            if (!P.lessonPassed(m.lessons[k].id)) {
              return { href: "#/lesson/" + m.lessons[k].id, label: "המשך: " + m.lessons[k].title };
            }
          }
          if (!P.examPassed(m.id)) return { href: "#/exam/" + m.id, label: "מבחן: " + m.title };
        }
        if (!P.finalPassed(lv.id)) return { href: "#/final/" + lv.id, label: "מבחן " + lv.short };
        for (var q = 0; q < lv.milestones.length; q++) {
          if (!state.milestones[lv.milestones[q].id]) return { href: "#/level/" + lv.id, label: "אבני דרך מעשיות: " + lv.short };
        }
      }
      return null;
    },

    exportJSON: function () { return JSON.stringify(state); },
    importJSON: function (text) {
      var s = JSON.parse(text);
      if (!s || typeof s !== "object" || !s.lessons || !s.exams) throw new Error("bad file");
      state = migrate(s);
      save();
    },
    reset: function () {
      state = empty();
      memory = null;
      try { localStorage.removeItem(KEY); } catch (e) {}
    },

    allLessons: allLessons
  };

  window.Progress = P;
})();
