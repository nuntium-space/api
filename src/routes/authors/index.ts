import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { AUTHOR_CREATE_SCHEMA, AUTHOR_SCHEMA, EXPAND_QUERY_SCHEMA, ID_SCHEMA } from "../../config/schemas";
import { Author } from "../../models/Author";
import { Publisher } from "../../models/Publisher";
import { User } from "../../models/User";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/authors/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.AUTHOR).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: AUTHOR_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const author = await Author.retrieve(request.params.id, request.query.expand);

            return author.serialize();
        },
    },
    {
        method: "GET",
        path: "/publishers/{id}/authors",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: Joi.array().items(AUTHOR_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const publisher = await Publisher.retrieve(request.params.id);

            const authenticatedUser = request.auth.credentials.user as User;

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            const authors = await Author.forPublisher(publisher, request.query.expand);

            return authors.map(author => author.serialize());
        },
    },
    {
        method: "GET",
        path: "/users/{id}/authors",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: Joi.array().items(AUTHOR_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const authors = await Author.forUser(authenticatedUser);

            return authors.map(author => author.serialize());
        },
    },
    {
        method: "POST",
        path: "/publishers/{id}/authors",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
                payload: AUTHOR_CREATE_SCHEMA,
            },
            response: {
                schema: AUTHOR_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const publisher = await Publisher.retrieve(request.params.id);

            const authenticatedUser = request.auth.credentials.user as User;

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            const author = await Author.create(
                {
                    email: (request.payload as any).email,
                    publisher: publisher.id,
                },
                request.query.expand,
            );

            return author.serialize();
        },
    },
    {
        method: "DELETE",
        path: "/authors/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.AUTHOR).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const author = await Author.retrieve(request.params.id, [ "publisher" ]);

            if (!(author.publisher instanceof Publisher))
            {
                throw Boom.badImplementation();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (!author.publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            await author.delete();

            return h.response();
        },
    },
];
