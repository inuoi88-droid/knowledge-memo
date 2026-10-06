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

-- ▼ クイズ機能（解説・難易度）

alter table public.memos add column if not exists explanation text;
alter table public.memos add column if not exists difficulty smallint
  check (difficulty between 1 and 5);

create schema if not exists private;

-- （以前あったクイズセット quiz_sets / quiz_set_items は、本棚・アイテムの公開に置き換えて削除済み）

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
  level smallint not null default 0,          -- 覚えた度（復習の段階）
  last_result boolean,
  last_answered_at timestamptz,
  due_at timestamptz,                         -- 次に復習する日時
  introduced_at timestamptz,                  -- 学習で初めて出した日時（1日の新しい問題数を数える）
  primary key (user_id, memo_id)
);
create index if not exists quiz_progress_introduced_idx on public.quiz_progress (user_id, introduced_at) where introduced_at is not null;
create index if not exists quiz_progress_memo_id_idx on public.quiz_progress (memo_id);
create index if not exists quiz_progress_due_idx on public.quiz_progress (user_id, due_at);
alter table public.quiz_progress enable row level security;
create policy "Own quiz progress" on public.quiz_progress for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 学習の個人設定（復習の間隔・書く回数・復習の答え方・1日の新しい問題数・出す順番・範囲）
-- （本番DBには migration「study_settings_configurable_review」「study_unified_scope_publish」として適用済み）
create table if not exists public.study_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  review_days int[] not null default '{1,3,7,14,30}'
    check (cardinality(review_days) between 2 and 8 and 1 <= all (review_days) and 3650 >= all (review_days)),
  check_repeats smallint not null default 2 check (check_repeats between 1 and 5),
  review_style text not null default 'typing' check (review_style in ('typing', 'cards')),
  daily_new smallint not null default 10 check (daily_new between 1 and 200),
  new_order text not null default 'sequential' check (new_order in ('sequential', 'random')),
  scope_shelf_ids uuid[] not null default '{}',
  scope_item_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.study_settings enable row level security;
create policy "Own study settings" on public.study_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 1回答ぶんを記録。復習の間隔は本人の設定（なければ 1,3,7,14,30 日）。
-- ・復習日は「日」単位（日本時間の朝4時に切り替え）。夜に答えても翌日の朝から復習に出る
-- ・まちがえた直後（覚えた度0）に正解したら、明日の復習へ
-- ・復習の時期が来ていない問題は、正解しても覚えた度を上げない（同じ日に連打して上げられないように）
create or replace function public.record_answer(p_memo_id uuid, p_correct boolean, p_study boolean default false) returns void
  language plpgsql security invoker set search_path = '' as $fn$
declare
  days int[];
  steps int;
  today timestamptz := date_bin('1 day', now(), timestamptz '2000-01-01 04:00:00+09');
begin
  select s.review_days into days from public.study_settings s where s.user_id = (select auth.uid());
  days := coalesce(days, '{1,3,7,14,30}'::int[]);
  steps := cardinality(days);
  insert into public.quiz_progress as p (user_id, memo_id, correct_count, wrong_count, level, last_result, last_answered_at, due_at, introduced_at)
  values (
    (select auth.uid()), p_memo_id,
    case when p_correct then 1 else 0 end,
    case when p_correct then 0 else 1 end,
    case when p_correct then 1 else 0 end,
    p_correct, now(),
    case when p_correct then today + make_interval(days => days[1]) else now() + interval '10 minutes' end,
    case when p_study then now() end
  )
  on conflict (user_id, memo_id) do update set
    correct_count = p.correct_count + case when p_correct then 1 else 0 end,
    wrong_count = p.wrong_count + case when p_correct then 0 else 1 end,
    level = case
      when not p_correct then 0
      when p.due_at is null or p.due_at <= now() then least(steps, p.level + 1)
      when p.level = 0 then 1
      else p.level end,
    due_at = case
      when not p_correct then now() + interval '10 minutes'
      when p.due_at is null or p.due_at <= now() then today + make_interval(days => days[least(steps, p.level + 1)])
      when p.level = 0 then today + make_interval(days => days[1])
      else p.due_at end,
    last_result = p_correct,
    last_answered_at = now();
end $fn$;
revoke all on function public.record_answer(uuid, boolean, boolean) from public, anon;
grant execute on function public.record_answer(uuid, boolean, boolean) to authenticated;

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

