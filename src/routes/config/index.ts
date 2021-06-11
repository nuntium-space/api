import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { Schema } from "../../config/Schema";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/config/currencies",
        options: {
            response: {
                schema: Schema.ARRAY(Joi.object({
                    name: Schema.CURRENCY.required(),
                    min: Schema.MONEY.required(),
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
                schema: Schema.ARRAY(Joi.object({
                    id: Schema.LANGUAGE.required(),
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
