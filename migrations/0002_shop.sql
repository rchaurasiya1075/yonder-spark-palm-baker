-- PINAKI Farms catalog, profiles, and orders.
-- Mirrors the intended Firestore collections (products, orders, profiles)
-- so the schema is easy to port later.

create table if not exists products (
  id          text primary key,
  slug        text not null unique,
  name        text not null,
  hindi_name  text,
  category    text not null,
  description text not null,
  price       integer not null,
  mrp         integer,
  unit        text not null,
  image_urls  text not null default '[]',
  video_url   text,
  stock       integer not null default 0,
  active      boolean not null default true,
  featured    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists products_category_idx on products (category);
create index if not exists products_active_idx on products (active);

create table if not exists profiles (
  user_id    text primary key,
  role       text not null default 'customer',
  name       text,
  phone      text,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id              text primary key,
  user_id         text not null,
  customer_name   text not null,
  phone           text not null,
  address         text not null,
  city            text not null,
  pincode         text not null,
  payment_method  text not null,
  payment_status  text not null default 'pending',
  order_status    text not null default 'placed',
  total           integer not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists orders_user_id_idx on orders (user_id);
create index if not exists orders_status_idx on orders (order_status);
create index if not exists orders_created_at_idx on orders (created_at desc);

create table if not exists order_items (
  id            text primary key,
  order_id      text not null references orders (id) on delete cascade,
  product_id    text not null,
  product_slug  text not null,
  product_name  text not null,
  unit          text not null,
  price         integer not null,
  quantity      integer not null,
  image_url     text
);

create index if not exists order_items_order_id_idx on order_items (order_id);

create table if not exists order_events (
  id         text primary key,
  order_id   text not null references orders (id) on delete cascade,
  status     text not null,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_id_idx on order_events (order_id);

-- Seed catalog
insert into products (
  id, slug, name, hindi_name, category, description, price, mrp, unit,
  image_urls, video_url, stock, active, featured
) values
(
  'prod_mango_achar',
  'homemade-mango-pickle',
  'Homemade Mango Pickle',
  'आम का अचार',
  'achar',
  'Sun-ripened raw mangoes from our orchard, cut by hand and aged in cold-pressed mustard oil with fennel, fenugreek, nigella and red chili. No preservatives, no shortcuts — the taste of a North Indian summer, jarred the way our family has always made it.',
  349,
  449,
  '500 g',
  '["/products/mango-pickle-1.jpg","/products/mango-pickle-2.jpg"]',
  null,
  42,
  true,
  true
),
(
  'prod_chili_achar',
  'stuffed-chili-pickle',
  'Stuffed Chili Pickle',
  'भरवां मिर्च अचार',
  'achar',
  'Tender red and green chilies stuffed with a roasted spice masala and slow-cured in mustard oil. Sharp, fragrant, and made for paratha, dal-chawal, and winter thalis. Hari mirch achar with the heat left honest.',
  299,
  399,
  '400 g',
  '["/products/chili-pickle-1.jpg","/products/chili-pickle-2.jpg"]',
  null,
  28,
  true,
  false
),
(
  'prod_mixed_achar',
  'mixed-pickles',
  'Mixed Pickles',
  'मिक्स अचार',
  'achar',
  'A farm mix of cauliflower, carrot, mango, lemon and chili, packed in mustard oil with homemade achar masala. One jar for the whole table — every spoon a little different.',
  329,
  null,
  '500 g',
  '["/products/mixed-pickle-1.jpg"]',
  null,
  8,
  true,
  false
),
(
  'prod_a2_ghee',
  'a2-bilona-cow-ghee',
  'Pure Bilona Method A2 Cow Ghee',
  'आ2 बिलोना घी',
  'ghee',
  'Cultured A2 desi cow milk, churned the traditional bilona way and slow-cooked in a heavy kadai until it turns grainy, aromatic and golden. For tadka, roti, halwa, and daily nourish. Nothing added, nothing taken away.',
  899,
  1099,
  '500 ml',
  '["/products/ghee-1.jpg","/products/ghee-2.jpg"]',
  'https://www.youtube.com/watch?v=eM7XlgoGuZQ',
  35,
  true,
  true
),
(
  'prod_mustard_oil',
  'wooden-kolhu-mustard-oil',
  'Wooden Kolhu Mustard Oil',
  'सरसों का तेल',
  'oil',
  'Black mustard seeds crushed in a wooden kolhu — cold pressed, unrefined, and bottled the same week. Strong aroma, pungent flavour, the oil our kitchen has always cooked with. Sarson ka tel, as it should be.',
  279,
  349,
  '1 L',
  '["/products/mustard-oil-1.jpg","/products/mustard-oil-2.jpg"]',
  null,
  50,
  true,
  true
),
(
  'prod_sesame_oil',
  'cold-pressed-sesame-oil',
  'Cold Pressed Sesame Oil',
  'तिल का तेल',
  'oil',
  'White sesame (til) pressed without heat so the nutty aroma stays intact. A finishing oil for tadka, a gentle oil for hair and skin, and a kitchen staple from a slower way of milling.',
  399,
  null,
  '500 ml',
  '["/products/sesame-oil-1.jpg"]',
  null,
  22,
  true,
  false
),
(
  'prod_coconut_oil',
  'cold-pressed-coconut-oil',
  'Cold Pressed Coconut Oil',
  'नारियल तेल',
  'oil',
  'Fresh copra pressed at low temperature. Clean coconut aroma — sets white in winter, pours golden in summer. For cooking, oil-pulling, and skin. A short-batch oil from the farm pantry.',
  349,
  399,
  '500 ml',
  '["/products/coconut-oil-1.jpg"]',
  null,
  18,
  true,
  false
)
on conflict (id) do nothing;