-- ▼ 問題の並び順・本棚とアイテムの公開
-- （本番DBには migration「study_unified_scope_publish」として適用済み）

-- 追加した順（スプレッドシートの上から）。「初めから」学習の順番
create sequence if not exists public.memos_position_seq;
alter table public.memos add column if not exists position bigint not null default nextval('public.memos_position_seq');
alter sequence public.memos_position_seq owned by public.memos.position;
grant usage, select on sequence public.memos_position_seq to authenticated;
create index if not exists memos_item_position_idx on public.memos (item_id, position);

-- 貼り直した表の順に並べ替える（自分の問題だけ）
create or replace function public.reorder_quizzes(p_ids uuid[]) returns void
  language plpgsql security invoker set search_path = '' as $fn$
declare
  base bigint;
begin
  base := nextval('public.memos_position_seq');
  perform setval('public.memos_position_seq', base + coalesce(cardinality(p_ids), 0) + 1, false);
  update public.memos m set position = base + u.ord
  from unnest(p_ids) with ordinality as u(id, ord)
  where m.id = u.id and m.user_id = (select auth.uid());
end $fn$;
revoke all on function public.reorder_quizzes(uuid[]) from public, anon;
grant execute on function public.reorder_quizzes(uuid[]) to authenticated;

-- 本棚・アイテムを公開すると、中のクイズがすべて公開される（引用・感想のメモは公開しない）
alter table public.shelves
  add column if not exists is_public boolean not null default false,
  add column if not exists author_name text,
  add column if not exists published_at timestamptz;
alter table public.items
  add column if not exists is_public boolean not null default false,
  add column if not exists author_name text,
  add column if not exists published_at timestamptz;
create index if not exists shelves_public_idx on public.shelves (published_at desc) where is_public;
create index if not exists items_public_idx on public.items (published_at desc) where is_public;

