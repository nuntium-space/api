import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { CURRENCY_SCHEMA, LANGUAGE_SCHEMA, MONEY_SCHEMA } from "../../config/schemas";
import { Config } from "../../config/Config";
import { Schema } from "../../config/Schema";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/config/currencies",
        options: {
            response: {
                schema: Joi.array().items(Joi.object({
                    name: CURRENCY_SCHEMA.required(),
                    min: MONEY_SCHEMA.required(),
                })).required(),
            },
        },
        handler: (request, h) =>
        {
            return Config.CURRENCIES;
        },
    },
    {
        method: "GET",
        path: "/config/languages",
        options: {
            response: {
                schema: Joi.array().items(Joi.object({
                    id: LANGUAGE_SCHEMA.required(),
                    display_name: Schema.STRING.required(),
                })).required(),
            },
        },
        handler: (request, h) =>
        {
            return Config.LANGUAGES;
        },
    },
];
