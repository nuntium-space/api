import Boom from "@hapi/boom";
import sendgrid from "@sendgrid/mail";
import { User } from "../models/User";

enum EmailType {
  AUTH = "AUTH",
  ARTICLE_DRAFT_PUBLISHED = "ARTICLE_DRAFT_PUBLISHED",
  ARTICLE_DRAFT_REJECTED = "ARTICLE_DRAFT_REJECTED",
  AUTHOR_INVITE = "AUTHOR_INVITE",
  AUTHOR_INVITE_NO_USER = "AUTHOR_INVITE_NO_USER",
}

interface EmailData {
  from: {
    name: string;
    email: string;
  };
  translation: string;
}

export class Email {
  public static readonly TYPE: { [key in EmailType]: EmailData } = {
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
    AUTHOR_INVITE_NO_USER: {
      from: {
        name: "nuntium",
        email: "invites@nuntium.space",
      } as const,
      translation: "author_invite_no_user",
    } as const,
  } as const;

  public static async send(data: {
    to: string;
    type: EmailData;
    replace: {
      [key: string]: string;
    };
  }): Promise<void> {
    let lang = "en";

    if (await User.existsWithEmail(data.to)) {
      const user = await User.retrieveWithEmail(data.to);

      const userSettings = await user.retrieveSettings();

      lang = userSettings.language ?? lang;
    }

    await sendgrid
      .send({
        to: data.to,
        from: data.type.from,
        subject: Email.getSubject(data.type.translation, data.replace, lang),
        html: Email.getText(data.type.translation, data.replace, lang),
        trackingSettings: {
          clickTracking: {
            enable: false,
          },
        },
      })
      .catch(() => {
        throw Boom.badImplementation();
      });
  }

  private static getSubject(
    type: string,
    replace: { [key: string]: string },
    lang: string
  ): string {
    /* eslint @typescript-eslint/no-var-requires: "off" */
    const translations = require(`../assets/translations/email/${lang}.json`);

    let subject = translations[type].subject as string;

    for (const _ in replace) {
      subject = subject.replace(`{{ ${_} }}`, replace[_]);
    }

    return subject;
  }

  private static getText(
    type: string,
    replace: { [key: string]: string },
    lang: string
  ): string {
    /* eslint @typescript-eslint/no-var-requires: "off" */
    const translations = require(`../assets/translations/email/${lang}.json`);

    let text = (translations[type].lines as string[]).join("<br>");

    for (const _ in replace) {
      text = text.replace(new RegExp(`{{ ${_} }}`, "g"), replace[_]);
    }

    text += "<br><br>";
    text += (translations.__end.lines as string[]).join("<br>");

    return text;
  }
}
