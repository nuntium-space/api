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

            return h.redirect(`/auth/${provider.id}?link=${hmac}--${authenticatedUser.id}&redirectTo=/settings/security`);
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
    {
        method: "DELETE",
        path: "/users/{user_id}/accounts/{account_id}",
        options: {
            validate: {
                params: Joi.object({
                    user_id: Schema.ID.USER.required(),
                    account_id: Schema.STRING.valid(...Config.AUTH_PROVIDERS.map(_ => _.id)).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const [ authenticatedUser ] = Utilities.getAuthenticatedUser(request);

            if (authenticatedUser.id !== request.params.user_id)
            {
                throw Boom.forbidden();
            }

            const account = await Account.retrieveWithUserAndType(authenticatedUser, request.params.account_id);

            await account.delete();

            return h.response();
        },
    },
    ...accountLinkingRoutes,
];
