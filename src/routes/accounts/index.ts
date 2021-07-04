import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { Schema } from "../../config/Schema";
import { Account } from "../../models/Account";
import { ACCOUNT_SCHEMA } from "../../types/account";
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
            response: {
                schema: Schema.ARRAY(ACCOUNT_SCHEMA.OBJ),
            },
        },
        handler: async (request, h) =>
        {
            const [ authenticatedUser ] = Utilities.getAuthenticatedUser(request);

            if (authenticatedUser.id !== request.params.id)
            {
                throw Boom.forbidden();
            }

            const accounts = await Account.forUser(authenticatedUser);

            return Promise.all(Config.AUTH_PROVIDERS.map(async _ =>
            {
                return {
                    id: _.id,
                    display_name: _.display_name,
                    is_linked: accounts.find(account => account.type === _.id) instanceof Account,
                };
            }));
        },
    },
    ...accountLinkingRoutes,
];
