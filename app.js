/* =========================================================
   全站通用小工具：本地存储、转义、提示、日期
   每个功能页只要引入 <script src="app.js"></script> 就能用
   ========================================================= */
(function (global) {
  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadStore(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function saveStore(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // 把日期对象/字符串格式化成 "2026-11-04"
  function fmtDate(value) {
    var d = value ? new Date(value) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  // 相对时间：刚刚 / x 分钟前 / x 天前 / 具体日期
  function fromNow(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' 天前';
    return fmtDate(d);
  }

  // 安全绑定事件（元素可能不存在时不报错）
  function on(id, ev, fn) {
    var el = $(id);
    if (el) el.addEventListener(ev, fn);
    return el;
  }

  // 轻量提示条
  var toastTimer;
  function toast(msg, type) {
    var el = $('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 2200);
  }

  global.App = {
    $: $, on: on, escapeHtml: escapeHtml,
    loadStore: loadStore, saveStore: saveStore,
    uid: uid, fmtDate: fmtDate, fromNow: fromNow, toast: toast
  };
})(window);
