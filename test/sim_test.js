// 无头对局测试：验证战斗内核能跑完一局且状态合法
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const base = path.join(__dirname, '..', 'apk/app/src/main/assets/js');
const ctx = { console, Math, Date, JSON };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['util.js', 'data.js', 'world.js', 'sim.js']) {
  vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), ctx, { filename: f });
}

const SIM = ctx.window.SIM;
const g = SIM.newGame({ heroId: 'star' });
g.player.isPlayer = false;      // 让“玩家”也交给 AI 跑，做压力测试
g.player.think = 0;

const dt = 1 / 30;
let steps = 0;
const maxSteps = 30 * 60 * 25; // 最多 25 分钟
const t0 = Date.now();

while (!g.over && steps < maxSteps) {
  SIM.update(g, dt);
  steps++;
  if (steps % (30 * 60) === 0) {
    const towers = g.towers.filter(t => t.alive).length;
    const cores = g.cores.filter(c => c.alive).map(c => Math.round(c.hp));
    const mx = Math.max(...g.heroes.map(h => h.level));
    console.log(`[${(steps / 30 / 60).toFixed(0)}min] 塔存活=${towers} 水晶=${cores} 击杀=${g.kills} 最高等级=${mx} 单位数=${g.minions.length}`);
  }
}

const dur = ((Date.now() - t0) / 1000).toFixed(1);
console.log('---');
console.log('结束:', g.over, '胜方:', g.winner, '用时:', (g.time / 60).toFixed(1) + '分', '真实耗时:', dur + 's');
console.log('击杀比分:', g.kills.join(':'), '推塔:', g.towerDown.join(':'));
console.log('英雄:', g.heroes.map(h => `${h.name}(${h.team})Lv${h.level} ${Math.round(h.hp)}/${Math.round(h.maxHp)} k${h.kills}d${h.deaths} 金${Math.round(h.gold)} 装${h.items.length}`).join(' | '));

// 合法性检查
let bad = 0;
g.heroes.forEach(h => {
  if (h.hp > h.maxHp + 1) { console.log('!! HP 溢出', h.name); bad++; }
  if (h.x < 0 || h.y < 0 || h.x > 3200 || h.y > 3200) { console.log('!! 越界', h.name); bad++; }
  if (isNaN(h.hp) || isNaN(h.x)) { console.log('!! NaN', h.name); bad++; }
  if (h.items.length > 6) { console.log('!! 装备超 6 件', h.name); bad++; }
});
console.log('异常项:', bad);
