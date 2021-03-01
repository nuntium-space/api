export class Config
{
    public static readonly PASSWORD_MIN_LENGTH = 10;

    public static readonly SESSION_DURATION = 60 * 60 * 24 * 30;

    public static readonly HASH_ROUNDS = 15;

    public static readonly ID_PREFIXES = {
        USER: "usr",
        ORGANIZATION: "org",
        PUBLISHER: "pub",
        AUTHOR: "aut",
        ARTICLE: "art",
        SESSION: "ses",
        COMMENT: "cmt",
    };
}
