import { Region, BlueAirDeviceSensorData, BlueAirDeviceState } from "./Consts";
/**
 * Represents a device structure. Add more properties as per your actual data.
 */
type BlueAirDeviceDiscovery = {
    mac: string;
    "mcu-firmware": string;
    name: string;
    type: string;
    "user-type": string;
    uuid: string;
    "wifi-firmware": string;
};
export type BlueAirDeviceStatus = {
    id: string;
    name: string;
    state: BlueAirDeviceState;
    sensorData: BlueAirDeviceSensorData;
};
/**
 * BlueAirAwsClient Class:
 * A client for handling requests to the BlueAir API.
 * It manages authentication, determines the right endpoint, and provides methods to fetch device data.
 */
export declare class BlueAirAwsClient {
    private mutex;
    private _authToken;
    private _endpoint;
    private gigyaApi;
    private last_login;
    private blueAirApiUrl;
    /**
     * Constructor to set up the client with necessary credentials.
     * @param username - The user's email or username.
     * @param password - The user's password.
     * @param region - The region for the API.
     */
    constructor(username: string, password: string, region: Region);
    get authToken(): string | null;
    /**
     * Initializes the client by determining the API endpoint and fetching the authentication token.
     * @returns {Promise<boolean>} True if initialization was successful, false otherwise.
     */
    initialize(): Promise<boolean>;
    /**
     * Logs in and sets the authentication token.
     */
    private login;
    /**
     * Checks if the token is expired and renews it if necessary.
     */
    private checkTokenExpiration;
    /**
     * Fetches the AWS access token using the JWT.
     * @param jwt - The JWT token.
     * @returns {Promise<{ accessToken: string }>} - The AWS access token.
     */
    private getAwsAccessToken;
    /**
     * Fetches the devices associated with the user.
     * @returns {Promise<BlueAirDeviceDiscovery[]>} - A list of devices.
     * @throws {Error} - If the client is not initialized or the fetch operation fails.
     */
    getDevices(): Promise<BlueAirDeviceDiscovery[]>;
    /**
     * Fetches the status of the specified devices.
     * @param accountuuid - the main account uuid
     * @param uuids - An array of device names.
     * @returns {Promise<BlueAirDeviceStatus[]>} - The status of the devices.
     * @throws {Error} - If the fetch operation fails.
     */
    getDeviceStatus(accountuuid: string, uuids: string[]): Promise<BlueAirDeviceStatus[]>;
    /**
     * Makes an API call with retry functionality.
     * @param url - The URL to call.
     * @param data - The data to send with the request.
     * @param method - The HTTP method to use.
     * @param headers - Additional headers to send with the request.
     * @param retries - Number of retries in case of failure.
     * @returns {Promise<any>} - The response data.
     */
    private apiCall;
}
export {};
