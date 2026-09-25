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

-- ▼ クイズ機能（解説・難易度・クイズセット・共有）

alter table public.memos add column if not exists explanation text;
alter table public.memos add column if not exists difficulty smallint
  check (difficulty between 1 and 5);

create table if not exists public.quiz_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  description text,
  author_name text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists quiz_sets_user_id_idx on public.quiz_sets (user_id);
create index if not exists quiz_sets_public_created_idx on public.quiz_sets (created_at desc) where is_public;

create table if not exists public.quiz_set_items (
  quiz_set_id uuid not null references public.quiz_sets on delete cascade,
  memo_id uuid not null references public.memos on delete cascade,
  position int not null default 0,
  primary key (quiz_set_id, memo_id)
);
create index if not exists quiz_set_items_memo_id_idx on public.quiz_set_items (memo_id);

alter table public.quiz_sets enable row level security;
alter table public.quiz_set_items enable row level security;

create policy "Own quiz sets" on public.quiz_sets for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Public quiz sets are readable" on public.quiz_sets for select to anon, authenticated
  using (is_public);

create policy "Own quiz set items" on public.quiz_set_items for all to authenticated
  using (exists (select 1 from public.quiz_sets s where s.id = quiz_set_id and s.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.quiz_sets s where s.id = quiz_set_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.memos m where m.id = memo_id and m.user_id = (select auth.uid()))
  );
create policy "Public quiz set items are readable" on public.quiz_set_items for select to anon, authenticated
  using (exists (select 1 from public.quiz_sets s where s.id = quiz_set_id and s.is_public));

-- 公開セットに入っているクイズだけは、他の人（未ログイン含む）も読める
create policy "Quizzes in public sets are readable" on public.memos for select to anon, authenticated
  using (
    type = 'qa' and exists (
      select 1 from public.quiz_set_items i
      join public.quiz_sets s on s.id = i.quiz_set_id
      where i.memo_id = memos.id and s.is_public
    )
  );
