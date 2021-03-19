import { compare, hash } from "bcrypt";
import cuid from "cuid";
import { Config } from "../config/Config";

export default class Utilities
{
    public static hash(data: string): Promise<string>
    {
        return hash(data, Config.HASH_ROUNDS);
    }

    public static verifyHash(data: string, hash: string): Promise<boolean>
    {
        return compare(data, hash);
    }

    public static id(prefix: string): string
    {
        return `${prefix}_${cuid()}`;
    }
}
