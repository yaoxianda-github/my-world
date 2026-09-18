/* =========================================================
 * 《老街新生》微信小游戏 · Canvas 渲染 render.js
 * 双环境共用: wx.createCanvas() 或浏览器 <canvas>
 * 维护 hitAreas 供触摸命中检测; draw(ctx,W,H,Core) 每帧重建
 * ========================================================= */
(function (global) {
'use strict';

// 布局常量 (375 宽基准)
var W = 375;
var H = 667;
var TOP_H = 112;      // 顶栏
var SETTLE_H = 58;    // 结算条
var TAB_H = 46;       // 底部 tab
var scrollY = 0;
var page = "street";  // street | cards | tasks
var hitAreas = [];
var touchStartY = 0, touchMoved = false, touchStartT = 0;

var C = {
  paper: "#F6EFE3", card: "#FFFDF8", ink: "#46352A", ink2: "#7A6A58",
  brown: "#8A5A33", orange: "#D97E3D", brick: "#B85C3C", green: "#7A8F6E",
  gold: "#C9A227", line: "#D8C8B2", red: "#C0392B"
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function text(ctx, s, x, y, size, color, bold, align) {
  ctx.font = (bold ? "bold " : "") + size + "px sans-serif";
  ctx.fillStyle = color || C.ink;
  ctx.textAlign = align || "left";
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}
function btn(ctx, x, y, w, h, label, bg, fg, size) {
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg; ctx.fill();
  text(ctx, label, x + w / 2, y + h / 2, size || 14, fg || "#fff", true, "center");
  hitAreas.push({ x: x, y: y, w: w, h: h, id: "btn:" + label });
}

// ---------- 顶栏 ----------
function drawTop(ctx, Core) {
  var S = Core.S, fmt = Core.fmt;
  ctx.fillStyle = "#F0E3CA";
  ctx.fillRect(0, 0, W, TOP_H);
  ctx.fillStyle = "#E9D9BE";
  ctx.fillRect(0, TOP_H - 3, W, 3);
  // 金币
  text(ctx, "🪙 " + fmt(S.coins), 14, 20, 26, C.brown, true);
  text(ctx, "+" + Core.totalRate().toFixed(1) + "/s", W - 14, 20, 13, C.orange, true, "right");
  // chips
  var y = 42;
  text(ctx, "第" + S.day + "天", 14, y + 6, 12, C.ink2, true);
  text(ctx, "繁荣 " + Math.floor(S.prosper), 92, y + 6, 12, C.brick, true);
  text(ctx, "租金 " + fmt(Core.rentDay(S.day)), 180, y + 6, 12, C.ink2, true);
  if (Date.now() < S.speedUntil) text(ctx, "⚡加速", 300, y + 6, 12, C.gold, true);
  // 繁荣条
  var next = -1;
  for (var i = 0; i < Core.SHOPS.length; i++) if (!S.shops[i].on) { next = i; break; }
  var thr = next >= 0 ? Core.SHOPS[next].unlock : 2000;
  text(ctx, "下一店: " + (next >= 0 ? Core.SHOPS[next].name + "(" + thr + ")" : "全部解锁"), 14, y + 22, 11, C.ink2);
  rr(ctx, 200, y + 16, W - 214, 12, 6);
  ctx.fillStyle = "#E4D5BC"; ctx.fill();
  var pw = Math.min(1, S.prosper / thr);
  rr(ctx, 200, y + 16, (W - 214) * pw, 12, 6);
  ctx.fillStyle = C.orange;
  ctx.fill();
}

// ---------- 街道页 ----------
function drawStreet(ctx, Core) {
  var S = Core.S, fmt = Core.fmt;
  var y0 = TOP_H - scrollY;
  // 特殊顾客横幅
  if (S.special) {
    var sp = S.special;
    rr(ctx, 10, y0, W - 20, 46, 10);
    ctx.fillStyle = C.gold; ctx.fill();
    text(ctx, sp.icon + " " + sp.type + " 到店!", 22, y0 + 15, 13, "#fff", true);
    text(ctx, sp.reward === "coin" ? "接待得金币" : "接待得繁荣", 22, y0 + 34, 11, "#fff");
    hitAreas.push({ x: W - 92, y: y0 + 8, w: 80, h: 30, id: "special" });
    rr(ctx, W - 92, y0 + 8, 80, 30, 15);
    ctx.fillStyle = C.brick; ctx.fill();
    text(ctx, "接待", W - 52, y0 + 23, 13, "#fff", true, "center");
    y0 += 54;
  }
  // 店铺卡片
  Core.SHOPS.forEach(function (sh, i) {
    var st = S.shops[i];
    var x = 10, w = W - 20, h = 74;
    var y = y0 + i * (h + 10);
    rr(ctx, x, y, w, h, 12);
    ctx.fillStyle = C.card; ctx.fill();
    ctx.strokeStyle = st.on ? C.brown : C.line; ctx.lineWidth = 1.5; ctx.stroke();
    if (!st.on) { ctx.strokeStyle = C.line; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]); }
    // 图标
    rr(ctx, x + 10, y + 12, 46, 46, 8);
    ctx.fillStyle = st.on ? C.brick : "#D8C8B2"; ctx.fill();
    text(ctx, st.on ? sh.icon : "🔒", x + 33, y + 35, 20, "#fff", true, "center");
    text(ctx, sh.name, x + 68, y + 20, 15, C.ink, true);
    if (st.on) {
      text(ctx, "Lv." + st.lv + " · 客流" + Math.round(sh.T0 * (1 + sh.a_t * (st.lv - 1))) + "/h", x + 68, y + 40, 11, C.ink2);
      var r = Core.shopRate(i) * Core.gEff().g;
      var c = Core.upCost(i);
      text(ctx, "+" + fmt(r) + "/s", W - 14, y + 22, 13, C.orange, true, "right");
      text(ctx, "升级 " + fmt(c), W - 14, y + 44, 12, S.coins >= c ? C.green : C.red, true, "right");
      hitAreas.push({ x: x, y: y, w: w, h: h, id: "up:" + i });
    } else {
      text(ctx, "繁荣" + sh.unlock + " · 金币" + fmt(sh.build), x + 68, y + 40, 11, C.ink2);
      text(ctx, S.prosper >= sh.unlock ? "可修建" : "未解锁", W - 14, y + 30, 12, S.prosper >= sh.unlock ? C.green : C.ink2, true, "right");
      hitAreas.push({ x: x, y: y, w: w, h: h, id: "unlock:" + i });
    }
  });
  var contentH = (Core.SHOPS.length) * 84 + (S.special ? 60 : 10) + 60;
  hitAreas.push({ x: 0, y: 0, w: W, h: H, id: "scroll", scrollable: true, contentH: contentH, viewH: H - TOP_H - SETTLE_H - TAB_H });
}

// ---------- 卡牌页 ----------
function drawCards(ctx, Core) {
  var S = Core.S;
  btn(ctx, 12, TOP_H + 10, (W - 36) / 2, 44, "抽卡 · 5000币", C.orange, "#fff", 14);
  btn(ctx, W / 2 + 6, TOP_H + 10, (W - 36) / 2, 44, S.adUsed ? "今日已用" : "广告翻倍", S.adUsed ? C.line : C.card, S.adUsed ? C.ink2 : C.brown, 13);
  var y = TOP_H + 70;
  text(ctx, "已持 " + S.cards.length + " / 8 张", 14, y + 8, 12, C.ink2, true);
  y += 20;
  Core.CARDS.forEach(function (cd, i) {
    var col = i % 2, row = Math.floor(i / 2);
    var x = 10 + col * ((W - 28) / 2 + 8), w = (W - 28) / 2, h = 62;
    var yy = y + row * (h + 8);
    rr(ctx, x, yy, w, h, 10);
    ctx.fillStyle = C.card; ctx.fill();
    ctx.strokeStyle = cd.rar === "rare" ? C.gold : C.line; ctx.lineWidth = 1.5; ctx.stroke();
    var owned = S.cards.indexOf(cd.id) >= 0;
    text(ctx, cd.icon + cd.name + (owned ? " ✓" : ""), x + 10, yy + 16, 12, C.ink, true);
    text(ctx, (cd.rar === "rare" ? "稀有" : "普通") + " · " + (cd.type === "mult" ? "乘区" : "加区"),
      x + 10, yy + 36, 10, cd.rar === "rare" ? C.gold : C.ink2);
    var tgt = { traffic: "客流量", spend: "客单价", rent: "租金减免" }[cd.target];
    text(ctx, tgt + " +" + Math.round(cd.val * 100) + "%", x + 10, yy + 51, 11, C.orange, true);
  });
}

// ---------- 任务页 ----------
function drawTasks(ctx, Core) {
  var S = Core.S;
  text(ctx, "今日任务", 14, TOP_H + 16, 14, C.ink, true);
  Core.TASKS.forEach(function (t, i) {
    var y = TOP_H + 32 + i * 88;
    rr(ctx, 10, y, W - 20, 80, 12);
    ctx.fillStyle = C.card; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
    text(ctx, t.name, 20, y + 16, 14, C.ink, true);
    var prog = Core.taskProgress(t.id);
    // 每档进度
    t.tiers.forEach(function (need, k) {
      var key = t.id + "_" + k;
      var claimed = S.taskClaimed[key];
      var x0 = 20 + k * 118;
      var done = prog >= need;
      rr(ctx, x0, y + 30, 106, 22, 6);
      ctx.fillStyle = done ? (claimed ? C.green : C.orange) : "#EFE6D6"; ctx.fill();
      var label = (claimed ? "✓ " : (done ? "领取 " : "")) + Math.min(prog, need) + "/" + need;
      text(ctx, label, x0 + 53, y + 41, 10, done ? "#fff" : C.ink2, true, "center");
      if (done && !claimed) hitAreas.push({ x: x0, y: y + 30, w: 106, h: 22, id: "task:" + t.id + ":" + k });
    });
    text(ctx, "奖励: " + t.rdesc, 20, y + 66, 10, C.ink2);
  });
}

// ---------- 结算条 + 底部 tab ----------
function drawBottom(ctx, Core) {
  var S = Core.S, fmt = Core.fmt;
  var y0 = H - SETTLE_H - TAB_H;
  // 结算条
  ctx.fillStyle = C.card; ctx.fillRect(0, y0, W, SETTLE_H);
  ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();
  text(ctx, "顾客 " + Math.floor(S.cust) + "/" + Core.custTarget(S.day), 14, y0 + 16, 12, C.ink2, true);
  text(ctx, "明日租金 " + fmt(Core.rentDay(S.day + 1)), 14, y0 + 38, 11, C.ink2);
  btn(ctx, W - 120, y0 + 8, 108, 42, "结算 · 推进一天", C.orange, "#fff", 13);
  // tab
  var tabs = [["street", "街道"], ["cards", "卡牌"], ["tasks", "任务"]];
  var tw = W / 3, ty = H - TAB_H;
  ctx.fillStyle = C.card; ctx.fillRect(0, ty, W, TAB_H);
  ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();
  tabs.forEach(function (t, i) {
    var on = page === t[0];
    if (on) { ctx.fillStyle = C.paper; ctx.fillRect(i * tw, ty, tw, TAB_H); }
    text(ctx, t[1], i * tw + tw / 2, ty + TAB_H / 2, 13, on ? C.brick : C.ink2, on, "center");
    hitAreas.push({ x: i * tw, y: ty, w: tw, h: TAB_H, id: "tab:" + t[0] });
  });
}

// ---------- Toast ----------
function drawToast(ctx, Core) {
  var t = Core.getToast();
  if (!t || Date.now() > t.until) return;
  ctx.font = "bold 13px sans-serif";
  var tw = ctx.measureText(t.text).width;
  var x = (W - tw - 32) / 2, y = H - SETTLE_H - TAB_H - 60;
  rr(ctx, x, y, tw + 32, 32, 16);
  ctx.fillStyle = "rgba(70,53,42,.92)"; ctx.fill();
  text(ctx, t.text, x + (tw + 32) / 2, y + 16, 13, "#fff", true, "center");
}

// ---------- 主绘制 ----------
function draw(ctx, Core, w, h) {
  W = w; H = h;
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  hitAreas = [];
  if (page === "cards") drawCards(ctx, Core);
  else if (page === "tasks") drawTasks(ctx, Core);
  else drawStreet(ctx, Core);
  drawBottom(ctx, Core);
  drawToast(ctx, Core);
}

// ---------- 触摸处理 ----------
function onTouchStart(x, y) {
  touchStartY = y; touchMoved = false; touchStartT = Date.now();
}
function onTouchMove(x, y) {
  var dy = y - touchStartY;
  if (Math.abs(dy) > 6) touchMoved = true;
  if (page === "street") {
    // 找 scroll 区域
    for (var i = 0; i < hitAreas.length; i++) {
      var a = hitAreas[i];
      if (a.id === "scroll") {
        var maxScroll = Math.max(0, a.contentH - a.viewH);
        scrollY = Math.max(0, Math.min(maxScroll, scrollY - dy));
        touchStartY = y;
        break;
      }
    }
  }
}
function onTouchEnd(x, y, Core) {
  if (touchMoved || Date.now() - touchStartT > 800) return;
  var p = page;
  for (var i = hitAreas.length - 1; i >= 0; i--) {
    var a = hitAreas[i];
    if (a.id === "scroll") continue;
    if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) {
      var id = a.id;
      if (id.indexOf("btn:") === 0) {
        var lbl = id.slice(4);
        if (lbl === "抽卡 · 5000币") Core.drawCard();
        else if (lbl === "结算 · 推进一天") Core.settle();
        else if (lbl === "广告翻倍" || lbl === "今日已用") if (!Core.S.adUsed) Core.adDouble();
      } else if (id === "special") Core.serveSpecial();
      else if (id.indexOf("up:") === 0) Core.upgrade(parseInt(id.slice(3)));
      else if (id.indexOf("unlock:") === 0) Core.tryUnlock(parseInt(id.slice(7)));
      else if (id.indexOf("task:") === 0) {
        var parts = id.slice(5).split(":");
        Core.claimTask(parseInt(parts[0]), parseInt(parts[1]));
      } else if (id.indexOf("tab:") === 0) {
        page = id.slice(4); scrollY = 0;
      }
      break;
    }
  }
}
function getPage() { return page; }

global.Render = { draw: draw, onTouchStart: onTouchStart, onTouchMove: onTouchMove, onTouchEnd: onTouchEnd, getPage: getPage };

})(typeof window !== "undefined" ? window : globalThis);
