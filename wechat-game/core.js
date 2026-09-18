/* =========================================================
 * 《老街新生》微信小游戏 · 核心逻辑 core.js
 * 纯逻辑无渲染: 双环境(wx小游戏/浏览器预览)共用
 * 数值对齐: economy_sim / 数值设计文档 §3.4 (逆向参数)
 * 含: 金币产出/升级/繁荣/解锁/每日租金/离线收益/策略卡
 *     特殊顾客/每日任务(2026-09-19 新增)
 * ========================================================= */
(function (global) {
'use strict';

// ---------- 逆向参数 ----------
var SHOPS = [
  { name: "配钥匙铺", T0: 100, S0: 10, a_t: .12, r_s: 1.08, C0: 50,  r_c: 1.10, unlock: 0,    build: 0,     icon: "🔑" },
  { name: "自行车铺", T0: 120, S0: 12, a_t: .12, r_s: 1.08, C0: 60,  r_c: 1.10, unlock: 260,  build: 5000,  icon: "🚲" },
  { name: "纪念品铺", T0: 140, S0: 15, a_t: .12, r_s: 1.08, C0: 80,  r_c: 1.10, unlock: 500,  build: 12000, icon: "🎁" },
  { name: "茶馆",     T0: 160, S0: 18, a_t: .12, r_s: 1.08, C0: 100, r_c: 1.10, unlock: 900,  build: 20000, icon: "🍵" },
  { name: "书画斋",   T0: 180, S0: 22, a_t: .12, r_s: 1.09, C0: 130, r_c: 1.11, unlock: 1500, build: 30000, icon: "🖼️" }
];
var PROSP_GAIN = { 0: [[1,10,5],[11,30,8]], 1: [[1,10,6]], 2: [[1,20,10]], 3: [[1,10,9],[11,30,12]], 4: [[1,20,12]] };
var MILESTONES = [[110, "繁荣110 +5000币", 5000], [500, "繁荣500 +3600加速", 0], [1000, "繁荣1000 广告翻倍", 0], [2000, "繁荣2000 抽卡", 0]];
var CARDS = [
  { id: 1001, rar: "common", name: "老主顾",   icon: "👴", type: "add",  target: "traffic", val: .15 },
  { id: 1002, rar: "common", name: "金字招牌", icon: "🏮", type: "add",  target: "spend",   val: .20 },
  { id: 1003, rar: "rare",   name: "人气网红", icon: "📸", type: "mult", target: "traffic", val: .25 },
  { id: 1004, rar: "rare",   name: "老街物业", icon: "🏘️", type: "add", target: "rent",    val: .10 },
  { id: 1005, rar: "common", name: "熟客",     icon: "🙂", type: "add",  target: "traffic", val: .10 },
  { id: 1006, rar: "common", name: "公道价",   icon: "⚖️", type: "add",  target: "spend",   val: .10 },
  { id: 1007, rar: "common", name: "街坊关系", icon: "🤝", type: "add",  target: "rent",    val: .05 },
  { id: 1008, rar: "rare",   name: "匠心手作", icon: "🛠️", type: "mult", target: "spend",   val: .20 }
];
var TASKS = [
  { id: 2001, name: "收益领取", desc: "结算或看广告 3/6/9 次", tiers: [3, 6, 9],   reward: "2min",    rdesc: "2分钟收益" },
  { id: 2002, name: "服务顾客", desc: "累计服务 250/500/1000 人", tiers: [250, 500, 1000], reward: "coin500", rdesc: "+500币" },
  { id: 2003, name: "在线时长", desc: "今日在线 20/30 分钟", tiers: [1200, 1800], reward: "speed600", rdesc: "600秒加速" }
];
var P = { eta: .5, tOffMax: 8 * 3600, kAd: 2, promo: .5, gMax: 10, rentBase: 200, rRent: 1.15, custT: [60, 80, 100, 125, 150] };
var KEY = "laojie_mvp_v1";

// ---------- 状态 ----------
function defaultState() {
  return {
    coins: 0, prosper: 0, day: 1, owe: 0,
    shops: [{ lv: 1, on: true }, { lv: 1, on: false }, { lv: 1, on: false }, { lv: 1, on: false }, { lv: 1, on: false }],
    cards: [], msHit: [], cust: 0, adUsed: false, last: Date.now(),
    boost: 0, onlineSec: 0, taskClaimed: {}, special: null, specialAt: 0, speedUntil: 0
  };
}
function load() {
  try { var d = global.wx && wx.getStorageSync ? wx.getStorageSync(KEY) : JSON.parse(localStorage.getItem(KEY)); return d || defaultState(); }
  catch (e) { return defaultState(); }
}
function save() {
  S.last = Date.now();
  var raw = JSON.stringify(S);
  if (global.wx && wx.setStorageSync) wx.setStorageSync(KEY, raw); else localStorage.setItem(KEY, raw);
}
var S = load();

// ---------- 数值 ----------
function gEff() {
  var add = P.promo, mult = 0, rentRed = 0;
  S.cards.forEach(function (cid) {
    var cd = CARDS[cid - 1001]; if (!cd) return;
    if (cd.target === "rent") rentRed += cd.val;
    else if (cd.type === "mult") mult += cd.val; else add += cd.val;
  });
  return { g: Math.min((1 + add) * (1 + mult), P.gMax), rentRed: rentRed };
}
function shopRate(i) {
  var sh = SHOPS[i], lv = S.shops[i].lv;
  return sh.T0 * (1 + sh.a_t * (lv - 1)) * sh.S0 * Math.pow(sh.r_s, lv - 1) / 3600;
}
function totalRate() {
  var g = gEff().g, speed = (Date.now() < S.speedUntil) ? 2 : 1;
  var base = 0;
  for (var i = 0; i < SHOPS.length; i++) if (S.shops[i].on) base += shopRate(i);
  return base * g * speed;
}
function upCost(i) { var sh = SHOPS[i]; return sh.C0 * Math.pow(sh.r_c, S.shops[i].lv - 1); }
function prospGain(i, lv) {
  var arr = PROSP_GAIN[i] || [[1, 999, 5]];
  for (var k = 0; k < arr.length; k++) if (lv >= arr[k][0] && lv <= arr[k][1]) return arr[k][2];
  return arr[arr.length - 1][2];
}
function rentDay(d) { return P.rentBase * Math.pow(P.rRent, d - 1); }
function custTarget(d) { return P.custT[Math.min(d - 1, P.custT.length - 1)]; }
function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.floor(n) + "";
}

// ---------- 交互操作 ----------
var _toast = null; // {text, until}
function toast(t) { _toast = { text: t, until: Date.now() + 2000 }; }
function checkMilestones() {
  MILESTONES.forEach(function (m) {
    if (S.prosper >= m[0] && S.msHit.indexOf(m[0]) < 0) {
      S.msHit.push(m[0]);
      if (m[2] > 0) S.coins += m[2];
      toast("里程碑 " + m[1]);
    }
  });
}
function upgrade(i) {
  if (!S.shops[i].on) return;
  var c = upCost(i);
  if (S.coins < c) { toast("金币不足"); return; }
  S.coins -= c; S.shops[i].lv++; S.prosper += prospGain(i, S.shops[i].lv);
  checkMilestones(); save();
}
function tryUnlock(i) {
  if (S.shops[i].on) return;
  var sh = SHOPS[i];
  if (S.prosper >= sh.unlock && S.coins >= sh.build) {
    S.coins -= sh.build; S.shops[i].on = true; toast("🏠 解锁 " + sh.name); save();
  } else if (S.prosper >= sh.unlock) toast("金币不足, 无法修建");
  else toast("需要繁荣 " + sh.unlock);
}
function settle() {
  var rr = gEff().rentRed;
  var rt = rentDay(S.day) * (1 - rr);
  if (S.owe > 0) { rt += S.owe; S.owe = 0; }
  if (S.coins >= rt) S.coins -= rt; else { S.owe += rt - S.coins; S.coins = 0; }
  S.day++; S.cust = 0; S.adUsed = false; S.boost++;
  toast("第" + S.day + "天 · 已付租金 " + fmt(rt)); save();
}
function drawCard() {
  if (S.coins < 5000) { toast("抽卡需5000币"); return; }
  S.coins -= 5000;
  var id = 1001 + Math.floor(Math.random() * CARDS.length);
  S.cards.push(id);
  var cd = CARDS[id - 1001];
  toast("抽到 [" + (cd.rar === "rare" ? "稀有" : "普通") + "] " + cd.name); save();
}
function adDouble() {
  if (S.adUsed) { toast("今日已用过广告翻倍"); return; }
  var gain = totalRate() * 3600 * P.eta * P.kAd;
  S.coins += gain; S.adUsed = true; S.boost++;
  toast("广告翻倍 +" + fmt(gain) + "币"); save();
}

// ---------- 特殊顾客 (2026-09-19) ----------
var SPECIAL_TYPES = [
  { type: "阔佬",   icon: "🎩", reward: "coin",  amount: 600 },
  { type: "艺人",   icon: "🎭", reward: "prosp", amount: 80 },
  { type: "游客",   icon: "🧳", reward: "coin",  amount: 300 }
];
function newSpecial() {
  var t = SPECIAL_TYPES[Math.floor(Math.random() * SPECIAL_TYPES.length)];
  S.special = { type: t.type, icon: t.icon, reward: t.reward, amount: t.amount, until: Date.now() + 30000 };
}
function serveSpecial() {
  if (!S.special) return;
  var sp = S.special;
  if (sp.reward === "coin") { var v = totalRate() * sp.amount; S.coins += v; toast(sp.icon + " " + sp.type + " 打赏 +" + fmt(v) + "币"); }
  else { S.prosper += sp.amount; toast(sp.icon + " " + sp.type + " 助力 繁荣+" + sp.amount); }
  S.special = null; S.specialAt = Date.now(); checkMilestones(); save();
}

// ---------- 每日任务 (2026-09-19, daily_task.xlsx 逆向) ----------
function taskProgress(tid) {
  if (tid === 2001) return S.boost;
  if (tid === 2002) return Math.floor(S.cust);
  if (tid === 2003) return Math.floor(S.onlineSec);
  return 0;
}
function claimTask(tid, tierIdx) {
  var t = TASKS[0], ti = -1;
  for (var i = 0; i < TASKS.length; i++) if (TASKS[i].id === tid) { t = TASKS[i]; ti = i; }
  if (ti < 0) return;
  var key = tid + "_" + tierIdx;
  if (S.taskClaimed[key]) return;
  var need = t.tiers[tierIdx];
  if (taskProgress(tid) < need) { toast("进度未达标"); return; }
  S.taskClaimed[key] = true;
  if (t.reward === "2min") { var v = totalRate() * 120; S.coins += v; toast("任务奖励 +" + fmt(v) + "币"); }
  else if (t.reward === "coin500") { S.coins += 500; toast("任务奖励 +500币"); }
  else if (t.reward === "speed600") { S.speedUntil = Date.now() + 600000; toast("任务奖励 600秒加速"); }
  save();
}

// ---------- 离线结算 ----------
function offlineGain() {
  var dt = (Date.now() - S.last) / 1000;
  if (dt < 10) return;
  var cap = Math.min(dt, P.tOffMax);
  var gain = totalRate() * cap * P.eta;
  if (gain > 50) { S.coins += gain; toast("离线 " + Math.floor(cap / 60) + " 分钟收益 +" + fmt(gain) + "币"); }
}

// ---------- 主循环 tick ----------
function tick(dt) {
  S.coins += totalRate() * dt;
  S.cust += totalRate() * dt / 10;
  S.onlineSec += dt;
  // 特殊顾客生成: 距上次接待 2-5 分钟随机
  if (!S.special && (Date.now() - S.specialAt > 120000 + Math.random() * 180000)) newSpecial();
  // 特殊顾客过期
  if (S.special && Date.now() > S.special.until) { S.special = null; S.specialAt = Date.now(); }
}

global.Core = {
  SHOPS: SHOPS, PROSP_GAIN: PROSP_GAIN, MILESTONES: MILESTONES, CARDS: CARDS, TASKS: TASKS, P: P,
  S: S, save: save, load: load,
  gEff: gEff, shopRate: shopRate, totalRate: totalRate, upCost: upCost, prospGain: prospGain,
  rentDay: rentDay, custTarget: custTarget, fmt: fmt,
  upgrade: upgrade, tryUnlock: tryUnlock, settle: settle, drawCard: drawCard, adDouble: adDouble,
  checkMilestones: checkMilestones, newSpecial: newSpecial, serveSpecial: serveSpecial,
  taskProgress: taskProgress, claimTask: claimTask,
  offlineGain: offlineGain, tick: tick,
  toast: toast, getToast: function () { return _toast; }
};

})(typeof window !== "undefined" ? window : globalThis);
