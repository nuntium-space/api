import Boom from "@hapi/boom";
import crypto from "crypto";
import { ServerRoute } from "@hapi/hapi";
import sendgrid from "@sendgrid/mail";
import Joi from "joi";
import { Config } from "../../config/Config";
import { Account } from "../../models/Account";
import { Session } from "../../models/Session";
import { User } from "../../models/User";
import Database from "../../utilities/Database";
import Utilities from "../../utilities/Utilities";
import { Schema } from "../../config/Schema";
import { SESSION_SCHEMA } from "../../types/session";

sendgrid.setApiKey(process.env.SENDGRID_API_KEY ?? "");

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/auth/email/{token}",
        options: {
            auth: false,
            validate: {
                params: Joi.object({
                    token: Schema.STRING.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const result = await Database.pool
                .query(
                    `select * from "sign_in_requests" where "token" = $1`,
                    [ request.params.token ],
                );

            if (result.rowCount === 0)
            {
                throw Boom.notFound();
            }

            if
            (
                result.rows[0].expires_at < new Date()
                || result.rows[0].session !== null
            )
            {
                throw Boom.forbidden();
            }

            const user = await User.retrieve(result.rows[0].user);

            const session = await Session.create(user);

            await Database.pool
                .query(
                    `update "sign_in_requests" set "session" = $1 where "id" = $2`,
                    [ session.id, result.rows[0].id ],
                );

            return h.response();
        },
    },
    {
        method: "GET",
        path: "/auth/email/requests/{id}",
        options: {
            auth: false,
            validate: {
                params: Joi.object({
                    id: Schema.ID.SIGN_IN_REQUEST.required(),
                }),
            },
            response: {
                schema: Joi.object({
                    session: SESSION_SCHEMA.OBJ.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const result = await Database.pool
                .query(
                    `select * from "sign_in_requests" where "id" = $1`,
                    [ request.params.id ],
                );

            if (result.rowCount === 0 || !result.rows[0].session)
            {
                throw Boom.notFound();
            }

            if (result.rows[0].expires_at < new Date())
            {
                throw Boom.forbidden();
            }

            await Database.pool
                .query(
                    `delete from "sign_in_requests" where "id" = $1`,
                    [ result.rows[0].id ],
                );

            const user = await User.retrieve(result.rows[0].user);

            const session = await Session.retrieve(result.rows[0].session);

            request.cookieAuth.set({ id: session.id });

            return { session: session.serialize({ for: user }) };
        },
    },
    {
        method: "POST",
        path: "/auth/email",
        options: {
            auth: false,
            validate: {
                payload: SESSION_SCHEMA.CREATE,
            },
            response: {
                schema: Joi.object({
                    id: Schema.ID.SIGN_IN_REQUEST.required(),
                }),
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

            const id = Utilities.id(Config.ID_PREFIXES.SIGN_IN_REQUEST);

            const token = crypto.randomBytes(Config.SIGN_IN_REQUEST_TOKEN_BYTES).toString("hex");

            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + Config.SIGN_IN_REQUEST_DURATION_IN_SECONDS);

            const client = await Database.pool.connect();

            await client.query("begin");

            await client
                .query(
                    `
                    insert into "sign_in_requests"
                        ("id", "token", "user", "expires_at")
                    values
                        ($1, $2, $3, $4)
                    `,
                    [
                        id,
                        token,
                        user.id,
                        expiresAt.toISOString(),
                    ],
                )
                .catch(async () =>
                {
                    await client.query("rollback");

                    throw Boom.badImplementation();
                });

            const userSettings = await user.retrieveSettings();

            const lang = userSettings.language ?? "en";

            const translations = require(`../../assets/translations/email/${lang}.json`);

            await sendgrid
                .send({
                    to: user.email,
                    from: {
                        name: "nuntium",
                        email: "signin@nuntium.space",
                    },
                    subject: translations.auth.subject,
                    text: (translations.auth.lines as string[])
                        .join("\n")
                        .replace("{{ API_URL }}", Config.API_URL)
                        .replace("{{ TOKEN }}", token),
                    trackingSettings: {
                        clickTracking: {
                            enable: false,
                        },
                    },
                })
                .catch(async () =>
                {
                    await client.query("rollback");

                    throw Boom.badImplementation();
                });

            await client.query("commit");

            client.release();

            return { id };
        },
    },
    {
        method: [ "GET", "POST" ],
        path: "/auth/facebook",
        options: {
            auth: "facebook",
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
                displayName: string,
            } = request.auth.credentials.profile as any;

            let user: User;

            if (await User.exists(profile.email))
            {
                user = await User.retrieveWithEmail(profile.email);
            }
            else
            {
                user = await User.create({
                    email: profile.email,
                    full_name: profile.displayName,
                });
            }

            if (!await Account.exists(user, "facebook"))
            {
                await Account.create({
                    user,
                    type: "facebook",
                    external_id: profile.id,
                });
            }

            const session = await Session.create(user);

            request.cookieAuth.set({ id: session.id });

            return h.redirect(Config.CLIENT_URL);
        },
    },
    {
        method: [ "GET", "POST" ],
        path: "/auth/google",
        options: {
            auth: "google",
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
                displayName: string,
            } = request.auth.credentials.profile as any;

            let user: User;

            if (await User.exists(profile.email))
            {
                user = await User.retrieveWithEmail(profile.email);
            }
            else
            {
                user = await User.create({
                    email: profile.email,
                    full_name: profile.displayName,
                });
            }

            if (!await Account.exists(user, "google"))
            {
                await Account.create({
                    user,
                    type: "google",
                    external_id: profile.id,
                });
            }

            const session = await Session.create(user);

            request.cookieAuth.set({ id: session.id });

            return h.redirect(Config.CLIENT_URL);
        },
    },
    {
        method: [ "GET", "POST" ],
        path: "/auth/twitter",
        options: {
            auth: "twitter",
        },
        handler: async (request, h) =>
        {
            if (!request.auth.isAuthenticated)
            {
                throw Boom.unauthorized();
            }

            const profile: {
                id: string,
                raw: {
                    email: string,
                },
            } = request.auth.credentials.profile as any;

            let user: User;

            if (await User.exists(profile.raw.email))
            {
                user = await User.retrieveWithEmail(profile.raw.email);
            }
            else
            {
                user = await User.create({ email: profile.raw.email });
            }

            if (!await Account.exists(user, "twitter"))
            {
                await Account.create({
                    user,
                    type: "twitter",
                    external_id: profile.id,
                });
            }

            const session = await Session.create(user);

            request.cookieAuth.set({ id: session.id });

            return h.redirect(Config.CLIENT_URL);
        },
    },
];
