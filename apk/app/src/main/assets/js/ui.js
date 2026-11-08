window.UI = (function () {
  var U = window.U, D = window.DATA, SIMW = null;
  var el = {};
  var lastFeed = 0;
  var skillEls = [];
  var shopOpen = false;
  var handlers = {};

  function $(id) { return document.getElementById(id); }

  function heroImg(id) {
    if (window.IMG && window.IMG[id]) return window.IMG[id];
    return 'img/hero_' + id + '.png';
  }

  function init(h) {
    handlers = h || {};
    el.hud = $('hud');
    el.timer = $('timer');
    el.sb = $('scoreBlue');
    el.sr = $('scoreRed');
    el.lv = $('pLevel');
    el.hp = $('pHp');
    el.hpTxt = $('pHpTxt');
    el.mp = $('pMp');
    el.mpTxt = $('pMpTxt');
    el.pname = $('pName');
    el.gold = $('pGold');
    el.feed = $('feed');
    el.deadMask = $('deadMask');
    el.respawnCd = $('respawnCd');
    el.minimap = $('minimap');
    el.shop = $('shop');
    el.result = $('result');
    el.shopGold = $('shopGold');
    el.shopGrid = $('shopGrid');
    el.ownedList = $('ownedList');
    el.slotCount = $('slotCount');
    el.shopMsg = $('shopMsg');
    el.resultTitle = $('resultTitle');
    el.resultStats = $('resultStats');
    el.avatar = $('pAvatar');
    el.actions = $('actions');

    // 技能按钮加冷却层
    skillEls = [];
    document.querySelectorAll('.skill').forEach(function (btn) {
      var fill = document.createElement('div');
      fill.className = 'cdfill';
      fill.style.display = 'none';
      btn.appendChild(fill);
      var label = document.createElement('span');
      btn.appendChild(label);

      skillEls.push({ btn: btn, fill: fill, label: label, idx: +btn.dataset.i });
    });

    $('btnShopClose').onclick = function () { closeShop(); };
    $('btnShop').onclick = function () { openShop(); };
    $('btnAgain').onclick = function () {
      el.result.classList.add('hidden');
      if (handlers.onRestart) handlers.onRestart();
    };
  }

  function buildHeroGrid(onPick) {
    var grid = $('heroGrid');
    grid.innerHTML = '';
    D.HEROES.forEach(function (h) {
      var card = document.createElement('div');
      card.className = 'heroCard';
      card.innerHTML =
        '<div class="art"><img src="' + heroImg(h.id) + '" alt="">' +
        '<span class="rl">' + h.role + ' · ' + h.title + '</span></div>' +
        '<div class="nm">' + h.name + '</div>' +
        '<div class="sk">' + h.skills.map(function (s) { return '<i>' + s.k.toUpperCase() + '</i> ' + s.name; }).join('<br>') + '</div>';
      card.onclick = function () { onPick(h.id); };
      grid.appendChild(card);
    });
  }

  function updateHUD(g) {
    if (!g) return;
    var p = g.player;
    if (!updateHUD._hero || updateHUD._hero !== p.def.id) {
      updateHUD._hero = p.def.id;
      if (el.avatar) el.avatar.src = heroImg(p.def.id);
      skillEls.forEach(function (se) {
        var s = p.skills[se.idx];
        if (!s) return;
        var b = se.btn.querySelector('b');
        if (b) b.textContent = s.def.name;
      });
    }
    el.timer.textContent = U.fmtTime(g.time);
    el.sb.textContent = g.kills[0];
    el.sr.textContent = g.kills[1];
    el.lv.textContent = p.level;
    var hpR = Math.max(0, p.hp / p.maxHp);
    el.hp.style.transform = 'scaleX(' + hpR + ')';
    el.hpTxt.textContent = Math.ceil(p.hp) + ' / ' + Math.ceil(p.maxHp);
    el.mp.style.transform = 'scaleX(' + Math.max(0, p.mp / Math.max(1, p.maxMp)) + ')';
    el.mpTxt.textContent = Math.ceil(p.mp) + ' / ' + Math.ceil(p.maxMp);
    el.pname.textContent = p.name + ' · Lv' + p.level;
    el.gold.textContent = '金币 ' + Math.floor(p.gold);

    // 技能
    for (var i = 0; i < skillEls.length; i++) {
      var se = skillEls[i], s = p.skills[i];
      if (!s) continue;
      var def = s.def;
      var maxCd = def.cd * (1 - (p.cdr || 0));
      var ready = s.cd <= 0 && p.mp >= def.mp;
      se.btn.classList.toggle('ready', ready);
      if (s.cd > 0) {
        se.fill.style.display = 'block';
        se.fill.style.clipPath = 'inset(' + (100 * (1 - s.cd / maxCd)) + '% 0 0 0)';
        se.label.textContent = Math.ceil(s.cd) + 's';
      } else {
        se.fill.style.display = 'none';
        se.label.textContent = def.name;
      }
    }

    // 死亡遮罩
    if (!p.alive) {
      el.actions.classList.add('disabled');
      el.deadMask.classList.remove('hidden');
      el.respawnCd.textContent = Math.ceil(Math.max(0, p.respawnT));
    } else {
      el.actions.classList.remove('disabled');
      el.deadMask.classList.add('hidden');
    }

    // 击杀播报
    if (g.feed.length > lastFeed) {
      for (var k = lastFeed; k < g.feed.length; k++) {
        var f = g.feed[k];
        var d = document.createElement('div');
        d.className = 'feedItem';
        var kc = f.killerTeam === 0 ? 'b' : (f.killerTeam === 1 ? 'r' : '');
        var vc = f.victimTeam === 0 ? 'b' : 'r';
        d.innerHTML = '<span class="' + kc + '">' + f.killer + '</span> 击杀 <span class="' + vc + '">' + f.victim + '</span>';
        el.feed.appendChild(d);
        (function (node) {
          setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 5200);
        })(d);
      }
      while (el.feed.children.length > 4) el.feed.removeChild(el.feed.firstChild);
      lastFeed = g.feed.length;
    }

    // 商店数值实时刷新
    if (shopOpen) {
      el.shopGold.textContent = '金币 ' + Math.floor(p.gold);
      renderOwned(p);
    }
  }

  function statText(stat) {
    var map = { hp: '生命', atk: '攻击', ap: '法强', armor: '护甲', mr: '魔抗', as: '攻速', ms: '移速', lifesteal: '吸血', cdr: '冷却' };
    var pct = { as: 1, ms: 1, lifesteal: 1, cdr: 1 };
    var out = [];
    for (var k in stat) {
      var v = stat[k];
      out.push(map[k] + ' +' + v + (pct[k] ? '%' : ''));
    }
    return out.join(' · ');
  }

  function openShop() {
    var g = window.GAME;
    if (!g) return;
    if (!SIMW.isInFountain(g, g.player)) {
      flash('需要回到己方泉水才能购买装备');
      return;
    }
    shopOpen = true;
    el.shop.classList.remove('hidden');
    el.shopMsg.textContent = '';
    renderShop(g);
  }
  function closeShop() { shopOpen = false; el.shop.classList.add('hidden'); }
  function isShopOpen() { return shopOpen; }

  function renderShop(g) {
    var p = g.player;
    el.shopGold.textContent = '金币 ' + Math.floor(p.gold);
    el.shopGrid.innerHTML = '';
    D.ITEMS.forEach(function (it) {
      var card = document.createElement('div');
      card.className = 'itemCard';
      card.innerHTML = '<div class="nm">' + it.name + '</div><div class="cost">' + it.cost + ' 金币</div><div class="st">' + statText(it.stat) + '</div>';
      card.onclick = function () {
        var r = handlers.onBuy(it.id);
        el.shopMsg.textContent = r.msg;
        renderShop(g);
      };
      el.shopGrid.appendChild(card);
    });
    renderOwned(p);
  }

  function renderOwned(p) {
    el.slotCount.textContent = p.items.length + '/6';
    el.ownedList.innerHTML = '';
    if (!p.items.length) {
      el.ownedList.innerHTML = '<div class="ownedItem" style="opacity:.5;cursor:default">暂无装备</div>';
    }
    p.items.forEach(function (id, i) {
      var it = window.SIM.ITEM_MAP[id];
      var d = document.createElement('div');
      d.className = 'ownedItem';
      d.innerHTML = '<span>' + it.name + '</span><em>出售 ' + Math.floor(it.cost * 0.6) + '</em>';
      d.onclick = function () {
        var r = handlers.onSell(i);
        el.shopMsg.textContent = r.msg;
        renderShop(window.GAME);
      };
      el.ownedList.appendChild(d);
    });
  }

  function flash(msg) {
    if (el.shopMsg) el.shopMsg.textContent = msg;
    toast(msg);
  }

  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.add('hidden'); }, 2000);
  }

  function showResult(g) {
    var win = g.winner === g.player.team;
    el.resultTitle.textContent = win ? '胜利' : '失败';
    el.resultTitle.style.color = win ? '#ffe6a8' : '#ff9b8f';
    var p = g.player;
    el.resultStats.innerHTML =
      '对局时长 <b>' + U.fmtTime(g.time) + '</b><br>' +
      '团队击杀 <b>' + g.kills[0] + ' : ' + g.kills[1] + '</b><br>' +
      '你的战绩 <b>' + p.kills + ' / ' + p.deaths + '</b><br>' +
      '等级 <b>' + p.level + '</b> · 装备 <b>' + p.items.length + '</b> 件';
    el.result.classList.remove('hidden');
    closeShop();
  }

  function resetForNewGame() {
    lastFeed = 0;
    el.feed.innerHTML = '';
    el.result.classList.add('hidden');
    el.deadMask.classList.add('hidden');
    closeShop();
  }

  return {
    init: init, buildHeroGrid: buildHeroGrid, updateHUD: updateHUD,
    showResult: showResult, resetForNewGame: resetForNewGame,
    openShop: openShop, closeShop: closeShop, isShopOpen: isShopOpen,
    setSim: function (s) { SIMW = s; },
    toast: toast
  };
})();
