(function () {
  var U = window.U;
  var SIZE = 3200;

  var BASES = {
    0: { x: 430, y: 2770 },  // 蓝方（左下）
    1: { x: 2770, y: 430 }   // 红方（右上）
  };

  // 三条兵线：均从蓝方基地出发，终点为红方基地
  var RAW = {
    top: [[430, 2770], [430, 430], [2770, 430]],
    mid: [[430, 2770], [2770, 430]],
    bot: [[430, 2770], [2770, 2770], [2770, 430]]
  };

  function makePath(pts) {
    var segs = [], total = 0;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var l = U.dist(a[0], a[1], b[0], b[1]);
      segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], len: l, acc: total });
      total += l;
    }
    return { segs: segs, total: total, pts: pts };
  }

  var LANES = {};
  for (var k in RAW) LANES[k] = makePath(RAW[k]);

  function lanePos(lane, d) {
    var p = LANES[lane];
    d = U.clamp(d, 0, p.total);
    for (var i = 0; i < p.segs.length; i++) {
      var s = p.segs[i];
      if (d <= s.acc + s.len || i === p.segs.length - 1) {
        var t = s.len > 0 ? (d - s.acc) / s.len : 0;
        return { x: U.lerp(s.ax, s.bx, t), y: U.lerp(s.ay, s.by, t) };
      }
    }
    return { x: p.pts[0][0], y: p.pts[0][1] };
  }

  // 每队 3 座塔，距自家基地的距离
  var TOWER_D = [400, 1020, 1650];

  function towerSpots() {
    var out = [];
    ['top', 'mid', 'bot'].forEach(function (lane) {
      var L = LANES[lane].total;
      TOWER_D.forEach(function (d, i) {
        var bp = lanePos(lane, d);
        out.push({ lane: lane, tier: 3 - i, team: 0, x: bp.x, y: bp.y });
        var rp = lanePos(lane, L - d);
        out.push({ lane: lane, tier: 3 - i, team: 1, x: rp.x, y: rp.y });
      });
    });
    return out;
  }

  // 野区营地（镜像对称）
  var CAMPS = [
    { x: 1080, y: 2180, kind: 'buff', buff: 'atk' },   // 蓝方红buff侧
    { x: 700, y: 1500, kind: 'small' },
    { x: 1800, y: 2500, kind: 'small' },
    { x: 2120, y: 1020, kind: 'buff', buff: 'atk' },   // 红方对应
    { x: 2500, y: 1700, kind: 'small' },
    { x: 1400, y: 700, kind: 'small' }
  ];
  // 河道首领
  var BOSS = { x: 1600, y: 1600 };

  // 草丛（矩形）
  var BUSHES = [
    { x: 950, y: 2380, w: 260, h: 190 },
    { x: 1450, y: 2150, w: 240, h: 180 },
    { x: 1800, y: 1750, w: 240, h: 180 },
    { x: 2250, y: 1050, w: 260, h: 190 },
    { x: 1750, y: 2050, w: 220, h: 160 },
    { x: 1450, y: 1750, w: 220, h: 160 },
    { x: 660, y: 1150, w: 240, h: 180 },
    { x: 2540, y: 2050, w: 240, h: 180 }
  ];

  function inBush(x, y) {
    for (var i = 0; i < BUSHES.length; i++) {
      var b = BUSHES[i];
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
    }
    return false;
  }

  // 可走区域：地图内且不在“墙体”里。简化：整张图可走，但用若干岩石块阻挡
  var ROCKS = [
    { x: 1000, y: 1000, r: 190 },
    { x: 2200, y: 2200, r: 190 },
    { x: 1600, y: 1050, r: 150 },
    { x: 1600, y: 2150, r: 150 },
    { x: 1050, y: 1600, r: 150 },
    { x: 2150, y: 1600, r: 150 }
  ];

  function blocked(x, y, r) {
    for (var i = 0; i < ROCKS.length; i++) {
      var k = ROCKS[i];
      if (U.dist(x, y, k.x, k.y) < k.r + (r || 0)) return true;
    }
    return false;
  }

  window.WORLD = {
    SIZE: SIZE,
    BASES: BASES,
    LANES: LANES,
    lanePos: lanePos,
    towerSpots: towerSpots,
    CAMPS: CAMPS,
    BOSS: BOSS,
    BUSHES: BUSHES,
    ROCKS: ROCKS,
    inBush: inBush,
    blocked: blocked,
    TOWER_D: TOWER_D
  };
})();
