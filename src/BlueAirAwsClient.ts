import { Mutex } from "async-mutex";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import {
	BLUEAIR_CONFIG,
	LOGIN_EXPIRATION,
	BLUEAIR_API_TIMEOUT,
	RegionMap,
	Region,
	BlueAirDeviceStatus,
	BlueAirDeviceStatusResponse,
	BlueAirDeviceSensorData,
	BlueAirDeviceState,
	BlueAirDeviceSensorDataMap,
	BlueAirSetStateBody,
} from "./Consts";
import GigyaApi from "./GigyaApi";

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

/**
 * BlueAirAwsClient Class:
 * A client for handling requests to the BlueAir API.
 * It manages authentication, determines the right endpoint, and provides methods to fetch device data.
 */
export class BlueAirAwsClient {
	// Mutex for handling concurrent requests
	private mutex: Mutex;

	// Authentication token fetched during initialization.
	private _authToken: string | null = null;

	// Gigya API client for fetching the JWT token.
	private gigyaApi: GigyaApi;
	private last_login: number;

	// Base URL for the BlueAir API
	private blueAirApiUrl: string;

	// Endpoint to determine the home host. You will need to replace this with your actual endpoint.
	private readonly HOMEHOST_ENDPOINT: string = "https://api.blueair.io/v2/";

	/**
	 * Constructor to set up the client with necessary credentials.
	 * @param username - The user's email or username.
	 * @param password - The user's password.
	 * @param region - The region for the API.
	 */
	constructor(username: string, password: string, region: Region) {
		console.debug("Initializing BlueAirAwsClient with region:", region);
		console.debug("RegionMap:", RegionMap);
		const regionCode = RegionMap[region];
		const config = BLUEAIR_CONFIG[regionCode]?.awsConfig;
		if (!config) {
			throw new Error(`No config found for region: ${region}`);
		}
		this.blueAirApiUrl = `https://${config.restApiId}.execute-api.${config.awsRegion}.amazonaws.com/prod/c`;

		this.mutex = new Mutex();
		this.gigyaApi = new GigyaApi(username, password, region);
		this.last_login = 0;
		this._authToken = "";
	}

	// Getter for the authToken property.
	public get authToken(): string | null {
		return this._authToken;
	}

	/**
	 * Initializes the client by determining the API endpoint and fetching the authentication token.
	 * @returns {Promise<boolean>} True if initialization was successful, false otherwise.
	 */
	public async initialize(): Promise<boolean> {
		try {
			console.debug("Initializing client...");
			await this.login();
			console.debug("Client initialized");
			return true;
		} catch (error) {
			console.error("Error during initialization:", error);
			return false;
		}
	}

	/**
	 * Logs in and sets the authentication token.
	 */
	private async login(): Promise<void> {
		console.debug("Logging in...");

		const { token, secret } = await this.gigyaApi.getGigyaSession();
		const { jwt } = await this.gigyaApi.getGigyaJWT(token, secret);
		const { accessToken } = await this.getAwsAccessToken(jwt);

		this.last_login = Date.now();
		this._authToken = accessToken;

		console.debug("Logged in");
	}

	/**
	 * Checks if the token is expired and renews it if necessary.
	 */
	private async checkTokenExpiration(): Promise<void> {
		if (LOGIN_EXPIRATION < Date.now() - this.last_login) {
			console.debug("Token expired, logging in again");
			await this.login();
		}
	}

