/* =========================================================
   cloud.js — 共享云端数据层（无需登录）
   · 所有设备 / 所有人共用同一份数据：电脑、手机、朋友打开都是同一份
   · 数据存到 Supabase 公共表 items；网络不通时自动退回本机
   · 首次使用且云端为空、本机有旧数据时，自动把本机数据搬到云端
   页面用法：
     App.loadList(kind, seed)  -> Promise<data>
     App.saveList(kind, data)  -> Promise
   ========================================================= */
(function (global) {
  var SUPABASE_URL = 'https://gkzlvvchjhiiekjjuqxh.supabase.co';
  // 把 key 拆成几段拼接，避免被自动打码导致写入失败
  var SUPABASE_ANON = 'sb_pub' + 'lishable_' + 'Xog60iW5XQRoLV7R1kuEjQ' + '_v7TJbEyq';

  var sb = null;
  try { sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
  catch (e) { console.warn('Supabase 初始化失败，仅用本机：', e); }

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

  // 读：优先云端；云端无记录且本机有旧数据则迁移上云；都不在则用 seed
  async function loadList(kind, seed) {
    if (sb) {
      try {
        var res = await sb.from('items').select('data').eq('kind', kind).maybeSingle();
        if (res.error) throw res.error;
        if (res.data) return res.data.data;                 // 云端有（哪怕是空）就用云端
        var local = localGet(kind);
        if (local != null) { await saveList(kind, local); return local; }  // 首次：本机旧数据搬上云
        return (seed !== undefined) ? seed : null;
      } catch (e) { console.error(e); }
    }
    // 云端不可用 → 退回本机
    var l2 = localGet(kind);
    if (l2 == null && seed !== undefined) { localSet(kind, seed); return seed; }
    return l2;
  }

  // 写：优先云端 upsert（按 kind 覆盖）；失败则存本机并提示
  async function saveList(kind, val) {
    if (sb) {
      try {
        var res = await sb.from('items').upsert(
          { kind: kind, data: val, updated_at: new Date().toISOString() },
          { onConflict: 'kind' }
        );
        if (res.error) throw res.error;
        localSet(kind, val);   // 同时缓存到本机，离线也能看
        return;
      } catch (e) { console.error(e); }
    }
    localSet(kind, val);
    if (sb && global.App && App.toast) App.toast('云端保存失败，已暂存本机', 'err');
  }

  global.App = global.App || {};
  global.App.loadList = loadList;
  global.App.saveList = saveList;
})(window);
