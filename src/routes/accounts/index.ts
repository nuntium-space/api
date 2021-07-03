import { createHmac } from "crypto";
import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import Utilities from "../../utilities/Utilities";

const accountLinkingRoutes: ServerRoute[] = [ "facebook", "google", "twitter" ].map(provider =>
{
    return {
        method: "GET",
        path: `/users/{id}/accounts/link/${provider}`,
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const [ authenticatedUser ] = Utilities.getAuthenticatedUser(request);

            if (authenticatedUser.id !== request.params.id)
            {
                throw Boom.forbidden();
            }

            if (!process.env.AUTH_COOKIE_ENCRYPTION_PASSWORD)
            {
                throw Boom.badImplementation();
            }

            const hmac = createHmac("sha512", process.env.AUTH_COOKIE_ENCRYPTION_PASSWORD);
            hmac.update(authenticatedUser.id);

            return h.redirect(`auth/${provider}?link=${hmac.digest("hex")}`);
        },
    };
});

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/users/{id}/accounts",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            throw Boom.notImplemented();
        },
    },
    ...accountLinkingRoutes,
];
