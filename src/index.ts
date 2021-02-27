import Hapi from "@hapi/hapi";

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
