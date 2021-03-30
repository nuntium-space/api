import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import { Config } from "../../config/Config";

export default <ServerRoute[]>[
    {
        method: [ "GET", "POST" ],
        path: "/auth/callback/twitter",
        options: {
            auth: {
              mode: "try",
              strategy: "twitter",
            },
        },
        handler: (request, h) =>
        {
            if (!request.auth.isAuthenticated)
            {
                throw Boom.unauthorized();
            }

            // TODO:
            // CREDENTIALS: request.auth.credentials
            // Add user if it does not exist
            // Create session
            // Redirect with session id

            return h.redirect(`${Config.CLIENT_HOST}?session_id=${"TODO"}`);
        },
    },
];
