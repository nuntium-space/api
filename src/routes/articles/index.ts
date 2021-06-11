import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { Article } from "../../models/Article";
import { Author } from "../../models/Author";
import { Publisher } from "../../models/Publisher";
import { Session } from "../../models/Session";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/articles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ARTICLE.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                    format: Schema.STRING.allow("raw", "html"),
                }),
            },
            response: {
                schema: Article.SCHEMA.OBJ,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const article = await Article.retrieve(request.params.id, request.query.expand);

            const author = await Author.retrieve(article.author.id, [ "publisher" ]);

            if (!(author.publisher instanceof Publisher))
            {
                throw Boom.badImplementation();
            }

            if (!await authenticatedUser.isSubscribedToPublisher(author.publisher))
            {
                throw Boom.paymentRequired();
            }
    
            return article.serialize({
                includeContent: true,
                format: request.query.format,
            });
        },
    },
    {
        method: "GET",
        path: "/publishers/{id}/articles",
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
                schema: Schema.ARRAY(Article.SCHEMA.OBJ).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const publisher = await Publisher.retrieve(request.params.id);

            if (!await authenticatedUser.isSubscribedToPublisher(publisher))
            {
                throw Boom.paymentRequired();
            }

            const articles = await Article.forPublisher(publisher, request.query.expand);

            return articles.map(article => article.serialize({ for: authenticatedUser }));
        },
    },
    {
        method: "POST",
        path: "/authors/{id}/articles",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.AUTHOR.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
                payload: Article.SCHEMA.CREATE,
            },
            response: {
                schema: Article.SCHEMA.OBJ,
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

            const article = await Article.create(
                request.payload as any,
                author,
                request.query.expand,
            );

            return article.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "PATCH",
        path: "/articles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ARTICLE.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                    format: Schema.STRING.allow("raw", "html"),
                }),
                payload: Article.SCHEMA.UPDATE,
            },
            response: {
                schema: Article.SCHEMA.OBJ,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const article = await Article.retrieve(request.params.id, request.query.expand);

            const author = await Author.retrieve(article.author.id);

            if (author.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await article.update(request.payload as any);

            return article.serialize({
                includeContent: true,
                format: request.query.format,
            });
        },
    },
    {
        method: "DELETE",
        path: "/articles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ARTICLE.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const article = await Article.retrieve(request.params.id, [ "author" ]);

            if (!(article.author instanceof Author))
            {
                throw Boom.badImplementation();
            }

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (article.author.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await article.delete();

            return h.response();
        },
    },
];
