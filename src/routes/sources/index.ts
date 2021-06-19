import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { Source } from "../../models/Source";
import { SOURCE_SCHEMA } from "../../types/source";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/articles/{id}/sources",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ARTICLE.required(),
                }),
            },
            response: {
                schema: Schema.ARRAY(SOURCE_SCHEMA.OBJ).required(),
            },
        },
        handler: async (request, h) =>
        {
            const sources = await Source.forArticle(request.params.id);

            return sources.map(_ => _.serialize());
        },
    },
];
