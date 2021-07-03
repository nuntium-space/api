import Boom from "@hapi/boom";
import { randomBytes } from "crypto";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { Account } from "../../models/Account";
import { Session } from "../../models/Session";
import { User } from "../../models/User";
import Database from "../../utilities/Database";
import Utilities from "../../utilities/Utilities";
import { Schema } from "../../config/Schema";
import { SESSION_SCHEMA } from "../../types/session";
import { Email } from "../../utilities/Email";
import { INotExpandedResource } from "../../common/INotExpandedResource";

const authProvidersEndpoints: ServerRoute[] = Config.AUTH_PROVIDERS.map(provider =>
{
    return {
        method: [ "GET", "POST" ],
        path: `/auth/${provider.id}`,
        options: {
            auth: provider.id,
        },
        handler: async (request, h) =>
        {
            if (!request.auth.isAuthenticated)
            {
                throw Boom.unauthorized();
            }

            const profile = request.auth.credentials.profile;
            const query = request.auth.credentials.query as { [ key: string ]: string } | undefined;

            let user: User | INotExpandedResource | string;
            const providerUserId = provider.getId(profile);

            if (query?.link)
            {
                const [ hmac, userId ] = query.link.split("--");

                if (!Utilities.verifyHmac(hmac, userId))
                {
                    throw Boom.unauthorized();
                }

                user = userId;

                if (await Account.exists(user, "google"))
                {
                    throw Boom.conflict();
                }

                await Account.create({
                    user,
                    type: "google",
                    external_id: providerUserId,
                });
            }
            else if (await Account.existsWithExternalId(providerUserId))
            {
                const account = await Account.retrieveWithExternalId(providerUserId);

                user = account.user;
            }
            else
            {
                user = await User.create({
                    email: provider.getEmail(profile),
                    full_name: provider.getFullName(profile),
                });

                await Account.create({
                    user,
                    type: "google",
                    external_id: providerUserId,
                });
            }

            const session = await Session.create(user);

            request.cookieAuth.set({ id: session.id });

            const redirectUrl = new URL(Config.CLIENT_URL);
            redirectUrl.pathname = query?.redirectTo ?? "";

            return h.redirect(redirectUrl.toString());
        },
    };
});

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

            let user: User | INotExpandedResource;

            if (await User.exists(email))
            {
                user = await User.retrieveWithEmail(email);
            }
            else
            {
                user = await User.create({ email });
            }

            const id = Utilities.id(Config.ID_PREFIXES.SIGN_IN_REQUEST);

            const token = randomBytes(Config.SIGN_IN_REQUEST_TOKEN_BYTES).toString("hex");

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

            await Email.send({
                to: user,
                type: Email.TYPE.AUTH,
                replace: {
                    API_URL: Config.API_URL,
                    TOKEN: token,
                },
            });

            await client.query("commit");
            client.release();

            return { id };
        },
    },
    ...authProvidersEndpoints,
];
