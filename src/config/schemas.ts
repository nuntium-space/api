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

export const DATE_SCHEMA = Joi.extend(require("@joi/date")).date().utc().format("YYYY-MM-DD");
export const DATETIME_SCHEMA = Joi.extend(require("@joi/date")).date().utc().format("YYYY-MM-DDTHH:mm:ss.SSSZ");

export const MONEY_SCHEMA = Joi.number().integer().min(0);
export const CURRENCY_SCHEMA = STRING_SCHEMA.valid(...Config.CURRENCIES.map(c => c.name)).lowercase();

export const LANGUAGE_SCHEMA = STRING_SCHEMA.valid(...Config.LANGUAGES.map(c => c.id));

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
        username: STRING_SCHEMA.max(30).allow(null).required(),
        email: EMAIL_SCHEMA,
        has_default_payment_method: Joi.boolean(),
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
        verified: Joi.boolean().required(),
        imageUrl: STRING_SCHEMA.allow(null).required(),
        __metadata: Joi.object({
            is_author: Joi.boolean().required(),
            is_subscribed: Joi.boolean().required(),
        }),
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
        content: STRING_SCHEMA.allow("").required(),
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
        active: Joi.boolean().required(),
    });

export const PRICE_SCHEMA = Joi
    .object({
        id: ID_SCHEMA(Config.ID_PREFIXES.PRICE).required(),
        amount: MONEY_SCHEMA.required(),
        currency: CURRENCY_SCHEMA.required(),
        bundle: Joi
            .alternatives()
            .try(
                BUNDLE_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Config.ID_PREFIXES.BUNDLE),
            )
            .required(),
        active: Joi.boolean().required(),
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
        price: Joi
            .alternatives()
            .try(
                PRICE_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Config.ID_PREFIXES.PRICE),
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
        __metadata: Joi.object({
            is_default: Joi.boolean().required(),
        }),
    });

export const USER_SETTINGS_SCHEMA = Joi
    .object({
        language: LANGUAGE_SCHEMA.allow(null).required(),
    });

/*
---------------
REQUEST SCHEMAS
---------------
*/

export const USER_UPDATE_SCHEMA = Joi
    .object({
        username: STRING_SCHEMA.max(30),
        email: EMAIL_SCHEMA,
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
    });

export const BUNDLE_UPDATE_SCHEMA = Joi
    .object({
        name: STRING_SCHEMA.max(50),
    });

export const PRICE_CREATE_SCHEMA = Joi
    .object({
        amount: MONEY_SCHEMA.required(),
        currency: CURRENCY_SCHEMA.required(),
    });

export const SUBSCRIPTION_CREATE_SCHEMA = Joi
    .object({
        price: ID_SCHEMA(Config.ID_PREFIXES.PRICE).required(),
    });

export const USER_SETTINGS_UPDATE_SCHEMA = Joi
    .object({
        language: LANGUAGE_SCHEMA,
    });
