-- =========================================================
--  个人站点 Supabase 初始化脚本
--  用法：Supabase 后台 → SQL Editor → 粘贴全部 → Run
--  作用：建统一数据表 items + 开启行级安全(RLS) + 4 条策略
-- =========================================================

-- 1) 统一数据表：每种内容一个 kind（daily/book/movie/todo/wishlist/calendar）
create table if not exists public.items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 每个用户、每种 kind 只留一行（避免重复）
create unique index if not exists items_user_kind_uniq
  on public.items (user_id, kind);

-- 2) 开启行级安全（关键：没这步任何人都能看/改）
alter table public.items enable row level security;

-- 3) 策略：只能操作自己的数据
drop policy if exists "items_select_own" on public.items;
create policy "items_select_own" on public.items
  for select using (auth.uid() = user_id);

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own" on public.items
  for insert with check (auth.uid() = user_id);

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own" on public.items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own" on public.items
  for delete using (auth.uid() = user_id);

-- 4) 更新时自动刷新 updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at before update on public.items
  for each row execute function public.set_updated_at();
