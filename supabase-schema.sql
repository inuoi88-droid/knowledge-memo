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
