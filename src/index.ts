import Hapi from "@hapi/hapi";
import dotenv from "dotenv";
import { USER_CREATE_SCHEMA, USER_SCHEMA } from "./config/schemas";
import { User } from "./models/User";
import Database from "./utilities/Database";

dotenv.config();

const server = Hapi.server({
    port: 4000,
    routes: {
        cors: true,
        validate: {
            options: {
                abortEarly: false,
            },
            failAction: async (request, h, error) =>
            {
                throw error;
            },
        },
        response: {
            emptyStatusCode: 204,
        },
    },
});

const init = async () =>
{
    await Database.init();

    server.route({
        method: "POST",
        path: "/users",
        options: {
            auth: false,
            validate: {
                payload: USER_CREATE_SCHEMA,
            },
            response: {
                schema: USER_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const user = await User.create(request.payload as any);

            return user.serialize();
        }
    });

    server.route({
        method: "POST",
        path: "/sessions",
        options: {
            auth: false,
        },
        handler: (request, h) =>
        {
            // TODO
        }
    });

    server.start();
}

init();
