import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import { Config } from "../../config/Config";
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
                name: {
                    first: string,
                    last: string,
                },
                email: string,
            } = request.auth.credentials.profile as any;

            let user: User;

            if (await User.exists(profile.email))
            {
                user = await User.retrieveWithEmail(profile.email);
            }
            else
            {
                user = await User.create({
                    first_name: profile.name.first,
                    last_name: profile.name.last,
                    email: profile.email,
                });
            }

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
                name: {
                    given_name: string,
                    family_name: string,
                },
                email: string,
            } = request.auth.credentials.profile as any;

            let user: User;

            if (await User.exists(profile.email))
            {
                user = await User.retrieveWithEmail(profile.email);
            }
            else
            {
                user = await User.create({
                    first_name: profile.name.given_name,
                    last_name: profile.name.family_name,
                    email: profile.email,
                });
            }

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
