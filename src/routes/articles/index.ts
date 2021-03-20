import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { ARTICLE_SCHEMA, EXPAND_QUERY_SCHEMA, ID_SCHEMA } from "../../config/schemas";
import { Article } from "../../models/Article";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/articles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ARTICLE).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: ARTICLE_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const article = await Article.retrieve(request.params.id, request.query.expand);
    
            return article.serialize();
        }
    }
];
