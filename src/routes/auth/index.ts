import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import sendgrid from "@sendgrid/mail";
import Joi from "joi";
import { Config } from "../../config/Config";
import { SESSION_CREATE_SCHEMA, STRING_SCHEMA } from "../../config/schemas";
import { Account } from "../../models/Account";
import { Session } from "../../models/Session";
import { User } from "../../models/User";

sendgrid.setApiKey(process.env.SENDGRID_API_KEY ?? "");

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/auth/email/{token}",
        options: {
            auth: false,
            validate: {
                params: Joi.object({
                    token: STRING_SCHEMA.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const { token } = request.payload as any;

            // TODO:
            // Retrieve sign in request

            const session = await Session.create(user);

            return h.redirect(`${Config.CLIENT_HOST}?session_id=${session.id}`);
        },
    },
    {
        method: "POST",
        path: "/auth/email",
        options: {
            auth: false,
            validate: {
                payload: SESSION_CREATE_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const { email } = request.payload as any;

            let user: User;

            if (await User.exists(email))
            {
                user = await User.retrieveWithEmail(email);
            }
            else
            {
                user = await User.create({ email });
            }

            // TODO:
            // Create sign in request in db

            await sendgrid
                .send({
                    to: user.email,
                    from: "TODO",
                    subject: "TODO",
                    text: "TODO",
                })
                .catch(() =>
                {
                    throw Boom.badImplementation();
                });

            // HTTP 202 - Accepted
            return h.response().code(202);
        },
    },
    {
        method: [ "GET", "POST" ],
        path: "/auth/facebook",
        options: {
            auth: {
              mode: "try",
              strategy: "facebook",
            },
        },
        handler: async (request, h) =>
        {
            if (!request.auth.isAuthenticated)
            {
                throw Boom.unauthorized();
            }

            const profile: {
                id: string,
                email: string,
            } = request.auth.credentials.profile as any;

            let user: User;

            if (await User.exists(profile.email))
            {
                user = await User.retrieveWithEmail(profile.email);
            }
            else
            {
                user = await User.create({ email: profile.email });
            }

            await Account.create({
                user,
                type: "facebook",
                external_id: profile.id,
            });

            const session = await Session.create(user);

            return h.redirect(`${Config.CLIENT_HOST}?session_id=${session.id}`);
        },
    },
    {
        method: [ "GET", "POST" ],
        path: "/auth/google",
        options: {
            auth: {
              mode: "try",
              strategy: "google",
            },
        },
        handler: async (request, h) =>
        {
            if (!request.auth.isAuthenticated)
            {
                throw Boom.unauthorized();
            }

            const profile: {
                id: string,
                email: string,
            } = request.auth.credentials.profile as any;

            let user: User;

            if (await User.exists(profile.email))
            {
                user = await User.retrieveWithEmail(profile.email);
            }
            else
            {
                user = await User.create({ email: profile.email });
            }

            await Account.create({
                user,
                type: "google",
                external_id: profile.id,
            });

            const session = await Session.create(user);

            return h.redirect(`${Config.CLIENT_HOST}?session_id=${session.id}`);
        },
    },
    {
        method: [ "GET", "POST" ],
        path: "/auth/twitter",
        options: {
            auth: {
              mode: "try",
              strategy: "twitter",
            },
        },
        handler: async (request, h) =>
        {
            if (!request.auth.isAuthenticated)
            {
                throw Boom.unauthorized();
            }

            // TODO

            return h.redirect(`${Config.CLIENT_HOST}?session_id=${"TODO"}`);
        },
    },
];
