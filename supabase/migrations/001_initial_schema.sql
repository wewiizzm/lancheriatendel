create extension if not exists pgcrypto;

create table if not exists restaurant_settings (
  id integer primary key,
  whatsapp_number text not null default '',
  online_orders_paused boolean not null default false,
  online_open_time text not null default '19:00',
  online_close_time text not null default '23:00',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references menu_categories(id) on delete cascade,
  title text not null,
  description text not null,
  price_cents integer not null check (price_cents >= 0),
  position integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  source text not null check (source in ('online', 'counter')),
  service_mode text not null check (service_mode in ('pickup', 'table')),
  customer_name text not null,
  customer_phone text,
  table_reference text,
  pickup_time text,
  general_notes text,
  status text not null check (status in ('pending', 'preparing', 'ready', 'archived')) default 'pending',
  total_cents integer not null default 0,
  whatsapp_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  title text not null,
  description text not null,
  category_name text not null,
  price_cents integer not null check (price_cents >= 0),
  quantity integer not null check (quantity > 0),
  item_notes text,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists menu_categories_position_idx on menu_categories(position, name);
create index if not exists menu_items_category_position_idx on menu_items(category_id, position, title);
create index if not exists orders_status_created_idx on orders(status, created_at desc);
create index if not exists order_items_order_position_idx on order_items(order_id, position);
