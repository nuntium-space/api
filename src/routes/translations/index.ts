import fs from "fs/promises";
import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import path from "path";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/translations/{lang}",
        handler: async (request, h) =>
        {
            const translationFilePath = path.resolve(__dirname, "..", "..", "assets", "translations", `${request.params.lang}.json`);

            const exists = await fs.access(translationFilePath)
                .then(() => true)
                .catch(() => false);

            if (!exists)
            {
                throw Boom.notFound();
            }

            const file = await fs.readFile(
                translationFilePath,
                {
                    encoding: "utf8",
                },
            );

            return file;
        },
    },
];
