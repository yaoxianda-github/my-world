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

// ---------- 院子原画 (5店) ----------
var BG_FILES = ["assets/yard.png", "assets/shop1.png", "assets/shop2.png", "assets/shop3.png", "assets/shop4.png"];
var BGS = [];
var curShop = 0;
function loadImages() {
  var mk = (typeof wx !== "undefined" && wx.createImage) ? wx.createImage : function () { return new Image(); };
  BG_FILES.forEach(function (f) {
    var im = mk();
    im.src = f;
    BGS.push(im);
  });
}

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

// ---------- 老街远景长卷 (铺开动画: 人+房屋+烟火气, 2026-09-19) ----------
function drawPanoUnit(ctx, t) {
  // 与 DOM 版 SVG 同布局 (600x100) + 烟火气: 炊烟/幌子/早点摊/晾衣/街猫/灯笼
  ctx.fillStyle = "rgba(255,249,239,.55)";
  ctx.beginPath(); ctx.moveTo(0, 74);
  ctx.quadraticCurveTo(60, 44, 130, 70); ctx.quadraticCurveTo(200, 34, 280, 68);
  ctx.quadraticCurveTo(360, 50, 430, 68); ctx.quadraticCurveTo(520, 42, 600, 70);
  ctx.lineTo(600, 100); ctx.lineTo(0, 100); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = .85; ctx.fillStyle = "#D8C2A0"; ctx.fillRect(0, 80, 600, 20); ctx.globalAlpha = 1;
  ctx.strokeStyle = "#CBB28A"; ctx.lineWidth = 1.5;
  [90, 185, 278, 372, 466, 560].forEach(function (px) { ctx.beginPath(); ctx.moveTo(px, 80); ctx.lineTo(px, 86); ctx.stroke(); });
  // 房子1 砖红: 炊烟
  ctx.fillStyle = "#B85C3C"; ctx.fillRect(34, 56, 52, 28);
  ctx.fillStyle = "#6B4A2E"; ctx.beginPath(); ctx.moveTo(28, 58); ctx.lineTo(60, 36); ctx.lineTo(92, 58); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#7A6A58"; ctx.fillRect(70, 38, 9, 18); ctx.fillStyle = "#5C4A33"; ctx.fillRect(68, 36, 13, 5);
  for (var k = 0; k < 3; k++) {
    var ph = ((t * 0.9 + k * 1.1) % 3) / 3;
    ctx.beginPath(); ctx.arc(74.5 + ph * 4, 32 - ph * 16, 2.6 - ph * 0.8, 0, 7);
    ctx.fillStyle = "rgba(236,228,210," + (0.75 * (1 - ph)) + ")"; ctx.fill();
  }
  ctx.fillStyle = "#46352A"; ctx.fillRect(52, 68, 16, 16);
  // 树1
  ctx.fillStyle = "#8A5A33"; ctx.fillRect(150, 62, 7, 18);
  ctx.fillStyle = "#7A8F6E"; ctx.beginPath(); ctx.arc(153, 54, 13, 0, 7); ctx.fill();
  ctx.fillStyle = "#8CA084"; ctx.beginPath(); ctx.arc(145, 60, 8, 0, 7); ctx.fill();
  // 房子2 橙: 幌子(摆动)
  ctx.fillStyle = "#D97E3D"; ctx.fillRect(210, 56, 56, 28);
  ctx.fillStyle = "#8A5A33"; ctx.beginPath(); ctx.moveTo(204, 58); ctx.lineTo(238, 38); ctx.lineTo(272, 58); ctx.closePath(); ctx.fill();
  var sw = Math.sin(t * 2.4) * 4;
  ctx.fillStyle = "#C0392B"; ctx.beginPath(); ctx.moveTo(236, 56); ctx.lineTo(236 + sw * 0.3, 70); ctx.lineTo(248 + sw, 63); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#46352A"; ctx.fillRect(230, 68, 16, 16);
  ctx.fillStyle = "#DCEAF2"; ctx.fillRect(250, 62, 8, 6);
  // 早点摊: 伞+桌+热气
  ctx.fillStyle = "#8A5A33"; ctx.fillRect(298, 66, 34, 18);
  ctx.fillStyle = "#C9A227"; ctx.beginPath(); ctx.moveTo(290, 68); ctx.lineTo(296, 46); ctx.lineTo(300, 68); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(340, 68); ctx.lineTo(334, 46); ctx.lineTo(330, 68); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#DCEAF2"; ctx.fillRect(310, 58, 12, 6);
  for (k = 0; k < 3; k++) {
    ph = ((t * 0.9 + k * 1.1 + 0.5) % 3) / 3;
    ctx.beginPath(); ctx.arc(316 + ph * 3, 54 - ph * 14, 2.4 - ph * 0.8, 0, 7);
    ctx.fillStyle = "rgba(236,228,210," + (0.75 * (1 - ph)) + ")"; ctx.fill();
  }
  // 房子3 米墙绿顶: 晾衣(微摆)
  ctx.fillStyle = "#EFE2C8"; ctx.fillRect(360, 56, 52, 28);
  ctx.fillStyle = "#5C7050"; ctx.beginPath(); ctx.moveTo(354, 58); ctx.lineTo(386, 38); ctx.lineTo(418, 58); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#46352A"; ctx.fillRect(376, 70, 16, 14);
  ctx.fillStyle = "#DCEAF2"; ctx.fillRect(396, 62, 8, 6);
  ctx.fillStyle = "#8A5A33"; ctx.fillRect(352, 44, 3, 16); ctx.fillRect(414, 44, 3, 16);
  ctx.strokeStyle = "#7A6A58"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(354, 46); ctx.lineTo(415, 46); ctx.stroke();
  var cl = Math.sin(t * 2) * 2.5;
  ctx.fillStyle = "#D97E3D"; ctx.save(); ctx.translate(371.5, 47); ctx.rotate(cl * 0.05); ctx.fillRect(-5.5, 0, 11, 13); ctx.restore();
  ctx.fillStyle = "#7FB3A6"; ctx.save(); ctx.translate(389.5, 47); ctx.rotate(-cl * 0.05); ctx.fillRect(-5.5, 0, 11, 13); ctx.restore();
  // 街猫
  ctx.fillStyle = "#8A5A33"; ctx.beginPath(); ctx.arc(452, 72, 8, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(459, 66, 4.5, 0, 7); ctx.fill();
  ctx.strokeStyle = "#8A5A33"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(444, 72); ctx.quadraticCurveTo(439, 73, 440, 78); ctx.stroke();
  // 树2
  ctx.fillStyle = "#8A5A33"; ctx.fillRect(490, 64, 6, 16);
  ctx.fillStyle = "#7A8F6E"; ctx.beginPath(); ctx.arc(493, 56, 11, 0, 7); ctx.fill();
  // 房子4 金: 灯笼(摆动)
  ctx.fillStyle = "#C9A227"; ctx.fillRect(530, 58, 46, 26);
  ctx.fillStyle = "#6B4A2E"; ctx.beginPath(); ctx.moveTo(525, 60); ctx.lineTo(553, 42); ctx.lineTo(581, 60); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#46352A"; ctx.fillRect(548, 70, 14, 14);
  var lg = Math.sin(t * 2.4 + 1) * 0.06;
  ctx.fillStyle = "#C0392B"; ctx.save(); ctx.translate(569.5, 58); ctx.rotate(lg); rr(ctx, -3.5, 0, 7, 11, 3); ctx.fill();
  ctx.strokeStyle = "#C0392B"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, 11); ctx.lineTo(0, 15); ctx.stroke(); ctx.restore();
}
function drawWalker(ctx, x, y, color, legPhase) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "#E8B48A"; ctx.beginPath(); ctx.arc(0, -20, 5, 0, 7); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(-6, 6); ctx.lineTo(6, 6); ctx.closePath(); ctx.fill();
  var a = Math.sin(legPhase) * 0.38;
  ctx.strokeStyle = "#46352A"; ctx.lineWidth = 2.6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-1.5, 6); ctx.lineTo(-1.5 + Math.sin(a) * 6, 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1.5, 6); ctx.lineTo(1.5 + Math.sin(a + Math.PI) * 6, 20); ctx.stroke();
  ctx.restore();
}
function drawPanorama(ctx, t) {
  var top = TOP_H;
  var grad = ctx.createLinearGradient(0, top, 0, top + 112);
  grad.addColorStop(0, "#EFE3C8"); grad.addColorStop(1, "#DFC79E");
  ctx.fillStyle = grad; ctx.fillRect(0, top, W, 112);
  var unit = 375, span = unit * 2;
  var off = ((t * 26) % span);
  for (var k = -1; k <= 2; k++) {
    ctx.save();
    ctx.translate(k * unit - off, top + 4);
    ctx.scale(0.625, 0.625);
    drawPanoUnit(ctx, t);
    ctx.restore();
  }
  // 行走小人 (前景)
  var y = top + 78;
  drawWalker(ctx, ((t * 46) % (W + 120)) - 60, y, "#B85C3C", t * 9);
  drawWalker(ctx, ((t * 30 + 180) % (W + 120)) - 60, y + 3, "#D97E3D", t * 7 + 2);
  drawWalker(ctx, ((t * 20 + 300) % (W + 120)) - 60, y + 6, "#7A8F6E", t * 5 + 4);
}

