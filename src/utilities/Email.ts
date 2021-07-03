import Boom from "@hapi/boom";
import sendgrid from "@sendgrid/mail";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { User } from "../models/User";

enum EmailType
{
    AUTH = "AUTH",
    ARTICLE_DRAFT_PUBLISHED = "ARTICLE_DRAFT_PUBLISHED",
    ARTICLE_DRAFT_REJECTED = "ARTICLE_DRAFT_REJECTED",
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
        ARTICLE_DRAFT_PUBLISHED: {
            from: {
                name: "nuntium",
                email: "articles@nuntium.space",
            } as const,
            translation: "article_draft_published",
        } as const,
        ARTICLE_DRAFT_REJECTED: {
            from: {
                name: "nuntium",
                email: "articles@nuntium.space",
            } as const,
            translation: "article_draft_rejected",
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
        to: User | INotExpandedResource,
        type: EmailData,
        replace: {
            [ key: string ]: string,
        },
    }): Promise<void>
    {
        const to = data.to instanceof User
            ? data.to
            : await User.retrieve(data.to.id);

        const userSettings = await to.retrieveSettings();

        const lang = userSettings.language ?? "en";

        await sendgrid
            .send({
                to: to.email,
                from: data.type.from,
                subject: Email.getSubject(data.type.translation, data.replace, lang),
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

    private static getSubject(type: string, replace: { [ key: string ]: string }, lang: string): string
    {
        const translations = require(`../assets/translations/email/${lang}.json`);

        let subject = translations[type].subject as string;

        for (const _ in replace)
        {
            subject = subject.replace(`{{ ${_} }}`, replace[_]);
        }

        return subject;
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
