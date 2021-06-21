import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { Author } from "../../models/Author";
import { AuthorInvite } from "../../models/AuthorInvite";
import { Publisher } from "../../models/Publisher";
import { Session } from "../../models/Session";
import { AUTHOR_SCHEMA } from "../../types/author";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/authors/{id}",
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
                schema: AUTHOR_SCHEMA.OBJ,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const author = await Author.retrieve(request.params.id, request.query.expand);

            return author.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "GET",
        path: "/publishers/{id}/authors",
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
                schema: Schema.ARRAY(AUTHOR_SCHEMA.OBJ).required(),
            },
        },
        handler: async (request, h) =>
        {
            const publisher = await Publisher.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            const authors = await Author.forPublisher(publisher, request.query.expand);

            // Pass the author.user to load email address
            return authors.map(author => author.serialize({ for: author.user }));
        },
    },
    {
        method: "GET",
        path: "/users/{id}/authors",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
                query: Joi.object({
                    publisher: Schema.ID.PUBLISHER.optional(),
                    expand: Schema.EXPAND_QUERY,
                }),
            },
            response: {
                schema: Schema.ARRAY(AUTHOR_SCHEMA.OBJ).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const authors = request.query.publisher
                ? [ await Author.retrieveWithUserAndPublisher(authenticatedUser, request.query.publisher) ]
                : await Author.forUser(authenticatedUser, request.query.expand);

            return authors.map(author => author.serialize({ for: authenticatedUser }));
        },
    },
    {
        method: "POST",
        path: "/authors/invites/{id}/accept",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.AUTHOR_INVITE.required(),
                }),
                payload: AUTHOR_SCHEMA.CREATE,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const invite = await AuthorInvite.retrieve(request.params.id);

            if (authenticatedUser.id !== invite.user.id)
            {
                throw Boom.forbidden();
            }

            await invite.accept();

            return h.response();
        },
    },
    {
        method: "POST",
        path: "/publishers/{id}/authors/invites",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.PUBLISHER.required(),
                }),
                payload: AUTHOR_SCHEMA.CREATE,
            },
        },
        handler: async (request, h) =>
        {
            const publisher = await Publisher.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            await AuthorInvite.create({
                email: (request.payload as any).email,
                publisher: publisher.id,
            });

            return h.response();
        },
    },
    {
        method: "DELETE",
        path: "/authors/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.AUTHOR.required(),
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

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (!author.publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            await author.delete();

            return h.response();
        },
    },
];