// ---------- 院子场景 (复刻 DOM 版: 原画+门脸+切店, 2026-09-19) ----------
function drawYard(ctx, Core, t) {
  var S = Core.S, fmt = Core.fmt;
  var cx = W / 2;
  var top = TOP_H, bot = H - 130;
  var yh = bot - top;
  // 背景原画
  var im = BGS[curShop];
  ctx.fillStyle = "#E8D5B5"; ctx.fillRect(0, top, W, yh);
  if (im && im.width) {
    var ir = im.width / im.height, cr = W / yh, dw, dh, dx, dy;
    if (cr > ir) { dw = W; dh = W / ir; dx = 0; dy = top + (yh - dh) / 2; }
    else { dh = yh; dw = yh * ir; dx = (W - dw) / 2; dy = top; }
    ctx.drawImage(im, dx, dy, dw, dh);
  }
  // 门招牌
  var sh = Core.SHOPS[curShop], st = S.shops[curShop];
  var sw = 96, shh = 24, sx = cx - sw / 2, sy = top + yh * 0.38;
  rr(ctx, sx, sy, sw, shh, 5); ctx.fillStyle = "#8A5A33"; ctx.fill();
  text(ctx, sh.name, cx, sy + shh / 2, 13, "#FFF8E8", true, "center");
  // Lv 标签
  var tag = st.on ? ("Lv." + st.lv + "  +" + fmt(Core.shopRate(curShop) * Core.gEff().g) + "/s")
                  : ("未建 繁荣" + sh.unlock);
  ctx.font = "bold 11px sans-serif";
  var tw = ctx.measureText(tag).width + 22;
  rr(ctx, cx - tw / 2, sy + shh + 8, tw, 20, 10);
  ctx.fillStyle = "rgba(70,53,42,.85)"; ctx.fill();
  text(ctx, tag, cx, sy + shh + 18, 11, "#FFD980", true, "center");
  // 门热区
  hitAreas.push({ x: cx - 72, y: sy - 12, w: 144, h: yh * 0.46, id: st.on ? ("panel:" + curShop) : ("unlock:" + curShop) });
  // 左右切店箭头
  var ay = top + yh * 0.44, ah = 54;
  ctx.fillStyle = "rgba(110,80,50,.55)";
  rr(ctx, 4, ay, 30, ah, 6); ctx.fill();
  rr(ctx, W - 34, ay, 30, ah, 6); ctx.fill();
  text(ctx, "‹", 19, ay + ah / 2, 22, "#FFF8E8", true, "center");
  text(ctx, "›", W - 19, ay + ah / 2, 22, "#FFF8E8", true, "center");
  hitAreas.push({ x: 4, y: ay, w: 30, h: ah, id: "prev" });
  hitAreas.push({ x: W - 34, y: ay, w: 30, h: ah, id: "next" });
  // 店前两顾客
  drawWalker(ctx, cx - 48, sy + shh + 86, "#4A6A8A", t * 2);
  drawWalker(ctx, cx + 60, sy + shh + 86, "#B85C3C", t * 2 + 1);
  // 特殊顾客横幅
  if (S.special) {
    var sp = S.special, by = top + 8;
    rr(ctx, 10, by, W - 20, 40, 10); ctx.fillStyle = C.gold; ctx.fill();
    text(ctx, sp.icon + " " + sp.type + " 到店!", 22, by + 14, 13, "#fff", true);
    text(ctx, sp.reward === "coin" ? "接待得金币" : "接待得繁荣", 22, by + 31, 11, "#fff");
    hitAreas.push({ x: W - 92, y: by + 6, w: 80, h: 28, id: "special" });
    rr(ctx, W - 92, by + 6, 80, 28, 14); ctx.fillStyle = C.brick; ctx.fill();
    text(ctx, "接待", W - 52, by + 20, 13, "#fff", true, "center");
  }
}

