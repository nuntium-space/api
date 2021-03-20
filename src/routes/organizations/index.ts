import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { ID_SCHEMA, ORGANIZATION_CREATE_SCHEMA, ORGANIZATION_SCHEMA, ORGANIZATION_UPDATE_SCHEMA, URL_SCHEMA } from "../../config/schemas";
import { Organization } from "../../models/Organization";
import { User } from "../../models/User";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/organizations/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ORGANIZATION).required(),
                }),
            },
            response: {
                schema: ORGANIZATION_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            const authenticatedUser = request.auth.credentials.user as User;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            return organization.serialize();
        },
    },
    {
        method: "GET",
        path: "/organizations/{id}/stripe/connect",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ORGANIZATION).required(),
                }),
            },
            response: {
                schema: Joi.object({
                    url: URL_SCHEMA.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            const authenticatedUser = request.auth.credentials.user as User;

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
                    id: ID_SCHEMA(Config.ID_PREFIXES.ORGANIZATION).required(),
                }),
            },
            response: {
                schema: Joi.object({
                    url: URL_SCHEMA.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            const authenticatedUser = request.auth.credentials.user as User;

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
                    id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
                }),
            },
            response: {
                schema: Joi.array().items(ORGANIZATION_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const organizations = await Organization.forUser(authenticatedUser);

            return organizations.map(organization => organization.serialize());
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
            const authenticatedUser = request.auth.credentials.user as User;

            const organization = await Organization.create(request.payload as any, authenticatedUser);

            return organization.serialize();
        },
    },
    {
        method: "PATCH",
        path: "/organizations/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ORGANIZATION).required(),
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

            const authenticatedUser = request.auth.credentials.user as User;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await organization.update(request.payload as any);

            return organization.serialize();
        },
    },
    {
        method: "DELETE",
        path: "/organizations/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ORGANIZATION).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            const authenticatedUser = request.auth.credentials.user as User;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await organization.delete();

            return h.response();
        },
    },
];
