import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { Schema } from "../../config/Schema";
import Utilities from "../../utilities/Utilities";

const accountLinkingRoutes: ServerRoute[] = Config.AUTH_PROVIDERS.map(provider =>
{
    return {
        method: "GET",
        path: `/users/{id}/accounts/link/${provider.id}`,
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

            return h.redirect(`/auth/${provider.id}?link=${hmac}--${authenticatedUser.id}`);
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
