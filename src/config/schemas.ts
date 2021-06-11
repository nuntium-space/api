import Joi from "joi";
import { Article } from "../models/Article";
import { Config } from "./Config";
import { Schema } from "./Schema";

/*
---------------------
MISCELLANEOUS SCHEMAS
---------------------
*/

export const MONEY_SCHEMA = Joi.number().integer().min(0);
export const CURRENCY_SCHEMA = Schema.STRING.valid(...Config.CURRENCIES.map(c => c.name)).lowercase();

export const LANGUAGE_SCHEMA = Schema.STRING.valid(...Config.LANGUAGES.map(c => c.id));

export const NOT_EXPANDED_RESOURCE_SCHEMA = (schema: Joi.Schema) => Joi.object({ id: schema });

export const EXPAND_QUERY_SCHEMA = Schema.ARRAY(Schema.STRING);

/*
----------------
RESPONSE SCHEMAS
----------------
*/

export const USER_SCHEMA = Joi
    .object({
        id: Schema.ID.USER.required(),
        username: Schema.STRING.max(30).allow(null).required(),
        email: Schema.EMAIL,
        has_default_payment_method: Joi.boolean(),
    });

export const SESSION_SCHEMA = Joi
    .object({
        id: Schema.ID.SESSION.required(),
        user: USER_SCHEMA.required(),
        expires_at: Schema.DATETIME.required(),
    });

export const ORGANIZATION_SCHEMA = Joi
    .object({
        id: Schema.ID.ORGANIZATION.required(),
        name: Schema.STRING.max(50).required(),
        owner: USER_SCHEMA.required(),
        stripe_account_enabled: Joi.boolean().required(),
    });

export const PUBLISHER_SCHEMA = Joi
    .object({
        id: Schema.ID.PUBLISHER.required(),
        name: Schema.STRING.max(50).required(),
        url: Schema.URL.required(),
        organization: ORGANIZATION_SCHEMA.required(),
        verified: Joi.boolean().required(),
        imageUrl: Schema.STRING.allow(null).required(),
        __metadata: Joi.object({
            is_author: Joi.boolean().required(),
            is_subscribed: Joi.boolean().required(),
        }),
    });

export const AUTHOR_SCHEMA = Joi
    .object({
        id: Schema.ID.AUTHOR.required(),
        user: Joi
            .alternatives()
            .try(
                USER_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Schema.ID.USER),
            )
            .required(),
        publisher: Joi
            .alternatives()
            .try(
                PUBLISHER_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Schema.ID.PUBLISHER),
            )
            .required(),
    });

export const COMMENT_SCHEMA = Joi
    .object({
        id: Schema.ID.COMMENT.required(),
        content: Schema.STRING.required(),
        user: Joi
            .alternatives()
            .try(
                USER_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Schema.ID.USER),
            )
            .required(),
        article: Joi
            .alternatives()
            .try(
                Article.SCHEMA.OBJ,
                NOT_EXPANDED_RESOURCE_SCHEMA(Schema.ID.ARTICLE),
            )
            .required(),
        // Recursive schema
        parent: Joi
            .alternatives()
            .try(
                Joi.link("..."),
                NOT_EXPANDED_RESOURCE_SCHEMA(Schema.ID.COMMENT),
                null,
            )
            .required(),
        reply_count: Joi.number().min(0).required(),
        created_at: Schema.DATETIME.required(),
        updated_at: Schema.DATETIME.required(),
    });

export const BUNDLE_SCHEMA = Joi
    .object({
        id: Schema.ID.BUNDLE.required(),
        name: Schema.STRING.max(50).required(),
        organization: Joi
            .alternatives()
            .try(
                ORGANIZATION_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Schema.ID.ORGANIZATION),
            )
            .required(),
        active: Joi.boolean().required(),
    });

export const PRICE_SCHEMA = Joi
    .object({
        id: Schema.ID.PRICE.required(),
        amount: MONEY_SCHEMA.required(),
        currency: CURRENCY_SCHEMA.required(),
        bundle: Joi
            .alternatives()
            .try(
                BUNDLE_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Schema.ID.BUNDLE),
            )
            .required(),
        active: Joi.boolean().required(),
    });

export const SUBSCRIPTION_SCHEMA = Joi
    .object({
        id: Schema.ID.SUBSCRIPTION.required(),
        status: Schema.STRING.required(),
        user: Joi
            .alternatives()
            .try(
                USER_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Schema.ID.USER),
            )
            .required(),
        price: Joi
            .alternatives()
            .try(
                PRICE_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Schema.ID.PRICE),
            )
            .required(),
        current_period_end: Schema.DATETIME.required(),
        cancel_at_period_end: Joi.boolean().required(),
        deleted: Joi.boolean().required(),
    });

export const PAYMENT_METHOD_SCHEMA = Joi
    .object({
        id: Schema.ID.PAYMENT_METHOD.required(),
        type: Schema.STRING.required(),
        data: Joi.object().required(),
        user: Joi
            .alternatives()
            .try(
                USER_SCHEMA,
                NOT_EXPANDED_RESOURCE_SCHEMA(Schema.ID.USER),
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
        username: Schema.STRING.max(30),
        email: Schema.EMAIL,
    });

export const ORGANIZATION_CREATE_SCHEMA = Joi
    .object({
        name: Schema.STRING.max(50).required(),
    });

export const ORGANIZATION_UPDATE_SCHEMA = Joi
    .object({
        name: Schema.STRING.max(50),
    });

export const PUBLISHER_CREATE_SCHEMA = Joi
    .object({
        name: Schema.STRING.max(50).required(),
        url: Schema.URL.required(),
    });

export const PUBLISHER_UPDATE_SCHEMA = Joi
    .object({
        name: Schema.STRING.max(50),
        url: Schema.URL,
    });

export const AUTHOR_CREATE_SCHEMA = Joi
    .object({
        email: Schema.EMAIL.required(),
    });

export const SESSION_CREATE_SCHEMA = Joi
    .object({
        email: Schema.EMAIL.required(),
    });

export const COMMENT_CREATE_SCHEMA = Joi
    .object({
        content: Schema.STRING.required(),
        parent: Schema.ID.COMMENT.allow(null).required(),
    });

export const COMMENT_UPDATE_SCHEMA = Joi
    .object({
        content: Schema.STRING,
    });

export const BUNDLE_CREATE_SCHEMA = Joi
    .object({
        name: Schema.STRING.max(50).required(),
    });

export const BUNDLE_UPDATE_SCHEMA = Joi
    .object({
        name: Schema.STRING.max(50),
    });

export const PRICE_CREATE_SCHEMA = Joi
    .object({
        amount: MONEY_SCHEMA.required(),
        currency: CURRENCY_SCHEMA.required(),
    });

export const SUBSCRIPTION_CREATE_SCHEMA = Joi
    .object({
        price: Schema.ID.PRICE.required(),
    });

export const USER_SETTINGS_UPDATE_SCHEMA = Joi
    .object({
        language: LANGUAGE_SCHEMA,
    });
