import Boom from "@hapi/boom";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Bundle } from "./Bundle";
import { ISerializedOrganization, Organization } from "./Organization";
import { User } from "./User";

interface IDatabasePublisher
{
    id: string,
    name: string,
    url: string,
    organization: string,
}

interface ICreatePublisher
{
    name: string,
    url: string,
}

interface IUpdatePublisher
{
    name?: string,
    url?: string,
}

export interface ISerializedPublisher
{
    id: string,
    name: string,
    url: string,
    organization: ISerializedOrganization,
}

export class Publisher
{
    private constructor
    (
        private readonly _id: string,
        private _name: string,
        private _url: string,
        private  _organization: Organization,
    )
    {}

    public get id(): string
    {
        return this._id;
    }

    public get name(): string
    {
        return this._name;
    }

    public get url(): string
    {
        return this._url;
    }

    public get organization(): Organization
    {
        return this._organization;
    }

    public static async create(data: ICreatePublisher, organization: Organization): Promise<Publisher>
    {
        const result = await Database.pool
            .query(
                `
                insert into "publishers"
                    ("id", "name", "url", "organization")
                values
                    ($1, $2, $3, $4)
                returning *
                `,
                [
                    Utilities.id(Config.ID_PREFIXES.PUBLISHER),
                    data.name,
                    data.url,
                    organization.id,
                ],
            )
            .catch(() =>
            {
                throw Boom.badRequest();
            });

        return Publisher.deserialize(result.rows[0]);
    }

    public static async retrieve(id: string): Promise<Publisher>
    {
        const result = await Database.pool.query(
            `select * from "publishers" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return Publisher.deserialize(result.rows[0]);
    }

    public async update(data: IUpdatePublisher): Promise<void>
    {
        this._name = data.name ?? this.name;
        this._url = data.url ?? this.url;

        await Database.pool
            .query(
                `
                update "publishers"
                set
                    "name" = $1,
                    "url" = $2
                where
                    "id" = $3
                `,
                [
                    this.name,
                    this.url,
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
            `delete from "publishers" where "id" = $1`,
            [ this.id ],
        );
    }

    public static async forBundle(bundle: Bundle): Promise<Publisher[]>
    {
        const result = await Database.pool.query(
            `
            select p.*
            from
                bundles_publishers as bp
                inner join
                publishers as p
                on bp.publisher = p.id
            where bp.bundle = $1
            `,
            [ bundle.id ],
        );

        return Promise.all(result.rows.map(row => Publisher.deserialize(row)));
    }

    public static async forOrganization(organization: Organization, options: {
        not_in_bundle: string,
    }): Promise<Publisher[]>
    {
        let query = `select * from "publishers" where "organization" = $1`;
        let params = [ organization.id ];

        if (options.not_in_bundle)
        {
            query =
            `
            select *
            from publishers
            where
                id not in
                (
                    select publisher
                    from bundles_publishers
                    where bundle = $1
                )
                and
                organization = $2
            `;

            params = [ options.not_in_bundle, organization.id ];
        }

        const result = await Database.pool.query(query, params);

        return Promise.all(result.rows.map(Publisher.deserialize));
    }

    public isOwnedByUser(user: User): boolean
    {
        return this.organization.owner.id === user.id;
    }

    public serialize(): ISerializedPublisher
    {
        return {
            id: this.id,
            name: this.name,
            url: this.url,
            organization: this.organization.serialize(),
        };
    }

    private static async deserialize(data: IDatabasePublisher): Promise<Publisher>
    {
        const organization = await Organization.retrieve(data.organization);

        return new Publisher(
            data.id,
            data.name,
            data.url,
            organization,
        );
    }
}
