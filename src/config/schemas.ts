import Joi from "joi";
import { Bundle } from "../models/Bundle";
import { Schema } from "./Schema";

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

export const PRICE_SCHEMA = Joi
    .object({
        id: Schema.ID.PRICE.required(),
        amount: Schema.MONEY.required(),
        currency: Schema.CURRENCY.required(),
        bundle: Joi
            .alternatives()
            .try(
                Bundle.SCHEMA.OBJ,
                Schema.NOT_EXPANDED_RESOURCE(Schema.ID.BUNDLE),
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
                Schema.NOT_EXPANDED_RESOURCE(Schema.ID.USER),
            )
            .required(),
        price: Joi
            .alternatives()
            .try(
                PRICE_SCHEMA,
                Schema.NOT_EXPANDED_RESOURCE(Schema.ID.PRICE),
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
                Schema.NOT_EXPANDED_RESOURCE(Schema.ID.USER),
            )
            .required(),
        __metadata: Joi.object({
            is_default: Joi.boolean().required(),
        }),
    });

export const USER_SETTINGS_SCHEMA = Joi
    .object({
        language: Schema.LANGUAGE.allow(null).required(),
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

export const SESSION_CREATE_SCHEMA = Joi
    .object({
        email: Schema.EMAIL.required(),
    });

export const PRICE_CREATE_SCHEMA = Joi
    .object({
        amount: Schema.MONEY.required(),
        currency: Schema.CURRENCY.required(),
    });

export const SUBSCRIPTION_CREATE_SCHEMA = Joi
    .object({
        price: Schema.ID.PRICE.required(),
    });

export const USER_SETTINGS_UPDATE_SCHEMA = Joi
    .object({
        language: Schema.LANGUAGE,
    });
