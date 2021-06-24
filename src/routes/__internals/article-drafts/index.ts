import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../../config/Schema";
import { ArticleDraft } from "../../../models/ArticleDraft";
import { ARTICLE_DRAFT_SCHEMA } from "../../../types/article-draft";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/articles/drafts",
        options: {
            validate: {
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
            },
            response: {
                schema: Schema.ARRAY(ARTICLE_DRAFT_SCHEMA.OBJ),
            },
        },
        handler: async (request, h) =>
        {
            const drafts = await ArticleDraft.list(request.query.expand);

            return Promise.all(drafts.map(_ => _.serialize()));
        },
    },
    {
        method: "POST",
        path: "/articles/drafts/{id}/publish",
        options: {
            auth: {
                scope: "admin",
            },
        },
        handler: async (request, h) =>
        {
            const draft = await ArticleDraft.retrieve(request.params.id, request.query.expand);

            await draft.publish();

            return h.response();
        },
    },
];
