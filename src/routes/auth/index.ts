import Boom from "@hapi/boom";
import crypto from "crypto";
import { ServerRoute } from "@hapi/hapi";
import sendgrid from "@sendgrid/mail";
import Joi from "joi";
import { Config } from "../../config/Config";
import { SESSION_CREATE_SCHEMA, STRING_SCHEMA } from "../../config/schemas";
import { Account } from "../../models/Account";
import { Session } from "../../models/Session";
import { User } from "../../models/User";
import Database from "../../utilities/Database";

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
            const result = await Database.pool
                .query(
                    `select * from "sign_in_requests" where "id" = $1`,
                    [ request.params.token ],
                );

            if (result.rowCount === 0)
            {
                throw Boom.notFound();
            }

            await Database.pool
                .query(
                    `delete from "sign_in_requests" where "id" = $1`,
                    [ request.params.token ],
                );

            const user = await User.retrieve(result.rows[0].user);

            const session = await Session.create(user);

            request.server.publish(`/auth/email/requests/${result.rows[0].id}`, {
                id: session.id,
            });

            return h.response();
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
            response: Joi.object({
                id: STRING_SCHEMA.required(),
            }),
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

            const token = crypto.randomBytes(Config.SIGN_IN_REQUEST_TOKEN_BYTES).toString("hex");

            const expires = new Date();
            expires.setSeconds(new Date().getSeconds() + Config.SIGN_IN_REQUEST_DURATION);

            const client = await Database.pool.connect();

            await client.query("begin");

            await client
                .query(
                    `
                    insert into "sign_in_requests"
                        ("id", "user", "expires_at")
                    values
                        ($1, $2, $3)
                    `,
                    [
                        token,
                        user.id,
                        expires.toISOString(),
                    ],
                )
                .catch(async () =>
                {
                    await client.query("rollback");

                    throw Boom.badImplementation();
                });

            await sendgrid
                .send({
                    to: user.email,
                    from: "nuntium.tokens@alexsandri.com",
                    subject: "[nuntium] Accept Sign In Request",
                    text: "Hi,\n"
                        + "We received a request to sign into your account\n"
                        + "If this is you click the link below to accept the sign in\n"
                        + "If you are not sure and decide not to click it no one will gain access to your account\n\n"
                        + `${Config.API_HOST}/auth/email/${token}`,
                })
                .catch(async () =>
                {
                    await client.query("rollback");

                    throw Boom.badImplementation();
                });

            await client.query("commit");

            client.release();

            return { id: token };
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
