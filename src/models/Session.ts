import { ExpandQuery } from "../common/ExpandQuery";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import { Model } from "../config/Model";
import { ISerializedSession, ISession, SESSION_MODEL } from "../types/session";
import Utilities from "../utilities/Utilities";
import { User } from "./User";

export class Session
  extends Model
  implements ISerializable<ISerializedSession>
{
  public constructor(protected readonly record: ISession) {
    super(SESSION_MODEL, record);
  }

  public get id(): string {
    return this.record.id;
  }

  public get user(): User | INotExpandedResource {
    return this.record.user;
  }

  public get expires_at(): Date {
    return this.record.expires_at;
  }

  public static async create(
    user: User | INotExpandedResource | string
  ): Promise<INotExpandedResource> {
    const id = Utilities.id(Config.ID_PREFIXES.SESSION);

    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + Config.SESSION_DURATION_IN_SECONDS
    );

    await super._create(SESSION_MODEL, {
      id,
      user: typeof user === "string" ? user : user.id,
      expires_at: expiresAt.toISOString(),
    });

    return { id };
  }

  public static async retrieve(
    id: string,
    expand?: ExpandQuery
  ): Promise<Session> {
    return super._retrieve({ kind: SESSION_MODEL, filter: { id }, expand });
  }

  public async delete(): Promise<void> {
    return super._delete({ kind: SESSION_MODEL, filter: { id: this.id } });
  }

  public hasExpired(): boolean {
    return this.expires_at < new Date();
  }

  public serialize(options?: {
    for?: User | INotExpandedResource;
  }): ISerializedSession {
    return {
      id: this.id,
      user:
        this.user instanceof User
          ? this.user.serialize({ for: options?.for })
          : this.user,
      expires_at: this.expires_at.toISOString(),
    };
  }
}
