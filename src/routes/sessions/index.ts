import { ServerRoute } from "@hapi/hapi";
import { Session } from "../../models/Session";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/sessions/current",
        options: {
            response: {
                schema: Session.SCHEMA.OBJ,
            },
        },
        handler: async (request, h) =>
        {
            const session = request.auth.credentials.session as Session;

            return session.serialize({ for: session.user });
        },
    },
    {
        method: "DELETE",
        path: "/sessions/current",
        handler: async (request, h) =>
        {
            const session = request.auth.credentials.session as Session;

            await session.delete();

            request.cookieAuth.clear();

            return h.response();
        },
    },
];
