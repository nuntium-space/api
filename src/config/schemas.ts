import Joi from "joi";
import { Schema } from "./Schema";

/*
----------------
RESPONSE SCHEMAS
----------------
*/

export const USER_SETTINGS_SCHEMA = Joi
    .object({
        language: Schema.LANGUAGE.allow(null).required(),
    });

/*
---------------
REQUEST SCHEMAS
---------------
*/

export const USER_SETTINGS_UPDATE_SCHEMA = Joi
    .object({
        language: Schema.LANGUAGE,
    });
