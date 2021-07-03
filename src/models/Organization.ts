import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import { ISerializedOrganization, ICreateOrganization, IUpdateOrganization, IDatabaseOrganization } from "../types/organization";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { User } from "./User";

export class Organization implements ISerializable<ISerializedOrganization>
{
    private constructor
    (
        public readonly id: string,
        private _name: string,
        public readonly owner: User,
        public readonly stripe_account_id: string,
        private _stripe_account_enabled: boolean,
    )
    {}

    public get name(): string
    {
        return this._name;
    }

    public get stripe_account_enabled(): boolean
    {
        return this._stripe_account_enabled;
    }

    public static async create(data: ICreateOrganization, user: User): Promise<INotExpandedResource>
    {
        if (await Organization.existsWithName(data.name))
        {
            throw Boom.badRequest(undefined, [
                {
                    field: "name",
                    error: "custom.organization.already_exists",
                },
            ]);
        }

        const id = Utilities.id(Config.ID_PREFIXES.ORGANIZATION);

        const account = await Config.STRIPE.accounts
            .create({
                type: "express",
                email: user.email,
                metadata: {
                    organization_id: id,
                }
            })
            .catch(() =>
            {
                throw Boom.badImplementation();
            });

        await Database.pool
            .query(
                `
                insert into "organizations"
                    ("id", "name", "user", "stripe_account_id")
                values
                    ($1, $2, $3, $4)
                returning *
                `,
                [
                    id,
                    data.name,
                    user.id,
                    account.id,
                ],
            )
            .catch(() =>
            {
                throw Boom.badRequest();
            });

        return { id };
    }

    public static async retrieve(id: string): Promise<Organization>
    {
        const result = await Database.pool.query(
            `select * from "organizations" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return Organization.deserialize(result.rows[0]);
    }

    public static async existsWithName(name: string): Promise<boolean>
    {
        const { rowCount } = await Database.pool.query(
            `select "id" from "organizations" where "name" = $1 limit 1`,
            [ name ],
        );

        return rowCount > 0;
    }

    public async update(data: IUpdateOrganization): Promise<void>
    {
        this._name = data.name ?? this.name;
        this._stripe_account_enabled = data.stripe_account_enabled ?? this.stripe_account_enabled;

        await Database.pool
            .query(
                `
                update "organizations"
                set
                    "name" = $1,
                    "stripe_account_enabled" = $2
                where
                    "id" = $3
                `,
                [
                    this.name,
                    this.stripe_account_enabled,
                    this.id,
                ],
            )
            .catch(() =>
            {
                throw Boom.badRequest();
            });
    }

    public async delete(): Promise<void>
    {
        await Database.pool.query(
            `delete from "organizations" where "id" = $1`,
            [ this.id ],
        );
    }

    public static async forUser(user: User): Promise<Organization[]>
    {
        const result = await Database.pool.query(
            `select * from "organizations" where "user" = $1`,
            [ user.id ],
        );

        return Promise.all(result.rows.map(Organization.deserialize));
    }

    public serialize(options?: {
        for?: User | INotExpandedResource,
    }): ISerializedOrganization
    {
        return {
            id: this.id,
            name: this.name,
            owner: this.owner.serialize({ for: options?.for }),
            stripe_account_enabled: this.stripe_account_enabled,
        };
    }

    private static async deserialize(data: IDatabaseOrganization): Promise<Organization>
    {
        const owner = await User.retrieve(data.user);

        return new Organization(
            data.id,
            data.name,
            owner,
            data.stripe_account_id,
            data.stripe_account_enabled,
        );
    }
}
