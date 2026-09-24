-- SupabaseのSQL Editorで実行してください

-- 本棚
create table public.shelves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  created_at timestamptz default now()
);
alter table public.shelves enable row level security;
create policy "Own shelves" on public.shelves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- アイテム
create table public.items (
  id uuid primary key default gen_random_uuid(),
  shelf_id uuid references public.shelves on delete cascade not null,
  user_id uuid references auth.users not null,
  title text not null,
  author text,
  url text,
  source_type text not null default 'book',
  created_at timestamptz default now()
);
alter table public.items enable row level security;
create policy "Own items" on public.items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- メモ
create table public.memos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items on delete cascade not null,
  user_id uuid references auth.users not null,
  type text not null default 'quote',
  text text,
  question text,
  answer text,
  tags text[] default '{}',
  created_at timestamptz default now()
);
alter table public.memos enable row level security;
create policy "Own memos" on public.memos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ▼ パフォーマンス改善（本棚・アイテムを開く動作が重い問題への対応）
-- SupabaseのSQL Editorで実行してください（Advisorのperformance警告に対応）

-- 外部キーに対するインデックス（未インデックスFKによる検索の遅さを解消）
create index if not exists shelves_user_id_idx on public.shelves (user_id);
create index if not exists items_shelf_id_idx on public.items (shelf_id);
create index if not exists items_user_id_idx on public.items (user_id);
create index if not exists memos_item_id_idx on public.memos (item_id);
create index if not exists memos_user_id_idx on public.memos (user_id);

-- RLSポリシーのauth.uid()を(select ...)でラップし、行ごとの再評価を防ぐ
drop policy if exists "Own shelves" on public.shelves;
create policy "Own shelves" on public.shelves for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Own items" on public.items;
create policy "Own items" on public.items for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Own memos" on public.memos;
create policy "Own memos" on public.memos for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
