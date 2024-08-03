import { Region, BlueAirDeviceStatus, BlueAirDeviceState } from './Consts';
/**
 * Represents a device structure. Add more properties as per your actual data.
 */
type BlueAirDeviceDiscovery = {
    mac: string;
    'mcu-firmware': string;
    name: string;
    type: string;
    'user-type': string;
    uuid: string;
    'wifi-firmware': string;
};
/**
 * BlueAirAwsClient Class:
 * A client for handling requests to the BlueAir API.
 * It manages authentication, determines the right endpoint, and provides methods to fetch device data.
 */
export declare class BlueAirAwsClient {
    private mutex;
    private _authToken;
    private gigyaApi;
    private last_login;
    private blueAirApiUrl;
    private readonly HOMEHOST_ENDPOINT;
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
     * Sets the status of a specified device.
     * @param uuid - The unique identifier of the device.
     * @param state - The state property to be updated.
     * @param value - The new value to set for the specified state property. Can be a number or a boolean.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} - If the value type is neither number nor boolean, or if the API call fails.
     */
    setDeviceStatus(uuid: string, state: keyof BlueAirDeviceState, value: number | boolean): Promise<void>;
    /**
     * Sets the fan to automatic mode for a specific device.
     *
     * @param {string} uuid - The unique identifier of the device.
     * @param {boolean} value - The value to set for the fan's automatic mode. Acceptable values are true or false.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} - Throws an error if the arguments are missing or invalid.
     */
    setFanAuto(uuid: string, value: boolean): Promise<void>;
    /**
     * Sets the fan speed for a specific device.
     *
     * @param {string} uuid - The unique identifier of the device.
     * @param {number} value - The value to set for the fan's speed. Acceptable values are between 0 and 100.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} Throws an error if the arguments are missing or invalid.
     */
    setFanSpeed(uuid: string, value: number): Promise<void>;
    /**
     * Sets the brightness for a specific device.
     *
     * @param {string} uuid - The unique identifier of the device.
     * @param {number} value - The value to set for the brightness. Acceptable values are between 0 and 100.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} Throws an error if the arguments are missing or invalid.
     */
    setBrightness(uuid: string, value: number): Promise<void>;
    /**
     * Sets the childlock for a specific device.
     *
     * @param {string} uuid - The unique identifier of the device.
     * @param {boolean} value - The value to set for the childlocks mode. Acceptable values are true or false.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} - Throws an error if the arguments are missing or invalid.
     */
    setChildLock(uuid: string, value: boolean): Promise<void>;
    /**
     * Sets the night mode for a specific device.
     *
     * @param {string} uuid - The unique identifier of the device.
     * @param {boolean} value - The value to set for the night mode mode. Acceptable values are true or false.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} - Throws an error if the arguments are missing or invalid.
     */
    setNightMode(uuid: string, value: boolean): Promise<void>;
    /**
     * Sets the standby for a specific device.
     *
     * @param {string} uuid - The unique identifier of the device.
     * @param {boolean} value - The value to set for the standby mode. Acceptable values are true or false.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} - Throws an error if the arguments are missing or invalid.
     */
    setStandby(uuid: string, value: boolean): Promise<void>;
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
