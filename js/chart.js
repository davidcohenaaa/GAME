// גרפי SVG ידניים (בלי ספריות חיצוניות)
(function () {
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // טבעת אחוזים
  function ring(pct, label) {
    var r = 70, c = 2 * Math.PI * r;
    var off = c * (1 - pct / 100);
    return (
      '<svg class="ring" viewBox="0 0 180 180" role="img" aria-label="' + esc(label) + ": " + pct + '%">' +
      '<circle class="ring-bg" cx="90" cy="90" r="' + r + '" fill="none" stroke-width="16"/>' +
      '<circle class="ring-fg" cx="90" cy="90" r="' + r + '" fill="none" stroke-width="16" stroke-linecap="round"' +
      ' stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '" transform="rotate(-90 90 90)"/>' +
      '<text x="90" y="88" text-anchor="middle" class="ring-num">' + pct + '%</text>' +
      '<text x="90" y="112" text-anchor="middle" class="ring-lbl">' + esc(label) + '</text>' +
      '</svg>'
    );
  }

  // עמודות אופקיות: [{label, value}]
  function bars(items) {
    var rowH = 34, w = 520, labelW = 190, pad = 8;
    var h = items.length * rowH + pad * 2;
    var barW = w - labelW - 60;
    var out = '<svg class="bars" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="התקדמות לפי מודול">';
    items.forEach(function (it, i) {
      var y = pad + i * rowH;
      var bw = Math.max(0, Math.min(100, it.value)) / 100 * barW;
      // RTL: הטקסט בצד ימין, הפס גדל משמאל לימין מתחילת אזור הפס
      out += '<text x="' + (w - 4) + '" y="' + (y + 20) + '" text-anchor="end" class="bar-lbl">' + esc(it.label) + '</text>';
      out += '<rect x="40" y="' + (y + 6) + '" width="' + barW + '" height="16" rx="8" class="bar-bg"/>';
      if (bw > 0) out += '<rect x="' + (40 + barW - bw) + '" y="' + (y + 6) + '" width="' + bw + '" height="16" rx="8" class="bar-fg"/>';
      out += '<text x="34" y="' + (y + 19) + '" text-anchor="end" class="bar-val">' + it.value + '%</text>';
    });
    return out + "</svg>";
  }

  // גרף קו של ציונים: [{score, label}]
  function line(points) {
    var w = 520, h = 200, pl = 36, pr = 16, pt = 14, pb = 28;
    if (!points.length) return '<p class="muted">עוד אין ציונים. סיימו חידון כדי לראות גרף.</p>';
    var pts = points.slice(-20);
    var iw = w - pl - pr, ih = h - pt - pb;
    var step = pts.length > 1 ? iw / (pts.length - 1) : 0;
    var coords = pts.map(function (p, i) {
      // ציר זמן מימין לשמאל (RTL): ישן בימין
      var x = w - pr - (pts.length > 1 ? i * step : iw / 2);
      var y = pt + ih * (1 - p.score / 100);
      return [x, y, p];
    });
    var out = '<svg class="line" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="היסטוריית ציונים">';
    [0, 50, 100].forEach(function (g) {
      var y = pt + ih * (1 - g / 100);
      out += '<line x1="' + pl + '" x2="' + (w - pr) + '" y1="' + y + '" y2="' + y + '" class="grid"/>';
      out += '<text x="' + (pl - 6) + '" y="' + (y + 4) + '" text-anchor="end" class="axis">' + g + '</text>';
    });
    var d = coords.map(function (c, i) { return (i ? "L" : "M") + c[0].toFixed(1) + " " + c[1].toFixed(1); }).join(" ");
    out += '<path d="' + d + '" fill="none" class="line-path" stroke-width="2.5"/>';
    coords.forEach(function (c) {
      out += '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="4.5" class="dot"><title>' + esc(c[2].label) + ": " + c[2].score + '%</title></circle>';
    });
    return out + "</svg>";
  }

  window.Charts = { ring: ring, bars: bars, line: line, esc: esc };
})();
