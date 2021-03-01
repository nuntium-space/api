import { hashSync, compareSync } from "bcrypt";
import cuid from "cuid";
import { Config } from "../config/Config";

export default class Utilities
{
    public static hash(data: string): string
    {
        return hashSync(data, Config.HASH_ROUNDS);
    }

    public static verifyHash(data: string, hash: string): boolean
    {
        return compareSync(data, hash);
    }

    public static id(prefix: string): string
    {
        return `${prefix}_${cuid()}`;
    }
}
