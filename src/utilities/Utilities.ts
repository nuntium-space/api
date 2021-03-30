import cuid from "cuid";

export default class Utilities
{
    public static id(prefix: string): string
    {
        return `${prefix}_${cuid()}`;
    }

    public static formatCurrencyAmount(amount: number, currency: string): number
    {
        if ([ "usd", "eur" ].includes(currency.toLowerCase()))
        {
            return amount /= 100;
        }

        return amount;
    }
}
