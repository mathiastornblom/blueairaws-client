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
            //console.debug('Initializing client...');
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
                // Access AWS_CONFIG using the awsRegion string that corresponds to the region code
                const config = Object.values(Consts_1.AWS_CONFIG).find((config) => config.regionCode === regionCode);
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
            console.debug(`Determining endpoint with URL: ${url}`);
            return this.retry(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    const response = yield axios_1.default.get(url, {
                        headers: {
                            'Authorization': `Basic ${this.base64Credentials}`,
                            'X-API-KEY-TOKEN': this.API_KEY_TOKEN,
                        },
                    });
                    const endpoint = response.data; // Example: "api-us-east-1.blueair.io"
                    console.debug(`Determined endpoint: ${endpoint}`);
                    const awsRegion = this.extractAwsRegion(endpoint);
                    console.debug(`Extracted AWS region: ${awsRegion}`);
                    const region = this.mapAwsRegionToRegion(awsRegion);
                    console.debug(`Mapped AWS region: ${awsRegion} to Region: ${region}`);
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
     * @returns {Region} - The mapped Region enum.
     * @throws {Error} - If the region cannot be mapped.
     */
    mapAwsRegionToRegion(awsRegion) {
        var _a;
        console.debug(`Mapping AWS region: ${awsRegion}`);
        // Directly access the AWS_CONFIG using the awsRegion as a key
        const regionEntry = Consts_1.AWS_CONFIG[awsRegion];
        console.debug(`Region entry found: ${JSON.stringify(regionEntry)}`);
        // If no entry is found, throw an error
        if (!regionEntry) {
            throw new Error(`No region mapping found for AWS region: ${awsRegion}`);
        }
        // Use the regionCode to map to the Region enum
        const regionCode = regionEntry.regionCode; // Directly access the regionCode field
        // Map the regionCode to the corresponding Region enum
        const regionKey = (_a = Object.entries(Consts_1.RegionMap).find(([regionEnum, code]) => code === regionCode)) === null || _a === void 0 ? void 0 : _a[0];
        console.debug(`Mapped region key: ${regionKey}`);
        // If no internal region key is found, throw an error
        if (!regionKey) {
            throw new Error(`Unable to map AWS region to Region enum: ${awsRegion}`);
        }
        // Return the mapped Region enum value
        return Consts_1.Region[regionKey];
    }
    // Getter for the authToken property.
    get authToken() {
        return this._authToken;
    }
    /**
     * Logs in and sets the authentication token.
     */
    login() {
        return __awaiter(this, void 0, void 0, function* () {
            console.debug('Logging in...');
            try {
                const { token, secret } = yield this.gigyaApi.getGigyaSession();
                console.debug('Gigya session token:', token, 'secret:', secret);
                const { jwt } = yield this.gigyaApi.getGigyaJWT(token, secret);
                console.debug('Gigya JWT:', jwt);
                const { accessToken } = yield this.getAwsAccessToken(jwt);
                console.debug('AWS access token:', accessToken);
                this.last_login = Date.now();
                this._authToken = accessToken;
                console.debug('Logged in successfully');
            }
            catch (error) {
                console.error('Error during login:', error);
                throw error; // Re-throw to handle it in the calling function
            }
        });
    }
    /**
     * Checks if the token is expired and renews it if necessary.
     * Skips expiration check if `last_login` is zero (meaning no login has occurred yet).
     */
    checkTokenExpiration() {
        return __awaiter(this, void 0, void 0, function* () {
            // If last_login is zero, it indicates that the user hasn't logged in yet.
            // Skip the token expiration check to avoid unnecessary login attempts.
            if (this.last_login === 0) {
                console.debug('No previous login found. Skipping expiration check.');
                return;
            }
            const currentTime = Date.now();
            const timeElapsedSinceLastLogin = currentTime - this.last_login;
            console.debug('Checking token expiration...');
            console.debug('Current time:', new Date(currentTime).toISOString());
            console.debug('Last login time:', new Date(this.last_login).toISOString());
            console.debug('Time elapsed since last login (ms):', timeElapsedSinceLastLogin);
            console.debug('Configured token expiration (ms):', Consts_1.LOGIN_EXPIRATION);
            // If the time elapsed exceeds the configured expiration, renew the token.
            if (timeElapsedSinceLastLogin > Consts_1.LOGIN_EXPIRATION) {
                console.debug('Token has expired, attempting to log in again...');
                yield this.login();
                console.debug('Token renewed successfully.');
            }
            else {
                console.debug('Token is still valid, no action needed.');
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
            console.debug('Starting to get AWS access token...');
            // Log JWT details (partially, to avoid exposing sensitive data)
            console.debug('JWT provided (first 50 chars):', jwt.substring(0, 50));
            try {
                // Debug the headers used in the API call
                const headers = {
                    Authorization: `Bearer ${jwt}`,
                    idtoken: jwt, // Ensure jwt is not null or undefined
                };
                console.debug('Making API call to AWS /login with headers:', headers);
                // Make the API call
                const response = yield this.apiCall('/login', undefined, 'POST', headers);
                // Log the raw response for analysis
                console.debug('AWS access token response:', JSON.stringify(response, null, 2));
                // Check for the presence of the access_token
                if (!response.access_token) {
                    console.error('AWS access token missing in response:', response);
                    throw new Error(`AWS access token error: ${JSON.stringify(response)}`);
                }
                // Successfully retrieved token
                console.debug('AWS access token received:', response.access_token);
                return { accessToken: response.access_token };
            }
            catch (error) {
                // Handle and log errors
                console.error('Error while fetching AWS access token:', error);
                if (error instanceof Error && error.message.includes('403')) {
                    console.error('Potential authentication error. Please check the JWT.');
                }
                else if (error instanceof Error && error.message.includes('timeout')) {
                    console.error('Timeout occurred during AWS access token retrieval.');
                }
                throw error; // Re-throw the error for upstream handling
            }
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
            // Newer devices (e.g. Blue Pure 311i Max) return an empty `sensordata`
            // array from /r/initial; their readings are only available via telemetry.
            for (const status of deviceStatuses) {
                if (Object.keys(status.sensorData).length > 0)
                    continue;
                try {
                    status.sensorData = yield this.getLatestSensorData(accountuuid, status.id);
                }
                catch (error) {
                    console.warn(`getDeviceStatus: telemetry fallback failed for ${status.id}:`, error instanceof Error ? error.message : String(error));
                }
            }
            return deviceStatuses;
        });
    }
    /**
     * Fetches the most recent sensor sample for a device from the telemetry
     * endpoint (5-minute resolution).
     * @param accountuuid - the main account uuid
     * @param uuid - The unique identifier of the device.
     * @param lookbackMs - How far back to search for a sample (default 1 h).
     */
    getLatestSensorData(accountuuid_1, uuid_1) {
        return __awaiter(this, arguments, void 0, function* (accountuuid, uuid, lookbackMs = 60 * 60 * 1000) {
            var _a, _b;
            const now = Math.floor(Date.now() / 1000);
            const params = new URLSearchParams({
                did: uuid,
                from: String(now - Math.floor(lookbackMs / 1000)),
                to: String(now),
            });
            for (const s of Object.keys(Consts_1.BlueAirDeviceSensorDataMap)) {
                params.append('s', s);
            }
            // Response shape: [{ sensors: [...names], datapoints: [[ts, v1, v2, ...], ...] }]
            // where every element, including the timestamp, is a string or null.
            const data = yield this.apiCall(`/${accountuuid}/r/telemetry/5m/historical?${params}`, undefined, 'GET');
            const series = Array.isArray(data) ? data[0] : undefined;
            if (!((_a = series === null || series === void 0 ? void 0 : series.sensors) === null || _a === void 0 ? void 0 : _a.length) || !((_b = series.datapoints) === null || _b === void 0 ? void 0 : _b.length)) {
                return {};
            }
            const latest = series.datapoints.reduce((a, b) => { var _a, _b; return Number((_a = b[0]) !== null && _a !== void 0 ? _a : 0) > Number((_b = a[0]) !== null && _b !== void 0 ? _b : 0) ? b : a; });
            return series.sensors.reduce((acc, sensorName, idx) => {
                const key = Consts_1.BlueAirDeviceSensorDataMap[sensorName];
                const value = latest[idx + 1];
                if (key && value !== null && value !== undefined && value !== '') {
                    acc[key] = Number(value);
                }
                return acc;
            }, {});
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
        return __awaiter(this, arguments, void 0, function* (url, data, method = 'POST', headers, retries = 5) {
            const release = yield this.mutex.acquire();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), Consts_1.BLUEAIR_API_TIMEOUT);
            yield this.checkTokenExpiration();
            try {
                const response = yield (0, axios_1.default)({
                    url: `${this.blueAirApiUrl}${url}`,
                    method,
                    headers: Object.assign({ 'Accept': '*/*', 'Connection': 'keep-alive', 'Accept-Encoding': 'gzip, deflate, br', 'Authorization': `Bearer ${this._authToken}` }, headers),
                    data,
                    signal: controller.signal,
                    timeout: Consts_1.BLUEAIR_API_TIMEOUT,
                });
                console.debug('API Call - Response:', {
                    status: response.status,
                    body: response.data,
                    headers: response.headers,
                });
                // Check for custom status code 229
                if (response.status === 229) {
                    const backoff = Math.min(1000 * Math.pow(2, 3 - retries), 60000); // Exponential backoff capped at 60 seconds
                    const jitter = Math.random() * 500; // Add jitter to backoff time
                    const retryDelay = backoff + jitter;
                    console.warn(`Custom status 229 detected. Retrying in ${retryDelay / 1000}s...`);
                    yield new Promise((res) => setTimeout(res, retryDelay));
                    if (retries > 0) {
                        return this.apiCall(url, data, method, headers, retries - 1);
                    }
                    else {
                        throw new Error('Exceeded retries for status 229.');
                    }
                }
                return response.data;
            }
            catch (error) {
                if (axios_1.default.isAxiosError(error) && error.response) {
                    const status = error.response.status;
                    if (status === 429) {
                        // Handle rate-limiting with exponential backoff
                        const backoff = Math.min(1000 * Math.pow(2, 3 - retries), 60000); // Exponential backoff capped at 60 seconds
                        const jitter = Math.random() * 500; // Add jitter to backoff time
                        const retryDelay = backoff + jitter;
                        console.warn(`Rate limit exceeded (status ${status}). Retrying in ${retryDelay / 1000}s...`);
                        yield new Promise((res) => setTimeout(res, retryDelay));
                        if (retries > 0) {
                            return this.apiCall(url, data, method, headers, retries - 1);
                        }
                        else {
                            throw new Error('Exceeded retries for status 429.');
                        }
                    }
                    else if (status === 401 || status === 403) {
                        console.error(`Authentication error (status ${status}). Details:`, error.response.data);
                        throw new Error(`Authentication failed: ${error.response.data.message}`);
                    }
                    else {
                        console.error(`API error (status ${status}). Details:`, error.response.data);
                        throw new Error(`API error with status ${status}: ${JSON.stringify(error.response.data)}`);
                    }
                }
                else {
                    // Log only the message: the full axios error contains the request
                    // headers, including the Bearer token.
                    console.error('Unexpected error during API call:', error instanceof Error ? error.message : String(error));
                }
                if (retries > 0) {
                    console.debug(`Retrying API call (${retries - 1} retries left)...`);
                    return this.apiCall(url, data, method, headers, retries - 1);
                }
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`API call failed after retries: ${errorMessage}`);
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
     * @param retries - The number of times to retry the operation. Default is 5.
     * @param delay - The delay in milliseconds between each retry attempt. Default is 10000ms (10 second).
     * @returns A Promise that resolves with the result of the function fn if it eventually succeeds,
     * or rejects with an error if all retry attempts fail.
     */
    retry(fn_1) {
        return __awaiter(this, arguments, void 0, function* (fn, retries = 5, baseDelay = 1000) {
            var _a;
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    return yield fn();
                }
                catch (error) {
                    if (attempt >= retries) {
                        console.error('All retry attempts failed.');
                        throw error; // Re-throw the error after exhausting retries
                    }
                    // If rate limiting error is detected
                    if (axios_1.default.isAxiosError(error) && ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 429) {
                        console.warn(`Rate limit exceeded on attempt ${attempt}. Retrying with backoff...`);
                    }
                    else {
                        console.error(`Retry attempt ${attempt} failed with error:`, error);
                    }
                    // Apply exponential backoff with jitter
                    const delay = Math.random() * baseDelay * Math.pow(2, attempt);
                    console.debug(`Retrying in ${Math.round(delay)}ms...`);
                    yield new Promise((res) => setTimeout(res, delay));
                }
            }
            // Fallback for TypeScript type safety
            throw new Error('This code path should not be reached.');
        });
    }
}
exports.BlueAirAwsClient = BlueAirAwsClient;
