import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import { Config } from "../../config/Config";
import { Account } from "../../models/Account";
import { Session } from "../../models/Session";
import { User } from "../../models/User";

export default <ServerRoute[]>[
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
