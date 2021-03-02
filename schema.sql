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

    primary key ("id"),

    unique ("email"),

    check ("id" like 'usr_%')
);

create table "organizations"
(
    "id" id not null,
    "name" varchar(50) not null,
    "user" id not null,

    primary key ("id"),

    unique ("name"),

    foreign key ("user") references "users" on update cascade on delete cascade,

    check ("id" like 'org_%')
);

create table "publishers"
(
    "id" id not null,
    "name" varchar(50) not null,
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
    "created_at" timestamp not null,
    "updated_at" timestamp not null,

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
    "created_at" timestamp not null,
    "updated_at" timestamp not null,

    primary key ("id"),

    foreign key ("user") references "users" on update cascade on delete cascade,
    foreign key ("article") references "articles" on update cascade on delete cascade,
    foreign key ("parent") references "comments" on update cascade on delete cascade,

    check ("id" like 'cmt_%'),
    check ("created_at" <= current_timestamp),
    check ("updated_at" >= "created_at")
);

create table "bundles"
(
    "id" id not null,
    "name" varchar(50) not null,
    "organization" id not null,
    "price" money not null,

    primary key ("id"),

    foreign key ("organization") references "organizations" on update cascade on delete cascade,

    check ("id" like 'bdl_%'),
    check ("price" >= 0::money)
);

create table "bundles_publishers"
(
    "bundle" id not null,
    "publisher" id not null,

    primary key ("bundle", "publisher"),

    foreign key ("bundle") references "bundles" on update cascade on delete cascade,
    foreign key ("publisher") references "publishers" on update cascade on delete cascade
);
