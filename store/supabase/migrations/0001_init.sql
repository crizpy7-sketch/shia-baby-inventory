-- Shia Baby store — core e-commerce schema
-- Security model: RLS is enabled on every table with NO policies, so the
-- anon/authenticated keys can read or write nothing directly. All access
-- goes through the service-role key inside Next.js API route handlers,
-- after app-level checks (admin allow-list, or possession of an
-- unguessable order token). This mirrors the Reveal Atelier app's model.

create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- admin allow-list ----------
create table admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- catalog ----------
create table collections (
  id uuid primary key default gen_random_uuid(),
  handle text unique not null,
  name text not null,
  description text,
  type text not null default 'manual' check (type in ('manual', 'smart')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger collections_set_updated_at before update on collections
  for each row execute function set_updated_at();

create table products (
  id uuid primary key default gen_random_uuid(),
  handle text unique not null,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  vendor text,
  product_type text,
  tags text[] not null default '{}',
  price_cents integer not null check (price_cents >= 0),
  compare_at_price_cents integer check (compare_at_price_cents is null or compare_at_price_cents >= 0),
  gift_ready boolean not null default false,
  materials text,
  care_instructions text,
  images jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_status_idx on products (status);
create index products_tags_idx on products using gin (tags);
create trigger products_set_updated_at before update on products
  for each row execute function set_updated_at();

create table product_collections (
  product_id uuid not null references products(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  primary key (product_id, collection_id)
);

create table variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text unique not null,
  size text,
  color text,
  price_override_cents integer check (price_override_cents is null or price_override_cents >= 0),
  inventory_count integer not null default 0 check (inventory_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index variants_product_id_idx on variants (product_id);
create trigger variants_set_updated_at before update on variants
  for each row execute function set_updated_at();

-- ---------- customers ----------
create table customers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'US',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index addresses_customer_id_idx on addresses (customer_id);

-- ---------- promotions ----------
create table discounts (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type text not null check (type in ('percentage', 'fixed')),
  value numeric not null check (value > 0),
  min_subtotal_cents integer not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  usage_limit integer,
  times_used integer not null default 0,
  created_at timestamptz not null default now()
);

create table gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  initial_balance_cents integer not null check (initial_balance_cents > 0),
  balance_cents integer not null check (balance_cents >= 0),
  issued_to_email text,
  status text not null default 'active' check (status in ('active', 'redeemed', 'disabled')),
  created_at timestamptz not null default now()
);

-- ---------- cart ----------
create table carts (
  id uuid primary key default gen_random_uuid(),
  customer_email text,
  status text not null default 'open' check (status in ('open', 'converted', 'abandoned')),
  discount_code text,
  gift_card_code text,
  gift_wrap boolean not null default false,
  gift_note text,
  checkout_snapshot jsonb,
  locked_at timestamptz,
  stripe_checkout_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger carts_set_updated_at before update on carts
  for each row execute function set_updated_at();

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  variant_id uuid not null references variants(id),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
create index cart_items_cart_id_idx on cart_items (cart_id);

-- ---------- orders ----------
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  customer_id uuid references customers(id),
  customer_email text not null,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'fulfilled', 'cancelled', 'refunded')),
  subtotal_cents integer not null,
  discount_cents integer not null default 0,
  discount_code text,
  gift_wrap boolean not null default false,
  gift_wrap_cents integer not null default 0,
  gift_note text,
  gift_card_code text,
  gift_card_cents integer not null default 0,
  shipping_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null,
  shipping_address jsonb,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_email_idx on orders (customer_email);
create index orders_status_idx on orders (status);
create trigger orders_set_updated_at before update on orders
  for each row execute function set_updated_at();

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid references variants(id),
  product_name text not null,
  variant_label text,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now()
);
create index order_items_order_id_idx on order_items (order_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  stripe_payment_intent_id text,
  amount_cents integer not null,
  status text not null default 'succeeded' check (status in ('succeeded', 'refunded', 'failed')),
  created_at timestamptz not null default now()
);
create index payments_order_id_idx on payments (order_id);

create table order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  type text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index order_events_order_id_idx on order_events (order_id);

create or replace function log_order_status_change()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into order_events (order_id, type, data)
    values (new.id, 'status_changed', jsonb_build_object('from', case when tg_op = 'INSERT' then null else old.status end, 'to', new.status));
  end if;
  return new;
end;
$$;
create trigger orders_log_status_change after insert or update on orders
  for each row execute function log_order_status_change();

-- ---------- pre-launch waitlist (Founding Families) ----------
create table waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text check (role in ('expecting', 'gifting', 'grandparent', 'other')),
  source text not null default 'website',
  created_at timestamptz not null default now()
);

-- ---------- atomic order fulfillment ----------
-- Called once per successful payment (from the Stripe webhook, or directly
-- for a $0 order fully covered by a gift card). Runs as a single
-- transaction: if inventory is insufficient or the gift card balance is
-- short, the whole order is rolled back rather than left half-created.
create or replace function create_order_from_snapshot(
  p_cart_id uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text,
  p_customer_email text
)
returns table(order_id uuid, order_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot jsonb;
  v_gift_wrap boolean;
  v_gift_note text;
  v_order_id uuid;
  v_order_number text;
  v_token text;
  v_item jsonb;
  v_discount_code text;
  v_gift_card_code text;
  v_gift_card_applied integer;
  v_existing_id uuid;
  v_existing_token text;
begin
  select checkout_snapshot, gift_wrap, gift_note
    into v_snapshot, v_gift_wrap, v_gift_note
    from carts where id = p_cart_id
    for update;

  if v_snapshot is null then
    raise exception 'No checkout snapshot for cart %', p_cart_id;
  end if;

  select id, token into v_existing_id, v_existing_token
    from orders where stripe_checkout_session_id = p_stripe_session_id;
  if v_existing_id is not null then
    return query select v_existing_id, v_existing_token;
    return;
  end if;

  v_order_number := 'SB-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');
  v_token := encode(gen_random_bytes(16), 'hex');
  v_discount_code := v_snapshot->>'discountCode';
  v_gift_card_code := v_snapshot->>'giftCardCode';
  v_gift_card_applied := coalesce((v_snapshot->>'giftCardAppliedCents')::integer, 0);

  insert into orders (
    order_number, token, customer_email, status,
    subtotal_cents, discount_cents, discount_code,
    gift_wrap, gift_wrap_cents, gift_note,
    gift_card_code, gift_card_cents,
    shipping_cents, tax_cents, total_cents,
    stripe_checkout_session_id, stripe_payment_intent_id
  ) values (
    v_order_number, v_token, p_customer_email, 'paid',
    (v_snapshot->>'subtotalCents')::integer, (v_snapshot->>'discountCents')::integer, v_discount_code,
    coalesce(v_gift_wrap, false), (v_snapshot->>'giftWrapCents')::integer, v_gift_note,
    v_gift_card_code, v_gift_card_applied,
    (v_snapshot->>'shippingCents')::integer, (v_snapshot->>'taxCents')::integer, (v_snapshot->>'totalCents')::integer,
    p_stripe_session_id, p_stripe_payment_intent_id
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(v_snapshot->'items')
  loop
    insert into order_items (order_id, variant_id, product_name, variant_label, quantity, unit_price_cents)
    values (
      v_order_id,
      (v_item->>'variantId')::uuid,
      v_item->>'productName',
      v_item->>'variantLabel',
      (v_item->>'quantity')::integer,
      (v_item->>'unitPriceCents')::integer
    );

    update variants
    set inventory_count = inventory_count - (v_item->>'quantity')::integer
    where id = (v_item->>'variantId')::uuid
      and inventory_count >= (v_item->>'quantity')::integer;

    if not found then
      raise exception 'Insufficient inventory for variant %', v_item->>'variantId';
    end if;
  end loop;

  if v_discount_code is not null then
    update discounts set times_used = times_used + 1 where code = v_discount_code;
  end if;

  if v_gift_card_code is not null and v_gift_card_applied > 0 then
    update gift_cards
    set balance_cents = balance_cents - v_gift_card_applied,
        status = case when balance_cents - v_gift_card_applied <= 0 then 'redeemed' else status end
    where code = v_gift_card_code and balance_cents >= v_gift_card_applied;

    if not found then
      raise exception 'Gift card % has insufficient balance', v_gift_card_code;
    end if;
  end if;

  insert into payments (order_id, stripe_payment_intent_id, amount_cents, status)
  values (v_order_id, p_stripe_payment_intent_id, (v_snapshot->>'totalCents')::integer, 'succeeded');

  update carts set status = 'converted' where id = p_cart_id;

  return query select v_order_id, v_token;
end;
$$;

-- ---------- product images storage ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Public read of product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- ---------- lock every table down; service-role key bypasses RLS ----------
alter table admin_users enable row level security;
alter table collections enable row level security;
alter table products enable row level security;
alter table product_collections enable row level security;
alter table variants enable row level security;
alter table customers enable row level security;
alter table addresses enable row level security;
alter table discounts enable row level security;
alter table gift_cards enable row level security;
alter table carts enable row level security;
alter table cart_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table order_events enable row level security;
alter table waitlist_signups enable row level security;
