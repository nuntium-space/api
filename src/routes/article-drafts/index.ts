import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { Article } from "../../models/Article";
import { ArticleDraft } from "../../models/ArticleDraft";
import { Author } from "../../models/Author";
import { Publisher } from "../../models/Publisher";
import { Session } from "../../models/Session";
import { ARTICLE_DRAFT_SCHEMA } from "../../types/article-draft";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/articles/drafts/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ARTICLE_DRAFT.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
            },
            response: {
                schema: ARTICLE_DRAFT_SCHEMA.OBJ,
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
        method: "GET",
        path: "/authors/{id}/articles/drafts",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.AUTHOR.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
            },
            response: {
                schema: Schema.ARRAY(ARTICLE_DRAFT_SCHEMA.OBJ).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const author = await Author.retrieve(request.params.id);

            if (authenticatedUser.id !== author.user.id)
            {
                throw Boom.paymentRequired();
            }

            const drafts = await ArticleDraft.forAuthor(author, request.query.expand);

            return Promise.all(drafts.map(_ => _.serialize({ for: authenticatedUser })));
        },
    },
    {
        method: "GET",
        path: "/publishers/{id}/articles/drafts",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.PUBLISHER.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
            },
            response: {
                schema: Schema.ARRAY(ARTICLE_DRAFT_SCHEMA.OBJ).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const publisher = await Publisher.retrieve(request.params.id);

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.paymentRequired();
            }

            const drafts = await ArticleDraft.forPublisher(publisher, request.query.expand);

            return Promise.all(drafts.map(_ => _.serialize({ for: authenticatedUser })));
        },
    },
    {
        method: "POST",
        path: "/authors/{id}/articles/drafts",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.AUTHOR.required(),
                }),
                query: Joi.object({
                    from: Schema.ID.ARTICLE,
                }),
                payload: ARTICLE_DRAFT_SCHEMA.CREATE,
            },
            response: {
                schema: Joi.object({
                    id: Schema.ID.ARTICLE_DRAFT.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const author = await Author.retrieve(request.params.id, [ "publisher" ]);

            if (!(author.publisher instanceof Publisher))
            {
                throw Boom.badImplementation();
            }

            if (author.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            if (!author.publisher.verified)
            {
                throw Boom.forbidden(undefined, [
                    {
                        field: "author",
                        error: `Cannot add articles to unverified publisher '${author.publisher.id}'`,
                    },
                ]);
            }

            if (request.query.from)
            {
                const article = await Article.retrieve(request.query.from);

                if (article.author.id !== author.id)
                {
                    throw Boom.forbidden();
                }

                return ArticleDraft.createFromArticle(article);
            }

            return ArticleDraft.create(request.payload as any, author);
        },
    },
    {
        method: "POST",
        path: "/articles/drafts/{id}/verify",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ARTICLE_DRAFT.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const draft = await ArticleDraft.retrieve(request.params.id, request.query.expand);

            const author = await Author.retrieve(draft.author.id);

            if (authenticatedUser.id !== author.user.id)
            {
                throw Boom.forbidden();
            }

            await draft.submitForVerification();

            return h.response();
        },
    },
    {
        method: "POST",
        path: "/articles/drafts/{id}/publish",
        options: {
            auth: {
                scope: "admin",
            },
            validate: {
                params: Joi.object({
                    id: Schema.ID.ARTICLE_DRAFT.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const draft = await ArticleDraft.retrieve(request.params.id, request.query.expand);

            await draft.publish();

            return h.response();
        },
    },
    {
        method: "PATCH",
        path: "/articles/drafts/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ARTICLE_DRAFT.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
                payload: ARTICLE_DRAFT_SCHEMA.UPDATE,
            },
            response: {
                schema: ARTICLE_DRAFT_SCHEMA.OBJ,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const draft = await ArticleDraft.retrieve(request.params.id, request.query.expand);

            const author = await Author.retrieve(draft.author.id);

            if (author.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await draft.update(request.payload as any);

            return draft.serialize({ includeContent: true });
        },
    },
    {
        method: "DELETE",
        path: "/articles/drafts/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ARTICLE_DRAFT.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const draft = await ArticleDraft.retrieve(request.params.id, [ "author" ]);

            if (!(draft.author instanceof Author))
            {
                throw Boom.badImplementation();
            }

            if (authenticatedUser.id !== draft.author.user.id)
            {
                throw Boom.forbidden();
            }

            await draft.delete();

            return h.response();
        },
    },
];
