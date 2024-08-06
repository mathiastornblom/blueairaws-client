"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlueAirAwsClient = void 0;
const async_mutex_1 = require("async-mutex");
const axios_1 = __importDefault(require("axios"));
const Consts_1 = require("./Consts");
const GigyaApi_1 = __importDefault(require("./GigyaApi"));
/**
 * BlueAirAwsClient Class:
 * A client for handling requests to the BlueAir API.
 * It manages authentication, determines the right endpoint, and provides methods to fetch device data.
 */
class BlueAirAwsClient {
    /**
     * Constructor to set up the client with necessary credentials.
     * @param username - The user's email or username.
     * @param password - The user's password.
     */
    constructor(username, password) {
        // Authentication token fetched during initialization.
        this._authToken = null;
        // Timestamp for last login
        this.last_login = 0;
        // Constant API key token, required for authenticating with the API.
        this.API_KEY_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJncmFudGVlIjoiYmx1ZWFpciIsImlhdCI6MTQ1MzEyNTYzMiwidmFsaWRpdHkiOi0xLCJqdGkiOiJkNmY3OGE0Yi1iMWNkLTRkZDgtOTA2Yi1kN2JkNzM0MTQ2NzQiLCJwZXJtaXNzaW9ucyI6WyJhbGwiXSwicXVvdGEiOi0xLCJyYXRlTGltaXQiOi0xfQ.CJsfWVzFKKDDA6rWdh-hjVVVE9S3d6Hu9BzXG9htWFw';
        // Endpoint to determine the home host. You will need to replace this with your actual endpoint.
        this.HOMEHOST_ENDPOINT = 'https://api.blueair.io/v2/';
        console.debug('Initializing BlueAirAwsClient');
        this.username = username;
        this.password = password;
        this.base64Credentials = btoa(`${this.username}:${this.password}`);
        this.mutex = new async_mutex_1.Mutex();
    }
    /**
     * Initializes the client by determining the API endpoint, region, and setting up the Gigya API.
     * @returns {Promise<boolean>} True if initialization was successful, false otherwise.
     */
    initialize(region) {
        return __awaiter(this, void 0, void 0, function* () {
            console.debug('Initializing client...');
            try {
                // Determine the region if not provided
                if (!region) {
                    console.debug('No region provided, determining from endpoint...');
                    region = yield this.determineEndpoint();
                }
                console.debug('RegionMap:', Consts_1.RegionMap);
                // Ensure that region is defined after determination
                if (!region) {
                    throw new Error('Unable to determine region, and no region provided');
                }
                const regionCode = Consts_1.RegionMap[region];
                if (!regionCode) {
                    throw new Error(`Invalid region code for region: ${region}`);
                }
                const config = Consts_1.AWS_CONFIG[regionCode];
                if (!config) {
                    throw new Error(`No config found for region: ${region}`);
                }
                this.blueAirApiUrl = `https://${config.restApiId}.execute-api.${config.awsRegion}.amazonaws.com/prod/c`;
                this.gigyaApi = new GigyaApi_1.default(this.username, this.password, region);
                yield this.login();
                console.debug('Client initialized successfully');
                return true;
            }
            catch (error) {
                console.error('Error during initialization:', error);
                return false;
            }
        });
    }
    /**
     * Determines the appropriate endpoint (home host) for the API and resolves the region.
     * @returns {Promise<Region>} - The determined API region.
     * @throws {Error} - If the fetch operation fails or region is not found.
     */
    determineEndpoint() {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.HOMEHOST_ENDPOINT}user/${encodeURIComponent(this.username)}/homehost/`;
            console.log(`Determining endpoint with URL: ${url}`);
            return this.retry(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    const response = yield axios_1.default.get(url, {
                        headers: {
                            Authorization: `Basic ${this.base64Credentials}`,
                            'X-API-KEY-TOKEN': this.API_KEY_TOKEN,
                        },
                    });
                    const endpoint = response.data; // Example: "api-eu-west-1.blueair.io"
                    console.log(`Determined endpoint: ${endpoint}`);
                    const awsRegion = this.extractAwsRegion(endpoint);
                    const region = this.mapAwsRegionToRegion(awsRegion);
                    console.log(`Mapped AWS region: ${awsRegion} to Region: ${region}`);
                    return region;
                }
                catch (error) {
                    if (axios_1.default.isAxiosError(error)) {
                        console.error('Failed to determine endpoint', error);
                        throw new Error(`Failed to determine endpoint. Message: ${error.message}`);
                    }
                    else {
                        console.error('An unexpected error occurred', error);
                        throw new Error('An unexpected error occurred');
                    }
                }
            }));
        });
    }
    /**
     * Extracts the AWS region from the endpoint string.
     * @param endpoint - The endpoint URL.
     * @returns {string} - The extracted AWS region or two-letter fallback.
     */
    extractAwsRegion(endpoint) {
        // Regex to match the region part from the endpoint, e.g., "eu-west-1"
        const match = endpoint.match(/api-([a-z0-9\-]+)\.blueair\.io/i);
        if (!match || !match[1]) {
            console.warn(`Unable to extract AWS region from endpoint: ${endpoint}. Attempting fallback.`);
            return ''; // Empty string to indicate failure
        }
        return match[1]; // Return the matched AWS region
    }
    /**
     * Maps the extracted AWS region to the Region enum.
     * @param awsRegion - The extracted AWS region.
     * @returns {Region} - The mapped Region enum or uses the two-letter fallback if mapping fails.
     */
    mapAwsRegionToRegion(awsRegion) {
        var _a, _b;
        const regionEntry = Object.entries(Consts_1.AWS_CONFIG).find(([key, value]) => value.awsRegion === awsRegion);
        if (regionEntry) {
            // If exact match found
            const regionKey = (_a = Object.entries(Consts_1.RegionMap).find(([_, value]) => value === regionEntry[0])) === null || _a === void 0 ? void 0 : _a[0];
            if (regionKey) {
                return Consts_1.Region[regionKey];
            }
        }
        // If no exact match, use the first two letters as a fallback
        const fallbackPrefix = awsRegion.slice(0, 2).toLowerCase();
        const fallbackRegionKey = (_b = Object.entries(Consts_1.RegionMap).find(([_, value]) => value.startsWith(fallbackPrefix))) === null || _b === void 0 ? void 0 : _b[0];
        if (fallbackRegionKey) {
            console.warn(`Using fallback region based on prefix: ${fallbackPrefix}`);
            return Consts_1.Region[fallbackRegionKey];
        }
        // Final fallback to EU if no match found
        console.warn(`Unable to map AWS region: ${awsRegion}. Falling back to EU.`);
        return Consts_1.Region.EU;
    }
    /**
     * Logs in and sets the authentication token.
     */
    login() {
        return __awaiter(this, void 0, void 0, function* () {
            console.debug('Logging in...');
            const { token, secret } = yield this.gigyaApi.getGigyaSession();
            const { jwt } = yield this.gigyaApi.getGigyaJWT(token, secret);
            const { accessToken } = yield this.getAwsAccessToken(jwt);
            this.last_login = Date.now();
            this._authToken = accessToken;
            console.debug('Logged in');
        });
    }
    /**
     * Checks if the token is expired and renews it if necessary.
     */
    checkTokenExpiration() {
        return __awaiter(this, void 0, void 0, function* () {
            if (Consts_1.LOGIN_EXPIRATION < Date.now() - this.last_login) {
                console.debug('Token expired, logging in again');
                yield this.login();
            }
        });
    }
    /**
     * Fetches the AWS access token using the JWT.
     * @param jwt - The JWT token.
     * @returns {Promise<{ accessToken: string }>} - The AWS access token.
     */
    getAwsAccessToken(jwt) {
        return __awaiter(this, void 0, void 0, function* () {
            console.debug('Getting AWS access token...');
            const response = yield this.apiCall('/login', undefined, 'POST', {
                Authorization: `Bearer ${jwt}`,
                idtoken: jwt, // Make sure jwt is not null or undefined
            });
            if (!response.access_token) {
                throw new Error(`AWS access token error: ${JSON.stringify(response)}`);
            }
            console.debug('AWS access token received');
            return {
                accessToken: response.access_token,
            };
        });
    }
    /**
     * Fetches the devices associated with the user.
     * @returns {Promise<BlueAirDeviceDiscovery[]>} - A list of devices.
     * @throws {Error} - If the client is not initialized or the fetch operation fails.
     */
    getDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.checkTokenExpiration();
            console.debug('Getting devices...');
            const response = yield this.apiCall('/registered-devices', undefined, 'GET');
            if (!response.devices) {
                throw new Error('getDevices error: no devices in response');
            }
            const devices = response.devices;
            console.debug('Devices fetched:', devices);
            return devices;
        });
    }
    /**
     * Fetches the status of the specified devices.
     * @param accountuuid - the main account uuid
     * @param uuids - An array of device names.
     * @returns {Promise<BlueAirDeviceStatus[]>} - The status of the devices.
     * @throws {Error} - If the fetch operation fails.
     */
    getDeviceStatus(accountuuid, uuids) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.checkTokenExpiration();
            const body = {
                deviceconfigquery: uuids.map((uuid) => ({
                    id: uuid,
                    r: { r: ['sensors'] },
                })),
                includestates: true,
                eventsubscription: {
                    include: uuids.map((uuid) => ({ filter: { o: `= ${uuid}` } })),
                },
            };
            const data = yield this.apiCall(`/${accountuuid}/r/initial`, body);
            // Debugging: log the returned data
            console.debug(`Response data for UUIDs ${JSON.stringify(uuids)}:`, JSON.stringify(data, null, 2));
            if (!data.deviceInfo) {
                throw new Error(`getDeviceStatus error: no deviceInfo in response`);
            }
            const deviceStatuses = data.deviceInfo.map((device) => ({
                id: device.id,
                name: device.configuration.di.name,
                model: device.configuration._it,
                mac: device.configuration.di.cma,
                sku: device.configuration.di.sku,
                mcu: device.configuration.di.mfv,
                serial: device.configuration.di.ds,
                wifi: device.configuration.di.ofv,
                sensorData: device.sensordata.reduce((acc, sensor) => {
                    const key = Consts_1.BlueAirDeviceSensorDataMap[sensor.n];
                    if (key) {
                        acc[key] = sensor.v;
                    }
                    return acc;
                }, {}),
                state: device.states.reduce((acc, state) => {
                    if (state.v !== undefined) {
                        acc[state.n] = state.v;
                    }
                    else if (state.vb !== undefined) {
                        acc[state.n] = state.vb;
                    }
                    else {
                        console.debug(`getDeviceStatus: unknown state ${JSON.stringify(state)}`);
                    }
                    return acc;
                }, {}),
            }));
            return deviceStatuses;
        });
    }
    /**
     * Sets the status of a specified device.
     * @param uuid - The unique identifier of the device.
     * @param state - The state property to be updated.
     * @param value - The new value to set for the specified state property. Can be a number or a boolean.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} - If the value type is neither number nor boolean, or if the API call fails.
     */
    setDeviceStatus(uuid, state, value) {
        return __awaiter(this, void 0, void 0, function* () {
            // Ensure the authentication token is valid and not expired.
            yield this.checkTokenExpiration();
            // Log the parameters for debugging purposes.
            console.debug(`setDeviceStatus: ${uuid} ${state} ${value}`);
            // Create the request body for setting the device status.
            const body = {
                n: state, // The name of the state property to be updated.
            };
            // Set the appropriate value in the request body based on the type of the value.
            if (typeof value === 'number') {
                body.v = value; // Set the value as a number.
            }
            else if (typeof value === 'boolean') {
                body.vb = value; // Set the value as a boolean.
            }
            else {
                // Throw an error if the value type is neither number nor boolean.
                throw new Error(`setDeviceStatus: unknown value type ${typeof value}`);
            }
            // Make the API call to set the device status.
            const response = yield this.apiCall(`/${uuid}/a/${state}`, body);
            // Log the API response for debugging purposes.
            console.debug(`setDeviceStatus response: ${JSON.stringify(response)}`);
        });
    }
    /**
     * Sets the fan to automatic mode for a specific device.
     *
     * @param {string} uuid - The unique identifier of the device.
     * @param {boolean} value - The value to set for the fan's automatic mode. Acceptable values are true or false.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} - Throws an error if the arguments are missing or invalid.
     */
    setFanAuto(uuid, value) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate
            if (typeof uuid !== 'string' || uuid.trim() === '') {
                throw new Error('Invalid or missing UUID');
            }
            // Validate value
            if (typeof value !== 'boolean') {
                throw new Error('Invalid fan speed value. Acceptable values are true or false');
            }
            // Check token expiration
            yield this.checkTokenExpiration();
            // Set device status
            yield this.setDeviceStatus(uuid, 'automode', value);
        });
    }
    /**
     * Sets the fan speed for a specific device.
     *
     * @param {string} uuid - The unique identifier of the device.
     * @param {number} value - The value to set for the fan's speed. Acceptable values are between 0 and 100.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} Throws an error if the arguments are missing or invalid.
     */
    setFanSpeed(uuid, value) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate UUID
            if (typeof uuid !== 'string' || uuid.trim() === '') {
                throw new Error('Invalid or missing UUID');
            }
            // Validate value
            if (typeof value !== 'number' || isNaN(value)) {
                throw new Error('Fan speed value must be a numeric value.');
            }
            if (value < 0 || value > 100) {
                throw new Error('Invalid fan speed value. Acceptable values are between 0 and 100.');
            }
            // Check token expiration
            yield this.checkTokenExpiration();
            // Set device status
            yield this.setDeviceStatus(uuid, 'fanspeed', value);
        });
    }
    /**
     * Sets the brightness for a specific device.
     *
     * @param {string} uuid - The unique identifier of the device.
     * @param {number} value - The value to set for the brightness. Acceptable values are between 0 and 100.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} Throws an error if the arguments are missing or invalid.
     */
    setBrightness(uuid, value) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate UUID
            if (typeof uuid !== 'string' || uuid.trim() === '') {
                throw new Error('Invalid or missing UUID');
            }
            // Validate value
            if (typeof value !== 'number' || isNaN(value)) {
                throw new Error('Brightness value must be a numeric value.');
            }
            if (value < 0 || value > 100) {
                throw new Error('Invalid brightness value. Acceptable values are between 0 and 100.');
            }
            // Check token expiration
            yield this.checkTokenExpiration();
            // Set device status
            yield this.setDeviceStatus(uuid, 'brightness', value);
        });
    }
    /**
     * Sets the childlock for a specific device.
     *
     * @param {string} uuid - The unique identifier of the device.
     * @param {boolean} value - The value to set for the childlocks mode. Acceptable values are true or false.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} - Throws an error if the arguments are missing or invalid.
     */
    setChildLock(uuid, value) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate
            if (typeof uuid !== 'string' || uuid.trim() === '') {
                throw new Error('Invalid or missing UUID');
            }
            // Validate value
            if (typeof value !== 'boolean') {
                throw new Error('Invalid child lock value. Acceptable values are true or false');
            }
            // Check token expiration
            yield this.checkTokenExpiration();
            // Set device status
            yield this.setDeviceStatus(uuid, 'childlock', value);
        });
    }
    /**
     * Sets the night mode for a specific device.
     *
     * @param {string} uuid - The unique identifier of the device.
     * @param {boolean} value - The value to set for the night mode mode. Acceptable values are true or false.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} - Throws an error if the arguments are missing or invalid.
     */
    setNightMode(uuid, value) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate
            if (typeof uuid !== 'string' || uuid.trim() === '') {
                throw new Error('Invalid or missing UUID');
            }
            // Validate value
            if (typeof value !== 'boolean') {
                throw new Error('Invalid night mode value. Acceptable values are true or false');
            }
            // Check token expiration
            yield this.checkTokenExpiration();
            // Set device status
            yield this.setDeviceStatus(uuid, 'nightmode', value);
        });
    }
    /**
     * Sets the standby for a specific device.
     *
     * @param {string} uuid - The unique identifier of the device.
     * @param {boolean} value - The value to set for the standby mode. Acceptable values are true or false.
     * @returns {Promise<void>} - A promise that resolves when the operation is complete.
     * @throws {Error} - Throws an error if the arguments are missing or invalid.
     */
    setStandby(uuid, value) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate
            if (typeof uuid !== 'string' || uuid.trim() === '') {
                throw new Error('Invalid or missing UUID');
            }
            // Validate value
            if (typeof value !== 'boolean') {
                throw new Error('Invalid standby value. Acceptable values are true or false');
            }
            // Check token expiration
            yield this.checkTokenExpiration();
            // Set device status
            yield this.setDeviceStatus(uuid, 'standby', value);
        });
    }
    /**
     * Makes an API call with retry functionality.
     * @param url - The URL to call.
     * @param data - The data to send with the request.
     * @param method - The HTTP method to use.
     * @param headers - Additional headers to send with the request.
     * @param retries - Number of retries in case of failure.
     * @returns {Promise<any>} - The response data.
     */
    apiCall(url_1, data_1) {
        return __awaiter(this, arguments, void 0, function* (url, data, method = 'POST', headers, retries = 3) {
            const release = yield this.mutex.acquire();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), Consts_1.BLUEAIR_API_TIMEOUT);
            try {
                // console.debug('API Call - Request:', {
                //   url: `${this.blueAirApiUrl}${url}`,
                //   method: method,
                //   headers: {
                //     Accept: '*/*',
                //     Connection: 'keep-alive',
                //     'Accept-Encoding': 'gzip, deflate, br',
                //     Authorization: `Bearer ${this._authToken}`,
                //     idtoken: this._authToken || '', // Ensure idtoken is a string
                //     ...headers,
                //   },
                //   body: data,
                // });
                const axiosConfig = {
                    url: `${this.blueAirApiUrl}${url}`,
                    method: method,
                    headers: Object.assign({ Accept: '*/*', 'Content-Type': 'application/json', 'User-Agent': 'Blueair/58 CFNetwork/1327.0.4 Darwin/21.2.0', Connection: 'keep-alive', 'Accept-Encoding': 'gzip, deflate, br', Authorization: `Bearer ${this._authToken}`, idtoken: this._authToken || '' }, headers),
                    data: data,
                    signal: controller.signal,
                    timeout: Consts_1.BLUEAIR_API_TIMEOUT,
                };
                const response = yield (0, axios_1.default)(axiosConfig);
                // console.debug('API Call - Response:', {
                //   status: response.status,
                //   statusText: response.statusText,
                //   body: response.data,
                // });
                if (response.status !== 200) {
                    throw new Error(`API call error with status ${response.status}: ${response.statusText}, ${JSON.stringify(response.data)}`);
                }
                return response.data;
            }
            catch (error) {
                console.error('API Call - Error:', {
                    url: `${this.blueAirApiUrl}${url}`,
                    method: method,
                    headers: Object.assign({ Accept: '*/*', Connection: 'keep-alive', 'Accept-Encoding': 'gzip, deflate, br', Authorization: `Bearer ${this._authToken}`, idtoken: this._authToken || '' }, headers),
                    body: data,
                    error: error,
                });
                if (retries > 0) {
                    return this.apiCall(url, data, method, headers, retries - 1);
                }
                else {
                    if (axios_1.default.isCancel(error)) {
                        throw new Error(`API call failed after ${3 - retries} retries with timeout.`);
                    }
                    else {
                        throw new Error(`API call failed after ${3 - retries} retries with error: ${error}`);
                    }
                }
            }
            finally {
                clearTimeout(timeout);
                release();
            }
        });
    }
    /**
     * Retries an asynchronous operation a specified number of times with a delay between each attempt.
     * @param fn - A function that returns a Promise. This is the operation that will be retried upon failure.
     * @param retries - The number of times to retry the operation. Default is 3.
     * @param delay - The delay in milliseconds between each retry attempt. Default is 1000ms (1 second).
     * @returns A Promise that resolves with the result of the function fn if it eventually succeeds,
     * or rejects with an error if all retry attempts fail.
     */
    retry(fn_1) {
        return __awaiter(this, arguments, void 0, function* (fn, retries = 3, delay = 1000) {
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    return yield fn();
                }
                catch (error) {
                    if (attempt < retries) {
                        yield new Promise((res) => setTimeout(res, delay));
                    }
                    else {
                        throw error;
                    }
                }
            }
            throw new Error('Failed after multiple retries');
        });
    }
}
exports.BlueAirAwsClient = BlueAirAwsClient;