// ---------- 卡牌页 (木牌原画风) ----------
function drawCards(ctx, Core) {
  var S = Core.S;
  var top = TOP_H, bot = H - 130, yh = bot - top;
  // 深木底
  var grad = ctx.createLinearGradient(0, top, 0, bot);
  grad.addColorStop(0, "#4A3520"); grad.addColorStop(1, "#5C4228");
  ctx.fillStyle = grad; ctx.fillRect(0, top, W, yh);
  // 返回院子
  ctx.fillStyle = "rgba(110,80,50,.6)";
  rr(ctx, 8, top + 14, 30, 26, 6); ctx.fill();
  text(ctx, "‹", 23, top + 27, 18, "#FFF8E8", true, "center");
  hitAreas.push({ x: 8, y: top + 14, w: 30, h: 26, id: "back" });
  // 标题木牌
  rr(ctx, 90, top + 10, W - 180, 30, 8);
  ctx.fillStyle = "#8A5A33"; ctx.fill();
  text(ctx, "抽卡 · 集邮", W / 2, top + 25, 15, "#FFF8E8", true, "center");
  // 两个操作钮
  rr(ctx, 12, top + 52, (W - 36) / 2, 42, 10);
  ctx.fillStyle = "#D97E3D"; ctx.fill();
  text(ctx, "抽卡 5000币", 12 + (W - 36) / 4, top + 73, 13, "#fff", true, "center");
  hitAreas.push({ x: 12, y: top + 52, w: (W - 36) / 2, h: 42, id: "draw" });
  rr(ctx, W / 2 + 6, top + 52, (W - 36) / 2, 42, 10);
  ctx.fillStyle = S.adUsed ? "#6B5540" : "#C9A227"; ctx.fill();
  text(ctx, S.adUsed ? "今日已用" : "广告翻倍", W / 2 + 6 + (W - 36) / 4, top + 73, 12, "#fff", true, "center");
  hitAreas.push({ x: W / 2 + 6, y: top + 52, w: (W - 36) / 2, h: 42, id: "ad" });
  // 已持
  text(ctx, "已持 " + S.cards.length + " / 8 张", 16, top + 112, 12, "#E8D3A8", true);
  // 卡列表
  var y = top + 124;
  Core.CARDS.forEach(function (cd, i) {
    var col = i % 2, row = Math.floor(i / 2);
    var x = 10 + col * ((W - 28) / 2 + 8), w = (W - 28) / 2, h = 66;
    var yy = y + row * (h + 8);
    rr(ctx, x, yy, w, h, 10);
    ctx.fillStyle = "#7A5A38"; ctx.fill();
    ctx.strokeStyle = cd.rar === "rare" ? "#C9A227" : "#9A7A55"; ctx.lineWidth = 1.5; ctx.stroke();
    var owned = S.cards.indexOf(cd.id) >= 0;
    text(ctx, cd.icon + cd.name + (owned ? " ✓" : " ？"), x + 10, yy + 16, 12, "#FFF8E8", true);
    text(ctx, (cd.rar === "rare" ? "稀有" : "普通") + " · " + (cd.type === "mult" ? "乘区" : "加区"),
      x + 10, yy + 36, 10, cd.rar === "rare" ? "#FFD980" : "#C9B18A");
    var tgt = { traffic: "客流量", spend: "客单价", rent: "租金减免" }[cd.target];
    text(ctx, tgt + " +" + Math.round(cd.val * 100) + "%", x + 10, yy + 54, 11, "#FFB870", true);
  });
}

