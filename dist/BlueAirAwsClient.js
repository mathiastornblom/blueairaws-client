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
     * @param region - The region for the API.
     */
    constructor(username, password, region) {
        var _a;
        // Authentication token fetched during initialization.
        this._authToken = null;
        // The API endpoint determined after initialization.
        this._endpoint = null;
        console.debug("Initializing BlueAirAwsClient with region:", region);
        console.debug("RegionMap:", Consts_1.RegionMap);
        const regionCode = Consts_1.RegionMap[region];
        const config = (_a = Consts_1.BLUEAIR_CONFIG[regionCode]) === null || _a === void 0 ? void 0 : _a.awsConfig;
        if (!config) {
            throw new Error(`No config found for region: ${region}`);
        }
        this.blueAirApiUrl = `https://${config.restApiId}.execute-api.${config.awsRegion}.amazonaws.com/prod/c`;
        this.mutex = new async_mutex_1.Mutex();
        this.gigyaApi = new GigyaApi_1.default(username, password, region);
        this.last_login = 0;
        this._authToken = "";
    }
    // Getter for the authToken property.
    get authToken() {
        return this._authToken;
    }
    /**
     * Initializes the client by determining the API endpoint and fetching the authentication token.
     * @returns {Promise<boolean>} True if initialization was successful, false otherwise.
     */
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.debug("Initializing client...");
                yield this.login();
                console.debug("Client initialized");
                return true;
            }
            catch (error) {
                console.error("Error during initialization:", error);
                return false;
            }
        });
    }
    /**
     * Logs in and sets the authentication token.
     */
    login() {
        return __awaiter(this, void 0, void 0, function* () {
            console.debug("Logging in...");
            const { token, secret } = yield this.gigyaApi.getGigyaSession();
            const { jwt } = yield this.gigyaApi.getGigyaJWT(token, secret);
            const { accessToken } = yield this.getAwsAccessToken(jwt);
            this.last_login = Date.now();
            this._authToken = accessToken;
            console.debug("Logged in");
        });
    }
    /**
     * Checks if the token is expired and renews it if necessary.
     */
    checkTokenExpiration() {
        return __awaiter(this, void 0, void 0, function* () {
            if (Consts_1.LOGIN_EXPIRATION < Date.now() - this.last_login) {
                console.debug("Token expired, logging in again");
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
            console.debug("Getting AWS access token...");
            const response = yield this.apiCall("/login", undefined, "POST", {
                Authorization: `Bearer ${jwt}`,
                idtoken: jwt, // Make sure jwt is not null or undefined
            });
            if (!response.access_token) {
                throw new Error(`AWS access token error: ${JSON.stringify(response)}`);
            }
            console.debug("AWS access token received");
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
            console.debug("Getting devices...");
            const response = yield this.apiCall("/registered-devices", undefined, "GET");
            if (!response.devices) {
                throw new Error("getDevices error: no devices in response");
            }
            const devices = response.devices;
            console.debug("Devices fetched:", devices);
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
            const deviceStatuses = yield Promise.all(uuids.map((uuid) => __awaiter(this, void 0, void 0, function* () {
                const body = {
                    deviceconfigquery: uuids.map((uuid) => ({
                        id: uuid,
                        r: { r: ["sensors"] },
                    })),
                    includestates: true,
                    eventsubscription: {
                        include: uuids.map((uuid) => ({ filter: { o: `= ${uuid}` } })),
                    },
                };
                const data = yield this.apiCall(`/${accountuuid}/r/initial`, body);
                // Debugging: log the returned data
                console.debug(`Response data for UUID ${uuid}:`, JSON.stringify(data, null, 2));
                if (!data.deviceInfo) {
                    throw new Error(`getDeviceStatus error: no deviceInfo in response for ${uuid}`);
                }
                const deviceInfo = data.deviceInfo[0]; // Assuming only one device info is returned per request
                return {
                    id: deviceInfo.id,
                    name: deviceInfo.configuration.di.name,
                    sensorData: deviceInfo.sensordata.reduce((acc, sensor) => {
                        const key = Consts_1.BlueAirDeviceSensorDataMap[sensor.n];
                        if (key) {
                            acc[key] = sensor.v;
                        }
                        return acc;
                    }, {}),
                    state: deviceInfo.states.reduce((acc, state) => {
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
                };
            })));
            return deviceStatuses;
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
        return __awaiter(this, arguments, void 0, function* (url, data, method = "POST", headers, retries = 3) {
            const release = yield this.mutex.acquire();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), Consts_1.BLUEAIR_API_TIMEOUT);
            try {
                console.debug("API Call - Request:", {
                    url: `${this.blueAirApiUrl}${url}`,
                    method: method,
                    headers: Object.assign({ Accept: "*/*", Connection: "keep-alive", "Accept-Encoding": "gzip, deflate, br", Authorization: `Bearer ${this._authToken}`, idtoken: this._authToken || "" }, headers),
                    body: data,
                });
                const response = yield fetch(`${this.blueAirApiUrl}${url}`, {
                    method: method,
                    headers: Object.assign({ Accept: "*/*", ContentType: "application/json", UserAgent: "Blueair/58 CFNetwork/1327.0.4 Darwin/21.2.0", Connection: "keep-alive", "Accept-Encoding": "gzip, deflate, br", Authorization: `Bearer ${this._authToken}`, idtoken: this._authToken || "" }, headers),
                    body: JSON.stringify(data),
                    signal: controller.signal,
                });
                const json = yield response.json();
                console.debug("API Call - Response:", {
                    status: response.status,
                    statusText: response.statusText,
                    body: json,
                });
                if (response.status !== 200) {
                    throw new Error(`API call error with status ${response.status}: ${response.statusText}, ${JSON.stringify(json)}`);
                }
                return json;
            }
            catch (error) {
                console.error("API Call - Error:", {
                    url: `${this.blueAirApiUrl}${url}`,
                    method: method,
                    headers: Object.assign({ Accept: "*/*", Connection: "keep-alive", "Accept-Encoding": "gzip, deflate, br", Authorization: `Bearer ${this._authToken}`, idtoken: this._authToken || "" }, headers),
                    body: data,
                    error: error,
                });
                if (retries > 0) {
                    return this.apiCall(url, data, method, headers, retries - 1);
                }
                else {
                    if (error instanceof Error && error.name === "AbortError") {
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
}
exports.BlueAirAwsClient = BlueAirAwsClient;
