import fs from "fs/promises";
import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import path from "path";
import Joi from "joi";
import { LANGUAGE_SCHEMA } from "../../config/schemas";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/translations/{lang}",
        options: {
            auth: false,
            validate: {
                params: Joi.object({
                    lang: LANGUAGE_SCHEMA.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const translationFilePath = path.resolve(__dirname, "..", "..", "assets", "translations", `${request.params.lang}.json`);

            const exists = await fs.access(translationFilePath)
                .then(() => true)
                .catch(() => false);

            if (!exists)
            {
                throw Boom.notFound();
            }

            const file = await fs.readFile(
                translationFilePath,
                {
                    encoding: "utf8",
                },
            );

            return JSON.stringify(JSON.parse(file));
        },
    },
];
