(function () {
  // 全部原创英雄与装备，不涉及任何第三方 IP
  var HEROES = [
    {
      id: 'ironwall', name: '铁壁', title: '不动的城墙', role: '坦克', color: '#5d7fd1', accent: '#b5cdff',
      base: { hp: 980, mp: 320, atk: 74, armor: 34, mr: 32, as: 0.72, ms: 336, range: 155, ap: 0 },
      grow: { hp: 108, mp: 30, atk: 5.4, armor: 4.4, mr: 1.6, as: 0.015 },
      skills: [
        { k: 'q', name: '裂地冲撞', type: 'dash', cd: 9, mp: 55, range: 430, dmg: [120, 26], ratio: 0.6, rs: 'atk', dtype: 'phys', knock: 210, desc: '向前冲撞，撞飞路径上的敌人' },
        { k: 'w', name: '磐石壁垒', type: 'self', cd: 15, mp: 70, shield: [220, 55], dur: 4.5, slowRes: 0.5, dmg: [0, 0], desc: '获得护盾并短时间减速抗性' },
        { k: 'r', name: '大地震怒', type: 'aoeSelf', cd: 62, mp: 120, radius: 470, dmg: [260, 62], ratio: 0.9, rs: 'ap', dtype: 'magic', stun: 1.2, desc: '以自身为中心震裂大地，眩晕周围敌人' }
      ]
    },
    {
      id: 'shadow', name: '影刃', title: '无声的刀', role: '刺客', color: '#8d4fc4', accent: '#e0b6ff',
      base: { hp: 810, mp: 340, atk: 86, armor: 26, mr: 26, as: 0.8, ms: 352, range: 150, ap: 0 },
      grow: { hp: 92, mp: 26, atk: 7.2, armor: 3.6, mr: 1.2, as: 0.022 },
      skills: [
        { k: 'q', name: '疾影突袭', type: 'dash', cd: 7.5, mp: 45, range: 400, dmg: [130, 30], ratio: 0.75, rs: 'atk', dtype: 'phys', desc: '瞬身突进并斩击路径敌人' },
        { k: 'w', name: '隐匿', type: 'self', cd: 16, mp: 60, stealth: 2.6, msBuff: 45, dur: 3, dmg: [0, 0], desc: '进入潜行并大幅提速' },
        { k: 'r', name: '影杀', type: 'strike', cd: 46, mp: 110, range: 230, dmg: [270, 72], ratio: 1.25, rs: 'atk', dtype: 'phys', desc: '对单体目标造成爆发伤害' }
      ]
    },
    {
      id: 'star', name: '星语', title: '观星的术士', role: '法师', color: '#3f8ad6', accent: '#a9e6ff',
      base: { hp: 730, mp: 480, atk: 56, armor: 22, mr: 30, as: 0.7, ms: 336, range: 520, ap: 30 },
      grow: { hp: 82, mp: 52, atk: 3.6, armor: 3.0, mr: 1.4, as: 0.012 },
      skills: [
        { k: 'q', name: '星火', type: 'proj', cd: 5, mp: 45, range: 640, speed: 940, radius: 26, dmg: [130, 34], ratio: 0.6, rs: 'ap', dtype: 'magic', desc: '射出一枚星火弹' },
        { k: 'w', name: '霜环', type: 'aoe', cd: 11, mp: 75, range: 560, radius: 180, dmg: [110, 26], ratio: 0.5, rs: 'ap', dtype: 'magic', slow: 0.45, slowDur: 2.5, desc: '冻结地面，减速区域内敌人' },
        { k: 'r', name: '陨星天罚', type: 'aoe', cd: 70, mp: 130, range: 720, radius: 265, delay: 0.75, dmg: [400, 108], ratio: 1.2, rs: 'ap', dtype: 'magic', desc: '召唤陨星轰击目标区域' }
      ]
    },
    {
      id: 'gale', name: '疾风', title: '逐风的射手', role: '射手', color: '#2f9e77', accent: '#b6f0d4',
      base: { hp: 780, mp: 330, atk: 82, armor: 24, mr: 24, as: 0.86, ms: 340, range: 560, ap: 0 },
      grow: { hp: 88, mp: 26, atk: 6.6, armor: 3.4, mr: 1.1, as: 0.03 },
      skills: [
        { k: 'q', name: '疾行', type: 'self', cd: 12, mp: 40, asBuff: 55, msBuff: 28, dur: 4, dmg: [0, 0], desc: '短时间大幅提升攻速与移速' },
        { k: 'w', name: '穿云箭', type: 'proj', cd: 7, mp: 55, range: 780, speed: 1250, radius: 30, pierce: true, dmg: [150, 36], ratio: 1.0, rs: 'atk', dtype: 'phys', desc: '射出穿透箭矢' },
        { k: 'r', name: '猎风之矢', type: 'proj', cd: 55, mp: 110, range: 1450, speed: 1650, radius: 40, dmg: [330, 92], ratio: 1.5, rs: 'atk', dtype: 'phys', desc: '超远程狙击，命中重创目标' }
      ]
    },
    {
      id: 'mountain', name: '山岳', title: '负山者', role: '辅助', color: '#a07b3c', accent: '#f0dba8',
      base: { hp: 940, mp: 400, atk: 66, armor: 32, mr: 30, as: 0.7, ms: 332, range: 170, ap: 10 },
      grow: { hp: 104, mp: 40, atk: 4.4, armor: 4.0, mr: 1.5, as: 0.014 },
      skills: [
        { k: 'q', name: '大地嘲讽', type: 'aoeSelf', cd: 15, mp: 60, radius: 330, dmg: [90, 22], ratio: 0.4, rs: 'ap', dtype: 'magic', taunt: 1.2, desc: '嘲讽周围敌人，迫使其攻击自己' },
        { k: 'w', name: '山泉之息', type: 'heal', cd: 17, mp: 80, radius: 520, heal: [150, 38], hratio: 0.45, desc: '治疗自身与附近友军' },
        { k: 'r', name: '石封结界', type: 'aoe', cd: 66, mp: 120, range: 480, radius: 300, dmg: [200, 52], ratio: 0.7, rs: 'ap', dtype: 'magic', stun: 1.4, desc: '在目标区域升起石柱，眩晕敌人' }
      ]
    },
    {
      id: 'plume', name: '翎羽', title: '风中的翎', role: '法师', color: '#c4557f', accent: '#ffc4d8',
      base: { hp: 760, mp: 440, atk: 62, armor: 23, mr: 28, as: 0.72, ms: 340, range: 460, ap: 22 },
      grow: { hp: 84, mp: 46, atk: 4.2, armor: 3.2, mr: 1.3, as: 0.018 },
      skills: [
        { k: 'q', name: '羽刃', type: 'proj', cd: 5.5, mp: 42, range: 620, speed: 1000, radius: 24, dmg: [115, 29], ratio: 0.55, rs: 'ap', dtype: 'magic', desc: '掷出锋利的翎羽' },
        { k: 'w', name: '掠羽', type: 'dash', cd: 10, mp: 55, range: 340, dmg: [70, 18], ratio: 0.3, rs: 'ap', dtype: 'magic', shield: [110, 30], desc: '向指定方向轻掠并获得护盾' },
        { k: 'r', name: '千羽风暴', type: 'aoe', cd: 60, mp: 125, range: 640, radius: 300, dmg: [300, 80], ratio: 1.0, rs: 'ap', dtype: 'magic', slow: 0.35, slowDur: 2, desc: '召唤羽刃风暴切割区域' }
      ]
    },
    {
      id: 'blaze', name: '赤焰', title: '燎原之刃', role: '战士', color: '#c8552e', accent: '#ffcf9e',
      base: { hp: 880, mp: 340, atk: 84, armor: 28, mr: 26, as: 0.78, ms: 344, range: 165, ap: 0 },
      grow: { hp: 96, mp: 28, atk: 6.4, armor: 3.8, mr: 1.2, as: 0.02 },
      skills: [
        { k: 'q', name: '烈焰斩', type: 'aoeSelf', cd: 6.5, mp: 40, radius: 270, dmg: [150, 34], ratio: 0.8, rs: 'atk', dtype: 'phys', desc: '挥出火焰横扫身前敌人' },
        { k: 'w', name: '燎原突进', type: 'dash', cd: 9, mp: 45, range: 380, dmg: [120, 28], ratio: 0.6, rs: 'atk', dtype: 'phys', desc: '向前突进并灼烧敌人' },
        { k: 'r', name: '焚天', type: 'self', cd: 60, mp: 110, atkBuff: 45, lifesteal: 25, dur: 8, dmg: [0, 0], desc: '进入燃烧状态，大幅提升攻击与吸血' }
      ]
    },
    {
      id: 'orchid', name: '幽兰', title: '静谧之息', role: '辅助', color: '#5f8f6a', accent: '#c9f2cf',
      base: { hp: 780, mp: 460, atk: 58, armor: 22, mr: 30, as: 0.68, ms: 338, range: 420, ap: 25 },
      grow: { hp: 86, mp: 50, atk: 3.4, armor: 3.0, mr: 1.4, as: 0.014 },
      skills: [
        { k: 'q', name: '幽光治愈', type: 'heal', cd: 11, mp: 70, radius: 470, heal: [160, 42], hratio: 0.5, desc: '治愈自身与附近友军' },
        { k: 'w', name: '兰影束缚', type: 'proj', cd: 8, mp: 55, range: 600, speed: 900, radius: 28, dmg: [100, 25], ratio: 0.45, rs: 'ap', dtype: 'magic', slow: 0.5, slowDur: 2.2, desc: '射出藤蔓缠绕敌人' },
        { k: 'r', name: '花海护佑', type: 'shieldAll', cd: 64, mp: 120, radius: 900, shield: [260, 65], dur: 5, msBuff: 25, dmg: [0, 0], desc: '为全队附加护盾与加速' }
      ]
    }
  ];

  var ITEMS = [
    { id: 'longsword', name: '长剑', cost: 500, icon: '剑', stat: { atk: 25 }, tag: '攻击' },
    { id: 'greatsword', name: '巨剑', cost: 1350, icon: '刃', stat: { atk: 60 }, tag: '攻击' },
    { id: 'wargod', name: '破军', cost: 2850, icon: '军', stat: { atk: 115, cdr: 10 }, tag: '攻击' },
    { id: 'tome', name: '秘典', cost: 620, icon: '典', stat: { ap: 55 }, tag: '法术' },
    { id: 'grimoire', name: '灾祸之书', cost: 2350, icon: '书', stat: { ap: 125 }, tag: '法术' },
    { id: 'staff', name: '巫师法杖', cost: 2150, icon: '杖', stat: { ap: 95, cdr: 15 }, tag: '法术' },
    { id: 'leather', name: '皮甲', cost: 400, icon: '甲', stat: { armor: 30 }, tag: '防御' },
    { id: 'plate', name: '板甲', cost: 1450, icon: '板', stat: { armor: 70 }, tag: '防御' },
    { id: 'cloak', name: '魔抗斗篷', cost: 520, icon: '袍', stat: { mr: 42 }, tag: '防御' },
    { id: 'belt', name: '生命腰带', cost: 820, icon: '带', stat: { hp: 420 }, tag: '防御' },
    { id: 'aegis', name: '不灭战铠', cost: 2600, icon: '铠', stat: { hp: 900, armor: 55 }, tag: '防御' },
    { id: 'boots', name: '疾行之靴', cost: 600, icon: '靴', stat: { ms: 6 }, tag: '移动' },
    { id: 'ninja', name: '影忍之靴', cost: 950, icon: '忍', stat: { ms: 6, armor: 30 }, tag: '移动' },
    { id: 'scythe', name: '吸血镰刀', cost: 1650, icon: '镰', stat: { atk: 45, lifesteal: 12 }, tag: '攻击' },
    { id: 'bow', name: '迅捷之弓', cost: 1800, icon: '弓', stat: { atk: 25, as: 35 }, tag: '攻击' },
    { id: 'ring', name: '圣者之戒', cost: 1200, icon: '戒', stat: { ap: 60, hp: 220 }, tag: '法术' },
    { id: 'blade', name: '破晓之刃', cost: 2900, icon: '曦', stat: { atk: 90, as: 25 }, tag: '攻击' },
    { id: 'orb', name: '虚空之球', cost: 2750, icon: '球', stat: { ap: 140, mr: 40 }, tag: '法术' }
  ];

  var MINION = {
    melee: { hp: 480, atk: 26, armor: 12, mr: 8, as: 0.9, ms: 190, range: 110, r: 17, gold: 32, xp: 26 },
    caster: { hp: 360, atk: 32, armor: 6, mr: 6, as: 0.75, ms: 190, range: 240, r: 15, gold: 38, xp: 30 },
    cannon: { hp: 900, atk: 55, armor: 20, mr: 12, as: 0.65, ms: 180, range: 300, r: 22, gold: 65, xp: 48 }
  };

  var XP_TABLE = [0, 180, 420, 740, 1140, 1620, 2200, 2880, 3660, 4560, 5580, 6720, 8000, 9400, 11000, 12800];

  window.DATA = {
    HEROES: HEROES,
    ITEMS: ITEMS,
    MINION: MINION,
    XP_TABLE: XP_TABLE,
    MAX_LEVEL: 15,
    RESPAWN: function (lv, t) { return Math.min(45, 6 + lv * 1.4 + t / 60 * 1.6); }
  };
})();
