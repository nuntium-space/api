import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import { SESSION_SCHEMA } from "../../config/schemas";
import { Session } from "../../models/Session";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/sessions/current",
        options: {
            response: {
                schema: SESSION_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const session = await Session.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (session.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            return session.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "DELETE",
        path: "/sessions/current",
        handler: async (request, h) =>
        {
            const session = await Session.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (session.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await session.delete();

            return h.response();
        },
    },
];
