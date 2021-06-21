import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { AuthorInvite } from "../../models/AuthorInvite";
import { Publisher } from "../../models/Publisher";
import { Session } from "../../models/Session";
import { AUTHOR_INVITE_SCHEMA } from "../../types/author-invite";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/publishers/{id}/authors/invites",
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
                schema: Schema.ARRAY(AUTHOR_INVITE_SCHEMA.OBJ).required(),
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

            const invites = await AuthorInvite.forPublisher(publisher, request.query.expand);

            // Pass the author.user to load email address
            return invites.map(_ => _.serialize({ for: _.user }));
        },
    },
    {
        method: "GET",
        path: "/users/{id}/authors/invites",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
            },
            response: {
                schema: Schema.ARRAY(AUTHOR_INVITE_SCHEMA.OBJ).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const invites = await AuthorInvite.forUser(authenticatedUser, request.query.expand);

            // Pass the author.user to load email address
            return invites.map(_ => _.serialize({ for: _.user }));
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
                payload: AUTHOR_INVITE_SCHEMA.CREATE,
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
        path: "/authors/invites/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.AUTHOR_INVITE.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const invite = await AuthorInvite.retrieve(request.params.id, [ "publisher" ]);

            if (!(invite.publisher instanceof Publisher))
            {
                throw Boom.badImplementation();
            }

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (!invite.publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            await invite.delete();

            return h.response();
        },
    },
];
