import Joi from "joi";
import JoiDate from "@joi/date";
import { Config } from "./Config";

export const EMAIL_SCHEMA = Joi.string().email();

export const PASSWORD_SCHEMA = Joi.string().min(Config.PASSWORD_MIN_LENGTH);

export const UUID_SCHEMA = Joi.string().uuid({ version: "uuidv4" });

export const DATE_SCHEMA = Joi.extend(JoiDate).date().utc().format("YYYY-MM-DD");
export const DATETIME_SCHEMA = Joi.extend(JoiDate).date().utc().format("YYYY-MM-DDTHH:mm:ss.SSSZ");
