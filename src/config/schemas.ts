import Joi from "joi";
import { Config } from "./Config";

/*
---------------------
MISCELLANEOUS SCHEMAS
---------------------
*/

export const ID_SCHEMA = (prefix: string) => Joi.string().pattern(new RegExp(`^${prefix}_.+$`));

export const EMAIL_SCHEMA = Joi.string().email();

export const PASSWORD_SCHEMA = Joi.string().min(Config.PASSWORD_MIN_LENGTH);

export const DATE_SCHEMA = Joi.extend(require("@joi/date")).date().utc().format("YYYY-MM-DD");
export const DATETIME_SCHEMA = Joi.extend(require("@joi/date")).date().utc().format("YYYY-MM-DDTHH:mm:ss.SSSZ");

/*
----------------
RESPONSE SCHEMAS
----------------
*/

export const USER_SCHEMA = Joi
    .object({
        id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
        first_name: Joi.string().max(50).required(),
        last_name: Joi.string().max(50).required(),
        email: EMAIL_SCHEMA.required(),
    });

export const SESSION_SCHEMA = Joi
    .object({
        id: ID_SCHEMA(Config.ID_PREFIXES.SESSION).required(),
        user: USER_SCHEMA.required(),
        expires_at: DATETIME_SCHEMA.required(),
    });

/*
---------------
REQUEST SCHEMAS
---------------
*/

export const USER_CREATE_SCHEMA = Joi
    .object({
        first_name: Joi.string().max(50).required(),
        last_name: Joi.string().max(50).required(),
        email: EMAIL_SCHEMA.required(),
        password: PASSWORD_SCHEMA.required(),
    });

export const USER_UPDATE_SCHEMA = Joi
    .object({
        first_name: Joi.string().max(50),
        last_name: Joi.string().max(50),
        email: EMAIL_SCHEMA,
        password: PASSWORD_SCHEMA,
    });

export const SESSION_CREATE_SCHEMA = Joi
    .object({
        email: EMAIL_SCHEMA.required(),
        password: PASSWORD_SCHEMA.required(),
    });
