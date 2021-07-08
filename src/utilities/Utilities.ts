import Boom from "@hapi/boom";
import { Request } from "@hapi/hapi";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import readingTime from "reading-time";
import { Config } from "../config/Config";
import { Session } from "../models/Session";
import { User } from "../models/User";

export default class Utilities {
  public static id(prefix: string): string {
    return `${prefix}_${randomBytes(Config.ID_BYTE_LENGTH).toString("hex")}`;
  }

  public static formatCurrencyAmount(amount: number, currency: string): number {
    if (["usd", "eur"].includes(currency.toLowerCase())) {
      return (amount /= 100);
    }

    return amount;
  }

  public static getArticleReadingTimeInMinutes(json: {
    text?: string;
    content?: any[];
  }): number {
    return Math.round(
      readingTime(Utilities.extractTextFromEditorJson(json)).minutes
    );
  }

  public static extractTextFromEditorJson(json: {
    text?: string;
    content?: any[];
  }): string {
    if (json.text) {
      return json.text;
    }

    if (!json.content) {
      return "";
    }

    return json.content
      .map(Utilities.extractTextFromEditorJson)
      .flat()
      .join(" ");
  }

  public static getNestedExpandQuery(query: string[], key: string): string[] {
    return query
      .filter((_) => _.startsWith(`${key}.`))
      .map((_) => _.replace(`${key}.`, ""));
  }

  /**
   * @param request The hapi request object
   *
   * @returns An array containing:\
   *  1. The current session
   *  2. Whether the authenticated user is an admin
   */
  public static getAuthenticatedUser(request: Request): [User, boolean] {
    const session = request.auth.credentials.session as Session;

    return [session.user, session.user.type === "admin"];
  }

  public static createHmac(value: string): string {
    if (!process.env.AUTH_COOKIE_ENCRYPTION_PASSWORD) {
      throw Boom.badImplementation();
    }

    const hmac = createHmac(
      "sha512",
      process.env.AUTH_COOKIE_ENCRYPTION_PASSWORD
    );
    hmac.update(value);

    return hmac.digest("hex");
  }

  public static verifyHmac(hmac: string, value: string): boolean {
    return timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(Utilities.createHmac(value))
    );
  }
}
