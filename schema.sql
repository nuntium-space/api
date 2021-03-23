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

/*
------
TABLES
------
*/

create table "users"
(
    "id" id not null,
    "first_name" varchar(50) not null,
    "last_name" varchar(50) not null,
    "email" email_address not null,
    "password" text not null,
    "stripe_customer_id" text,

    primary key ("id"),

    unique ("email"),

    check ("id" like 'usr_%')
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

    primary key ("id"),

    unique ("name"),

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
    "content" text not null,
    "author" id not null,
    "created_at" timestamp not null default current_timestamp,
    "updated_at" timestamp not null default current_timestamp,

    primary key ("id"),

    foreign key ("author") references "authors" on update cascade on delete cascade,

    check ("id" like 'art_%'),
    check ("created_at" <= current_timestamp),
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

create table "comments"
(
    "id" id not null,
    "content" text not null,
    "user" id not null,
    "article" id not null,
    "parent" id,
    "created_at" timestamp not null default current_timestamp,
    "updated_at" timestamp not null default current_timestamp,

    primary key ("id"),

    foreign key ("user") references "users" on update cascade on delete cascade,
    foreign key ("article") references "articles" on update cascade on delete cascade,
    foreign key ("parent") references "comments" on update cascade on delete cascade,

    check ("id" like 'cmt_%'),
    check ("created_at" <= current_timestamp),
    check ("updated_at" >= "created_at"),
    check ("parent" <> "id")
);

create table "bundles"
(
    "id" id not null,
    "name" varchar(50) not null,
    "organization" id not null,
    "price" int not null,
    "active" boolean not null,
    "stripe_product_id" text,
    "stripe_price_id" text,

    primary key ("id"),

    unique ("name", "organization"),

    foreign key ("organization") references "organizations" on update cascade,

    check ("id" like 'bdl_%'),
    check ("price" >= 0)
);

create table "prices"
(
    "id" id not null,
    "value" int not null,
    "currency" char(3) not null,
    "bundle" id not null,
    "stripe_price_id" text,

    primary key ("id"),

    unique ("name", "organization"),

    foreign key ("bundle") references "bundles" on update cascade on delete cascade,

    check ("id" like 'pri_%'),
    check ("value" >= 0)
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
    "bundle" id not null,
    "current_period_end" timestamp not null,
    "cancel_at_period_end" boolean not null,
    "deleted" boolean not null,
    "stripe_subscription_id" text not null,

    primary key ("id"),

    unique ("stripe_subscription_id"),

    foreign key ("user") references "users" on update cascade on delete cascade,
    foreign key ("bundle") references "bundles" on update cascade,

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
    foreign key ("payment_method") references "payment_methods" on update cascade on delete cascade,
);

/*
-----
VIEWS
-----
*/

create view "v_active_bundles"
as select * from "bundles" where "active" = true;

create view "v_comments"
as
    select *, (select count(*) from "comments" where "parent" = "c"."id") as "reply_count"
    from "comments" as c;

create view "v_active_subscriptions"
as select * from "subscriptions" where "status" = 'active';

/*
---------
FUNCTIONS
---------
*/

create function trigger_update_updated_at()
returns trigger as $$
begin
  new."updated_at" = current_timestamp;
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
execute procedure trigger_update_updated_at();

create trigger "update_updated_at"
before update on "comments"
for each row
execute procedure trigger_update_updated_at();
