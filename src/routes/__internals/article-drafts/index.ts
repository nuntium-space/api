import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../../config/Schema";
import { ArticleDraft } from "../../../models/ArticleDraft";
import { Author } from "../../../models/Author";
import { Session } from "../../../models/Session";
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
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const draft = await ArticleDraft.retrieve(request.params.id, request.query.expand);

            if (!(draft.author instanceof Author))
            {
                throw Boom.badImplementation();
            }

            if (authenticatedUser.id !== draft.author.user.id)
            {
                throw Boom.forbidden();
            }

            return draft.serialize({
                for: authenticatedUser,
                includeContent: true,
            });
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
