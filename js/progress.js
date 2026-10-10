// ניהול התקדמות: שמירה ב-localStorage וחישוב אחוזים
(function () {
  var KEY = "seogeo.progress.v1";
  var PASS_LESSON = 70;
  var PASS_EXAM = 70;
  var PASS_FINAL = 80;
  var WEIGHTS = { lessons: 60, exams: 25, final: 15 };

  var memory = null; // גיבוי כשה-localStorage חסום

  function empty() {
    return { lessons: {}, exams: {}, final: 0, history: [], days: [], name: "" };
  }

  function load() {
    if (memory) return memory;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        return Object.assign(empty(), s);
      }
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

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function touchDay() {
    var t = today();
    if (state.days.indexOf(t) === -1) state.days.push(t);
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
    PASS_FINAL: PASS_FINAL,
    WEIGHTS: WEIGHTS,
    state: function () { return state; },

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
    recordFinal: function (pct) {
      touchDay();
      state.final = Math.max(state.final || 0, pct);
      state.history.push({ t: Date.now(), kind: "final", id: "final", score: pct });
      save();
    },
    setName: function (n) { state.name = n; save(); },

    lessonPassed: function (id) { return (state.lessons[id] || 0) >= PASS_LESSON; },
    examPassed: function (id) { return (state.exams[id] || 0) >= PASS_EXAM; },
    finalPassed: function () { return (state.final || 0) >= PASS_FINAL; },

    // אחוז התקדמות של מודול: 70% שיעורים, 30% מבחן
    moduleProgress: function (m) {
      var done = m.lessons.filter(function (l) { return P.lessonPassed(l.id); }).length;
      var lessonsPart = done / m.lessons.length;
      var examPart = P.examPassed(m.id) ? 1 : 0;
      return Math.round((lessonsPart * 0.7 + examPart * 0.3) * 100);
    },

    counts: function () {
      var lessons = allLessons();
      var lessonsDone = lessons.filter(function (l) { return P.lessonPassed(l.id); }).length;
      var examsDone = window.CURRICULUM.filter(function (m) { return P.examPassed(m.id); }).length;
      return {
        lessonsDone: lessonsDone,
        lessonsTotal: lessons.length,
        examsDone: examsDone,
        examsTotal: window.CURRICULUM.length,
        finalDone: P.finalPassed()
      };
    },

    overall: function () {
      var c = P.counts();
      var pct =
        (c.lessonsDone / c.lessonsTotal) * WEIGHTS.lessons +
        (c.examsDone / c.examsTotal) * WEIGHTS.exams +
        (c.finalDone ? WEIGHTS.final : 0);
      return Math.round(pct);
    },

    // רצף ימים רצופים של למידה (נספר גם אם היום עדיין לא למדו)
    streak: function () {
      var set = {};
      state.days.forEach(function (d) { set[d] = true; });
      var d = new Date();
      var fmt = function (x) {
        return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
      };
      if (!set[fmt(d)]) d.setDate(d.getDate() - 1);
      var n = 0;
      while (set[fmt(d)]) {
        n++;
        d.setDate(d.getDate() - 1);
      }
      return n;
    },

    // הצעה לשיעור הבא שעוד לא הושלם
    nextLesson: function () {
      var lessons = allLessons();
      for (var i = 0; i < lessons.length; i++) {
        if (!P.lessonPassed(lessons[i].id)) return lessons[i];
      }
      return null;
    },

    allModulesPassed: function () {
      return window.CURRICULUM.every(function (m) { return P.examPassed(m.id); });
    },

    exportJSON: function () { return JSON.stringify(state); },
    importJSON: function (text) {
      var s = JSON.parse(text);
      if (!s || typeof s !== "object" || !s.lessons || !s.exams) throw new Error("bad file");
      state = Object.assign(empty(), s);
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
