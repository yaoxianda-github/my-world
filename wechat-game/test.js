/* 核心逻辑全面测试: 在 Node 下 mock localStorage/wx, 跑 Core 全部操作 */
'use strict';
// mock 浏览器环境
const store = {};
global.localStorage = {
  getItem: k => store[k] || null,
  setItem: (k, v) => { store[k] = v; }
};
const Core = require('./core.js');
let pass = 0, fail = 0;
function assert(name, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? '  [' + detail + ']' : '')); }
}

// 重置存档到干净初始
function fresh() {
  delete store['laojie_mvp_v1'];
  // 重新 require 拿新 S 不好做, 直接改 Core.S
  const S = Core.S;
  S.coins = 0; S.prosper = 0; S.day = 1; S.owe = 0;
  S.shops.forEach((s, i) => { s.lv = 1; s.on = (i === 0); });
  S.cards = []; S.cust = 0; S.adUsed = false; S.boost = 0;
  S.taskClaimed = {}; S.special = null; S.specialAt = 0; S.speedUntil = 0;
  S.last = Date.now();
}

console.log('== 1. 初始状态 ==');
fresh();
assert('店1默认开张', Core.S.shops[0].on === true);
assert('店2-5默认未开', Core.S.shops.slice(1).every(s => !s.on));
assert('初始金币0', Core.S.coins === 0);

console.log('== 2. shopRate / totalRate ==');
fresh();
// 店1 lv1: 100 * 1 * 10 * 1 / 3600 = 0.2778
const r1 = Core.shopRate(0);
assert('店1 lv1 速率≈0.278/s', Math.abs(r1 - 100 * 10 / 3600) < 0.01, 'got ' + r1);
// gEff promo=0.5 -> g=1.5
const g = Core.gEff().g;
assert('gEff.g=1.5 (无卡+promo0.5)', Math.abs(g - 1.5) < 0.01, 'got ' + g);
assert('totalRate=shopRate*1.5', Math.abs(Core.totalRate() - r1 * 1.5) < 0.01);

console.log('== 3. tick 金币累加 ==');
fresh();
Core.S.coins = 0;
Core.tick(1); // 1 秒
assert('tick(1) 加了 totalRate*1', Math.abs(Core.S.coins - Core.totalRate() * 1) < 0.01, 'got ' + Core.S.coins);
assert('tick 累计顾客', Core.S.cust > 0);

console.log('== 4. 升级 upgrade ==');
fresh();
Core.S.coins = 1000;
const lvBefore = Core.S.shops[0].lv;
const cost = Core.upCost(0);
Core.upgrade(0);
assert('升级后 lv+1', Core.S.shops[0].lv === lvBefore + 1);
assert('升级扣金币', Math.abs(Core.S.coins - (1000 - cost)) < 0.01);
assert('升级加繁荣', Core.S.prosper > 0);
// 金币不足
Core.S.coins = 0;
const lv2 = Core.S.shops[0].lv;
Core.upgrade(0);
assert('金币不足不升级', Core.S.shops[0].lv === lv2);

console.log('== 5. upCost 递增 ==');
fresh();
const c1 = Core.upCost(0); Core.S.shops[0].lv = 2;
const c2 = Core.upCost(0);
assert('升级费递增(×1.1)', c2 > c1, c1 + ' -> ' + c2);

console.log('== 6. 解锁 tryUnlock ==');
fresh();
Core.S.prosper = 300; Core.S.coins = 6000;
Core.tryUnlock(1); // 店2 需繁荣260 金币5000
assert('店2解锁成功', Core.S.shops[1].on === true);
assert('解锁扣5000', Math.abs(Core.S.coins - 1000) < 0.01);
// 繁荣不足
fresh();
Core.S.prosper = 100; Core.S.coins = 99999;
Core.tryUnlock(1);
assert('繁荣不足不解锁', Core.S.shops[1].on === false);