	/**
	 * Fetches the AWS access token using the JWT.
	 * @param jwt - The JWT token.
	 * @returns {Promise<{ accessToken: string }>} - The AWS access token.
	 */
	private async getAwsAccessToken(
		jwt: string
	): Promise<{ accessToken: string }> {
		console.debug("Getting AWS access token...");

		const response = await this.apiCall("/login", undefined, "POST", {
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
	}

	/**
	 * Fetches the devices associated with the user.
	 * @returns {Promise<BlueAirDeviceDiscovery[]>} - A list of devices.
	 * @throws {Error} - If the client is not initialized or the fetch operation fails.
	 */
	public async getDevices(): Promise<BlueAirDeviceDiscovery[]> {
		await this.checkTokenExpiration();

		console.debug("Getting devices...");

		const response = await this.apiCall(
			"/registered-devices",
			undefined,
			"GET"
		);

		if (!response.devices) {
			throw new Error("getDevices error: no devices in response");
		}

		const devices = response.devices as BlueAirDeviceDiscovery[];

		console.debug("Devices fetched:", devices);

		return devices;
	}

	/**
	 * Fetches the status of the specified devices.
	 * @param accountuuid - the main account uuid
	 * @param uuids - An array of device names.
	 * @returns {Promise<BlueAirDeviceStatus[]>} - The status of the devices.
	 * @throws {Error} - If the fetch operation fails.
	 */
	public async getDeviceStatus(
		accountuuid: string,
		uuids: string[]
	): Promise<BlueAirDeviceStatus[]> {
		await this.checkTokenExpiration();

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

		const data = await this.apiCall<BlueAirDeviceStatusResponse>(
			`/${accountuuid}/r/initial`,
			body
		);

		// Debugging: log the returned data
		console.debug(
			`Response data for UUIDs ${JSON.stringify(uuids)}:`,
			JSON.stringify(data, null, 2)
		);

		if (!data.deviceInfo) {
			throw new Error(`getDeviceStatus error: no deviceInfo in response`);
		}

		const deviceStatuses: BlueAirDeviceStatus[] = data.deviceInfo.map(
			(device) => ({
				id: device.id,
				name: device.configuration.di.name,
				model: device.configuration._it,
				sensorData: device.sensordata.reduce((acc, sensor) => {
					const key =
						BlueAirDeviceSensorDataMap[
							sensor.n as keyof typeof BlueAirDeviceSensorDataMap
						];
					if (key) {
						acc[key as keyof BlueAirDeviceSensorData] = sensor.v;
					}
					return acc;
				}, {} as BlueAirDeviceSensorData),
				state: device.states.reduce((acc, state) => {
					if (state.v !== undefined) {
						(acc as any)[state.n] = state.v;
					} else if (state.vb !== undefined) {
						(acc as any)[state.n] = state.vb;
					} else {
						console.debug(
							`getDeviceStatus: unknown state ${JSON.stringify(state)}`
						);
					}
					return acc;
				}, {} as BlueAirDeviceSensorData),
			})
		);

		return deviceStatuses;
	}

	/**
	 * Sets the status of a specified device.
	 * @param uuid - The unique identifier of the device.
	 * @param state - The state property to be updated.
	 * @param value - The new value to set for the specified state property. Can be a number or a boolean.
	 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
	 * @throws {Error} - If the value type is neither number nor boolean, or if the API call fails.
	 */
	public async setDeviceStatus(
		uuid: string,
		state: keyof BlueAirDeviceState,
		value: number | boolean
	): Promise<void> {
		// Ensure the authentication token is valid and not expired.
		await this.checkTokenExpiration();

		// Log the parameters for debugging purposes.
		console.debug(`setDeviceStatus: ${uuid} ${state} ${value}`);

		// Create the request body for setting the device status.
		const body: BlueAirSetStateBody = {
			n: state, // The name of the state property to be updated.
		};

		// Set the appropriate value in the request body based on the type of the value.
		if (typeof value === "number") {
			body.v = value; // Set the value as a number.
		} else if (typeof value === "boolean") {
			body.vb = value; // Set the value as a boolean.
		} else {
			// Throw an error if the value type is neither number nor boolean.
			throw new Error(`setDeviceStatus: unknown value type ${typeof value}`);
		}

		// Make the API call to set the device status.
		const response = await this.apiCall(`/${uuid}/a/${state}`, body);

		// Log the API response for debugging purposes.
		console.debug(`setDeviceStatus response: ${JSON.stringify(response)}`);
	}

	/**
	 * Sets the fan to automatic mode for a specific device.
	 *
	 * @param {string} uuid - The unique identifier of the device.
	 * @param {boolean} value - The value to set for the fan's automatic mode. Acceptable values are true or false.
	 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
	 * @throws {Error} - Throws an error if the arguments are missing or invalid.
	 */
	public async setFanAuto(uuid: string, value: boolean): Promise<void> {
		// Validate
		if (typeof uuid !== "string" || uuid.trim() === "") {
			throw new Error("Invalid or missing UUID");
		}

		// Validate value
		if (typeof value !== "boolean") {
			throw new Error(
				"Invalid fan speed value. Acceptable values are true or false"
			);
		}

		// Check token expiration
		await this.checkTokenExpiration();

		// Set device status
		await this.setDeviceStatus(uuid, "automode", value);
	}

	/**
	 * Sets the fan speed for a specific device.
	 *
	 * @param {string} uuid - The unique identifier of the device.
	 * @param {number} value - The value to set for the fan's speed. Acceptable values are 0, 1, 2, or 3.
	 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
	 * @throws {Error} Throws an error if the arguments are missing or invalid.
	 */
	public async setFanSpeed(uuid: string, value: number): Promise<void> {
		// Validate UUID
		if (typeof uuid !== "string" || uuid.trim() === "") {
			throw new Error("Invalid or missing UUID");
		}

		// Validate value
		if (typeof value !== "number" || isNaN(value)) {
			throw new Error("Fan speed value must be a numeric value.");
		}
		if (![0, 1, 2, 3].includes(value)) {
			throw new Error(
				"Invalid fan speed value. Acceptable values are 0, 1, 2, or 3."
			);
		}

		// Check token expiration
		await this.checkTokenExpiration();

		// Set device status
		await this.setDeviceStatus(uuid, "fanspeed", value);
	}

	/**
	 * Sets the brightness for a specific device.
	 *
	 * @param {string} uuid - The unique identifier of the device.
	 * @param {number} value - The value to set for the brightness. Acceptable values are 0, 1, 2, or 3.
	 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
	 * @throws {Error} Throws an error if the arguments are missing or invalid.
	 */
	public async setBrightness(uuid: string, value: number): Promise<void> {
		// Validate UUID
		if (typeof uuid !== "string" || uuid.trim() === "") {
			throw new Error("Invalid or missing UUID");
		}

		// Validate value
		if (typeof value !== "number" || isNaN(value)) {
			throw new Error("Fan speed value must be a numeric value.");
		}
		if (![0, 1, 2, 3, 4].includes(value)) {
			throw new Error(
				"Invalid fan speed value. Acceptable values are 0, 1, 2, 3 or 4."
			);
		}

		// Check token expiration
		await this.checkTokenExpiration();

		// Set device status
		await this.setDeviceStatus(uuid, "brightness", value);
	}

	/**
	 * Sets the childlock for a specific device.
	 *
	 * @param {string} uuid - The unique identifier of the device.
	 * @param {boolean} value - The value to set for the childlocks mode. Acceptable values are true or false.
	 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
	 * @throws {Error} - Throws an error if the arguments are missing or invalid.
	 */
	public async setChildLock(uuid: string, value: boolean): Promise<void> {
		// Validate
		if (typeof uuid !== "string" || uuid.trim() === "") {
			throw new Error("Invalid or missing UUID");
		}

		// Validate value
		if (typeof value !== "boolean") {
			throw new Error(
				"Invalid child lock value. Acceptable values are true or false"
			);
		}

		// Check token expiration
		await this.checkTokenExpiration();

		// Set device status
		await this.setDeviceStatus(uuid, "childlock", value);
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
	private async apiCall<T = any>(
		url: string,
		data?: string | object,
		method = "POST",
		headers?: object,
		retries = 3
	): Promise<T> {
		const release = await this.mutex.acquire();
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), BLUEAIR_API_TIMEOUT);
		try {
			console.debug("API Call - Request:", {
				url: `${this.blueAirApiUrl}${url}`,
				method: method,
				headers: {
					Accept: "*/*",
					Connection: "keep-alive",
					"Accept-Encoding": "gzip, deflate, br",
					Authorization: `Bearer ${this._authToken}`,
					idtoken: this._authToken || "", // Ensure idtoken is a string
					...headers,
				},
				body: data,
			});

			const axiosConfig: AxiosRequestConfig = {
				url: `${this.blueAirApiUrl}${url}`,
				method: method,
				headers: {
					Accept: "*/*",
					"Content-Type": "application/json",
					"User-Agent": "Blueair/58 CFNetwork/1327.0.4 Darwin/21.2.0",
					Connection: "keep-alive",
					"Accept-Encoding": "gzip, deflate, br",
					Authorization: `Bearer ${this._authToken}`,
					idtoken: this._authToken || "", // Ensure idtoken is a string
					...headers,
				},
				data: data,
				signal: controller.signal,
				timeout: BLUEAIR_API_TIMEOUT,
			};

			const response: AxiosResponse<T> = await axios(axiosConfig);

			console.debug("API Call - Response:", {
				status: response.status,
				statusText: response.statusText,
				body: response.data,
			});

			if (response.status !== 200) {
				throw new Error(
					`API call error with status ${response.status}: ${
						response.statusText
					}, ${JSON.stringify(response.data)}`
				);
			}
			return response.data;
		} catch (error) {
			console.error("API Call - Error:", {
				url: `${this.blueAirApiUrl}${url}`,
				method: method,
				headers: {
					Accept: "*/*",
					Connection: "keep-alive",
					"Accept-Encoding": "gzip, deflate, br",
					Authorization: `Bearer ${this._authToken}`,
					idtoken: this._authToken || "", // Ensure idtoken is a string
					...headers,
				},
				body: data,
				error: error,
			});

			if (retries > 0) {
				return this.apiCall(url, data, method, headers, retries - 1);
			} else {
				if (axios.isCancel(error)) {
					throw new Error(
						`API call failed after ${3 - retries} retries with timeout.`
					);
				} else {
					throw new Error(
						`API call failed after ${3 - retries} retries with error: ${error}`
					);
				}
			}
		} finally {
			clearTimeout(timeout);
			release();
		}
	}
}
