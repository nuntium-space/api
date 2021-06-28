import Boom from "@hapi/boom";
import sendgrid from "@sendgrid/mail";
import { User } from "../models/User";

enum EmailType
{
    AUTH = "AUTH",
    AUTHOR_INVITE = "AUTHOR_INVITE",
}

interface EmailData
{
    from: {
        name: string,
        email: string,
    },
}

export class Email
{
    public static readonly TYPE: { [ key in EmailType ]: EmailData } = {
        AUTH: {
            from: {
                name: "nuntium",
                email: "signin@nuntium.space",
            } as const,
        } as const,
        AUTHOR_INVITE: {
            from: {
                name: "nuntium",
                email: "invites@nuntium.space",
            } as const,
        } as const,
    } as const;

    public static async send(data: {
        to: User,
        type: EmailData,
    }): Promise<void>
    {
        const userSettings = await user.retrieveSettings();

        const lang = userSettings.language ?? "en";

        const translations = require(`../../assets/translations/email/${lang}.json`);

        await sendgrid
            .send({
                to: user.email,
                from: {
                    name: "nuntium",
                    email: "signin@nuntium.space",
                },
                subject: translations.auth.subject,
                text: (translations.auth.lines as string[])
                    .join("\n")
                    .replace("{{ API_URL }}", Config.API_URL)
                    .replace("{{ TOKEN }}", token)
                    +
                    "\n\n"
                    +
                    (translations.__end.lines as string[])
                        .join("\n"),
                trackingSettings: {
                    clickTracking: {
                        enable: false,
                    },
                },
            })
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badImplementation();
            });
    }
}
