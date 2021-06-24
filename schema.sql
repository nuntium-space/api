/*
-------
DOMAINS
-------
*/

/*
  An id is made up of three parts:
  - a prefix (3 characters)
  - a separator (an underscore)
  - a random string
*/
create domain "id" as varchar(300) check(value like '___\_%');

/*
  '320' is the maximum length of an email address as documented here:

  https://tools.ietf.org/html/rfc3696#section-3
*/
create domain "email_address" as varchar(320);

create domain "url" as varchar(500) check(value like 'https://%');

create domain "current_timestamp_utc" as timestamp default (current_timestamp at time zone 'UTC') check (value = current_timestamp at time zone 'UTC');

/*
------
TABLES
------
*/

create table "user_types"
(
  "id" text not null,

  primary key ("id")
);

create table "users"
(
  "id" id not null,
  "type" text not null default 'user',
  "full_name" text,
  "email" email_address not null,
  "stripe_customer_id" text,

  primary key ("id"),

  unique ("email"),

  foreign key ("type") references "user_types" on update cascade on delete cascade,

  check ("id" like 'usr_%')
);

create table "account_types"
(
  "id" text not null,

  primary key ("id")
);

create table "accounts"
(
  "id" id not null,
  "user" id not null,
  "type" text not null,
  "external_id" text not null,

  primary key ("id"),

  unique ("user", "type"),

  foreign key ("user") references "users" on update cascade on delete cascade,
  foreign key ("type") references "account_types" on update cascade on delete cascade,

  check ("id" like 'acc_%')
);

create table "organizations"
(
  "id" id not null,
  "name" varchar(50) not null,
  "user" id not null,
  "stripe_account_id" text not null,
  "stripe_account_enabled" boolean not null default false,

  primary key ("id"),

  unique ("name"),

  foreign key ("user") references "users" on update cascade on delete cascade,

  check ("id" like 'org_%')
);

create table "publishers"
(
  "id" id not null,
  "name" varchar(50) not null,
  "url" url not null,
  "organization" id not null,
  "verified" boolean not null,
  "has_image" boolean not null,
  "dns_txt_value" text not null,

  primary key ("id"),

  unique ("name"),
  unique ("url"),
  unique ("dns_txt_value"),

  foreign key ("organization") references "organizations" on update cascade on delete cascade,

  check ("id" like 'pub_%')
);

create table "authors"
(
  "id" id not null,
  "user" id not null,
  "publisher" id not null,

  primary key ("id"),

  unique ("user", "publisher"),

  foreign key ("user") references "users" on update cascade on delete cascade,
  foreign key ("publisher") references "publishers" on update cascade on delete cascade,

  check ("id" like 'aut_%')
);

create table "articles"
(
  "id" id not null,
  "title" varchar(50) not null,
  "content" json not null,
  "author" id not null,
  "reading_time" int not null,
  "view_count" int not null default 0,
  "like_count" int not null default 0,
  "created_at" current_timestamp_utc not null,
  "updated_at" current_timestamp_utc not null,

  primary key ("id"),

  foreign key ("author") references "authors" on update cascade on delete cascade,

  check ("id" like 'art_%'),
  check ("reading_time" >= 0),
  check ("updated_at" >= "created_at")
);

create table "sessions"
(
  "id" id not null,
  "user" id not null,
  "expires_at" timestamp not null,

  primary key ("id"),

  foreign key ("user") references "users" on update cascade on delete cascade,

  check ("id" like 'ses_%'),
  check ("expires_at" > current_timestamp)
);

create table "bundles"
(
  "id" id not null,
  "name" varchar(50) not null,
  "organization" id not null,
  "active" boolean not null,
  "stripe_product_id" text,

  primary key ("id"),

  unique ("name", "organization"),

  foreign key ("organization") references "organizations" on update cascade,

  check ("id" like 'bdl_%')
);

create table "prices"
(
  "id" id not null,
  "amount" int not null,
  "currency" char(3) not null,
  "bundle" id not null,
  "active" boolean not null,
  "stripe_price_id" text,

  primary key ("id"),

  foreign key ("bundle") references "bundles" on update cascade on delete cascade,

  check ("id" like 'pri_%'),
  check ("amount" >= 0)
);

create table "bundles_publishers"
(
  "bundle" id not null,
  "publisher" id not null,

  primary key ("bundle", "publisher"),

  foreign key ("bundle") references "bundles" on update cascade on delete cascade,
  foreign key ("publisher") references "publishers" on update cascade on delete cascade
);

create table "subscriptions"
(
  "id" id not null,
  "status" text not null,
  "user" id not null,
  "price" id not null,
  "current_period_end" timestamp not null,
  "cancel_at_period_end" boolean not null,
  "deleted" boolean not null,
  "stripe_subscription_id" text not null,

  primary key ("id"),

  unique ("stripe_subscription_id"),

  foreign key ("user") references "users" on update cascade on delete cascade,
  foreign key ("price") references "prices" on update cascade,

  check ("id" like 'sub_%')
);

create table "payment_methods"
(
  "id" id not null,
  "type" text not null,
  "data" json not null,
  "user" id not null,
  "stripe_id" text not null,

  primary key ("id"),

  unique ("stripe_id"),

  foreign key ("user") references "users" on update cascade on delete cascade,

  check ("id" like 'pmt_%')
);

create table "default_payment_methods"
(
  "user" id not null,
  "payment_method" id not null,

  primary key ("user"),

  unique ("payment_method"),

  foreign key ("user") references "users" on update cascade on delete cascade,
  foreign key ("payment_method") references "payment_methods" on update cascade on delete cascade
);

