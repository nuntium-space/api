import Joi from "joi";
import { Config } from "./Config";

/*
---------------------
MISCELLANEOUS SCHEMAS
---------------------
*/

export const STRING_SCHEMA = Joi.string().trim();

export const ID_SCHEMA = (prefix: string) => STRING_SCHEMA.pattern(new RegExp(`^${prefix}_.+$`));

export const EMAIL_SCHEMA = STRING_SCHEMA.email();

export const URL_SCHEMA = STRING_SCHEMA.max(500).uri({
    scheme: "https",
    domain: {
        tlds: {
            allow: true,
        },
    },
});

export const PASSWORD_SCHEMA = Joi.string().min(Config.PASSWORD_MIN_LENGTH);

export const DATE_SCHEMA = Joi.extend(require("@joi/date")).date().utc().format("YYYY-MM-DD");
export const DATETIME_SCHEMA = Joi.extend(require("@joi/date")).date().utc().format("YYYY-MM-DDTHH:mm:ss.SSSZ");

export const NOT_EXPANDED_RESOURCE_SCHEMA = (prefix: string) => Joi.object({ id: ID_SCHEMA(prefix).required() });

/*
----------------
RESPONSE SCHEMAS
----------------
*/

export const USER_SCHEMA = Joi
    .object({
        id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
        first_name: STRING_SCHEMA.max(50).required(),
        last_name: STRING_SCHEMA.max(50).required(),
        email: EMAIL_SCHEMA.required(),
    });

export const SESSION_SCHEMA = Joi
    .object({
        id: ID_SCHEMA(Config.ID_PREFIXES.SESSION).required(),
        user: USER_SCHEMA.required(),
        expires_at: DATETIME_SCHEMA.required(),
    });

export const ORGANIZATION_SCHEMA = Joi
    .object({
        id: ID_SCHEMA(Config.ID_PREFIXES.ORGANIZATION).required(),
        name: STRING_SCHEMA.max(50).required(),
        owner: USER_SCHEMA.required(),
    });

export const PUBLISHER_SCHEMA = Joi
    .object({
        id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
        name: STRING_SCHEMA.max(50).required(),
        url: URL_SCHEMA.required(),
        organization: ORGANIZATION_SCHEMA.required(),
    });

export const AUTHOR_SCHEMA = Joi
    .object({
        id: ID_SCHEMA(Config.ID_PREFIXES.AUTHOR).required(),
        user: USER_SCHEMA.required(),
        publisher: PUBLISHER_SCHEMA.required(),
    });

export const ARTICLE_SCHEMA = Joi
    .object({
        id: ID_SCHEMA(Config.ID_PREFIXES.ARTICLE).required(),
        title: STRING_SCHEMA.max(50).required(),
        content: STRING_SCHEMA.required(),
        reading_time: Joi.number().min(0).required(),
        author: Joi
            .alternatives()
            .try(
                AUTHOR_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Config.ID_PREFIXES.AUTHOR),
            )
            .required(),
        created_at: DATETIME_SCHEMA.required(),
        updated_at: DATETIME_SCHEMA.required(),
    });

export const COMMENT_SCHEMA = Joi
    .object({
        id: ID_SCHEMA(Config.ID_PREFIXES.COMMENT).required(),
        content: STRING_SCHEMA.required(),
        user: Joi
            .alternatives()
            .try(
                USER_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Config.ID_PREFIXES.USER),
            )
            .required(),
        article: Joi
            .alternatives()
            .try(
                ARTICLE_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Config.ID_PREFIXES.ARTICLE),
            )
            .required(),
        // Recursive schema
        parent: Joi
            .alternatives()
            .try(
                Joi.link("..."),
                NOT_EXPANDED_RESOURCE_SCHEMA(Config.ID_PREFIXES.COMMENT),
                null,
            )
            .required(),
        reply_count: Joi.number().min(0).required(),
        created_at: DATETIME_SCHEMA.required(),
        updated_at: DATETIME_SCHEMA.required(),
    });

/*
---------------
REQUEST SCHEMAS
---------------
*/

export const USER_CREATE_SCHEMA = Joi
    .object({
        first_name: STRING_SCHEMA.max(50).required(),
        last_name: STRING_SCHEMA.max(50).required(),
        email: EMAIL_SCHEMA.required(),
        password: PASSWORD_SCHEMA.required(),
    });

export const USER_UPDATE_SCHEMA = Joi
    .object({
        first_name: STRING_SCHEMA.max(50),
        last_name: STRING_SCHEMA.max(50),
        email: EMAIL_SCHEMA,
        old_password: PASSWORD_SCHEMA.when(Joi.ref("new_password"), {
            then: Joi.required(),
        }),
        new_password: PASSWORD_SCHEMA,
    });

export const ORGANIZATION_CREATE_SCHEMA = Joi
    .object({
        name: STRING_SCHEMA.max(50).required(),
    });

export const ORGANIZATION_UPDATE_SCHEMA = Joi
    .object({
        name: STRING_SCHEMA.max(50),
    });

export const PUBLISHER_CREATE_SCHEMA = Joi
    .object({
        name: STRING_SCHEMA.max(50).required(),
        url: URL_SCHEMA.required(),
        organization: ID_SCHEMA(Config.ID_PREFIXES.ORGANIZATION).required(),
    });

export const PUBLISHER_UPDATE_SCHEMA = Joi
    .object({
        name: STRING_SCHEMA.max(50),
        url: URL_SCHEMA,
    });

export const AUTHOR_CREATE_SCHEMA = Joi
    .object({
        email: EMAIL_SCHEMA.required(),
    });

export const SESSION_CREATE_SCHEMA = Joi
    .object({
        email: EMAIL_SCHEMA.required(),
        password: PASSWORD_SCHEMA.required(),
    });

export const ARTICLE_CREATE_SCHEMA = Joi
    .object({
        title: STRING_SCHEMA.max(50).required(),
        content: STRING_SCHEMA.required(),
        author: ID_SCHEMA(Config.ID_PREFIXES.AUTHOR).required(),
    });

export const ARTICLE_UPDATE_SCHEMA = Joi
    .object({
        title: STRING_SCHEMA.max(50),
        content: STRING_SCHEMA,
    });

export const COMMENT_CREATE_SCHEMA = Joi
    .object({
        content: STRING_SCHEMA.required(),
        parent: ID_SCHEMA(Config.ID_PREFIXES.COMMENT).allow(null).required(),
    });

export const COMMENT_UPDATE_SCHEMA = Joi
    .object({
        content: STRING_SCHEMA,
    });