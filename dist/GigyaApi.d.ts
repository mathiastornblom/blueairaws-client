import { Region } from "./Consts";
/**
 * Gigya API client for handling authentication.
 */
export default class GigyaApi {
    private readonly username;
    private readonly password;
    private api_key;
    private gigyaApiUrl;
    /**
     * Constructs a new GigyaApi instance.
     * @param username - The username for authentication.
     * @param password - The password for authentication.
     * @param region - The region code.
     */
    constructor(username: string, password: string, region: Region);
    /**
     * Retrieves the Gigya session.
     * @returns A promise that resolves to the session token and secret.
     */
    getGigyaSession(): Promise<{
        token: string;
        secret: string;
    }>;
    /**
     * Retrieves the Gigya JWT.
     * @param token - The session token.
     * @param secret - The session secret.
     * @returns A promise that resolves to the JWT.
     */
    getGigyaJWT(token: string, secret: string): Promise<{
        jwt: string;
    }>;
    private apiCall;
}
