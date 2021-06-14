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

    public static extractTextFromEditorJson(json: { text?: string, content?: any[] }): string
    {
        if (json.text)
        {
            return json.text;
        }

        if (!json.content)
        {
            return "";
        }

        return json.content.map(Utilities.extractTextFromEditorJson).flat().join(" ");
    }
}