// ---------- 任务页 (木牌原画风) ----------
function drawTasks(ctx, Core) {
  var S = Core.S;
  var top = TOP_H, bot = H - 130, yh = bot - top;
  var grad = ctx.createLinearGradient(0, top, 0, bot);
  grad.addColorStop(0, "#4A3520"); grad.addColorStop(1, "#5C4228");
  ctx.fillStyle = grad; ctx.fillRect(0, top, W, yh);
  ctx.fillStyle = "rgba(110,80,50,.6)";
  rr(ctx, 8, top + 14, 30, 26, 6); ctx.fill();
  text(ctx, "‹", 23, top + 27, 18, "#FFF8E8", true, "center");
  hitAreas.push({ x: 8, y: top + 14, w: 30, h: 26, id: "back" });
  rr(ctx, 110, top + 10, W - 220, 30, 8);
  ctx.fillStyle = "#8A5A33"; ctx.fill();
  text(ctx, "今日任务", W / 2, top + 25, 15, "#FFF8E8", true, "center");
  var y0 = top + 52;
  Core.TASKS.forEach(function (t, i) {
    var y = y0 + i * 88;
    rr(ctx, 10, y, W - 20, 80, 12);
    ctx.fillStyle = "#7A5A38"; ctx.fill();
    ctx.strokeStyle = "#9A7A55"; ctx.lineWidth = 1; ctx.stroke();
    text(ctx, t.name, 20, y + 16, 14, "#FFF8E8", true);
    var prog = Core.taskProgress(t.id);
    t.tiers.forEach(function (need, k) {
      var key = t.id + "_" + k;
      var claimed = S.taskClaimed[key];
      var x0 = 20 + k * 118;
      var done = prog >= need;
      rr(ctx, x0, y + 30, 106, 22, 6);
      ctx.fillStyle = done ? (claimed ? "#7A8F6E" : "#D97E3D") : "#5C4228"; ctx.fill();
      var label = (claimed ? "✓ " : (done ? "领取 " : "")) + Math.min(prog, need) + "/" + need;
      text(ctx, label, x0 + 53, y + 41, 10, done ? "#fff" : "#C9B18A", true, "center");
      if (done && !claimed) hitAreas.push({ x: x0, y: y + 30, w: 106, h: 22, id: "task:" + t.id + ":" + k });
    });
    text(ctx, "奖励: " + t.rdesc, 20, y + 66, 10, "#C9B18A");
  });
}

