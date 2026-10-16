// מנוע חידונים ומבחנים
(function () {
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // מכין שאלות: מערבב סדר שאלות ותשובות. correct = אינדקס התשובה הנכונה לאחר ערבוב
  function prepare(questions) {
    return shuffle(questions).map(function (q) {
      var opts = q.o.map(function (text, i) { return { text: text, ok: i === 0 }; });
      opts = shuffle(opts);
      return { q: q.q, e: q.e, opts: opts };
    });
  }

  // מרנדר חידון לתוך container. onDone(pct) נקרא לאחר שליחה.
  function render(container, questions, opts) {
    var prepared = prepare(questions);
    var esc = window.Charts.esc;
    var html = '<form class="quiz" novalidate>';
    prepared.forEach(function (q, qi) {
      html += '<fieldset class="q" data-q="' + qi + '"><legend><span class="qn">' + (qi + 1) + '.</span> ' + esc(q.q) + '</legend>';
      q.opts.forEach(function (o, oi) {
        html += '<label class="opt"><input type="radio" name="q' + qi + '" value="' + oi + '"><span>' + esc(o.text) + '</span></label>';
      });
      html += '<div class="explain" hidden></div></fieldset>';
    });
    html += '<div class="quiz-actions"><button type="submit" class="btn primary" disabled>בדיקת תשובות</button>' +
      '<span class="muted answered">0/' + prepared.length + ' נענו</span></div>' +
      '<div class="result" role="status" aria-live="polite"></div></form>';
    container.innerHTML = html;

    var form = container.querySelector("form");
    var submit = form.querySelector('button[type="submit"]');
    var counter = form.querySelector(".answered");
    var done = false;

    form.addEventListener("change", function () {
      var n = prepared.filter(function (_, i) { return form.querySelector('input[name="q' + i + '"]:checked'); }).length;
      counter.textContent = n + "/" + prepared.length + " נענו";
      submit.disabled = n < prepared.length;
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (done) return;
      done = true;
      var correct = 0;
      prepared.forEach(function (q, qi) {
        var fs = form.querySelector('fieldset[data-q="' + qi + '"]');
        var chosen = form.querySelector('input[name="q' + qi + '"]:checked');
        var ci = q.opts.findIndex(function (o) { return o.ok; });
        var isOk = chosen && Number(chosen.value) === ci;
        if (isOk) correct++;
        fs.classList.add(isOk ? "right" : "wrong");
        fs.querySelectorAll(".opt").forEach(function (lab, oi) {
          lab.querySelector("input").disabled = true;
          if (oi === ci) lab.classList.add("is-correct");
          else if (chosen && Number(chosen.value) === oi) lab.classList.add("is-wrong");
        });
        var ex = fs.querySelector(".explain");
        ex.hidden = false;
        ex.textContent = (isOk ? "✔ נכון. " : "✘ לא נכון. ") + (q.e || "");
      });
      var pct = Math.round((correct / prepared.length) * 100);
      var passed = pct >= opts.pass;
      submit.hidden = true;
      counter.hidden = true;
      var res = form.querySelector(".result");
      res.className = "result " + (passed ? "pass" : "fail");
      res.innerHTML =
        "<strong>" + correct + " מתוך " + prepared.length + " (" + pct + "%)</strong> – " +
        (passed ? "עברתם! 🎉" : "צריך " + opts.pass + "% לפחות. עברו על ההסברים ונסו שוב.") +
        '<div class="quiz-actions"><button type="button" class="btn retry">נסו שוב</button></div>';
      res.querySelector(".retry").addEventListener("click", function () {
        render(container, questions, opts);
        container.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      if (opts.onDone) opts.onDone(pct, passed);
    });
  }

  // מבחן רמה: דגימה אקראית מכל שאלות המודולים של הרמה
  function finalPool(level, n) {
    var pool = [];
    level.modules.forEach(function (id) {
      var m = window.CURRICULUM.find(function (x) { return x.id === id; });
      m.lessons.forEach(function (l) { pool = pool.concat(l.quiz); });
      pool = pool.concat(m.exam);
    });
    return shuffle(pool).slice(0, n);
  }

  window.Quiz = { render: render, finalPool: finalPool };
})();
