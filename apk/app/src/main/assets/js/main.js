(function () {
  var U = window.U, D = window.DATA, SIM = window.SIM, R = window.RENDER, UI = window.UI;
  var G = null;
  var last = 0, acc = 0, mmTimer = 0;
  var recall = { active: false, t: 0, hpMark: 0 };
  var joy = { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0, R: 56 };
  var keys = {};
  var fxSeen = 0, feedSeen = 0;

  function $(id) { return document.getElementById(id); }

  function boot() {
    var canvas = $('game');
    R.init(canvas);
    UI.setSim(SIM);
    UI.init({
      onBuy: function (id) { return SIM.buyForPlayer(G, G.player, id); },
      onSell: function (i) { return SIM.sellForPlayer(G, G.player, i); },
      onRestart: function () { showPick(); }
    });
    UI.buildHeroGrid(function (heroId) { startGame(heroId); });
    $('btnRandom').onclick = function () {
      startGame(D.HEROES[Math.floor(Math.random() * D.HEROES.length)].id);
    };
    bindInput(canvas);
    window.addEventListener('resize', function () { R.resize(); });
    // 调试用：?auto=英雄id 直接开局
    var m = /[?&]auto=([a-z]+)/.exec(location.search);
    if (m) {
      startGame(m[1]);
      if (/[?&]ai=1/.test(location.search)) G.player.isPlayer = false;
      var tm = /[?&]t=(\d+)/.exec(location.search);
      if (/[?&]open=shop/.test(location.search)) setTimeout(function () { UI.openShop(); }, 300);
      if (tm) {
        var secs = Math.min(1500, +tm[1]);
        for (var i = 0; i < secs * 60; i++) SIM.update(G, 1 / 60);
      }
    }
    requestAnimationFrame(loop);
  }

  function startGame(heroId) {
    G = SIM.newGame({ heroId: heroId });
    fxSeen = 0; feedSeen = 0;
    window.GAME = G;
    lastFeedReset();
    UI.resetForNewGame();
    $('pick').classList.add('hidden');
    $('hud').classList.remove('hidden');
    recall.active = false;
    UI.updateHUD(G);
  }
  function lastFeedReset() { /* feed 索引在 UI 内部按新局归零 */ }
  function showPick() {
    $('pick').classList.remove('hidden');
    $('hud').classList.add('hidden');
  }

  /* ---------------- 输入 ---------------- */
  function bindInput(canvas) {
    // 摇杆
    var zone = $('joyZone');
    var base = $('joyBase');
    var knob = $('joyKnob');

    function placeBase(x, y) {
      base.style.left = x + 'px';
      base.style.bottom = (window.innerHeight - y) + 'px';
    }
    zone.addEventListener('pointerdown', function (e) {
      if (UI.isShopOpen()) return;
      joy.active = true; joy.id = e.pointerId;
      joy.cx = e.clientX; joy.cy = e.clientY;
      placeBase(e.clientX, e.clientY);
      knob.style.transform = 'translate(-50%,-50%)';
      e.preventDefault();
    });
    zone.addEventListener('pointermove', function (e) {
      if (!joy.active || e.pointerId !== joy.id) return;
      var dx = e.clientX - joy.cx, dy = e.clientY - joy.cy;
      var l = Math.hypot(dx, dy);
      var max = 62;
      if (l > max) { dx = dx / l * max; dy = dy / l * max; l = max; }
      knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
      var nx = dx / max, ny = dy / max;
      if (G) { G.input.moveX = nx; G.input.moveY = ny; }
      e.preventDefault();
    });
    function endJoy(e) {
      if (!joy.active) return;
      joy.active = false;
      knob.style.transform = 'translate(-50%,-50%)';
      base.style.left = '150px';
      base.style.bottom = '168px';
      if (G) { G.input.moveX = 0; G.input.moveY = 0; }
    }
    zone.addEventListener('pointerup', endJoy);
    zone.addEventListener('pointercancel', endJoy);
    zone.addEventListener('pointerleave', endJoy);

    // 技能按钮（按下后可拖动瞄准）
    document.querySelectorAll('.skill').forEach(function (btn) {
      var idx = +btn.dataset.i;
      var start = null;
      btn.addEventListener('pointerdown', function (e) {
        start = { x: e.clientX, y: e.clientY };
        e.stopPropagation(); e.preventDefault();
      });
      btn.addEventListener('pointerup', function (e) {
        if (!start || !G) return;
        var dx = e.clientX - start.x, dy = e.clientY - start.y;
        var p = G.player;
        if (Math.hypot(dx, dy) > 26) {
          var l = Math.hypot(dx, dy);
          var rng = (p.skills[idx].def.range || 420);
          G.input.aim = { x: p.x + dx / l * rng, y: p.y + dy / l * rng };
        } else {
          G.input.aim = null;
        }
        G.input.cast = idx;
        start = null;
        e.stopPropagation(); e.preventDefault();
      });
      btn.addEventListener('pointercancel', function () { start = null; });
    });

    $('btnAttack').addEventListener('pointerdown', function (e) {
      if (G) G.input.attack = true;
      e.preventDefault();
    });
    $('btnRecall').addEventListener('click', function () {
      if (!G) return;
      var p = G.player;
      if (!p.alive) return;
      if (SIM.isInFountain(G, p)) return;
      recall.active = true; recall.t = 0; recall.hpMark = p.hp;
    });

    // 键盘（桌面/调试）
    window.addEventListener('keydown', function (e) {
      keys[e.key.toLowerCase()] = true;
      if (!G) return;
      var k = e.key.toLowerCase();
      if (k === 'j') G.input.cast = 0;
      if (k === 'k') G.input.cast = 1;
      if (k === 'l') G.input.cast = 2;
      if (k === ' ') G.input.attack = true;
      if (k === 'b') UI.isShopOpen() ? UI.closeShop() : UI.openShop();
    });
    window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });

    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function keyboardMove() {
    var x = 0, y = 0;
    if (keys['a'] || keys['arrowleft']) x -= 1;
    if (keys['d'] || keys['arrowright']) x += 1;
    if (keys['w'] || keys['arrowup']) y -= 1;
    if (keys['s'] || keys['arrowdown']) y += 1;
    if (x || y) {
      var l = Math.hypot(x, y);
      G.input.moveX = x / l; G.input.moveY = y / l;
    } else if (!joy.active) {
      G.input.moveX *= 0.6; G.input.moveY *= 0.6;
      if (Math.abs(G.input.moveX) < 0.05) G.input.moveX = 0;
      if (Math.abs(G.input.moveY) < 0.05) G.input.moveY = 0;
    }
  }

  /* ---------------- 回城 ---------------- */
  function updateRecall(dt) {
    if (!recall.active || !G) return;
    var p = G.player;
    if (!p.alive) { recall.active = false; return; }
    if (Math.abs(p.hp - recall.hpMark) > 0.5 || (G.input.moveX || G.input.moveY)) {
      recall.active = false;
      UI.toast('回城被打断');
      return;
    }
    recall.hpMark = p.hp;
    recall.t += dt;
    if (recall.t >= 4) {
      var b = window.WORLD.BASES[p.team];
      p.x = b.x; p.y = b.y;
      p.target = null; p.moveTarget = null;
      recall.active = false;
      G.effects.push({ type: 'spawn', x: b.x, y: b.y, r: 70, color: p.def.accent, t: 0, dur: 0.7 });
    }
  }

  /* ---------------- 主循环 ---------------- */
  function loop(now) {
    requestAnimationFrame(loop);
    if (!last) last = now;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!G) return;

    keyboardMove();
    updateRecall(dt);

    // 固定步长推进
    acc += dt;
    var step = 1 / 60;
    var guard = 0;
    while (acc >= step && guard < 6) {
      SIM.update(G, step);
      acc -= step;
      guard++;
    }
    if (guard >= 6) acc = 0;

    R.updateCamera(G, dt);
    R.draw(G, now);
    UI.updateHUD(G);

    mmTimer += dt;
    if (mmTimer > 0.12) { R.drawMinimap(G, $('minimap')); mmTimer = 0; }

    playSounds();

    if (G.over && !G._shown) {
      G._shown = true;
      setTimeout(function () { UI.showResult(G); }, 700);
    }
  }

  function playSounds() {
    if (!window.AUDIO) return;
    if (G.effects.length > fxSeen) {
      var start = Math.max(0, G.effects.length - 6);
      for (var i = start; i < G.effects.length; i++) {
        var e = G.effects[i];
        if (e.t > 0.06) continue;
        if (e.type === 'hit') AUDIO.hit();
        else if (e.type === 'ring') AUDIO.cast();
        else if (e.type === 'boom') AUDIO.boom();
        else if (e.type === 'levelup') AUDIO.levelup();
      }
      fxSeen = G.effects.length;
    }
    if (G.feed.length > feedSeen) { AUDIO.kill(); feedSeen = G.feed.length; }
  }

  document.addEventListener('pointerdown', function () { if (window.AUDIO) AUDIO.resume(); }, { once: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
