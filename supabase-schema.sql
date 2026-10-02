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

-- memos の公開ポリシーが quiz_set_items を読むので、ここで memos を直接読むと RLS が循環する。
-- 所有チェックは RLS を経由しない関数で行う。
create schema if not exists private;
create or replace function private.owns_memo(target uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $fn$ select exists (select 1 from public.memos m where m.id = target and m.user_id = (select auth.uid())) $fn$;
revoke all on function private.owns_memo(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.owns_memo(uuid) to authenticated;

create policy "Own quiz set items" on public.quiz_set_items for all to authenticated
  using (exists (select 1 from public.quiz_sets s where s.id = quiz_set_id and s.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.quiz_sets s where s.id = quiz_set_id and s.user_id = (select auth.uid()))
    and private.owns_memo(memo_id)
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

-- ▼ ビジュアルクイズ・タグ重複防止・成績の記録・勉強モード
-- （本番DBには migration「quiz_progress_play_sessions_image_url_tag_dedupe」として適用済み）

-- ビジュアルクイズ（外部の画像URLを保存するだけ。画像そのものは保存しない）
alter table public.memos add column if not exists image_url text
  check (image_url is null or image_url ~* '^https?://');

-- タグの重複をDB側で防ぐ（同じタグは1つにまとめる。順番は最初の出現順）
create or replace function private.dedupe_memo_tags() returns trigger
  language plpgsql set search_path = '' as $fn$
begin
  if new.tags is not null then
    new.tags := coalesce((
      select array_agg(t order by ord)
      from (select t, min(ord) as ord from unnest(new.tags) with ordinality as u(t, ord) group by t) s
    ), '{}');
  end if;
  return new;
end $fn$;
drop trigger if exists dedupe_memo_tags on public.memos;
create trigger dedupe_memo_tags before insert or update of tags on public.memos
  for each row execute function private.dedupe_memo_tags();

-- 問題ごとの成績（1人×1問につき1行を上書きするので、遊ぶほど増えることはない）
create table if not exists public.quiz_progress (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  memo_id uuid not null references public.memos on delete cascade,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  level smallint not null default 0,          -- 覚えた度 0〜5
  last_result boolean,
  last_answered_at timestamptz,
  due_at timestamptz,                         -- 次に復習する日時
  primary key (user_id, memo_id)
);
create index if not exists quiz_progress_memo_id_idx on public.quiz_progress (memo_id);
create index if not exists quiz_progress_due_idx on public.quiz_progress (user_id, due_at);
alter table public.quiz_progress enable row level security;
create policy "Own quiz progress" on public.quiz_progress for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 勉強モードの個人設定（復習の間隔・確かめるで書く回数・復習の答え方）
-- （本番DBには migration「study_settings_configurable_review」として適用済み）
create table if not exists public.study_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  review_days int[] not null default '{1,3,7,14,30}'
    check (cardinality(review_days) between 2 and 8 and 1 <= all (review_days) and 3650 >= all (review_days)),
  check_repeats smallint not null default 2 check (check_repeats between 1 and 5),
  review_style text not null default 'typing' check (review_style in ('typing', 'cards')),
  updated_at timestamptz not null default now()
);
alter table public.study_settings enable row level security;
create policy "Own study settings" on public.study_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 1回答ぶんを記録。復習の間隔は本人の設定（なければ 1,3,7,14,30 日）。
-- 復習の時期が来ていない問題は、正解しても覚えた度を上げない（同じ日に連打して上げられないように）
create or replace function public.record_answer(p_memo_id uuid, p_correct boolean) returns void
  language plpgsql security invoker set search_path = '' as $fn$
declare
  days int[];
  steps int;
begin
  select s.review_days into days from public.study_settings s where s.user_id = (select auth.uid());
  days := coalesce(days, '{1,3,7,14,30}'::int[]);
  steps := cardinality(days);
  insert into public.quiz_progress as p (user_id, memo_id, correct_count, wrong_count, level, last_result, last_answered_at, due_at)
  values (
    (select auth.uid()), p_memo_id,
    case when p_correct then 1 else 0 end,
    case when p_correct then 0 else 1 end,
    case when p_correct then 1 else 0 end,
    p_correct, now(),
    case when p_correct then now() + make_interval(days => days[1]) else now() + interval '10 minutes' end
  )
  on conflict (user_id, memo_id) do update set
    correct_count = p.correct_count + case when p_correct then 1 else 0 end,
    wrong_count = p.wrong_count + case when p_correct then 0 else 1 end,
    level = case
      when not p_correct then 0
      when p.due_at is null or p.due_at <= now() then least(steps, p.level + 1)
      else p.level end,
    due_at = case
      when not p_correct then now() + interval '10 minutes'
      when p.due_at is null or p.due_at <= now() then now() + make_interval(days => days[least(steps, p.level + 1)])
      else p.due_at end,
    last_result = p_correct,
    last_answered_at = now();
end $fn$;
revoke all on function public.record_answer(uuid, boolean) from public, anon;
grant execute on function public.record_answer(uuid, boolean) to authenticated;

-- 1回ごとのプレイ記録（1人あたり最新300件だけ残す）
create table if not exists public.play_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  mode text not null,
  rule text not null,
  total int not null,
  correct int not null,
  max_combo int not null default 0,
  duration_ms int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists play_sessions_user_created_idx on public.play_sessions (user_id, created_at desc);
alter table public.play_sessions enable row level security;
create policy "Own play sessions" on public.play_sessions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function private.prune_play_sessions() returns trigger
  language plpgsql security definer set search_path = '' as $fn$
begin
  delete from public.play_sessions
  where user_id = new.user_id
    and id not in (select id from public.play_sessions where user_id = new.user_id order by created_at desc, id desc limit 300);
  return null;
end $fn$;
drop trigger if exists prune_play_sessions on public.play_sessions;
create trigger prune_play_sessions after insert on public.play_sessions
  for each row execute function private.prune_play_sessions();
