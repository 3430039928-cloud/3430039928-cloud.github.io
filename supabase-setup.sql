-- =========================================================
--  个人站点 Supabase 初始化脚本（共享版，无需登录）
--  用法：Supabase 后台 → SQL Editor → 粘贴全部 → Run
--  作用：建一张公共表 items，所有设备/所有人共用同一份数据
-- =========================================================

-- 1) 公共数据表：每种内容一个 kind（daily/book/movie/notes/calendar）
--    注意：没有 user_id、没有登录——谁打开网页都能读写同一份
drop table if exists public.items;

create table public.items (
  kind       text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) 关闭行级安全（RLS）：让网页用 anon key 直接读写，无需登录
alter table public.items disable row level security;

-- 3) 明确授权 anon（网页前端用的 key）可读写这张表
grant select, insert, update, delete on table public.items to anon, authenticated;

-- 4) 更新时自动刷新 updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at before update on public.items
  for each row execute function public.set_updated_at();
