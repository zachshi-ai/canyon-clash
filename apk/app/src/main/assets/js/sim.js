/* 战斗内核：单位、伤害、技能、AI、胜负判定。不依赖 DOM，可在 Node 中无头运行。 */
window.SIM = (function () {
  var U = window.U, W = window.WORLD, D = window.DATA;
  var ID = 1;
  var ITEM_MAP = {};
  D.ITEMS.forEach(function (it) { ITEM_MAP[it.id] = it; });

  var TOWER_STAT = {
    outer: { hp: 4200, atk: 230, armor: 95, mr: 95, range: 500, as: 0.9, r: 46, gold: 260, xp: 130 },
    mid: { hp: 4700, atk: 245, armor: 105, mr: 105, range: 500, as: 0.9, r: 46, gold: 280, xp: 150 },
    inner: { hp: 5200, atk: 260, armor: 115, mr: 115, range: 500, as: 0.9, r: 46, gold: 300, xp: 170 }
  };
  var CORE_STAT = { hp: 10000, atk: 290, armor: 90, mr: 90, range: 560, as: 1.0, r: 56, gold: 0, xp: 0 };

  var ROLE_BUILD = {
    '坦克': ['aegis', 'ninja', 'plate', 'belt', 'cloak', 'wargod'],
    '刺客': ['blade', 'scythe', 'boots', 'greatsword', 'wargod', 'aegis'],
    '法师': ['grimoire', 'staff', 'ring', 'boots', 'orb', 'aegis'],
    '射手': ['bow', 'blade', 'scythe', 'boots', 'greatsword', 'aegis'],
    '辅助': ['boots', 'ring', 'staff', 'aegis', 'grimoire', 'cloak'],
    '战士': ['scythe', 'greatsword', 'ninja', 'wargod', 'belt', 'aegis']
  };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------------- 单位构造 ---------------- */
  function makeHero(g, team, def, lane, isPlayer) {
    var jungler = (lane === 'jungle');
    if (jungler) lane = 'mid';
    var h = {
      id: ID++, kind: 'hero', team: team, def: def, name: def.name, role: def.role,
      lane: lane, jungler: jungler, isPlayer: !!isPlayer,
      level: 1, xp: 0, gold: 500, items: [],
      hp: 1, mp: 1, maxHp: 1, maxMp: 1, atk: 1, ap: 0, armor: 0, mr: 0,
      asBonus: 0, atkTimer: 0, atkCd: 1, range: def.base.range, speed: def.base.ms,
      x: 0, y: 0, r: 28, facing: 0, alive: true, respawnT: 0,
      skills: def.skills.map(function (s) { return { def: s, cd: 0 }; }),
      buffs: [], target: null, moveTarget: null,
      pathD: 0, retreat: false, think: 0, kills: 0, deaths: 0, assists: 0,
      lastHitBy: null, deadT: 0, recallT: 0, channel: 0
    };
    var base = W.BASES[team];
    var toCenter = team === 0 ? -1 : 1;
    h.x = base.x + U.rnd(-130, 130);
    h.y = base.y + toCenter * U.rnd(150, 235);
    h.pathD = team === 0 ? 420 : W.LANES[lane].total - 420;
    h.facing = team === 0 ? -Math.PI / 4 : Math.PI * 0.75;
    recalc(h);
    h.hp = h.maxHp; h.mp = h.maxMp;
    return h;
  }

  function recalc(h) {
    var d = h.def, L = h.level - 1;
    var st = { hp: 0, atk: 0, ap: 0, armor: 0, mr: 0, as: 0, ms: 0, lifesteal: 0, cdr: 0 };
    h.items.forEach(function (id) {
      var it = ITEM_MAP[id]; if (!it) return;
      for (var k in it.stat) st[k] = (st[k] || 0) + it.stat[k];
    });
    var oldMax = h.maxHp;
    h.maxHp = d.base.hp + d.grow.hp * L + st.hp;
    h.maxMp = d.base.mp + d.grow.mp * L;
    h.atk = d.base.atk + d.grow.atk * L + st.atk;
    h.ap = d.base.ap + st.ap;
    h.armor = d.base.armor + d.grow.armor * L + st.armor;
    h.mr = d.base.mr + d.grow.mr * L + st.mr;
    h.asBase = d.base.as + d.grow.as * L;
    h.asBonus = st.as / 100;
    h.baseSpeed = d.base.ms * (1 + st.ms / 100);
    h.lifesteal = st.lifesteal / 100;
    h.cdr = st.cdr / 100;
    if (oldMax > 0) h.hp = Math.min(h.maxHp, h.hp + Math.max(0, h.maxHp - oldMax));
    h.hp = Math.min(h.hp, h.maxHp);
  }

  function makeMinion(g, team, type, lane, d) {
    var s = D.MINION[type];
    var scale = 1 + g.time / 540;
    var p = W.lanePos(lane, d);
    return {
      id: ID++, kind: 'minion', mtype: type, team: team, lane: lane, pathD: d,
      x: p.x + U.rnd(-30, 30), y: p.y + U.rnd(-30, 30), r: s.r,
      maxHp: s.hp * scale, hp: s.hp * scale, atk: s.atk * (0.85 + scale * 0.15),
      armor: s.armor * scale * 0.5 + s.armor, mr: s.mr, range: s.range, speed: s.ms,
      asBase: s.as, asBonus: 0, atkTimer: U.rnd(0, 0.5), alive: true, dead: false,
      target: null, facing: team === 0 ? -Math.PI / 4 : Math.PI * 0.75,
      gold: s.gold, xp: s.xp, buffs: []
    };
  }

  function makeTower(g, spot) {
    var tierKey = spot.tier === 1 ? 'outer' : (spot.tier === 2 ? 'mid' : 'inner');
    var s = TOWER_STAT[tierKey];
    return {
      id: ID++, kind: 'tower', team: spot.team, lane: spot.lane, tier: spot.tier,
      x: spot.x, y: spot.y, r: s.r, maxHp: s.hp, hp: s.hp,
      atk: s.atk, armor: s.armor, mr: s.mr, range: s.range, asBase: s.as, asBonus: 0,
      atkTimer: 0, alive: true, dead: false, target: null, gold: s.gold, xp: s.xp,
      buffs: [], facing: 0
    };
  }

  function makeCore(g, team) {
    var b = W.BASES[team], s = CORE_STAT;
    return {
      id: ID++, kind: 'core', team: team, x: b.x, y: b.y, r: s.r,
      maxHp: s.hp, hp: s.hp, atk: s.atk, armor: s.armor, mr: s.mr, range: s.range,
      asBase: s.as, asBonus: 0, atkTimer: 0, alive: true, dead: false, target: null,
      gold: 0, xp: 0, buffs: [], facing: 0
    };
  }

  function makeMonster(g, camp) {
    var isBoss = camp.boss;
    return {
      id: ID++, kind: 'monster', team: -1, camp: camp,
      x: camp.x, y: camp.y, r: isBoss ? 52 : (camp.kind === 'buff' ? 34 : 26),
      maxHp: isBoss ? 9000 : (camp.kind === 'buff' ? 2600 : 1500),
      hp: isBoss ? 9000 : (camp.kind === 'buff' ? 2600 : 1500),
      atk: isBoss ? 230 : (camp.kind === 'buff' ? 95 : 70),
      armor: isBoss ? 90 : 30, mr: isBoss ? 90 : 30,
      range: 150, asBase: 0.75, asBonus: 0, atkTimer: 0,
      alive: true, dead: false, target: null, buffs: [],
      gold: isBoss ? 420 : (camp.kind === 'buff' ? 130 : 85),
      xp: isBoss ? 320 : (camp.kind === 'buff' ? 120 : 85),
      respawnT: 0, isBoss: !!isBoss, home: { x: camp.x, y: camp.y },
      buff: camp.buff || null, facing: 0
    };
  }

  /* ---------------- 状态计算 ---------------- */
  function buffVal(u, type) {
    var v = 0;
    for (var i = 0; i < u.buffs.length; i++) if (u.buffs[i].type === type) v += u.buffs[i].val;
    return v;
  }
  function hasBuff(u, type) {
    for (var i = 0; i < u.buffs.length; i++) if (u.buffs[i].type === type) return u.buffs[i];
    return null;
  }
  function isStunned(u) {
    if (hasBuff(u, 'stun')) return true;
    if (hasBuff(u, 'taunt')) return false;
    return false;
  }
  function effSpeed(u) {
    var base = u.kind === 'hero' ? u.baseSpeed : u.speed;
    var mul = 1 + buffVal(u, 'ms') / 100;
    var slow = buffVal(u, 'slow');
    if (slow > 0) mul *= (1 - slow);
    return Math.max(90, base * mul);
  }
  function effAtkInterval(u) {
    var as = (u.asBase || 0.8) + (u.asBonus || 0) + buffVal(u, 'as') / 100;
    return 1 / Math.max(0.25, as);
  }
  function effAtk(u) {
    return (u.atk || 0) * (1 + buffVal(u, 'atk') / 100);
  }

  function addBuff(u, b) {
    b.t = b.dur;
    u.buffs.push(b);
  }
  function tickBuffs(u, dt) {
    for (var i = u.buffs.length - 1; i >= 0; i--) {
      var b = u.buffs[i];
      b.t -= dt;
      if (b.t <= 0) u.buffs.splice(i, 1);
    }
  }

  /* ---------------- 视野 ---------------- */
  var VIS_N = 32;
  function newVision() { return new Uint8Array(VIS_N * VIS_N); }
  function markVision(v, x, y, r) {
    var cs = W.SIZE / VIS_N;
    var x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs);
    var y0 = Math.floor((y - r) / cs), y1 = Math.floor((y + r) / cs);
    for (var i = Math.max(0, x0); i <= Math.min(VIS_N - 1, x1); i++) {
      for (var j = Math.max(0, y0); j <= Math.min(VIS_N - 1, y1); j++) {
        v[i + j * VIS_N] = 1;
      }
    }
  }
  function visibleAt(v, x, y) {
    var cs = W.SIZE / VIS_N;
    var i = Math.floor(x / cs), j = Math.floor(y / cs);
    if (i < 0 || j < 0 || i >= VIS_N || j >= VIS_N) return false;
    return v[i + j * VIS_N] === 1;
  }
  function updateVision(g) {
    [0, 1].forEach(function (team) {
      var v = g.vision[team];
      v.fill(0);
      g.heroes.forEach(function (h) {
        if (h.team === team && h.alive) markVision(v, h.x, h.y, hasBuff(h, 'stealth') ? 300 : 980);
      });
      g.minions.forEach(function (m) {
        if (m.team === team && m.alive) markVision(v, m.x, m.y, 620);
      });
      g.towers.forEach(function (t) { if (t.team === team && t.alive) markVision(v, t.x, t.y, 640); });
      g.cores.forEach(function (c) { if (c.team === team && c.alive) markVision(v, c.x, c.y, 680); });
    });
  }
  function canSee(g, viewerTeam, u) {
    if (u.team === viewerTeam) return true;
    if (u.team === -1) return visibleAt(g.vision[viewerTeam], u.x, u.y);
    // 草丛隐藏
    if (u.kind === 'hero' && W.inBush(u.x, u.y)) {
      var v = g.vision[viewerTeam];
      var cs = W.SIZE / VIS_N;
      var i = Math.floor(u.x / cs), j = Math.floor(u.y / cs);
      return v[i + j * VIS_N] > 0 && false;
    }
    return visibleAt(g.vision[viewerTeam], u.x, u.y);
  }

  /* ---------------- 战斗基础 ---------------- */
  function addEffect(g, e) {
    e.t = 0; e.dur = e.dur || 0.45;
    g.effects.push(e);
  }
  function addText(g, x, y, text, color) {
    g.texts.push({ x: x, y: y, text: text, color: color || '#fff', t: 0, dur: 0.9 });
  }

  function armorFactor(def, dmgType, pen) {
    var a = dmgType === 'phys' ? def.armor : def.mr;
    a = Math.max(0, a - (pen || 0));
    return 100 / (100 + a);
  }

  function dealDamage(g, src, tgt, amount, dtype, opts) {
    opts = opts || {};
    if (!tgt || !tgt.alive && tgt.kind !== 'hero') return 0;
    if (tgt.kind === 'hero' && !tgt.alive) return 0;
    var pen = 0;
    if (src && src.kind === 'hero') pen = dtype === 'phys' ? (src.armorPen || 0) : (src.mpen || 0);
    var dmg = amount * armorFactor(tgt, dtype, pen);
    if ((tgt.kind === 'tower' || tgt.kind === 'core') && src && src.kind === 'hero') dmg *= 0.62;
    if ((tgt.kind === 'tower' || tgt.kind === 'core') && src && src.kind === 'minion') dmg *= 0.9;
    if (tgt.buffs) {
      var sh = hasBuff(tgt, 'shield');
      if (sh) {
        var absorb = Math.min(sh.val, dmg);
        sh.val -= absorb; dmg -= absorb;
        addText(g, tgt.x, tgt.y - 40, Math.round(absorb), '#9fd8ff');
        if (sh.val <= 0) tgt.buffs.splice(tgt.buffs.indexOf(sh), 1);
      }
    }
    dmg = Math.max(1, dmg);
    tgt.hp -= dmg;
    if (!opts.silent) {
      addText(g, tgt.x + U.rnd(-12, 12), tgt.y - 26, Math.round(dmg), opts.color || (dtype === 'magic' ? '#c9a6ff' : '#ffe6a8'));
    }
    if (src && src.kind === 'hero' && src.lifesteal > 0 && !opts.noLifesteal) {
      src.hp = Math.min(src.maxHp, src.hp + dmg * src.lifesteal);
    }
    if (tgt.kind === 'hero') tgt.lastHitBy = src;
    if (tgt.hp <= 0) killUnit(g, tgt, src);
    return dmg;
  }

  function killUnit(g, u, killer) {
    if (u.dead) return;
    u.dead = true; u.alive = false; u.hp = 0;
    var i;
    if (u.kind === 'hero') {
      u.deaths++;
      u.respawnT = D.RESPAWN(u.level, g.time);
      u.deadT = 0;
      u.buffs.length = 0;
      u.target = null;
      g.kills[1 - u.team]++;
      addEffect(g, { type: 'death', x: u.x, y: u.y, r: 60, color: u.def.color, dur: 0.9 });
      if (killer && killer.kind === 'hero' && killer.team !== u.team) {
        killer.kills++;
        // 击杀金币与经验
        giveGold(g, killer, 320 + Math.min(400, g.time * 0.35));
        giveXp(g, killer, 150 + u.level * 22);
        g.feed.push({ t: g.time, killer: killer.name, killerTeam: killer.team, victim: u.name, victimTeam: u.team });
      } else if (killer && killer.team !== undefined && killer.team !== u.team) {
        g.feed.push({ t: g.time, killer: killerName(killer), killerTeam: killer.team, victim: u.name, victimTeam: u.team });
      }
      // 周围友军分经验
      g.heroes.forEach(function (o) {
        if (o.team === u.team && o.alive && o !== killer && U.dist(o.x, o.y, u.x, u.y) < 1100) {
          giveXp(g, o, 60);
        }
      });
    } else if (u.kind === 'minion') {
      addEffect(g, { type: 'death', x: u.x, y: u.y, r: 22, color: u.team === 0 ? '#7fb0ff' : '#ff9b7f', dur: 0.4 });
      if (killer && killer.kind === 'hero' && killer.team !== u.team) {
        giveGold(g, killer, u.gold);
        giveXp(g, killer, u.xp);
      } else {
        // 附近英雄分经验，金币给击杀者
        g.heroes.forEach(function (o) {
          if (o.team === u.team) return;
          if (!o.alive) return;
          if (U.dist(o.x, o.y, u.x, u.y) < 900) giveXp(g, o, u.xp * 0.6);
        });
      }
    } else if (u.kind === 'tower') {
      addEffect(g, { type: 'boom', x: u.x, y: u.y, r: 150, color: u.team === 0 ? '#7fb0ff' : '#ff9b7f', dur: 1.2 });
      g.towerDown[u.team]++;
      if (killer && killer.team !== undefined && killer.team !== u.team) {
        g.heroes.forEach(function (o) {
          if (o.team === killer.team && o.alive && U.dist(o.x, o.y, u.x, u.y) < 1400) {
            giveGold(g, o, u.gold * 0.6);
            giveXp(g, o, u.xp * 0.8);
          }
        });
      }
      g.feed.push({ t: g.time, killer: killerName(killer), killerTeam: killer ? killer.team : -1, victim: '防御塔', victimTeam: u.team });
    } else if (u.kind === 'core') {
      addEffect(g, { type: 'boom', x: u.x, y: u.y, r: 320, color: u.team === 0 ? '#7fb0ff' : '#ff9b7f', dur: 2 });
      if (!g.over) { g.over = true; g.winner = 1 - u.team; g.endTime = g.time; }
    } else if (u.kind === 'monster') {
      u.respawnT = u.isBoss ? 180 : 70;
      if (killer && killer.kind === 'hero' && killer.team !== u.team) {
        giveGold(g, killer, u.gold);
        giveXp(g, killer, u.xp);
        if (u.buff === 'atk') addBuff(killer, { type: 'atk', val: 20, dur: 70 });
        if (u.isBoss) {
          g.heroes.forEach(function (o) {
            if (o.team === killer.team && o.alive) addBuff(o, { type: 'atk', val: 18, dur: 120 });
          });
          g.feed.push({ t: g.time, killer: killer.name, killerTeam: killer.team, victim: '远古巨兽', victimTeam: -1 });
        }
      }
    }
    if (u.kind !== 'hero' && u.kind !== 'monster') {
      // 保留在数组中，靠 alive 过滤
    }
  }

  function killerName(k) {
    if (!k) return '小兵';
    if (k.kind === 'hero') return k.name;
    if (k.kind === 'minion') return '小兵';
    if (k.kind === 'tower') return '防御塔';
    return '野怪';
  }

  function giveGold(g, h, amount) {
    h.gold += amount;
    if (h.kind === 'hero') addText(g, h.x, h.y - 56, '+' + Math.round(amount), '#ffd85e');
  }
  function giveXp(g, h, amount) {
    if (h.level >= D.MAX_LEVEL) return;
    h.xp += amount;
    while (h.level < D.MAX_LEVEL && h.xp >= D.XP_TABLE[h.level]) {
      h.level++;
      recalc(h);
      addEffect(g, { type: 'levelup', x: h.x, y: h.y, r: 70, color: '#ffe27a', dur: 0.9 });
      addText(g, h.x, h.y - 70, '升级 ' + h.level, '#ffe27a');
    }
  }

  /* ---------------- 移动 ---------------- */
  function moveToward(g, u, tx, ty, dt, stopDist) {
    var n = U.norm(tx - u.x, ty - u.y);
    if (n.l < (stopDist || 6)) return true;
    var sp = effSpeed(u);
    var step = Math.min(n.l, sp * dt);
    var nx = u.x + n.x * step, ny = u.y + n.y * step;
    if (!W.blocked(nx, ny, u.r * 0.6)) { u.x = nx; u.y = ny; }
    else {
      // 绕过障碍
      var tangent = (u.id % 2 === 0) ? 1 : -1;
      var ax = u.x + (-n.y) * tangent * step, ay = u.y + (n.x) * tangent * step;
      if (!W.blocked(ax, ay, u.r * 0.6)) { u.x = ax; u.y = ay; }
    }
    u.x = clamp(u.x, 20, W.SIZE - 20);
    u.y = clamp(u.y, 20, W.SIZE - 20);
    u.facing = Math.atan2(n.y, n.x);
    return n.l - step < 4;
  }

  /* ---------------- 攻击 ---------------- */
  function performAttack(g, u, tgt) {
    var dmg = effAtk(u);
    var isRanged = u.range > 300;
    u.atkTimer = effAtkInterval(u);
    var ang = Math.atan2(tgt.y - u.y, tgt.x - u.x);
    u.facing = ang;
    if (isRanged) {
      g.projectiles.push({
        x: u.x, y: u.y, target: tgt, speed: 1000, dmg: dmg, dtype: 'phys',
        team: u.team, owner: u, r: 10, homing: true, life: 2.4,
        color: u.kind === 'hero' ? u.def.accent : '#dfe9ff', kind: 'attack'
      });
    } else {
      dealDamage(g, u, tgt, dmg, 'phys');
      addEffect(g, { type: 'hit', x: tgt.x, y: tgt.y, r: 16, color: '#fff2c0', dur: 0.22 });
    }
  }

  /* ---------------- 技能 ---------------- */
  function skillCd(h, s) { return s.def.cd * (1 - (h.cdr || 0)); }

  function aimPoint(g, h) {
    // 优先当前目标，其次附近敌人，否则朝面向
    var t = h.target;
    if (t && t.alive && U.dist(h.x, h.y, t.x, t.y) < 1200) return { x: t.x, y: t.y, unit: t };
    var best = null, bd = 1e9;
    g.heroes.concat(g.minions, g.monsters).forEach(function (o) {
      if (!o.alive || o.team === h.team) return;
      if (!canSee(g, h.team, o)) return;
      var d = U.dist(h.x, h.y, o.x, o.y);
      if (d < bd && d < 900) { bd = d; best = o; }
    });
    if (best) return { x: best.x, y: best.y, unit: best };
    return { x: h.x + Math.cos(h.facing) * 300, y: h.y + Math.sin(h.facing) * 300, unit: null };
  }

  function castSkill(g, h, idx, aimX, aimY) {
    var s = h.skills[idx];
    if (!s || s.cd > 0) return false;
    if (isStunned(h)) return false;
    var def = s.def;
    if (h.mp < def.mp) return false;
    var aim;
    if (aimX !== undefined && aimX !== null) aim = { x: aimX, y: aimY };
    else { var a = aimPoint(g, h); aim = { x: a.x, y: a.y }; }
    var n = U.norm(aim.x - h.x, aim.y - h.y);
    if (n.l < 1) { n.x = Math.cos(h.facing); n.y = Math.sin(h.facing); }
    var capped = Math.min(n.l, def.range || 500);
    var px = h.x + n.x * capped, py = h.y + n.y * capped;

    h.mp -= def.mp;
    s.cd = skillCd(h, s);
    h.facing = Math.atan2(n.y, n.x);
    h.channel = 0.25;

    var power = 0;
    if (def.dmg) power = (def.dmg[0] + def.dmg[1] * (h.level - 1)) + (def.ratio || 0) * (def.rs === 'ap' ? h.ap : h.atk);

    switch (def.type) {
      case 'dash': {
        var dist = Math.min(n.l, def.range);
        var steps = 12, hitSet = {};
        for (var i = 1; i <= steps; i++) {
          var cx = h.x + n.x * dist * i / steps, cy = h.y + n.y * dist * i / steps;
          if (W.blocked(cx, cy, h.r * 0.6)) break;
          h.x = cx; h.y = cy;
          enemiesNear(g, h, cx, cy, 130).forEach(function (e) {
            if (hitSet[e.id]) return; hitSet[e.id] = 1;
            dealDamage(g, h, e, power, def.dtype);
            if (def.knock) knockback(e, h, def.knock);
            if (def.slow) addBuff(e, { type: 'slow', val: def.slow, dur: def.slowDur || 2 });
            if (def.stun) addBuff(e, { type: 'stun', val: 1, dur: def.stun });
          });
        }
        if (def.shield) addBuff(h, { type: 'shield', val: def.shield[0] + def.shield[1] * (h.level - 1), dur: 4 });
        addEffect(g, { type: 'dash', x: h.x, y: h.y, x0: h.x - n.x * dist, y0: h.y - n.y * dist, r: 26, color: h.def.accent, dur: 0.35 });
        break;
      }
      case 'aoeSelf': {
        enemiesNear(g, h, h.x, h.y, def.radius).forEach(function (e) {
          dealDamage(g, h, e, power, def.dtype);
          if (def.stun) addBuff(e, { type: 'stun', val: 1, dur: def.stun });
          if (def.taunt) addBuff(e, { type: 'taunt', val: 1, dur: def.taunt, src: h });
          if (def.slow) addBuff(e, { type: 'slow', val: def.slow, dur: def.slowDur || 2 });
        });
        addEffect(g, { type: 'ring', x: h.x, y: h.y, r: def.radius, color: def.dtype === 'magic' ? '#b48bff' : '#ffb066', dur: 0.55 });
        break;
      }
      case 'aoe': {
        g.zones.push({
          x: px, y: py, r: def.radius, t: 0, delay: def.delay || 0.05,
          owner: h, team: h.team, power: power, dtype: def.dtype,
          slow: def.slow, slowDur: def.slowDur, stun: def.stun, taunt: def.taunt,
          color: def.dtype === 'magic' ? '#b48bff' : '#ffb066'
        });
        break;
      }
      case 'self': {
        if (def.shield) addBuff(h, { type: 'shield', val: def.shield[0] + def.shield[1] * (h.level - 1), dur: def.dur || 4 });
        if (def.stealth) addBuff(h, { type: 'stealth', val: 1, dur: def.stealth });
        if (def.msBuff) addBuff(h, { type: 'ms', val: def.msBuff, dur: def.dur || 3 });
        if (def.asBuff) addBuff(h, { type: 'as', val: def.asBuff, dur: def.dur || 4 });
        if (def.atkBuff) addBuff(h, { type: 'atk', val: def.atkBuff, dur: def.dur || 6 });
        if (def.slowRes) addBuff(h, { type: 'shieldup', val: def.slowRes, dur: def.dur || 4 });
        if (def.lifesteal) h.lifesteal = Math.max(h.lifesteal, def.lifesteal / 100);
        addEffect(g, { type: 'buff', x: h.x, y: h.y, r: 70, color: h.def.accent, dur: 0.6 });
        break;
      }
      case 'proj': {
        g.projectiles.push({
          x: h.x, y: h.y, vx: n.x, vy: n.y, speed: def.speed, dmg: power, dtype: def.dtype,
          team: h.team, owner: h, r: def.radius, pierce: !!def.pierce, life: (def.range || 600) / def.speed + 0.4,
          slow: def.slow, slowDur: def.slowDur, stun: def.stun, hitSet: {}, kind: 'skill',
          color: h.def.accent, maxDist: def.range || 600, traveled: 0
        });
        break;
      }
      case 'strike': {
        var t = null, bd = 1e9;
        enemiesNear(g, h, h.x, h.y, def.range + 60).forEach(function (e) {
          var d = U.dist(h.x, h.y, e.x, e.y);
          if (e.kind === 'hero') d -= 120;
          if (d < bd) { bd = d; t = e; }
        });
        if (t) {
          dealDamage(g, h, t, power, def.dtype);
          addEffect(g, { type: 'slash', x: t.x, y: t.y, r: 46, color: '#ffffff', dur: 0.4 });
        }
        break;
      }
      case 'heal': {
        var amt = (def.heal[0] + def.heal[1] * (h.level - 1)) + (def.hratio || 0) * h.ap;
        var list = [h].concat(g.heroes.filter(function (o) { return o !== h && o.team === h.team && o.alive && U.dist(o.x, o.y, h.x, h.y) < def.radius; }));
        list.forEach(function (o) {
          o.hp = Math.min(o.maxHp, o.hp + amt);
          addText(g, o.x, o.y - 40, '+' + Math.round(amt), '#8dffb0');
          addEffect(g, { type: 'heal', x: o.x, y: o.y, r: 40, color: '#8dffb0', dur: 0.6 });
        });
        break;
      }
      case 'shieldAll': {
        var sv = def.shield[0] + def.shield[1] * (h.level - 1);
        g.heroes.forEach(function (o) {
          if (o.team === h.team && o.alive && U.dist(o.x, o.y, h.x, h.y) < def.radius) {
            addBuff(o, { type: 'shield', val: sv, dur: def.dur || 5 });
            if (def.msBuff) addBuff(o, { type: 'ms', val: def.msBuff, dur: def.dur || 5 });
            addEffect(g, { type: 'buff', x: o.x, y: o.y, r: 46, color: '#a9e6ff', dur: 0.6 });
          }
        });
        break;
      }
    }
    return true;
  }

  function knockback(u, from, power) {
    var n = U.norm(u.x - from.x, u.y - from.y);
    var nx = u.x + n.x * power * 0.06, ny = u.y + n.y * power * 0.06;
    if (!W.blocked(nx, ny, 10)) { u.x = nx; u.y = ny; }
    u.x = clamp(u.x, 20, W.SIZE - 20);
    u.y = clamp(u.y, 20, W.SIZE - 20);
  }

  function enemiesNear(g, h, x, y, r) {
    var out = [];
    g.heroes.forEach(function (o) { if (o.alive && o.team !== h.team && U.dist(o.x, o.y, x, y) < r + o.r) out.push(o); });
    g.minions.forEach(function (o) { if (o.alive && o.team !== h.team && U.dist(o.x, o.y, x, y) < r + o.r) out.push(o); });
    g.towers.forEach(function (o) { if (o.alive && o.team !== h.team && U.dist(o.x, o.y, x, y) < r + o.r) out.push(o); });
    g.cores.forEach(function (o) { if (o.alive && o.team !== h.team && U.dist(o.x, o.y, x, y) < r + o.r) out.push(o); });
    g.monsters.forEach(function (o) { if (o.alive && U.dist(o.x, o.y, x, y) < r + o.r) out.push(o); });
    return out;
  }

  /* ---------------- 目标选择 ---------------- */
  function nearestEnemy(g, h, range, opts) {
    opts = opts || {};
    var best = null, bs = -1e9;
    var consider = [];
    if (!opts.noHero) consider = consider.concat(g.heroes.filter(function (o) { return o.alive && o.team !== h.team; }));
    if (opts.includeMinion) consider = consider.concat(g.minions.filter(function (o) { return o.alive && o.team !== h.team; }));
    if (opts.includeTower) consider = consider.concat(g.towers.filter(function (o) { return o.alive && o.team !== h.team; }));
    if (opts.includeMonster) consider = consider.concat(g.monsters.filter(function (o) { return o.alive; }).filter(function (o) { return opts.forced || o.target === null || o.target === h; }));
    if (opts.includeCore) consider = consider.concat(g.cores.filter(function (o) { return o.alive && o.team !== h.team; }));
    consider.forEach(function (o) {
      var d = U.dist(h.x, h.y, o.x, o.y);
      if (d > range + o.r) return;
      if (!canSee(g, h.team, o) && o.kind !== 'tower' && o.kind !== 'core') return;
      var score = -d;
      if (o.kind === 'hero') score += 260;
      if (o.kind === 'monster') score -= 100;
      if (o.kind === 'tower') score -= 60;
      if (score > bs) { bs = score; best = o; }
    });
    return best;
  }

  /* ---------------- 每帧逻辑 ---------------- */
  function update(g, dt) {
    if (g.over) { updateEffects(g, dt); return; }
    g.time += dt;
    updateVision(g);
    g.waveTimer -= dt;
    if (g.waveTimer <= 0) {
      g.waveTimer = 30;
      spawnWave(g);
    }
    // 22 分钟后水晶开始崩坏，避免无限对局
    if (g.time > 1320) {
      g.cores.forEach(function (c) {
        if (!c.alive) return;
        c.hp -= c.maxHp * 0.006 * dt;
        if (c.hp <= 0) killUnit(g, c, null);
      });
    }
    updateHeroes(g, dt);
    updateMinions(g, dt);
    updateStructures(g, dt);
    updateMonsters(g, dt);
    updateProjectiles(g, dt);
    updateZones(g, dt);
    updateEffects(g, dt);
    g.heroes.forEach(function (h) { h.think -= dt; });
  }

  function updateEffects(g, dt) {
    var i;
    for (i = g.effects.length - 1; i >= 0; i--) {
      var e = g.effects[i];
      e.t += dt;
      if (e.t > e.dur) g.effects.splice(i, 1);
    }
    for (i = g.texts.length - 1; i >= 0; i--) {
      var t = g.texts[i];
      t.t += dt; t.y -= dt * 34;
      if (t.t > t.dur) g.texts.splice(i, 1);
    }
  }

  var WAVE_N = 0;
  function spawnWave(g) {
    WAVE_N++;
    ['top', 'mid', 'bot'].forEach(function (lane) {
      [0, 1].forEach(function (team) {
        var L = W.LANES[lane].total;
        var startD = team === 0 ? 220 : L - 220;
        var step = team === 0 ? 55 : -55;
        var comp = ['melee', 'melee', 'melee', 'caster'];
        if (WAVE_N % 3 === 0) comp.push('cannon');
        if (g.time > 900) comp.push('cannon');
        comp.forEach(function (t, i) {
          g.minions.push(makeMinion(g, team, t, lane, startD + step * i));
        });
      });
    });
  }

  function updateHeroes(g, dt) {
    g.heroes.forEach(function (h) {
      // 冷却
      h.skills.forEach(function (s) { if (s.cd > 0) s.cd = Math.max(0, s.cd - dt); });
      h.buffs = h.buffs.filter(function (b) { b.t -= dt; return b.t > 0; });
      if (h.kind === 'hero' && h.lifesteal > 1) h.lifesteal = 1;

      if (!h.alive) {
        h.deadT += dt;
        h.respawnT -= dt;
        if (h.respawnT <= 0) respawn(g, h);
        return;
      }
      // 回复
      if (isInFountain(g, h)) {
        h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.18 * dt);
        h.mp = Math.min(h.maxMp, h.mp + h.maxMp * 0.18 * dt);
      } else {
        h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.006 * dt);
        h.mp = Math.min(h.maxMp, h.mp + h.maxMp * 0.012 * dt);
      }
      if (h.atkTimer > 0) h.atkTimer -= dt;
      if (h.channel > 0) h.channel -= dt;

      if (isStunned(h)) return;

      if (h.isPlayer) updatePlayer(g, h, dt);
      else updateHeroAI(g, h, dt);

      // 自动攻击
      if (h.atkTimer <= 0 && h.channel <= 0) {
        var t = h.target;
        if (!t || !t.alive || U.dist(h.x, h.y, t.x, t.y) > h.range + t.r + 20 || !canSee(g, h.team, t)) {
          t = pickAttackTarget(g, h);
          h.target = t;
        }
        if (t && t.alive && U.dist(h.x, h.y, t.x, t.y) <= h.range + t.r + 10) {
          performAttack(g, h, t);
        }
      }
    });
  }

  function pickAttackTarget(g, h) {
    return nearestEnemy(g, h, h.range + 40, { includeMinion: true, includeTower: true, includeCore: true, includeMonster: false });
  }

  function respawn(g, h) {
    var b = W.BASES[h.team];
    h.alive = true; h.dead = false; h.hp = h.maxHp; h.mp = h.maxMp;
    h.x = b.x + U.rnd(-130, 130); h.y = b.y + (h.team === 0 ? -1 : 1) * U.rnd(150, 235);
    h.buffs.length = 0; h.target = null; h.moveTarget = null;
    h.pathD = h.team === 0 ? 420 : W.LANES[h.lane].total - 420;
    h.retreat = false;
    addEffect(g, { type: 'spawn', x: h.x, y: h.y, r: 60, color: h.def.accent, dur: 0.7 });
  }

  function isInFountain(g, h) {
    var b = W.BASES[h.team];
    return U.dist(h.x, h.y, b.x, b.y) < 430;
  }

  /* ---------------- 玩家控制 ---------------- */
  function updatePlayer(g, h, dt) {
    var inp = g.input;
    if (!inp) return;
    if (inp.cast !== null && inp.cast !== undefined) {
      var idx = inp.cast;
      inp.cast = null;
      var aim = inp.aim;
      if (aim) castSkill(g, h, idx, aim.x, aim.y);
      else castSkill(g, h, idx);
    }
    if (inp.attack) {
      inp.attack = false;
      var t = pickAttackTarget(g, h);
      if (t) { h.target = t; }
    }
    if (inp.moveX !== undefined && (Math.abs(inp.moveX) > 0.08 || Math.abs(inp.moveY) > 0.08)) {
      h.moveTarget = { x: h.x + inp.moveX * 400, y: h.y + inp.moveY * 400 };
      h.retreat = false;
      h.pathD = nearestPathD(h);
    }
    if (h.moveTarget) {
      var n = U.norm(h.moveTarget.x - h.x, h.moveTarget.y - h.y);
      if (n.l < 12) h.moveTarget = null;
      else moveToward(g, h, h.moveTarget.x, h.moveTarget.y, dt, 10);
    } else if (h.target && h.target.alive && U.dist(h.x, h.y, h.target.x, h.target.y) > h.range + h.target.r - 6) {
      moveToward(g, h, h.target.x, h.target.y, dt, h.range + h.target.r - 10);
    }
    // 录制动作意图（用于动画）
    if (h.moveTarget) h.walking = true; else h.walking = false;
  }

  function nearestPathD(h) {
    var p = W.LANES[h.lane], best = h.pathD, bd = 1e9;
    for (var d = 0; d < p.total; d += 60) {
      var pt = W.lanePos(h.lane, d);
      var dd = U.dist(pt.x, pt.y, h.x, h.y);
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  /* ---------------- 小兵 ---------------- */
  function updateMinions(g, dt) {
    g.minions.forEach(function (m) {
      if (!m.alive) return;
      m.buffs = m.buffs.filter(function (b) { b.t -= dt; return b.t > 0; });
      if (m.atkTimer > 0) m.atkTimer -= dt;
      if (isStunned(m)) return;

      var t = m.target;
      if (!t || !t.alive || U.dist(m.x, m.y, t.x, t.y) > m.range + 380) {
        t = nearestEnemy(g, m, 400, { forced: true, includeMinion: true, includeTower: true, includeCore: true });
        m.target = t;
      }
      if (t && t.alive) {
        var d = U.dist(m.x, m.y, t.x, t.y);
        if (d > m.range + t.r - 4) moveToward(g, m, t.x, t.y, dt, m.range + t.r - 10);
        else if (m.atkTimer <= 0) {
          m.atkTimer = effAtkInterval(m);
          var dmg = effAtk(m);
          if (m.range > 200) {
            g.projectiles.push({
              x: m.x, y: m.y, target: t, speed: 700, dmg: dmg, dtype: 'phys',
              team: m.team, owner: m, r: 7, homing: true, life: 2, color: '#cfe3ff', kind: 'attack'
            });
          } else {
            dealDamage(g, m, t, dmg, 'phys');
          }
          m.facing = Math.atan2(t.y - m.y, t.x - m.x);
        }
      } else {
        // 沿兵线推进
        var dir = m.team === 0 ? 1 : -1;
        var L = W.LANES[m.lane].total;
        m.pathD = clamp(m.pathD + dir * effSpeed(m) * dt, 120, L - 120);
        var pt = W.lanePos(m.lane, m.pathD);
        moveToward(g, m, pt.x + Math.sin(m.id) * 34, pt.y + Math.cos(m.id) * 34, dt, 20);
      }
    });
    g.minions = g.minions.filter(function (m) { return m.alive; });
  }

  /* ---------------- 防御塔与水晶 ---------------- */
  function updateStructures(g, dt) {
    var all = g.towers.concat(g.cores);
    all.forEach(function (u) {
      if (!u.alive) return;
      if (u.atkTimer > 0) u.atkTimer -= dt;
      var t = u.target;
      if (!t || !t.alive || U.dist(u.x, u.y, t.x, t.y) > u.range + t.r + 20) {
        t = null;
        var best = -1e9;
        var cands = [];
        g.minions.forEach(function (m) { if (m.alive && m.team !== u.team) cands.push(m); });
        g.heroes.forEach(function (h) { if (h.alive && h.team !== u.team) cands.push(h); });
        g.monsters.forEach(function (m) { if (m.alive && m.team !== u.team) cands.push(m); });
        cands.forEach(function (o) {
          var d = U.dist(u.x, u.y, o.x, o.y);
          if (d > u.range + o.r) return;
          if (!canSee(g, u.team, o)) return;
          var sc = 1000 - d + (o.kind === 'minion' ? 400 : 0);
          if (sc > best) { best = sc; t = o; }
        });
        u.target = t;
      }
      if (t && t.alive && u.atkTimer <= 0 && U.dist(u.x, u.y, t.x, t.y) <= u.range + t.r) {
        u.atkTimer = effAtkInterval(u);
        u.facing = Math.atan2(t.y - u.y, t.x - u.x);
        g.projectiles.push({
          x: u.x, y: u.y - 30, target: t, speed: 900, dmg: u.atk, dtype: 'phys',
          team: u.team, owner: u, r: 14, homing: true, life: 2.2,
          color: u.team === 0 ? '#8fc0ff' : '#ffb08f', kind: 'tower'
        });
      }
    });
  }

  /* ---------------- 野怪 ---------------- */
  function updateMonsters(g, dt) {
    g.monsters.forEach(function (m) {
      if (!m.alive) {
        m.respawnT -= dt;
        if (m.respawnT <= 0) {
          m.alive = true; m.dead = false; m.hp = m.maxHp;
          m.x = m.home.x; m.y = m.home.y; m.target = null;
        }
        return;
      }
      if (m.atkTimer > 0) m.atkTimer -= dt;
      if (isStunned(m)) return;
      var t = m.target;
      if (!t || !t.alive || U.dist(m.x, m.y, t.x, t.y) > 620) {
        t = null;
        var best = 1e9;
        g.heroes.forEach(function (h) {
          if (!h.alive) return;
          var d = U.dist(m.x, m.y, h.x, h.y);
          if (d < 420 && d < best) { best = d; t = h; }
        });
        g.minions.forEach(function (o) {
          if (!o.alive) return;
          var d = U.dist(m.x, m.y, o.x, o.y);
          if (d < 300 && d < best) { best = d; t = o; }
        });
        m.target = t;
      }
      if (t && t.alive) {
        var d = U.dist(m.x, m.y, t.x, t.y);
        if (d > m.range + t.r) moveToward(g, m, t.x, t.y, dt, m.range + t.r - 6);
        else if (m.atkTimer <= 0) {
          m.atkTimer = effAtkInterval(m);
          dealDamage(g, m, t, effAtk(m), 'phys');
          m.facing = Math.atan2(t.y - m.y, t.x - m.x);
        }
        // 脱战回家
        if (U.dist(m.x, m.y, m.home.x, m.home.y) > 700) {
          m.target = null;
          moveToward(g, m, m.home.x, m.home.y, dt, 20);
          m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.15 * dt);
        }
      } else {
        if (U.dist(m.x, m.y, m.home.x, m.home.y) > 30) moveToward(g, m, m.home.x, m.home.y, dt, 20);
        else m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.1 * dt);
      }
    });
  }

  /* ---------------- 弹道 ---------------- */
  function updateProjectiles(g, dt) {
    for (var i = g.projectiles.length - 1; i >= 0; i--) {
      var p = g.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) { g.projectiles.splice(i, 1); continue; }
      if (p.homing) {
        if (!p.target || !p.target.alive) { g.projectiles.splice(i, 1); continue; }
        var n = U.norm(p.target.x - p.x, p.target.y - p.y);
        var step = p.speed * dt;
        if (n.l <= step + p.target.r) {
          dealDamage(g, p.owner, p.target, p.dmg, p.dtype || 'phys');
          addEffect(g, { type: 'hit', x: p.target.x, y: p.target.y, r: p.r + 8, color: p.color || '#fff', dur: 0.22 });
          g.projectiles.splice(i, 1);
        } else {
          p.x += n.x * step; p.y += n.y * step;
        }
      } else {
        var move = p.speed * dt;
        p.x += p.vx * move; p.y += p.vy * move;
        p.traveled = (p.traveled || 0) + move;
        if (p.maxDist && p.traveled > p.maxDist) { g.projectiles.splice(i, 1); continue; }
        // 命中
        var hit = null;
        var cands = g.heroes.concat(g.minions, g.monsters).concat(g.towers).concat(g.cores);
        for (var j = 0; j < cands.length; j++) {
          var o = cands[j];
          if (!o.alive || o.team === p.team) continue;
          if (U.dist(p.x, p.y, o.x, o.y) < o.r + p.r) { hit = o; break; }
        }
        if (hit) {
          if (p.hitSet[p.hitSet ? hit.id : 0]) { }
          if (p.pierce) {
            p.hitSet = p.hitSet || {};
            if (!p.hitSet[hit.id]) {
              p.hitSet[hit.id] = 1;
              dealDamage(g, p.owner, hit, p.dmg, p.dtype || 'phys');
            }
          } else {
            dealDamage(g, p.owner, hit, p.dmg, p.dtype || 'phys');
            if (p.slow) addBuff(hit, { type: 'slow', val: p.slow, dur: p.slowDur || 2 });
            if (p.stun) addBuff(hit, { type: 'stun', val: 1, dur: p.stun });
            addEffect(g, { type: 'hit', x: p.x, y: p.y, r: p.r + 12, color: p.color || '#fff', dur: 0.25 });
            g.projectiles.splice(i, 1);
            continue;
          }
        }
        if (p.x < 0 || p.y < 0 || p.x > W.SIZE || p.y > W.SIZE) g.projectiles.splice(i, 1);
      }
    }
  }

  /* ---------------- 区域技能 ---------------- */
  function updateZones(g, dt) {
    for (var i = g.zones.length - 1; i >= 0; i--) {
      var z = g.zones[i];
      z.t += dt;
      if (z.t >= z.delay && !z.fired) {
        z.fired = true;
        addEffect(g, { type: 'ring', x: z.x, y: z.y, r: z.r, color: z.color, dur: 0.6 });
        enemiesNear(g, z.owner, z.x, z.y, z.r).forEach(function (e) {
          dealDamage(g, z.owner, e, z.power, z.dtype);
          if (z.slow) addBuff(e, { type: 'slow', val: z.slow, dur: z.slowDur || 2 });
          if (z.stun) addBuff(e, { type: 'stun', val: 1, dur: z.stun });
          if (z.taunt) addBuff(e, { type: 'taunt', val: 1, dur: z.taunt, src: z.owner });
        });
      }
      if (z.t > z.delay + 0.4) g.zones.splice(i, 1);
    }
  }

  /* ---------------- 英雄 AI ---------------- */
  function updateHeroAI(g, h, dt) {
    if (h.think > 0) { aiAct(g, h, dt); return; }
    h.think = 0.18 + Math.random() * 0.1;
    aiThink(g, h);
    aiAct(g, h, dt);
  }

  function visibleEnemyHeroes(g, h) {
    return g.heroes.filter(function (o) {
      return o.alive && o.team !== h.team && canSee(g, h.team, o) && U.dist(o.x, o.y, h.x, h.y) < 1100;
    });
  }

  function ownTowerAt(g, h, x, y, r) {
    var best = null, bd = 1e9;
    g.towers.forEach(function (t) {
      if (!t.alive || t.team !== h.team) return;
      var d = U.dist(t.x, t.y, x, y);
      if (d < r && d < bd) { bd = d; best = t; }
    });
    return best;
  }

  function enemyTowerNear(g, h, x, y, r) {
    var best = null, bd = 1e9;
    g.towers.forEach(function (t) {
      if (!t.alive || t.team === h.team) return;
      var d = U.dist(t.x, t.y, x, y);
      if (d < r && d < bd) { bd = d; best = t; }
    });
    return best;
  }

  function aiThink(g, h) {
    var hpR = h.hp / h.maxHp;
    var mpR = h.mp / h.maxMp;
    var b = W.BASES[h.team];

    // 回城治疗
    if (h.retreat) {
      if (hpR > 0.92 || isInFountain(g, h)) {
        if (hpR > 0.92) h.retreat = false;
      }
      return;
    }
    if (hpR < 0.34 && !isInFountain(g, h)) { h.retreat = true; h.target = null; return; }
    if (hpR < 0.5 && visibleEnemyHeroes(g, h).length > 0) {
      var e = visibleEnemyHeroes(g, h)[0];
      if (e.hp / e.maxHp > hpR + 0.15) { h.retreat = true; h.target = null; return; }
    }

    var enemies = visibleEnemyHeroes(g, h);
    var enemy = null, bd = 1e9;
    enemies.forEach(function (o) {
      var d = U.dist(h.x, h.y, o.x, o.y);
      if (d < bd) { bd = d; enemy = o; }
    });

    // 敌塔威胁：没有友军小兵在附近就不深入
    var et = enemyTowerNear(g, h, h.x, h.y, 560);
    var allyMinionsNear = g.minions.filter(function (m) {
      return m.alive && m.team === h.team && U.dist(m.x, m.y, h.x, h.y) < 620;
    }).length;

    if (enemy && bd < 780) {
      var canFight = hpR > 0.52 || (enemy.hp / enemy.maxHp < 0.32);
      if (canFight && !(et && allyMinionsNear === 0 && bd > 300)) {
        h.target = enemy;
        h.combat = true;
        return;
      }
      if (!canFight) { h.retreat = true; return; }
    }
    h.combat = false;

    // 打小兵/野怪/塔
    var laneTarget = null, ltd = 1e9;
    g.minions.forEach(function (m) {
      if (!m.alive || m.team === h.team) return;
      if (!canSee(g, h.team, m)) return;
      var d = U.dist(h.x, h.y, m.x, m.y);
      if (d < 820 && d < ltd) { ltd = d; laneTarget = m; }
    });
    if (laneTarget) { h.target = laneTarget; return; }

    // 打野
    if (h.jungler || (h.role === '刺客' && h.level >= 4)) {
      var mon = null, md = 1e9;
      g.monsters.forEach(function (m) {
        if (!m.alive || m.isBoss && h.level < 8) return;
        var d = U.dist(h.x, h.y, m.x, m.y);
        if (d < 900 && d < md) { md = d; mon = m; }
      });
      if (mon && hpR > 0.5) { h.target = mon; return; }
    }

    var t = enemyTowerNear(g, h, h.x, h.y, 760);
    if (t && allyMinionsNear >= 2) { h.target = t; return; }
    var core = g.cores.filter(function (c) { return c.alive && c.team !== h.team; })[0];
    if (core && U.dist(h.x, h.y, core.x, core.y) < 820 && (allyMinionsNear >= 1 || g.time > 1080)) { h.target = core; return; }

    h.target = null;
  }

  function aiAct(g, h, dt) {
    var hpR = h.hp / h.maxHp;
    var b = W.BASES[h.team];
    var dir = h.team === 0 ? 1 : -1;
    var L = W.LANES[h.lane].total;

    if (h.retreat) {
      moveToward(g, h, b.x, b.y, dt, 60);
      if (isInFountain(g, h)) {
        h.target = null;
        if (h.hp / h.maxHp > 0.85) h.retreat = false;
        tryBuy(g, h);
      }
      return;
    }

    // 在泉水中买装备
    if (isInFountain(g, h)) tryBuy(g, h);

    // 技能释放
    var tgt = h.target;
    if (tgt && tgt.alive) {
      var d = U.dist(h.x, h.y, tgt.x, tgt.y);
      var isHeroTgt = tgt.kind === 'hero';
      // 控制/爆发对英雄
      for (var i = h.skills.length - 1; i >= 0; i--) {
        var s = h.skills[i];
        var def = s.def;
        if (s.cd > 0 || h.mp < def.mp) continue;
        var inRange = d < (def.range || 500) + 40;
        if (def.type === 'heal' || def.type === 'shieldAll') {
          var hurt = g.heroes.filter(function (o) { return o.team === h.team && o.alive && o.hp / o.maxHp < 0.6 && U.dist(o.x, o.y, h.x, h.y) < (def.radius || 400); });
          if (hurt.length > 0) { castSkill(g, h, i); return; }
          continue;
        }
        if (def.type === 'self') {
          if (isHeroTgt && d < 420) { castSkill(g, h, i); return; }
          continue;
        }
        if (!inRange) continue;
        if (!isHeroTgt && def.type !== 'aoeSelf' && def.type !== 'proj') continue;
        if (def.type === 'dash' && d < 120) continue;
        // R 技能保守一点
        if (i === 2 && !isHeroTgt && d > 260) continue;
        castSkill(g, h, i);
        return;
      }
      if (d > h.range + tgt.r - 8) moveToward(g, h, tgt.x, tgt.y, dt, h.range + tgt.r - 14);
      else h.facing = Math.atan2(tgt.y - h.y, tgt.x - h.x);
      return;
    }

    // 无目标：沿兵线推进
    var pd = clamp(h.pathD + dir * 150, 200, L - 200);
    var wp = W.lanePos(h.lane, pd);
    var reached = moveToward(g, h, wp.x, wp.y, dt, 40);
    h.pathD = clamp(h.pathD + dir * 150 * (reached ? 1 : 0), 200, L - 200);
    if (reached) h.pathD = clamp(h.pathD + dir * 150, 200, L - 200);
  }

  function tryBuy(g, h) {
    var order = ROLE_BUILD[h.role] || ROLE_BUILD['战士'];
    if (h.items.length >= 6) return;
    var best = null, bestCost = -1;
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      if (h.items.indexOf(id) >= 0) continue;
      var it = ITEM_MAP[id];
      if (!it) continue;
      // 优先买“下一步能负担的最贵装备”，避免把钱花在垃圾上
      if (it.cost <= h.gold && it.cost > bestCost) { best = it; bestCost = it.cost; }
    }
    if (best) {
      h.gold -= best.cost;
      h.items.push(best.id);
      recalc(h);
      addEffect(g, { type: 'buff', x: h.x, y: h.y, r: 50, color: '#ffd85e', dur: 0.5 });
    }
  }

  function buyForPlayer(g, h, itemId) {
    if (!isInFountain(g, h)) return { ok: false, msg: '只能在泉水购买' };
    var it = ITEM_MAP[itemId];
    if (!it) return { ok: false, msg: '物品不存在' };
    if (h.items.length >= 6) return { ok: false, msg: '装备栏已满（6 件）' };
    if (h.gold < it.cost) return { ok: false, msg: '金币不足' };
    h.gold -= it.cost;
    h.items.push(itemId);
    recalc(h);
    return { ok: true, msg: '已购买 ' + it.name };
  }

  function sellForPlayer(g, h, index) {
    if (!isInFountain(g, h)) return { ok: false, msg: '只能在泉水出售' };
    var id = h.items[index];
    if (!id) return { ok: false, msg: '没有该装备' };
    var it = ITEM_MAP[id];
    h.gold += Math.floor(it.cost * 0.6);
    h.items.splice(index, 1);
    recalc(h);
    return { ok: true, msg: '已出售 ' + it.name };
  }

  /* ---------------- 新开一局 ---------------- */
  function newGame(opts) {
    opts = opts || {};
    ID = 1; WAVE_N = 0;
    var g = {
      time: 0, over: false, winner: -1, endTime: 0,
      heroes: [], minions: [], towers: [], cores: [], monsters: [], projectiles: [],
      zones: [], effects: [], texts: [], feed: [],
      vision: { 0: newVision(), 1: newVision() },
      kills: [0, 0], towerDown: [0, 0],
      waveTimer: 6, input: { moveX: 0, moveY: 0, cast: null, attack: false, aim: null },
      player: null, aura: 0
    };
    // 塔
    W.towerSpots().forEach(function (sp) { g.towers.push(makeTower(g, sp)); });
    // 水晶
    g.cores.push(makeCore(g, 0));
    g.cores.push(makeCore(g, 1));
    // 野怪
    W.CAMPS.forEach(function (c) { g.monsters.push(makeMonster(g, c)); });
    g.monsters.push(makeMonster(g, { x: W.BOSS.x, y: W.BOSS.y, kind: 'boss', boss: true }));

    // 英雄
    var heroDefs = D.HEROES.slice();
    var playerDef = opts.heroId ? D.HEROES.filter(function (x) { return x.id === opts.heroId; })[0] : heroDefs[0];
    var pool = U.shuffle(heroDefs.filter(function (x) { return x !== playerDef; }));
    var lanes0 = ['mid', 'top', 'jungle', 'bot', 'bot'];
    var lanes1 = ['top', 'mid', 'jungle', 'bot', 'bot'];

    var p = makeHero(g, 0, playerDef, 'mid', true);
    g.heroes.push(p); g.player = p;
    for (var i = 0; i < 4; i++) {
      g.heroes.push(makeHero(g, 0, pool[i % pool.length], lanes0[i + 1], false));
    }
    for (var j = 0; j < 5; j++) {
      g.heroes.push(makeHero(g, 1, pool[(j + 4) % pool.length], lanes1[j], false));
    }
    // 初始兵线
    spawnWave(g);
    updateVision(g);
    return g;
  }

  return {
    newGame: newGame,
    update: update,
    castSkill: castSkill,
    buyForPlayer: buyForPlayer,
    sellForPlayer: sellForPlayer,
    canSee: canSee,
    visibleAt: function (g, team, x, y) { return visibleAt(g.vision[team], x, y); },
    isInFountain: isInFountain,
    recalc: recalc,
    addBuff: addBuff,
    effSpeed: effSpeed,
    ITEM_MAP: ITEM_MAP,
    TOWER_STAT: TOWER_STAT,
    spawnWave: spawnWave
  };
})();
