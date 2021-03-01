import Hapi from "@hapi/hapi";
import dotenv from "dotenv";
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
        options: {},
        handler: (request, h) =>
        {
            // TODO
        }
    });

    server.route({
        method: "POST",
        path: "/sessions",
        options: {},
        handler: (request, h) =>
        {
            // TODO
        }
    });

    server.start();
}

init();
