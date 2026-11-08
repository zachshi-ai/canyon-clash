(function () {
  var U = {};
  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.dist = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); };
  U.dist2 = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  U.rnd = function (a, b) { if (b === undefined) { b = a; a = 0; } return a + Math.random() * (b - a); };
  U.rndi = function (a, b) { return Math.floor(U.rnd(a, b + 1)); };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.sign = function (v) { return v < 0 ? -1 : 1; };
  U.shuffle = function (a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  // 角度差，返回 [-PI, PI]
  U.angDiff = function (a, b) {
    var d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  U.norm = function (dx, dy) {
    var l = Math.sqrt(dx * dx + dy * dy);
    if (l < 0.00001) return { x: 0, y: 0, l: 0 };
    return { x: dx / l, y: dy / l, l: l };
  };
  U.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s));
    var m = Math.floor(s / 60), ss = s % 60;
    return (m < 10 ? '0' + m : m) + ':' + (ss < 10 ? '0' + ss : ss);
  };
  U.fmtK = function (n) {
    if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
    return String(Math.floor(n));
  };
  // 点到线段距离
  U.distToSeg = function (px, py, ax, ay, bx, by) {
    var vx = bx - ax, vy = by - ay;
    var wx = px - ax, wy = py - ay;
    var l2 = vx * vx + vy * vy;
    if (l2 < 1e-6) return U.dist(px, py, ax, ay);
    var t = U.clamp((wx * vx + wy * vy) / l2, 0, 1);
    return U.dist(px, py, ax + vx * t, ay + vy * t);
  };
  U.easeOut = function (t) { return 1 - (1 - t) * (1 - t); };
  window.U = U;
})();