// ---------- 底部五按钮 (复刻竞品: 任务/卡牌/长按表盘/宣传/结算) ----------
function drawBottom(ctx, Core) {
  var S = Core.S;
  var bh = 62, by = H - bh;
  // 木底
  ctx.fillStyle = "#5C4228"; ctx.fillRect(0, by, W, bh);
  ctx.fillStyle = "#4A3520"; ctx.fillRect(0, by, W, 3);
  // 五个槽位
  var dialX = W / 2;
  var slots = [
    { id: "btasks", label: "任务", x: W * 0.10 },
    { id: "bcards", label: "卡牌", x: W * 0.30 },
    { id: "bad", label: "宣传", x: W * 0.70 },
    { id: "bsettle", label: "结算", x: W * 0.90 }
  ];
  slots.forEach(function (s) {
    rr(ctx, s.x - 30, by + 8, 60, 40, 8);
    ctx.fillStyle = "#8A5A33"; ctx.fill();
    text(ctx, s.label, s.x, by + 32, 12, "#FFF8E8", true, "center");
    hitAreas.push({ x: s.x - 30, y: by + 8, w: 60, h: 40, id: s.id });
  });
  // 中间表盘
  var r = 30;
  var grad = ctx.createRadialGradient(dialX - 8, by + bh / 2 - 8, 4, dialX, by + bh / 2, r);
  grad.addColorStop(0, "#E8C87A"); grad.addColorStop(1, "#C9963A");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(dialX, by + bh / 2, r, 0, 7); ctx.fill();
  ctx.strokeStyle = "#6B4A2E"; ctx.lineWidth = 3; ctx.stroke();
  text(ctx, "长按", dialX, by + bh / 2 - 8, 13, "#5C4228", true, "center");
  text(ctx, "加速", dialX, by + bh / 2 + 8, 13, "#5C4228", true, "center");
  hitAreas.push({ x: dialX - r, y: by + bh / 2 - r, w: r * 2, h: r * 2, id: "dial" });
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
  var t = Date.now() / 1000;
  if (page === "street") drawYard(ctx, Core, t);
  else if (page === "cards") drawCards(ctx, Core);
  else if (page === "tasks") drawTasks(ctx, Core);
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
      else if (id === "prev") { curShop = (curShop + Core.SHOPS.length - 1) % Core.SHOPS.length; }
      else if (id === "next") { curShop = (curShop + 1) % Core.SHOPS.length; }
      else if (id.indexOf("panel:") === 0) Core.upgrade(parseInt(id.slice(6)));
      else if (id.indexOf("unlock:") === 0) Core.tryUnlock(parseInt(id.slice(7)));
      else if (id === "back") { page = "street"; }
      else if (id === "btasks") { page = "tasks"; }
      else if (id === "bcards") { page = "cards"; }
      else if (id === "bad" || id === "ad") { Core.adDouble(); }
      else if (id === "draw") { Core.drawCard(); }
      else if (id === "bsettle") { Core.settle(); }
      else if (id === "dial") { Core.S.speedUntil = Date.now() + 5000; Core.save(); }
      else if (id.indexOf("task:") === 0) {
        var parts = id.slice(5).split(":");
        Core.claimTask(parseInt(parts[0]), parseInt(parts[1]));
      }
      break;
    }
  }
}
function getPage() { return page; }

loadImages();
global.Render = { draw: draw, onTouchStart: onTouchStart, onTouchMove: onTouchMove, onTouchEnd: onTouchEnd, getPage: getPage };

})(typeof window !== "undefined" ? window : globalThis);
