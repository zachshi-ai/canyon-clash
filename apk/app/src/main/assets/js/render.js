/* 渲染层：地形预烘焙 + 实体绘制 + 战争迷雾 */
window.RENDER = (function () {
  var W = window.WORLD, U = window.U;
  var cv, ctx, Wd, H, DPR = 1;
  var cam = { x: 1600, y: 1600, zoom: 1 };
  var terrain = null, terrainScale = 0.5;
  var fogCv, fogCtx;
  var VIS_N = 32;
  var t0 = 0;

  function init(canvas) {
    cv = canvas;
    ctx = cv.getContext('2d', { alpha: false });
    resize();
    terrain = buildTerrain();
    fogCv = document.createElement('canvas');
    fogCv.width = VIS_N; fogCv.height = VIS_N;
    fogCtx = fogCv.getContext('2d');
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    Wd = Math.floor(window.innerWidth);
    H = Math.floor(window.innerHeight);
    cv.width = Math.floor(Wd * DPR);
    cv.height = Math.floor(H * DPR);
    cv.style.width = Wd + 'px';
    cv.style.height = H + 'px';
  }

  /* ---------------- 地形烘焙 ---------------- */
  function buildTerrain() {
    var S = W.SIZE * terrainScale;
    var c = document.createElement('canvas');
    c.width = S; c.height = S;
    var g = c.getContext('2d');
    var k = terrainScale;

    // 底色
    var bg = g.createLinearGradient(0, 0, S, S);
    bg.addColorStop(0, '#20382a');
    bg.addColorStop(0.5, '#274233');
    bg.addColorStop(1, '#1d3428');
    g.fillStyle = bg;
    g.fillRect(0, 0, S, S);

    // 随机草纹
    for (var i = 0; i < 2600; i++) {
      var x = Math.random() * S, y = Math.random() * S;
      var a = 0.02 + Math.random() * 0.05;
      g.fillStyle = 'rgba(120,200,150,' + a + ')';
      g.beginPath();
      g.arc(x, y, 1 + Math.random() * 6, 0, 6.283);
      g.fill();
    }

    // 河道（左上到右下）
    g.save();
    g.translate(0, 0);
    var river = g.createLinearGradient(0, 0, S, S);
    river.addColorStop(0, 'rgba(38,86,110,0.85)');
    river.addColorStop(0.5, 'rgba(30,78,104,0.9)');
    river.addColorStop(1, 'rgba(36,84,108,0.85)');
    g.strokeStyle = river;
    g.lineWidth = 300 * k;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-40, -40);
    g.lineTo(S + 40, S + 40);
    g.stroke();
    // 水面波纹
    for (var w = 0; w < 160; w++) {
      var t = Math.random();
      var px = t * S, py = t * S + (Math.random() - 0.5) * 260 * k;
      g.fillStyle = 'rgba(150,220,255,' + (0.03 + Math.random() * 0.05) + ')';
      g.beginPath();
      g.ellipse(px, py, 20 * k + Math.random() * 40 * k, 3 * k + Math.random() * 4 * k, 0, 0, 6.283);
      g.fill();
    }
    g.restore();

    // 三条路
    function drawLane(pts, width, color) {
      g.save();
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.strokeStyle = 'rgba(0,0,0,0.22)';
      g.lineWidth = width * k + 8;
      g.beginPath();
      pts.forEach(function (p, i) { i ? g.lineTo(p[0] * k, p[1] * k) : g.moveTo(p[0] * k, p[1] * k); });
      g.stroke();
      g.strokeStyle = color;
      g.lineWidth = width * k;
      g.stroke();
      // 路面颗粒
      g.strokeStyle = 'rgba(255,255,255,0.045)';
      g.lineWidth = 2;
      g.stroke();
      g.restore();
    }
    var laneColor = '#7d8462';
    drawLane([[430, 2770], [430, 430], [2770, 430]], 150, laneColor);
    drawLane([[430, 2770], [2770, 430]], 150, laneColor);
    drawLane([[430, 2770], [2770, 2770], [2770, 430]], 150, laneColor);

    // 野区色块
    g.fillStyle = 'rgba(24,60,42,0.5)';
    var jungleBlobs = [[1100, 2100, 300], [760, 1500, 240], [1750, 2450, 230], [2100, 1100, 300], [2440, 1700, 240], [1450, 750, 230]];
    jungleBlobs.forEach(function (b) {
      g.beginPath();
      g.ellipse(b[0] * k, b[1] * k, b[2] * k, b[2] * 0.8 * k, 0, 0, 6.283);
      g.fill();
    });
    // 野区小树
    for (var t2 = 0; t2 < 260; t2++) {
      var ang = Math.random() * 6.283, rad = Math.random() * 260;
      var blob = jungleBlobs[Math.floor(Math.random() * jungleBlobs.length)];
      var px2 = blob[0] + Math.cos(ang) * rad, py2 = blob[1] + Math.sin(ang) * rad * 0.8;
      g.fillStyle = 'rgba(46,92,60,' + (0.35 + Math.random() * 0.3) + ')';
      g.beginPath();
      g.arc(px2 * k, py2 * k, (3 + Math.random() * 6) * k, 0, 6.283);
      g.fill();
    }

    // 岩石
    W.ROCKS.forEach(function (r) {
      g.save();
      g.translate(r.x * k, r.y * k);
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath(); g.ellipse(0, 6, r.r * k * 1.02, r.r * k * 0.72, 0, 0, 6.283); g.fill();
      var rg = g.createLinearGradient(-r.r * k, -r.r * k, r.r * k, r.r * k);
      rg.addColorStop(0, '#59605c');
      rg.addColorStop(1, '#333a38');
      g.fillStyle = rg;
      g.beginPath();
      for (var i2 = 0; i2 < 9; i2++) {
        var a2 = i2 / 9 * 6.283;
        var rr = r.r * k * (0.82 + 0.18 * Math.sin(i2 * 2.7));
        i2 ? g.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr) : g.moveTo(Math.cos(a2) * rr, Math.sin(a2) * rr);
      }
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(160,180,175,0.18)'; g.lineWidth = 2; g.stroke();
      g.restore();
    });

    // 草丛
    W.BUSHES.forEach(function (b) {
      g.save();
      g.translate(b.x * k, b.y * k);
      g.fillStyle = 'rgba(42,92,58,0.9)';
      roundRect(g, 0, 0, b.w * k, b.h * k, 16 * k);
      g.fill();
      g.fillStyle = 'rgba(96,170,110,0.22)';
      for (var i3 = 0; i3 < 26; i3++) {
        var bx = Math.random() * b.w * k, by = Math.random() * b.h * k;
        g.beginPath(); g.arc(bx, by, (2 + Math.random() * 5) * k, 0, 6.283); g.fill();
      }
      g.restore();
    });

    // 基地平台
    [0, 1].forEach(function (team) {
      var b = W.BASES[team];
      g.save();
      g.translate(b.x * k, b.y * k);
      var grad = g.createRadialGradient(0, 0, 10, 0, 0, 420 * k);
      grad.addColorStop(0, team === 0 ? 'rgba(60,110,200,0.36)' : 'rgba(200,80,70,0.36)');
      grad.addColorStop(0.7, team === 0 ? 'rgba(40,70,140,0.14)' : 'rgba(140,50,45,0.14)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(0, 0, 420 * k, 0, 6.283); g.fill();
      g.strokeStyle = team === 0 ? 'rgba(140,190,255,0.2)' : 'rgba(255,160,150,0.2)';
      g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 300 * k, 0, 6.283); g.stroke();
      g.restore();
    });

    // 地图边框
    g.strokeStyle = 'rgba(120,180,150,0.18)';
    g.lineWidth = 8;
    g.strokeRect(4, 4, S - 8, S - 8);

    return c;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* ---------------- 相机 ---------------- */
  function updateCamera(g, dt) {
    var p = g.player;
    var targetH = 1080 * (H / Math.max(H, 1)); // 占位
    var viewH = 720; // 世界单位
    cam.zoom = H / viewH;
    var tx = p.x, ty = p.y;
    cam.x = U.lerp(cam.x, tx, Math.min(1, dt * 7));
    cam.y = U.lerp(cam.y, ty, Math.min(1, dt * 7));
  }

  function w2s(x, y) {
    return { x: (x - cam.x) * cam.zoom + Wd / 2, y: (y - cam.y) * cam.zoom + H / 2 };
  }

  /* ---------------- 主绘制 ---------------- */
  function draw(g, now) {
    if (!ctx) return;
    var t = now / 1000;
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#0a1210';
    ctx.fillRect(0, 0, Wd, H);

    ctx.save();
    ctx.translate(Wd / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    // 地形
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(terrain, 0, 0, W.SIZE, W.SIZE);

    // 技能预警区
    g.zones.forEach(function (z) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.283); ctx.stroke();
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = z.color;
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r * Math.min(1, z.t / Math.max(0.05, z.delay)), 0, 6.283);
      ctx.stroke();
      ctx.restore();
    });

    // 分层绘制：建筑在下，单位在上，避免塔遮住英雄
    g.cores.forEach(function (c) { if (c.alive && onScreen(c.x, c.y, 260)) drawCore(g, c, t); });
    g.towers.forEach(function (tw) { if (tw.alive && onScreen(tw.x, tw.y, 240)) drawTower(g, tw, t); });

    var drawList = [];
    g.minions.forEach(function (m) { if (m.alive) drawList.push(m); });
    g.monsters.forEach(function (m) { if (m.alive) drawList.push(m); });
    drawList.sort(function (a, b) { return a.y - b.y; });
    drawList.forEach(function (u) {
      if (!onScreen(u.x, u.y, 160)) return;
      if (u.kind === 'minion') drawMinion(g, u, t);
      else drawMonster(g, u, t);
    });

    var heroes = g.heroes.filter(function (h) {
      if (!h.alive) return false;
      if (h.team !== g.player.team && !window.SIM.canSee(g, g.player.team, h)) return false;
      return true;
    }).sort(function (a, b) { return a.y - b.y; });
    heroes.forEach(function (h) { if (onScreen(h.x, h.y, 200)) drawHero(g, h, t); });

    // 弹道
    g.projectiles.forEach(function (p) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.6);
      grad.addColorStop(0, p.color || '#fff');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.6, 0, 6.283); ctx.fill();
      ctx.restore();
    });

    // 特效
    g.effects.forEach(function (e) { drawEffect(e); });

    // 伤害数字
    ctx.textAlign = 'center';
    g.texts.forEach(function (tx) {
      var a = 1 - tx.t / tx.dur;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = 'bold 21px system-ui,sans-serif';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.72)';
      ctx.strokeText(tx.text, tx.x, tx.y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x, tx.y);
      ctx.restore();
    });

    ctx.restore();

    // 迷雾
    drawFog(g);

    // 屏幕边缘受伤/低血量效果
    var p = g.player;
    if (p.alive && p.hp / p.maxHp < 0.3) {
      ctx.save();
      var vg = ctx.createRadialGradient(Wd / 2, H / 2, H * 0.25, Wd / 2, H / 2, H * 0.8);
      vg.addColorStop(0, 'rgba(160,0,0,0)');
      vg.addColorStop(1, 'rgba(160,10,10,' + (0.28 + 0.1 * Math.sin(t * 5)) + ')');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, Wd, H);
      ctx.restore();
    }
    ctx.restore();
  }

  function onScreen(x, y, pad) {
    var s = w2s(x, y);
    return s.x > -pad && s.x < Wd + pad && s.y > -pad && s.y < H + pad;
  }

  function drawFog(g) {
    var team = g.player.team;
    var vis = g.vision[team];
    var img = fogCtx.createImageData(VIS_N, VIS_N);
    for (var i = 0; i < VIS_N * VIS_N; i++) {
      var a = vis[i] ? 0 : 200;
      img.data[i * 4] = 8;
      img.data[i * 4 + 1] = 16;
      img.data[i * 4 + 2] = 22;
      img.data[i * 4 + 3] = a;
    }
    fogCtx.putImageData(img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fogCv, 0, 0, Wd, H);
    ctx.restore();
  }

  /* ---------------- 单位绘制 ---------------- */
  function teamColor(team) { return team === 0 ? '#4f8cff' : '#ff6a5a'; }
  function teamGlow(team) { return team === 0 ? 'rgba(79,140,255,0.75)' : 'rgba(255,106,90,0.75)'; }

  function shadow(x, y, r) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.75, r * 0.85, r * 0.38, 0, 0, 6.283);
    ctx.fill();
    ctx.restore();
  }

  function hpBar(x, y, w, h, ratio, color, back) {
    ctx.fillStyle = back || 'rgba(0,0,0,0.6)';
    roundRect(ctx, x - w / 2 - 1.5, y - 1.5, w + 3, h + 3, 3);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, x - w / 2, y, w * Math.max(0, ratio), h, 2);
    ctx.fill();
  }

  function shade(hex, k) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.substr(0, 2), 16), gg = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    r = Math.round(Math.min(255, r * k)); gg = Math.round(Math.min(255, gg * k)); b = Math.round(Math.min(255, b * k));
    return 'rgb(' + r + ',' + gg + ',' + b + ')';
  }

  function drawHero(g, h, t) {
    var isAlly = h.team === g.player.team;
    var isMe = h === g.player;
    var stealthed = false;
    h.buffs.forEach(function (b) { if (b.type === 'stealth') stealthed = true; });
    var r = h.r;
    var bob = Math.sin(t * (h.walking ? 11 : 4) + h.id) * (h.walking ? 2.6 : 0.9);

    ctx.save();
    if (stealthed) ctx.globalAlpha = 0.42;

    shadow(h.x, h.y, r * 1.05);

    // 脚下阵营环
    ctx.save();
    ctx.strokeStyle = isMe ? '#ffe27a' : teamGlow(h.team);
    ctx.lineWidth = isMe ? 3.5 : 2.2;
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + r * 0.78, r * 0.95, r * 0.4, 0, 0, 6.283);
    ctx.stroke();
    if (isMe) {
      ctx.globalAlpha *= 0.55;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y + r * 0.78, r * 1.25, r * 0.52, 0, 0, 6.283);
      ctx.stroke();
    }
    ctx.restore();

    var by = h.y - r * 0.15 + bob;
    var role = h.def.role;

    // 武器（在身体之后绘制，形成前后层次）
    ctx.save();
    ctx.translate(h.x, by);
    ctx.rotate(h.facing);
    var wc = isAlly ? '#d8e9ff' : '#ffe0d8';
    if (role === '法师' || role === '辅助') {
      ctx.strokeStyle = '#6b5330'; ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.55); ctx.lineTo(r * 0.95, -r * 0.75); ctx.stroke();
      ctx.fillStyle = h.def.accent;
      ctx.beginPath(); ctx.arc(r * 1.0, -r * 0.8, r * 0.28, 0, 6.283); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(r * 1.0, -r * 0.8, r * 0.5, 0, 6.283); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    } else if (role === '射手') {
      ctx.strokeStyle = wc; ctx.lineWidth = r * 0.14;
      ctx.beginPath(); ctx.arc(r * 0.6, 0, r * 0.85, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(r * 0.9 + Math.cos(-1.1) * r * 0.85, Math.sin(-1.1) * r * 0.85);
      ctx.lineTo(r * 0.9 + Math.cos(1.1) * r * 0.85, Math.sin(1.1) * r * 0.85);
      ctx.stroke();
    } else if (role === '坦克') {
      ctx.fillStyle = shade(h.def.color, 0.65);
      ctx.strokeStyle = wc; ctx.lineWidth = r * 0.12;
      ctx.beginPath(); ctx.ellipse(r * 0.75, 0, r * 0.42, r * 0.75, 0, 0, 6.283);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = h.def.accent;
      ctx.beginPath(); ctx.arc(r * 0.75, 0, r * 0.16, 0, 6.283); ctx.fill();
    } else {
      // 剑
      var grd = ctx.createLinearGradient(r * 0.4, 0, r * 1.7, 0);
      grd.addColorStop(0, '#9fb4cc'); grd.addColorStop(0.6, wc); grd.addColorStop(1, '#ffffff');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(r * 0.55, -r * 0.13);
      ctx.lineTo(r * 1.7, -r * 0.05);
      ctx.lineTo(r * 1.85, 0);
      ctx.lineTo(r * 1.7, r * 0.05);
      ctx.lineTo(r * 0.55, r * 0.13);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(h.def.color, 0.6);
      roundRect(ctx, r * 0.42, -r * 0.22, r * 0.2, r * 0.44, r * 0.08);
      ctx.fill();
    }
    ctx.restore();

    // 披风
    ctx.save();
    ctx.fillStyle = shade(h.def.color, 0.55);
    ctx.beginPath();
    ctx.moveTo(h.x - r * 0.75, by - r * 0.35);
    ctx.quadraticCurveTo(h.x - r * 1.05, by + r * 0.9, h.x - r * 0.3, by + r * 1.05);
    ctx.lineTo(h.x + r * 0.3, by + r * 1.05);
    ctx.quadraticCurveTo(h.x + r * 1.05, by + r * 0.9, h.x + r * 0.75, by - r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 躯干
    var bg = ctx.createLinearGradient(h.x - r, by - r, h.x + r, by + r);
    bg.addColorStop(0, h.def.accent);
    bg.addColorStop(0.5, h.def.color);
    bg.addColorStop(1, shade(h.def.color, 0.45));
    ctx.fillStyle = bg;
    roundRect(ctx, h.x - r * 0.62, by - r * 0.55, r * 1.24, r * 1.35, r * 0.3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(6,10,16,0.65)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 腰带
    ctx.fillStyle = 'rgba(12,18,26,0.7)';
    roundRect(ctx, h.x - r * 0.6, by + r * 0.42, r * 1.2, r * 0.2, r * 0.08);
    ctx.fill();

    // 肩甲
    ctx.fillStyle = shade(h.def.accent, 0.95);
    [ -1, 1 ].forEach(function (sd) {
      ctx.beginPath();
      ctx.arc(h.x + sd * r * 0.6, by - r * 0.42, r * 0.26, 0, 6.283);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.2; ctx.stroke();
    });

    // 头
    ctx.fillStyle = '#f0d9c8';
    ctx.beginPath();
    ctx.arc(h.x, by - r * 0.78, r * 0.4, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
    // 头盔/头发
    ctx.fillStyle = shade(h.def.color, 0.8);
    ctx.beginPath();
    ctx.arc(h.x, by - r * 0.86, r * 0.42, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    // 朝向指示（面部朝向）
    ctx.fillStyle = 'rgba(20,28,38,0.85)';
    var fx = h.x + Math.cos(h.facing) * r * 0.22;
    var fy = by - r * 0.75 + Math.sin(h.facing) * r * 0.12;
    ctx.beginPath(); ctx.arc(fx, fy, r * 0.09, 0, 6.283); ctx.fill();

    // 血条 / 蓝条 / 等级 / 名字
    var bw = Math.max(48, r * 2);
    var topY = h.y - r * 2.15;
    hpBar(h.x, topY, bw, 6, h.hp / h.maxHp, h.team === 0 ? '#4fe08d' : '#f2604c', 'rgba(0,0,0,0.68)');
    if (h.maxMp) hpBar(h.x, topY + 8, bw, 3.5, h.mp / Math.max(1, h.maxMp), '#4aa8ff');

    ctx.fillStyle = 'rgba(8,12,20,0.92)';
    ctx.beginPath(); ctx.arc(h.x - bw / 2 - 11, topY + 3, 8.5, 0, 6.283); ctx.fill();
    ctx.strokeStyle = isMe ? '#ffe27a' : teamColor(h.team);
    ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(h.level, h.x - bw / 2 - 11, topY + 7);

    ctx.font = 'bold 12px system-ui,sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(h.name, h.x, topY - 10);
    ctx.fillStyle = isAlly ? 'rgba(205,230,255,1)' : 'rgba(255,200,190,1)';
    ctx.fillText(h.name, h.x, topY - 10);

    if (isStunnedMark(h)) {
      ctx.fillStyle = '#ffe27a';
      ctx.font = 'bold 15px system-ui,sans-serif';
      ctx.fillText('!', h.x, topY - 23);
    }
    // 护盾指示
    for (var bi = 0; bi < h.buffs.length; bi++) {
      if (h.buffs[bi].type === 'shield') {
        ctx.strokeStyle = 'rgba(150,220,255,0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(h.x, by, r * 1.45, 0, 6.283); ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  function isStunnedMark(h) {
    for (var i = 0; i < h.buffs.length; i++) if (h.buffs[i].type === 'stun') return true;
    return false;
  }

  function drawMinion(g, m, t) {
    var ally = m.team === 0;
    var col = ally ? '#6ea2ff' : '#ff7f66';
    var dark = ally ? '#1e3a6b' : '#66231d';
    var rr = m.r;
    shadow(m.x, m.y, rr);
    ctx.save();
    var bob = Math.sin(t * 9 + m.id) * 1.4;
    ctx.translate(m.x, m.y + bob * 0.6);
    ctx.rotate(m.facing + Math.PI / 2);

    // 身体
    ctx.fillStyle = dark;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    if (m.mtype === 'cannon') {
      roundRect(ctx, -rr * 0.95, -rr * 0.95, rr * 1.9, rr * 1.9, rr * 0.35);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, rr * 0.42, 0, 6.283); ctx.fill();
    } else if (m.mtype === 'caster') {
      ctx.beginPath();
      ctx.moveTo(0, -rr * 1.1);
      ctx.lineTo(rr * 0.95, rr * 0.75);
      ctx.lineTo(-rr * 0.95, rr * 0.75);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, -rr * 0.1, rr * 0.34, 0, 6.283); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, 6.283);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, -rr * 0.35, rr * 0.42, 0, 6.283);
      ctx.fill();
      // 小刀
      ctx.fillStyle = '#cfd8e6';
      ctx.fillRect(rr * 0.55, -rr * 0.12, rr * 0.85, rr * 0.24);
    }
    ctx.restore();
    hpBar(m.x, m.y - m.r - 12, m.mtype === 'cannon' ? 40 : 30, 3.6, m.hp / m.maxHp,
      ally ? '#59d8a0' : '#ff8a7a', 'rgba(0,0,0,0.6)');
  }

  function drawTower(g, o, t) {
    var col = o.team === 0 ? '#5f8fe0' : '#e0685a';
    var dark = o.team === 0 ? '#243a63' : '#5d2620';
    shadow(o.x, o.y, o.r * 1.2);
    ctx.save();
    ctx.translate(o.x, o.y);
    // 基座
    ctx.fillStyle = 'rgba(18,26,32,0.95)';
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * 6.283 + 0.5;
      i ? ctx.lineTo(Math.cos(a) * o.r * 1.25, Math.sin(a) * o.r * 1.25)
        : ctx.moveTo(Math.cos(a) * o.r * 1.25, Math.sin(a) * o.r * 1.25);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    // 塔身
    var grad = ctx.createLinearGradient(0, -o.r * 2.6, 0, 0);
    grad.addColorStop(0, col);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-o.r * 0.62, 0);
    ctx.lineTo(-o.r * 0.4, -o.r * 2.35);
    ctx.lineTo(o.r * 0.4, -o.r * 2.35);
    ctx.lineTo(o.r * 0.62, 0);
    ctx.closePath();
    ctx.fill();
    // 顶部水晶
    var pulse = 0.65 + 0.35 * Math.sin(t * 3 + o.id);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var gg = ctx.createRadialGradient(0, -o.r * 2.6, 0, 0, -o.r * 2.6, o.r * 1.35);
    gg.addColorStop(0, col);
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = pulse;
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(0, -o.r * 2.6, o.r * 1.35, 0, 6.283); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#eaf4ff';
    ctx.beginPath();
    ctx.moveTo(0, -o.r * 3.15);
    ctx.lineTo(o.r * 0.35, -o.r * 2.6);
    ctx.lineTo(0, -o.r * 2.05);
    ctx.lineTo(-o.r * 0.35, -o.r * 2.6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    hpBar(o.x, o.y - o.r * 3.4, 56, 5, o.hp / o.maxHp, col);
  }

  function drawCore(g, o, t) {
    var col = o.team === 0 ? '#6fa8ff' : '#ff8172';
    shadow(o.x, o.y, o.r * 1.2);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.fillStyle = 'rgba(14,20,28,0.92)';
    ctx.beginPath(); ctx.arc(0, 0, o.r * 1.5, 0, 6.283); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, o.r * 1.5, 0, 6.283); ctx.stroke();

    ctx.rotate(t * 0.5);
    var grad = ctx.createRadialGradient(0, 0, 4, 0, 0, o.r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, col);
    grad.addColorStop(1, 'rgba(20,30,50,0.9)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * 6.283;
      var rr = o.r * (i % 2 ? 0.62 : 1.0);
      i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var glow = ctx.createRadialGradient(o.x, o.y, 10, o.x, o.y, o.r * 2.8);
    glow.addColorStop(0, col);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.16 + 0.06 * Math.sin(t * 2);
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 2.8, 0, 6.283); ctx.fill();
    ctx.restore();

    hpBar(o.x, o.y - o.r * 1.9, 90, 7, o.hp / o.maxHp, col);
  }

  function drawMonster(g, o, t) {
    shadow(o.x, o.y, o.r);
    ctx.save();
    ctx.translate(o.x, o.y + Math.sin(t * 2 + o.id) * 1.5);
    var col = o.isBoss ? '#b98cff' : (o.buff ? '#ffb157' : '#8f9a86');
    ctx.fillStyle = 'rgba(24,32,26,0.95)';
    ctx.beginPath();
    ctx.ellipse(0, 0, o.r, o.r * 0.9, 0, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
    // 眼睛
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(-o.r * 0.35, -o.r * 0.2, o.r * 0.16, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(o.r * 0.35, -o.r * 0.2, o.r * 0.16, 0, 6.283); ctx.fill();
    if (o.isBoss) {
      ctx.strokeStyle = 'rgba(185,140,255,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, o.r * 1.25, 0, 6.283); ctx.stroke();
    }
    ctx.restore();
    hpBar(o.x, o.y - o.r - 12, o.isBoss ? 90 : 44, o.isBoss ? 6 : 4, o.hp / o.maxHp, col);
  }

  function drawEffect(e) {
    var k = e.t / e.dur;
    ctx.save();
    if (e.type === 'hit') {
      ctx.globalAlpha = 1 - k;
      ctx.globalCompositeOperation = 'lighter';
      var g2 = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * (1 + k));
      g2.addColorStop(0, e.color);
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1 + k), 0, 6.283); ctx.fill();
    } else if (e.type === 'ring') {
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 6 * (1 - k) + 1.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.4 + 0.6 * k), 0, 6.283); ctx.stroke();
    } else if (e.type === 'slash') {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (0.6 + k), -0.9 + k * 0.5, 0.9 + k * 0.5);
      ctx.stroke();
    } else if (e.type === 'heal') {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.color; ctx.lineWidth = 3;
      var s = e.r * (0.6 + k * 0.8);
      ctx.beginPath();
      ctx.moveTo(e.x - s * 0.35, e.y - s); ctx.lineTo(e.x - s * 0.35, e.y + s);
      ctx.moveTo(e.x - s, e.y - s * 0.35); ctx.lineTo(e.x + s, e.y - s * 0.35);
      ctx.stroke();
    } else if (e.type === 'buff' || e.type === 'levelup' || e.type === 'spawn') {
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.globalCompositeOperation = 'lighter';
      var g3 = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * (0.6 + k * 0.9));
      g3.addColorStop(0, e.color);
      g3.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.6 + k * 0.9), 0, 6.283); ctx.fill();
    } else if (e.type === 'death') {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = e.color;
      for (var i = 0; i < 10; i++) {
        var a = i / 10 * 6.283 + e.x * 0.01;
        var d = e.r * k * 1.6;
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d - k * 20, 3 * (1 - k) + 1, 0, 6.283);
        ctx.fill();
      }
    } else if (e.type === 'boom') {
      ctx.globalAlpha = 1 - k;
      ctx.globalCompositeOperation = 'lighter';
      var g4 = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * (0.3 + k));
      g4.addColorStop(0, '#fff');
      g4.addColorStop(0.4, e.color);
      g4.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g4;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.3 + k), 0, 6.283); ctx.fill();
    } else if (e.type === 'dash') {
      ctx.globalAlpha = (1 - k) * 0.55;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 10 * (1 - k) + 2;
      ctx.beginPath(); ctx.moveTo(e.x0, e.y0); ctx.lineTo(e.x, e.y); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- 小地图 ---------------- */
  function drawMinimap(g, mcv) {
    var mctx = mcv.getContext('2d');
    var S = mcv.width;
    var k = S / W.SIZE;
    mctx.clearRect(0, 0, S, S);
    mctx.fillStyle = '#0f1a16';
    mctx.fillRect(0, 0, S, S);
    mctx.strokeStyle = 'rgba(120,170,140,0.28)';
    mctx.lineWidth = S * 0.055;
    mctx.lineCap = 'round';
    mctx.beginPath(); mctx.moveTo(430 * k, 2770 * k); mctx.lineTo(430 * k, 430 * k); mctx.lineTo(2770 * k, 430 * k); mctx.stroke();
    mctx.beginPath(); mctx.moveTo(430 * k, 2770 * k); mctx.lineTo(2770 * k, 430 * k); mctx.stroke();
    mctx.beginPath(); mctx.moveTo(430 * k, 2770 * k); mctx.lineTo(2770 * k, 2770 * k); mctx.lineTo(2770 * k, 430 * k); mctx.stroke();
    // 迷雾
    var vis = g.vision[g.player.team];
    mctx.fillStyle = 'rgba(4,8,12,0.72)';
    var cs = S / VIS_N;
    for (var i = 0; i < VIS_N; i++) {
      for (var j = 0; j < VIS_N; j++) {
        if (!vis[i + j * VIS_N]) mctx.fillRect(i * cs, j * cs, cs + 0.6, cs + 0.6);
      }
    }
    // 塔与水晶
    g.towers.forEach(function (t) {
      if (!t.alive) return;
      if (t.team !== g.player.team && !vis[Math.floor(t.x / W.SIZE * VIS_N) + Math.floor(t.y / W.SIZE * VIS_N) * VIS_N]) return;
      mctx.fillStyle = t.team === 0 ? '#5f8fe0' : '#e0685a';
      mctx.fillRect(t.x * k - 2.5, t.y * k - 2.5, 5, 5);
    });
    g.cores.forEach(function (c) {
      if (!c.alive) return;
      mctx.fillStyle = c.team === 0 ? '#8fc0ff' : '#ff9b8f';
      mctx.beginPath(); mctx.arc(c.x * k, c.y * k, 5, 0, 6.283); mctx.fill();
    });
    // 小兵
    g.minions.forEach(function (m) {
      if (!m.alive) return;
      if (m.team !== g.player.team && !vis[Math.floor(m.x / W.SIZE * VIS_N) + Math.floor(m.y / W.SIZE * VIS_N) * VIS_N]) return;
      mctx.fillStyle = m.team === 0 ? 'rgba(110,160,255,0.85)' : 'rgba(255,140,120,0.85)';
      mctx.fillRect(m.x * k - 1.2, m.y * k - 1.2, 2.4, 2.4);
    });
    // 英雄
    g.heroes.forEach(function (h) {
      if (!h.alive) return;
      if (h.team !== g.player.team && !vis[Math.floor(h.x / W.SIZE * VIS_N) + Math.floor(h.y / W.SIZE * VIS_N) * VIS_N]) return;
      var isMe = h === g.player;
      mctx.fillStyle = isMe ? '#ffe27a' : (h.team === 0 ? '#7fb0ff' : '#ff8f7d');
      mctx.beginPath(); mctx.arc(h.x * k, h.y * k, isMe ? 4 : 3.2, 0, 6.283); mctx.fill();
      if (isMe) { mctx.strokeStyle = '#fff'; mctx.lineWidth = 1; mctx.stroke(); }
    });
    // 视野框
    var vw = Wd / cam.zoom * k, vh = H / cam.zoom * k;
    mctx.strokeStyle = 'rgba(255,255,255,0.5)';
    mctx.lineWidth = 1.2;
    mctx.strokeRect(cam.x * k - vw / 2, cam.y * k - vh / 2, vw, vh);
  }

  function worldToScreen(x, y) { return w2s(x, y); }
  function screenToWorld(sx, sy) {
    return { x: (sx - Wd / 2) / cam.zoom + cam.x, y: (sy - H / 2) / cam.zoom + cam.y };
  }

  return {
    init: init, resize: resize, draw: draw, updateCamera: updateCamera,
    drawMinimap: drawMinimap, cam: cam, screenToWorld: screenToWorld,
    worldToScreen: worldToScreen, get size() { return { w: Wd, h: H }; }
  };
})();
