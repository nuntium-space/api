import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import Utilities from "../../utilities/Utilities";

const accountLinkingRoutes: ServerRoute[] = [ "facebook", "google", "twitter" ].map(provider =>
{
    return {
        method: "GET",
        path: "/users/{id}/accounts/link/facebook",
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

            // TODO:
            // Generate HMAC to link user account (user id is not enough because it is not private)

            const hmac = "TODO";

            return h.redirect(`auth/${request.auth.strategy}?link=${hmac}`);
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