create table "user_settings"
(
  "user" id not null,
  "language" text,

  primary key ("user"),

  foreign key ("user") references "users" on update cascade on delete cascade
);

create table "sign_in_requests"
(
  "id" id not null,
  "token" text not null,
  "user" id not null,
  "session" id,
  "expires_at" timestamp not null,

  primary key ("id"),

  unique ("token"),

  foreign key ("user") references "users" on update cascade on delete cascade,
  foreign key ("session") references "sessions" on update cascade on delete cascade,

  check ("id" like 'sir_%'),
  check ("expires_at" > current_timestamp at time zone 'UTC')
);

/*
  This table acts as the user's history (guess where the table's name came from).

  It can be cleared if the user wants to.

  This means we cannot rely on this table to calculate how many views an
  article has (it would be too much work for the DB anyway), that is why
  an article has the attribute 'view_count'.
*/
create table "user_history"
(
  "user" id not null,
  "article" id not null,
  "last_viewed_at" timestamp not null,

  primary key ("user", "article"),

  foreign key ("user") references "users" on update cascade on delete cascade,
  foreign key ("article") references "articles" on update cascade on delete cascade
);

/*
  This table cannot be cleared, unless the article a row refers to is deleted.

  This can be used to provide time series data for each article, to maybe draw
  a chart that shows the views for a certain period of time.
*/
create table "article_views"
(
  /*
    Added because a primary key with just the
    article id and the timestamp is not necessarily
    enough: just think of two requests at the exact same time
    from different users.
  */
  "id" id not null,
  "article" id not null,
  "timestamp" current_timestamp_utc not null,

  primary key ("id"),

  foreign key ("article") references "articles" on update cascade on delete cascade,

  check ("id" like 'avw_%')
);

create table "sources"
(
  "id" id not null,
  "url" url not null,
  "article" id not null,

  primary key ("id"),

  unique ("url", "article"),

  foreign key ("article") references "articles" on update cascade on delete cascade,

  check ("id" like 'src_%')
);

create table "likes"
(
  "user" id not null,
  "article" id not null,

  primary key ("user", "article"),

  foreign key ("user") references "users" on update cascade on delete cascade,
  foreign key ("article") references "articles" on update cascade on delete cascade
);

create table "bookmarks"
(
  "user" id not null,
  "article" id not null,
  "created_at" current_timestamp_utc not null,

  primary key ("user", "article"),

  foreign key ("user") references "users" on update cascade on delete cascade,
  foreign key ("article") references "articles" on update cascade on delete cascade
);

create table "author_invites"
(
  "id" id not null,
  "user" id not null,
  "publisher" id not null,
  "created_at" current_timestamp_utc not null,
  "expires_at" timestamp not null,

  primary key ("id"),

  unique ("user", "publisher"),

  foreign key ("user") references "users" on update cascade on delete cascade,
  foreign key ("publisher") references "publishers" on update cascade on delete cascade,

  check ("id" like 'inv_%'),
  check ("expires_at" >= "created_at")
);

create table "article_draft_statuses"
(
  "id" text not null,

  primary key ("id")
);

create table "article_drafts"
(
  "id" id not null,
  "title" varchar(50) not null,
  "content" json not null,
  "author" id not null,
  "article" id, -- If it is null it means that this is the first draft of an article
  "status" text not null default 'draft',
  "created_at" current_timestamp_utc not null,
  "updated_at" current_timestamp_utc not null,

  primary key ("id"),

  foreign key ("article") references "articles" on update cascade on delete cascade,
  foreign key ("author") references "authors" on update cascade on delete cascade,
  foreign key ("status") references "article_draft_statuses" on update cascade on delete cascade,

  check ("id" like 'dft_%'),
  check ("updated_at" >= "created_at")
);

create table "draft_sources"
(
  "id" id not null,
  "url" url not null,
  "draft" id not null,

  primary key ("id"),

  unique ("url", "draft"),

  foreign key ("draft") references "article_drafts" on update cascade on delete cascade,

  check ("id" like 'dsr_%')
);

/*
-----
VIEWS
-----
*/

create view "v_active_bundles"
as select * from "bundles" where "active" = true;

create view "v_active_subscriptions"
as select * from "subscriptions" where "status" = 'active';

/*
---------
FUNCTIONS
---------
*/

create function prevent_update()
returns trigger as $$
begin
  raise exception '';
end;
$$ language plpgsql;

create function update_updated_at()
returns trigger as $$
begin
  new."updated_at" = current_timestamp at time zone 'UTC';
  return new;
end;
$$ language plpgsql;

/*
--------
TRIGGERS
--------
*/

create trigger "update_updated_at"
before update on "articles"
for each row
execute procedure update_updated_at();

create trigger "update_updated_at"
before update on "article_drafts"
for each row
execute procedure update_updated_at();

create trigger "prevent_update"
before update on "article_views"
for each row
execute procedure prevent_update();

create trigger "prevent_update"
before update on "bookmarks"
for each row
execute procedure prevent_update();

create trigger "prevent_update"
before update on "likes"
for each row
execute procedure prevent_update();

/*
------------
INITIAL DATA
------------
*/

insert into "account_types"
  ("id")
values
  ('facebook'),
  ('google'),
  ('twitter');

insert into "article_draft_statuses"
  ("id")
values
  ('draft'), -- Default value for new drafts, can be modified
  ('pending-verification'); -- Draft submitted for verification, cannot be modified

insert into "user_types"
  ("id")
values
  ('admin'),
  ('user');
