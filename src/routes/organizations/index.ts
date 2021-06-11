import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { Schema } from "../../config/Schema";
import { ORGANIZATION_CREATE_SCHEMA, ORGANIZATION_SCHEMA, ORGANIZATION_UPDATE_SCHEMA } from "../../config/schemas";
import { Organization } from "../../models/Organization";
import { Session } from "../../models/Session";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/organizations/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ORGANIZATION.required(),
                }),
            },
            response: {
                schema: ORGANIZATION_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            return organization.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "GET",
        path: "/organizations/{id}/stripe/connect",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ORGANIZATION.required(),
                }),
            },
            response: {
                schema: Joi.object({
                    url: Schema.URL.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const { url } = await Config.STRIPE.accountLinks
                .create({
                    account: organization.stripe_account_id,
                    type: "account_onboarding",
                    refresh_url: `${Config.API_HOST}/organizations/${organization.id}`,
                    return_url: `${Config.CLIENT_HOST}/organization/${organization.id}`,
                })
                .catch(() =>
                {
                    throw Boom.badImplementation();
                });

            return { url };
        },
    },
    {
        method: "GET",
        path: "/organizations/{id}/stripe/dashboard",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ORGANIZATION.required(),
                }),
            },
            response: {
                schema: Joi.object({
                    url: Schema.URL.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const { url } = await Config.STRIPE.accounts
                .createLoginLink(organization.stripe_account_id)
                .catch(() =>
                {
                    throw Boom.badImplementation();
                });

            return { url };
        },
    },
    {
        method: "GET",
        path: "/users/{id}/organizations",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
            },
            response: {
                schema: Schema.ARRAY(ORGANIZATION_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const organizations = await Organization.forUser(authenticatedUser);

            return organizations.map(organization => organization.serialize({ for: authenticatedUser }));
        },
    },
    {
        method: "POST",
        path: "/organizations",
        options: {
            validate: {
                payload: ORGANIZATION_CREATE_SCHEMA,
            },
            response: {
                schema: ORGANIZATION_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const organization = await Organization.create(request.payload as any, authenticatedUser);

            return organization.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "PATCH",
        path: "/organizations/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ORGANIZATION.required(),
                }),
                payload: ORGANIZATION_UPDATE_SCHEMA,
            },
            response: {
                schema: ORGANIZATION_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await organization.update(request.payload as any);

            return organization.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "DELETE",
        path: "/organizations/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ORGANIZATION.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await organization.delete();

            return h.response();
        },
    },
];
