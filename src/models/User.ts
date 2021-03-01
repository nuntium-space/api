interface IDatabaseUser
{
    id: string,
    first_name: string,
    last_name: string,
    email: string,
    password: string,
}

interface ICreateUser
{
    first_name: string,
    last_name: string,
    email: string,
    password: string,
}

interface IUpdateUser
{
    first_name?: string,
    last_name?: string,
    email?: string,
    password?: string,
}

interface ISerializedUser
{
    id: string,
    first_name: string,
    last_name: string,
    email: string,
}

export class User
{
    private constructor
    (
        public readonly id: string,
        public readonly first_name: string,
        public readonly last_name: string,
        public readonly email: string,
    )
    {}

    public static async create(data: ICreateUser): Promise<User>
    {
        // TODO
    }

    public static async retrieve(id: string): Promise<User>
    {
        // TODO
    }

    public async update(data: IUpdateUser): Promise<void>
    {
        // TODO
    }

    public async delete(): Promise<void>
    {
        // TODO
    }

    public serialize(): ISerializedUser
    {
        return {
            id: this.id,
            first_name: this.first_name,
            last_name: this.last_name,
            email: this.email,
        };
    }

    public static deserialize(data: IDatabaseUser): User
    {
        return new User(
            data.id,
            data.first_name,
            data.last_name,
            data.email,
        );
    }
}
