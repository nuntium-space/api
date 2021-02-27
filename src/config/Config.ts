/**
 * Global configuration options for the API
 */
export class Config
{
    /**
     * The required minimum length for every password added through the API.
     * 
     * @default
     * 8
     */
    public static readonly PASSWORD_MIN_LENGTH = 8;

    /**
     * Represents the duration of a session in seconds.
     * 
     * @default
     * 30 days
     */
    public static readonly SESSION_DURATION = 60 * 60 * 24 * 30;
}
