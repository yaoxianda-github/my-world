/* =========================================================
 * 《老街新生》微信小游戏 · 入口 game.js
 * 微信环境: 直接运行; 浏览器预览: 由 browser.html 注入 wx polyfill 后运行
 * 主循环: 定时 tick(数值) + draw(渲染)
 * ========================================================= */
'use strict';

var Core = require('./core.js');
var Render = require('./render.js');

// 适配触摸 (微信触摸坐标为 clientX/clientY)
function bindTouch() {
  wx.onTouchStart(function (e) {
    if (e.touches && e.touches[0]) Render.onTouchStart(e.touches[0].clientX, e.touches[0].clientY);
  });
  wx.onTouchMove(function (e) {
    if (e.touches && e.touches[0]) Render.onTouchMove(e.touches[0].clientX, e.touches[0].clientY);
  });
  wx.onTouchEnd(function (e) {
    var t = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : (e.touches && e.touches[0]);
    if (t) Render.onTouchEnd(t.clientX, t.clientY, Core);
  });
}

function main() {
  var info = wx.getSystemInfoSync();
  var W = info.windowWidth, H = info.windowHeight;
  var canvas = wx.createCanvas();
  canvas.width = W;
  canvas.height = H;
  var ctx = canvas.getContext('2d');

  bindTouch();

  // 离线结算
  Core.offlineGain();

  // 主循环
  var last = Date.now();
  function loop() {
    var now = Date.now();
    var dt = Math.min((now - last) / 1000, 5); // 防后台大跳变
    last = now;
    Core.tick(dt);
    Render.draw(ctx, Core, W, H);
    canvas.requestAnimationFrame(loop);
  }
  loop();

  // 自动存档
  setInterval(function () { Core.save(); }, 5000);
  wx.onHide(function () { Core.save(); });
  wx.onShow(function () { Core.save(); });
}

main();
