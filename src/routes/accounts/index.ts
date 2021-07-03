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

            const hmac = Utilities.createHmac(authenticatedUser.id);

            return h.redirect(`auth/${provider}?link=${hmac}`);
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
