import Joi from "joi";
import JoiDate from "@joi/date";
import { Config } from "./Config";

/*
---------------------
MISCELLANEOUS SCHEMAS
---------------------
*/

export const EMAIL_SCHEMA = Joi.string().email();

export const PASSWORD_SCHEMA = Joi.string().min(Config.PASSWORD_MIN_LENGTH);

export const DATE_SCHEMA = Joi.extend(JoiDate).date().utc().format("YYYY-MM-DD");
export const DATETIME_SCHEMA = Joi.extend(JoiDate).date().utc().format("YYYY-MM-DDTHH:mm:ss.SSSZ");

/*
----------------
RESPONSE SCHEMAS
----------------
*/

export const USER_SCHEMA = Joi
    .object({
        first_name: Joi.string().required(),
        last_name: Joi.string().required(),
        email: EMAIL_SCHEMA.required(),
        password: PASSWORD_SCHEMA.required(),
    });

/*
---------------
REQUEST SCHEMAS
---------------
*/

export const USER_CREATE_SCHEMA = Joi
    .object({
        first_name: Joi.string().required(),
        last_name: Joi.string().required(),
        email: EMAIL_SCHEMA.required(),
        password: PASSWORD_SCHEMA.required(),
    });

export const USER_UPDATE_SCHEMA = Joi
    .object({
        first_name: Joi.string(),
        last_name: Joi.string(),
        email: EMAIL_SCHEMA,
        password: PASSWORD_SCHEMA,
    });
