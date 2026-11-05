/* =========================================================
   cloud.js — 统一数据层 + 登录（邮箱+密码）
   · 已登录：数据读写 Supabase 云端（跨设备同步，仅本人可见）
   · 未登录：自动退回 localStorage（保持"打开即用"）
   · 首次登录且云端为空时，会把本机已有数据自动迁移上云
   页面用法：
     App.loadList(kind, seed?)  -> Promise<data>
     App.saveList(kind, data)   -> Promise
     App.login(email, pw) / App.signup(email, pw) / App.logout()
   ========================================================= */
(function (global) {
  var SUPABASE_URL = 'https://gkzlvvchjhiiekjjuqxh.supabase.co';
  var SUPABASE_ANON = 'sb_publishable_Xog60iW5XQRoLV7R1kuEjQ_v7TJbEyq';

  var sb = null;
  try { sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
  catch (e) { console.warn('Supabase 初始化失败，将仅使用本机存储：', e); }

  var currentUser = null;

  // 各功能对应的本地兜底 key（与旧版一致，迁移时用）
  var LOCAL_KEYS = {
    daily: 'myblog-daily-v1',
    book: 'myblog-books-v1',
    movie: 'myblog-movies-v1',
    notes: 'myblog-notes-v1',
    calendar: 'myblog-calendar-v1'
  };
  function lk(kind) { return LOCAL_KEYS[kind] || ('myblog-' + kind + '-v1'); }
  function localGet(kind) { try { return JSON.parse(localStorage.getItem(lk(kind))); } catch (e) { return null; } }
  function localSet(kind, v) { try { localStorage.setItem(lk(kind), JSON.stringify(v)); } catch (e) {} }

  function getUser() { return currentUser; }

  async function ensureSession() {
    if (currentUser) return currentUser;
    if (!sb) return null;
    try {
      var r = await sb.auth.getSession();
      currentUser = (r.data && r.data.session) ? r.data.session.user : null;
    } catch (e) { currentUser = null; }
    return currentUser;
  }

  // 读：登录→云端；未登录→本机（首次访问且给了 seed 则写入本机）
  async function loadList(kind, seed) {
    var u = await ensureSession();
    if (!u) {
      var local = localGet(kind);
      if (local == null && seed !== undefined) { localSet(kind, seed); return seed; }
      return local;
    }
    try {
      var res = await sb.from('items').select('data')
        .eq('user_id', u.id).eq('kind', kind).maybeSingle();
      if (res.error) { console.error(res.error); return localGet(kind); }
      if (!res.data) {
        var l = localGet(kind);
        if (l != null) { await saveList(kind, l); }   // 本机数据迁移上云
        return l;
      }
      return res.data.data;
    } catch (e) { return localGet(kind); }
  }

  // 写：登录→云端 upsert；未登录→本机
  async function saveList(kind, val) {
    var u = await ensureSession();
    if (!u) { localSet(kind, val); return; }
    try {
      var res = await sb.from('items').upsert(
        { user_id: u.id, kind: kind, data: val },
        { onConflict: 'user_id,kind' }
      );
      if (res.error) {
        console.error(res.error);
        localSet(kind, val);
        if (global.App && App.toast) App.toast('云端保存失败，已暂存本机', 'err');
      }
    } catch (e) { localSet(kind, val); }
  }

  async function signup(email, pw) {
    if (!sb) return { error: { message: 'Supabase 未初始化' } };
    return await sb.auth.signUp({ email: email, password: pw });
  }
  async function login(email, pw) {
    if (!sb) return { error: { message: 'Supabase 未初始化' } };
    var r = await sb.auth.signInWithPassword({ email: email, password: pw });
    if (r.data && r.data.user) currentUser = r.data.user;
    return r;
  }
  async function logout() {
    if (!sb) { currentUser = null; return; }
    await sb.auth.signOut();
    currentUser = null;
  }

  /* ---------------- 登录 UI ---------------- */
  function shortEmail(e) { return (e || '').split('@')[0]; }

  function refreshBtn() {
    var btn = document.getElementById('authBtn');
    if (!btn) return;
    if (currentUser) {
      btn.textContent = '退出 · ' + shortEmail(currentUser.email);
      btn.classList.add('is-user');
      btn.title = '点击退出登录';
    } else {
      btn.textContent = '登录';
      btn.classList.remove('is-user');
      btn.title = '登录后数据存云端';
    }
  }

  function buildModal() {
    if (document.getElementById('authModal')) return;
    var m = document.createElement('div');
    m.id = 'authModal';
    m.className = 'auth-modal';
    m.innerHTML =
      '<div class="auth-box">' +
        '<button class="auth-close" id="authClose" type="button" aria-label="关闭">×</button>' +
        '<div class="auth-tabs">' +
          '<button class="auth-tab active" data-tab="login" type="button">登录</button>' +
          '<button class="auth-tab" data-tab="signup" type="button">注册</button>' +
        '</div>' +
        '<input type="email" id="authEmail" placeholder="你的邮箱（即账号）" autocomplete="username">' +
        '<input type="password" id="authPw" placeholder="密码（至少 6 位）" autocomplete="current-password">' +
        '<div class="auth-err" id="authErr"></div>' +
        '<button class="btn btn-primary" id="authSubmit" type="button">登录</button>' +
        '<div class="auth-hint">数据存在云端、仅你本人可见；未登录时自动存本机。</div>' +
      '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });
    document.getElementById('authClose').addEventListener('click', closeModal);
    m.querySelectorAll('.auth-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        m.querySelectorAll('.auth-tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        document.getElementById('authSubmit').textContent = (t.dataset.tab === 'signup') ? '注册' : '登录';
        document.getElementById('authErr').textContent = '';
      });
    });
    document.getElementById('authSubmit').addEventListener('click', submit);
  }
  function openModal() { buildModal(); var m = document.getElementById('authModal'); if (m) m.classList.add('open'); }
  function closeModal() { var m = document.getElementById('authModal'); if (m) m.classList.remove('open'); }

  async function submit() {
    var email = document.getElementById('authEmail').value.trim();
    var pw = document.getElementById('authPw').value;
    var errEl = document.getElementById('authErr');
    var isSignup = document.querySelector('.auth-tab.active').dataset.tab === 'signup';
    errEl.textContent = '';
    if (!email || !pw) { errEl.textContent = '邮箱和密码都要填'; return; }
    if (pw.length < 6) { errEl.textContent = '密码至少 6 位'; return; }
    var submitBtn = document.getElementById('authSubmit');
    submitBtn.disabled = true;
    var r = isSignup ? await signup(email, pw) : await login(email, pw);
    submitBtn.disabled = false;
    if (r.error) {
      var msg = r.error.message || '出错了，请重试';
      if (isSignup && /already registered|user already exists/i.test(msg)) msg = '这个邮箱已注册，去「登录」即可。';
      errEl.textContent = msg;
      return;
    }
    if (isSignup && r.data && !r.data.session) {
      errEl.textContent = '注册成功，但还需确认邮箱才能登录（去 Supabase 后台关掉 Confirm email 即可免确认）。';
      return;
    }
    closeModal();
    location.reload();   // 重新加载以拉取云端数据
  }

  function initUI() {
    if (!sb) { refreshBtn(); return; }
    sb.auth.onAuthStateChange(function (event, session) {
      currentUser = session ? session.user : null;
      refreshBtn();
    });
    var btn = document.getElementById('authBtn');
    if (btn) btn.addEventListener('click', function () {
      if (currentUser) { logout().then(function () { location.reload(); }); }
      else { openModal(); }
    });
    ensureSession().then(refreshBtn);
  }

  global.App = global.App || {};
  global.App.loadList = loadList;
  global.App.saveList = saveList;
  global.App.login = login;
  global.App.signup = signup;
  global.App.logout = logout;
  global.App.getUser = getUser;
  global.App.initCloudUI = initUI;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI);
  else initUI();
})(window);