create or replace function private.shelf_is_public(target uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $fn$ select exists (select 1 from public.shelves s where s.id = target and s.is_public) $fn$;
create or replace function private.item_is_public(target uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $fn$ select exists (
    select 1 from public.items i join public.shelves s on s.id = i.shelf_id
    where i.id = target and (i.is_public or s.is_public)
  ) $fn$;
revoke all on function private.shelf_is_public(uuid) from public;
revoke all on function private.item_is_public(uuid) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.shelf_is_public(uuid) to anon, authenticated;
grant execute on function private.item_is_public(uuid) to anon, authenticated;

create policy "Public shelves are readable" on public.shelves for select to anon, authenticated
  using (is_public);
create policy "Public items are readable" on public.items for select to anon, authenticated
  using (is_public or private.shelf_is_public(shelf_id));
create policy "Quizzes in public items are readable" on public.memos for select to anon, authenticated
  using (type = 'qa' and private.item_is_public(item_id));

-- 公開中の本棚・アイテムの一覧。呼び出した人の権限（RLS）で読む
create or replace function public.list_public_quiz_sources()
  returns table (kind text, id uuid, title text, author_name text, quiz_count bigint, published_at timestamptz, is_mine boolean)
  language sql stable security invoker set search_path = '' as $fn$
  select * from (
    select 'shelf'::text, s.id, s.name, s.author_name,
      (select count(*) from public.memos m join public.items i on i.id = m.item_id where i.shelf_id = s.id and m.type = 'qa'),
      s.published_at, coalesce(s.user_id = (select auth.uid()), false)
    from public.shelves s where s.is_public
    union all
    select 'item'::text, i.id, i.title, i.author_name,
      (select count(*) from public.memos m where m.item_id = i.id and m.type = 'qa'),
      i.published_at, coalesce(i.user_id = (select auth.uid()), false)
    from public.items i
    where i.is_public and not private.shelf_is_public(i.shelf_id)
  ) t order by published_at desc nulls last limit 200
$fn$;
revoke all on function public.list_public_quiz_sources() from public;
grant execute on function public.list_public_quiz_sources() to anon, authenticated;
-- ▼ 毎日の通知（プッシュ通知・メール）
-- （本番DBには migration「daily_reminders」「daily_reminders_cron」として適用済み。
--   送信は Edge Function「reminders」（supabase/functions/reminders）。メールは Edge Function のシークレット RESEND_API_KEY があるときだけ）
create table if not exists public.reminder_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  push_enabled boolean not null default false,
  email_enabled boolean not null default false,
  -- 通知する時刻（日本時間・0時からの分。15分きざみ）
  remind_minute smallint not null default 1200 check (remind_minute between 0 and 1425 and remind_minute % 15 = 0),
  -- 最後に通知した日（日本時間）。1日1回だけ送る
  last_sent_on date,
  updated_at timestamptz not null default now()
);
alter table public.reminder_settings enable row level security;
create policy "Own reminder settings" on public.reminder_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- プッシュ通知を受け取る端末（ブラウザ）
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
create policy "Own push subscriptions" on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 通知用の鍵など（RLS だけ有効でポリシーなし＝サーバーの関数からしか読めない）
-- プッシュ通知の VAPID 鍵は、Edge Function がはじめて呼ばれたときに作って key='vapid' に保存する
create table if not exists public.app_secrets (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on table public.app_secrets from anon, authenticated;

-- 通知の時刻が来た人を取り出し、今日は送ったことにする（Edge Function だけが呼ぶ）
create or replace function public.claim_due_reminders()
  returns table (user_id uuid, email text, push_enabled boolean, email_enabled boolean, due_count bigint, new_left bigint)
  language sql security definer set search_path = '' as $fn$
  with t as (
    select (now() at time zone 'Asia/Tokyo')::date as today,
      (extract(hour from now() at time zone 'Asia/Tokyo') * 60 + extract(minute from now() at time zone 'Asia/Tokyo'))::int as minute_now,
      date_bin('1 day', now(), timestamptz '2000-01-01 04:00:00+09') as study_day
  ), claimed as (
    update public.reminder_settings r set last_sent_on = t.today
    from t
    where (r.push_enabled or r.email_enabled)
      and r.remind_minute <= t.minute_now
      and (r.last_sent_on is null or r.last_sent_on < t.today)
    returning r.user_id, r.push_enabled, r.email_enabled
  )
  select c.user_id, u.email::text, c.push_enabled, c.email_enabled,
    (select count(*) from public.quiz_progress p where p.user_id = c.user_id and p.due_at <= now()),
    greatest(0, least(
      coalesce((select s.daily_new from public.study_settings s where s.user_id = c.user_id), 10)
        - (select count(*) from public.quiz_progress p, t where p.user_id = c.user_id and p.introduced_at >= t.study_day),
      (select count(*) from public.memos m where m.user_id = c.user_id and m.type = 'qa'
        and not exists (select 1 from public.quiz_progress p where p.user_id = c.user_id and p.memo_id = m.id))
    ))
  from claimed c join auth.users u on u.id = c.user_id
$fn$;
revoke all on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_reminders() to service_role;

-- 15分ごとに通知の Edge Function を呼ぶ（送る相手がいなければ何もしない。1人1日1回まで）
-- Authorization は公開用の anon キー（フロントにも入っている秘密ではないキー）
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'daily-reminders',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <anon key>'),
    body := '{"action":"cron"}'::jsonb,
    timeout_milliseconds := 30000
  )
  $job$
);
-- ============================================================
-- 公開判定を1回の問い合わせにつき1度だけ計算する（速度改善）
-- item_is_public(item_id) のような行ごとの関数呼び出しは、security definer のため
-- 展開されず1行ずつ実行され、自分の4,000問を読むだけで0.3秒以上かかっていた。
-- 公開中の本棚・アイテムの ID を一度だけ求め、IN で照らし合わせる（読める範囲は同じ）
-- ============================================================
create or replace function private.public_shelf_ids() returns setof uuid
  language sql stable security definer set search_path = ''
  as $fn$ select s.id from public.shelves s where s.is_public $fn$;
create or replace function private.public_item_ids() returns setof uuid
  language sql stable security definer set search_path = ''
  as $fn$ select i.id from public.items i join public.shelves s on s.id = i.shelf_id where i.is_public or s.is_public $fn$;
revoke all on function private.public_shelf_ids() from public;
revoke all on function private.public_item_ids() from public;
grant execute on function private.public_shelf_ids() to anon, authenticated;
grant execute on function private.public_item_ids() to anon, authenticated;

alter policy "Public items are readable" on public.items
  using (is_public or shelf_id in (select private.public_shelf_ids()));
alter policy "Quizzes in public items are readable" on public.memos
  using (type = 'qa' and item_id in (select private.public_item_ids()));