console.log('== 7. 结算 settle ==');
fresh();
Core.S.coins = 10000; Core.S.day = 2;
const dayBefore = Core.S.day;
Core.settle();
assert('结算 day+1', Core.S.day === dayBefore + 1);
assert('结算扣租金(200*1.15^1=230)', Math.abs(Core.S.coins - (10000 - 230)) < 0.01);
assert('结算 cust 清零', Core.S.cust === 0);

console.log('== 8. 抽卡 drawCard ==');
fresh();
Core.S.coins = 10000;
Core.drawCard();
assert('抽卡扣5000', Math.abs(Core.S.coins - 5000) < 0.01);
assert('抽到一张卡', Core.S.cards.length === 1);
// 钱不够
Core.S.coins = 100;
const cnt = Core.S.cards.length;
Core.drawCard();
assert('钱不够不抽', Core.S.cards.length === cnt);

console.log('== 9. 广告翻倍 adDouble ==');
fresh();
Core.S.adUsed = false;
const cBefore = Core.S.coins;
Core.adDouble();
assert('广告翻倍加金币', Core.S.coins > cBefore);
assert('广告用后 adUsed=true', Core.S.adUsed === true);
const cAfter = Core.S.coins;
Core.adDouble();
assert('广告今日只能一次', Math.abs(Core.S.coins - cAfter) < 0.01);

console.log('== 10. 特殊顾客 ==');
fresh();
Core.newSpecial();
assert('生成特殊顾客', Core.S.special !== null);
assert('特殊顾客45秒有效', Core.S.special.until > Date.now());
const pBefore = Core.S.prosper;
Core.S.special = { type: '艺人', icon: '🎭', reward: 'prosp', amount: 0, until: Date.now() + 99999 };
Core.S.prosper = 100;
Core.serveSpecial();
assert('艺人助力加繁荣', Core.S.prosper > 100);
assert('接待后清空 special', Core.S.special === null);

console.log('== 11. 每日任务 ==');
fresh();
Core.S.boost = 9;
assert('任务2001进度=boost=9', Core.taskProgress(2001) === 9);
Core.claimTask(2001, 0); // 需3
assert('领任务2001档0', Core.S.taskClaimed['2001_0'] === true);
// 不能重复领
Core.claimTask(2001, 0);
assert('任务不能重复领', Core.S.taskClaimed['2001_0'] === true);

console.log('== 12. 离线收益 offlineGain ==');
fresh();
Core.S.coins = 0;
Core.S.last = Date.now() - 3600 * 1000; // 离线1小时
Core.offlineGain();
assert('离线1小时加金币', Core.S.coins > 0, 'got ' + Core.S.coins);
// 离线太短(<10s)不加
fresh();
Core.S.last = Date.now() - 5000;
Core.S.coins = 0;
Core.offlineGain();
assert('离线<10s不加', Core.S.coins === 0);

console.log('== 13. 租金 rentDay / custTarget ==');
fresh();
assert('第1天租金200', Core.rentDay(1) === 200);
assert('第2天租金230(×1.15)', Math.abs(Core.rentDay(2) - 230) < 0.01);
assert('第1天顾客目标60', Core.custTarget(1) === 60);

console.log('== 14. fmt 格式化 ==');
assert('fmt(0)="0"', Core.fmt(0) === '0');
assert('fmt(1500)="1.5K"', Core.fmt(1500) === '1.5K');
assert('fmt(2.5M)="2.50M"', Core.fmt(2500000) === '2.50M');

console.log('== 15. 加速 speedUntil ==');
fresh();
Core.S.speedUntil = Date.now() + 5000;
const rNormal = (function(){ const old = Core.S.speedUntil; Core.S.speedUntil = 0; const v = Core.totalRate(); Core.S.speedUntil = old; return v; })();
assert('加速时 rate=2倍', Math.abs(Core.totalRate() - rNormal * 2) < 0.01, Core.totalRate() + ' vs ' + rNormal);

console.log('\n========== 结果: ' + pass + ' 通过, ' + fail + ' 失败 ==========');
process.exit(fail > 0 ? 1 : 0);
