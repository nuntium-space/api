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

export const MONEY_SCHEMA = Joi.number().integer().min(0);

export const NOT_EXPANDED_RESOURCE_SCHEMA = (prefix: string) => Joi.object({ id: ID_SCHEMA(prefix).required() });

export const EXPAND_QUERY_SCHEMA = Joi.array().items(STRING_SCHEMA);

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
        has_payment_methods: Joi.boolean().required(),
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
        stripe_account_enabled: Joi.boolean().required(),
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
        user: Joi
            .alternatives()
            .try(
                USER_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Config.ID_PREFIXES.USER),
            )
            .required(),
        publisher: Joi
            .alternatives()
            .try(
                PUBLISHER_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Config.ID_PREFIXES.PUBLISHER),
            )
            .required(),
    });

export const ARTICLE_SCHEMA = Joi
    .object({
        id: ID_SCHEMA(Config.ID_PREFIXES.ARTICLE).required(),
        title: STRING_SCHEMA.max(50).required(),
        content: STRING_SCHEMA.required(),
        reading_time: Joi.number().integer().min(0).required(),
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

export const BUNDLE_SCHEMA = Joi
    .object({
        id: ID_SCHEMA(Config.ID_PREFIXES.BUNDLE).required(),
        name: STRING_SCHEMA.max(50).required(),
        organization: Joi
            .alternatives()
            .try(
                ORGANIZATION_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Config.ID_PREFIXES.ORGANIZATION),
            )
            .required(),
        price: Joi
            .alternatives()
            .try(
                // The `price` can be 0 (free) or at least `Config.BUNDLE_MIN_PRICE`
                MONEY_SCHEMA.max(0),
                MONEY_SCHEMA.min(Config.BUNDLE_MIN_PRICE)
            )
            .required(),
    });

export const SUBSCRIPTION_SCHEMA = Joi
    .object({
        id: ID_SCHEMA(Config.ID_PREFIXES.SUBSCRIPTION).required(),
        status: STRING_SCHEMA.required(),
        user: Joi
            .alternatives()
            .try(
                USER_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Config.ID_PREFIXES.USER),
            )
            .required(),
        bundle: Joi
            .alternatives()
            .try(
                BUNDLE_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Config.ID_PREFIXES.BUNDLE),
            )
            .required(),
        current_period_end: DATETIME_SCHEMA.required(),
        cancel_at_period_end: Joi.boolean().required(),
        deleted: Joi.boolean().required(),
    });

export const PAYMENT_METHOD_SCHEMA = Joi
    .object({
        id: ID_SCHEMA(Config.ID_PREFIXES.PAYMENT_METHOD).required(),
        type: STRING_SCHEMA.required(),
        data: Joi.object().required(),
        user: Joi
            .alternatives()
            .try(
                USER_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Config.ID_PREFIXES.USER),
            )
            .required(),
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

export const BUNDLE_CREATE_SCHEMA = Joi
    .object({
        name: STRING_SCHEMA.max(50).required(),
        price: MONEY_SCHEMA.required(),
    });

export const BUNDLE_UPDATE_SCHEMA = Joi
    .object({
        name: STRING_SCHEMA.max(50),
    });

export const SUBSCRIPTION_CREATE_SCHEMA = Joi
    .object({
        bundle: ID_SCHEMA(Config.ID_PREFIXES.BUNDLE).required(),
    });
