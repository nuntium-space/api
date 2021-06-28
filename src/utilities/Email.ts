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
    translation: string,
}

export class Email
{
    public static readonly TYPE: { [ key in EmailType ]: EmailData } = {
        AUTH: {
            from: {
                name: "nuntium",
                email: "signin@nuntium.space",
            } as const,
            translation: "auth",
        } as const,
        AUTHOR_INVITE: {
            from: {
                name: "nuntium",
                email: "invites@nuntium.space",
            } as const,
            translation: "author_invite",
        } as const,
    } as const;

    public static async send(data: {
        to: User,
        type: EmailData,
        replace: {
            [ key: string ]: string,
        },
    }): Promise<void>
    {
        const userSettings = await data.to.retrieveSettings();

        const lang = userSettings.language ?? "en";

        const translations = require(`../assets/translations/email/${lang}.json`);

        await sendgrid
            .send({
                to: data.to.email,
                from: data.type.from,
                subject: translations[data.type.translation].subject,
                text: Email.getText(data.type.translation, data.replace, lang),
                trackingSettings: {
                    clickTracking: {
                        enable: false,
                    },
                },
            })
            .catch(() =>
            {
                throw Boom.badImplementation();
            });
    }

    private static getText(type: string, replace: { [ key: string ]: string }, lang: string): string
    {
        const translations = require(`../assets/translations/email/${lang}.json`);

        let text = (translations[type].lines as string[]).join("\n");

        for (const _ in replace)
        {
            text = text.replace(`{{ ${_} }}`, replace[_]);
        }

        text += "\n\n";
        text += (translations.__end.lines as string[]).join("\n");

        return text;
    }
}
