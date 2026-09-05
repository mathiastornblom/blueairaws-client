import { Mutex } from 'async-mutex';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  LOGIN_EXPIRATION,
  BLUEAIR_API_TIMEOUT,
  AWS_CONFIG,
  RegionMap,
  Region,
  BlueAirDeviceStatus,
  BlueAirDeviceStatusResponse,
  BlueAirDeviceSensorData,
  BlueAirDeviceState,
  BlueAirDeviceSensorDataMap,
  BlueAirSetStateBody,
} from './Consts';
import GigyaApi from './GigyaApi';

/**
 * Represents a device structure. Add more properties as per your actual data.
 */
type BlueAirDeviceDiscovery = {
  'mac': string;
  'mcu-firmware': string;
  'name': string;
  'type': string;
  'user-type': string;
  'uuid': string;
  'wifi-firmware': string;
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
  private gigyaApi!: GigyaApi;

  // Timestamp for last login
  private last_login: number = 0;

  // Base URL for the BlueAir API
  private blueAirApiUrl!: string;

  // Constant API key token, required for authenticating with the API.
  private readonly API_KEY_TOKEN: string =
    'eyJhbGciOiJIUzI1NiJ9.eyJncmFudGVlIjoiYmx1ZWFpciIsImlhdCI6MTQ1MzEyNTYzMiwidmFsaWRpdHkiOi0xLCJqdGkiOiJkNmY3OGE0Yi1iMWNkLTRkZDgtOTA2Yi1kN2JkNzM0MTQ2NzQiLCJwZXJtaXNzaW9ucyI6WyJhbGwiXSwicXVvdGEiOi0xLCJyYXRlTGltaXQiOi0xfQ.CJsfWVzFKKDDA6rWdh-hjVVVE9S3d6Hu9BzXG9htWFw';

  // Endpoint to determine the home host. You will need to replace this with your actual endpoint.
  private readonly HOMEHOST_ENDPOINT: string = 'https://api.blueair.io/v2/';

  // Base64 encoded credentials for Basic Authentication.
  private username: string;
  private password: string;
  private base64Credentials: string;

  /**
   * Constructor to set up the client with necessary credentials.
   * @param username - The user's email or username.
   * @param password - The user's password.
   */
  constructor(username: string, password: string) {
    console.debug('Initializing BlueAirAwsClient');

    this.username = username;
    this.password = password;
    this.base64Credentials = btoa(`${this.username}:${this.password}`);
    this.mutex = new Mutex();
  }

  /**
   * Initializes the client by determining the API endpoint, region, and setting up the Gigya API.
   * @returns {Promise<boolean>} True if initialization was successful, false otherwise.
   */
  public async initialize(region?: Region): Promise<boolean> {
    //console.debug('Initializing client...');

    try {
      // Determine the region if not provided
      if (!region) {
        console.debug('No region provided, determining from endpoint...');
        region = await this.determineEndpoint();
      }

      console.debug('RegionMap:', RegionMap);

      // Ensure that region is defined after determination
      if (!region) {
        throw new Error('Unable to determine region, and no region provided');
      }

      const regionCode = RegionMap[region];
      if (!regionCode) {
        throw new Error(`Invalid region code for region: ${region}`);
      }

      // Access AWS_CONFIG using the awsRegion string that corresponds to the region code
      const config = Object.values(AWS_CONFIG).find(
        (config) => config.regionCode === regionCode,
      );

      if (!config) {
        throw new Error(`No config found for region: ${region}`);
      }

      this.blueAirApiUrl = `https://${config.restApiId}.execute-api.${config.awsRegion}.amazonaws.com/prod/c`;
      this.gigyaApi = new GigyaApi(this.username, this.password, region);

      await this.login();
      console.debug('Client initialized successfully');
      return true;
    } catch (error) {
      console.error('Error during initialization:', error);
      return false;
    }
  }

  /**
   * Determines the appropriate endpoint (home host) for the API and resolves the region.
   * @returns {Promise<Region>} - The determined API region.
   * @throws {Error} - If the fetch operation fails or region is not found.
   */
  private async determineEndpoint(): Promise<Region> {
    const url = `${this.HOMEHOST_ENDPOINT}user/${encodeURIComponent(
      this.username,
    )}/homehost/`;
    console.debug(`Determining endpoint with URL: ${url}`);

    return this.retry(async () => {
      try {
        const response = await axios.get(url, {
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
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error('Failed to determine endpoint', error);
          throw new Error(
            `Failed to determine endpoint. Message: ${error.message}`,
          );
        } else {
          console.error('An unexpected error occurred', error);
          throw new Error('An unexpected error occurred');
        }
      }
    });
  }

  /**
   * Extracts the AWS region from the endpoint string.
   * @param endpoint - The endpoint URL.
   * @returns {string} - The extracted AWS region or two-letter fallback.
   */
  private extractAwsRegion(endpoint: string): string {
    // Regex to match the region part from the endpoint, e.g., "eu-west-1"
    const match = endpoint.match(/api-([a-z0-9\-]+)\.blueair\.io/i);

    if (!match || !match[1]) {
      console.warn(
        `Unable to extract AWS region from endpoint: ${endpoint}. Attempting fallback.`,
      );
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
  private mapAwsRegionToRegion(awsRegion: string): Region {
    console.debug(`Mapping AWS region: ${awsRegion}`);

    // Directly access the AWS_CONFIG using the awsRegion as a key
    const regionEntry = AWS_CONFIG[awsRegion];

    console.debug(`Region entry found: ${JSON.stringify(regionEntry)}`);

    // If no entry is found, throw an error
    if (!regionEntry) {
      throw new Error(`No region mapping found for AWS region: ${awsRegion}`);
    }

    // Use the regionCode to map to the Region enum
    const regionCode = regionEntry.regionCode; // Directly access the regionCode field

    // Map the regionCode to the corresponding Region enum
    const regionKey = Object.entries(RegionMap).find(
      ([regionEnum, code]) => code === regionCode,
    )?.[0];

    console.debug(`Mapped region key: ${regionKey}`);

    // If no internal region key is found, throw an error
    if (!regionKey) {
      throw new Error(`Unable to map AWS region to Region enum: ${awsRegion}`);
    }

    // Return the mapped Region enum value
    return Region[regionKey as keyof typeof Region];
  }

  // Getter for the authToken property.
  public get authToken(): string | null {
    return this._authToken;
  }

  /**
   * Logs in and sets the authentication token.
   */
  private async login(): Promise<void> {
    console.debug('Logging in...');

    try {
      const { token, secret } = await this.gigyaApi.getGigyaSession();
      console.debug('Gigya session token:', token, 'secret:', secret);

      const { jwt } = await this.gigyaApi.getGigyaJWT(token, secret);
      console.debug('Gigya JWT:', jwt);

      const { accessToken } = await this.getAwsAccessToken(jwt);
      console.debug('AWS access token:', accessToken);

      this.last_login = Date.now();
      this._authToken = accessToken;

      console.debug('Logged in successfully');
    } catch (error) {
      console.error('Error during login:', error);
      throw error; // Re-throw to handle it in the calling function
    }
  }

  /**
   * Checks if the token is expired and renews it if necessary.
   * Skips expiration check if `last_login` is zero (meaning no login has occurred yet).
   */
  private async checkTokenExpiration(): Promise<void> {
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
    console.debug(
      'Time elapsed since last login (ms):',
      timeElapsedSinceLastLogin,
    );
    console.debug('Configured token expiration (ms):', LOGIN_EXPIRATION);

    // If the time elapsed exceeds the configured expiration, renew the token.
    if (timeElapsedSinceLastLogin > LOGIN_EXPIRATION) {
      console.debug('Token has expired, attempting to log in again...');
      await this.login();
      console.debug('Token renewed successfully.');
    } else {
      console.debug('Token is still valid, no action needed.');
    }
  }

  /**
   * Fetches the AWS access token using the JWT.
   * @param jwt - The JWT token.
   * @returns {Promise<{ accessToken: string }>} - The AWS access token.
   */
  private async getAwsAccessToken(
    jwt: string,
  ): Promise<{ accessToken: string }> {
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
      const response = await this.apiCall('/login', undefined, 'POST', headers);

      // Log the raw response for analysis
      console.debug(
        'AWS access token response:',
        JSON.stringify(response, null, 2),
      );

      // Check for the presence of the access_token
      if (!response.access_token) {
        console.error('AWS access token missing in response:', response);
        throw new Error(`AWS access token error: ${JSON.stringify(response)}`);
      }

      // Successfully retrieved token
      console.debug('AWS access token received:', response.access_token);
      return { accessToken: response.access_token };
    } catch (error) {
      // Handle and log errors
      console.error('Error while fetching AWS access token:', error);

      if (error instanceof Error && error.message.includes('403')) {
        console.error('Potential authentication error. Please check the JWT.');
      } else if (error instanceof Error && error.message.includes('timeout')) {
        console.error('Timeout occurred during AWS access token retrieval.');
      }

      throw error; // Re-throw the error for upstream handling
    }
  }

  /**
   * Fetches the devices associated with the user.
   * @returns {Promise<BlueAirDeviceDiscovery[]>} - A list of devices.
   * @throws {Error} - If the client is not initialized or the fetch operation fails.
   */
  public async getDevices(): Promise<BlueAirDeviceDiscovery[]> {
    await this.checkTokenExpiration();

    console.debug('Getting devices...');

    const response = await this.apiCall(
      '/registered-devices',
      undefined,
      'GET',
    );

    if (!response.devices) {
      throw new Error('getDevices error: no devices in response');
    }

    const devices = response.devices as BlueAirDeviceDiscovery[];

    console.debug('Devices fetched:', devices);

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
    uuids: string[],
  ): Promise<BlueAirDeviceStatus[]> {
    await this.checkTokenExpiration();

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

    const data = await this.apiCall<BlueAirDeviceStatusResponse>(
      `/${accountuuid}/r/initial`,
      body,
    );

    // Debugging: log the returned data
    console.debug(
      `Response data for UUIDs ${JSON.stringify(uuids)}:`,
      JSON.stringify(data, null, 2),
    );

    if (!data.deviceInfo) {
      throw new Error(`getDeviceStatus error: no deviceInfo in response`);
    }

    const deviceStatuses: BlueAirDeviceStatus[] = data.deviceInfo.map(
      (device) => ({
        id: device.id,
        name: device.configuration.di.name,
        model: device.configuration._it,
        mac: device.configuration.di.cma,
        sku: device.configuration.di.sku,
        mcu: device.configuration.di.mfv,
        serial: device.configuration.di.ds,
        wifi: device.configuration.di.ofv,
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
              `getDeviceStatus: unknown state ${JSON.stringify(state)}`,
            );
          }
          return acc;
        }, {} as BlueAirDeviceSensorData),
      }),
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
    value: number | boolean,
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
    if (typeof value === 'number') {
      body.v = value; // Set the value as a number.
    } else if (typeof value === 'boolean') {
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
    if (typeof uuid !== 'string' || uuid.trim() === '') {
      throw new Error('Invalid or missing UUID');
    }

    // Validate value
    if (typeof value !== 'boolean') {
      throw new Error(
        'Invalid fan speed value. Acceptable values are true or false',
      );
    }

    // Check token expiration
    await this.checkTokenExpiration();

    // Set device status
    await this.setDeviceStatus(uuid, 'automode', value);
  }

  /**
   * Sets the fan speed for a specific device.
   *
   * @param {string} uuid - The unique identifier of the device.
   * @param {number} value - The value to set for the fan's speed. Acceptable values are between 0 and 100.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   * @throws {Error} Throws an error if the arguments are missing or invalid.
   */
  public async setFanSpeed(uuid: string, value: number): Promise<void> {
    // Validate UUID
    if (typeof uuid !== 'string' || uuid.trim() === '') {
      throw new Error('Invalid or missing UUID');
    }

    // Validate value
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('Fan speed value must be a numeric value.');
    }
    if (value < 0 || value > 100) {
      throw new Error(
        'Invalid fan speed value. Acceptable values are between 0 and 100.',
      );
    }

    // Check token expiration
    await this.checkTokenExpiration();

    // Set device status
    await this.setDeviceStatus(uuid, 'fanspeed', value);
  }

  /**
   * Sets the brightness for a specific device.
   *
   * @param {string} uuid - The unique identifier of the device.
   * @param {number} value - The value to set for the brightness. Acceptable values are between 0 and 100.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   * @throws {Error} Throws an error if the arguments are missing or invalid.
   */
  public async setBrightness(uuid: string, value: number): Promise<void> {
    // Validate UUID
    if (typeof uuid !== 'string' || uuid.trim() === '') {
      throw new Error('Invalid or missing UUID');
    }

    // Validate value
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('Brightness value must be a numeric value.');
    }
    if (value < 0 || value > 100) {
      throw new Error(
        'Invalid brightness value. Acceptable values are between 0 and 100.',
      );
    }

    // Check token expiration
    await this.checkTokenExpiration();

    // Set device status
    await this.setDeviceStatus(uuid, 'brightness', value);
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
    if (typeof uuid !== 'string' || uuid.trim() === '') {
      throw new Error('Invalid or missing UUID');
    }

    // Validate value
    if (typeof value !== 'boolean') {
      throw new Error(
        'Invalid child lock value. Acceptable values are true or false',
      );
    }

    // Check token expiration
    await this.checkTokenExpiration();

    // Set device status
    await this.setDeviceStatus(uuid, 'childlock', value);
  }

  /**
   * Sets the night mode for a specific device.
   *
   * @param {string} uuid - The unique identifier of the device.
   * @param {boolean} value - The value to set for the night mode mode. Acceptable values are true or false.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   * @throws {Error} - Throws an error if the arguments are missing or invalid.
   */
  public async setNightMode(uuid: string, value: boolean): Promise<void> {
    // Validate
    if (typeof uuid !== 'string' || uuid.trim() === '') {
      throw new Error('Invalid or missing UUID');
    }

    // Validate value
    if (typeof value !== 'boolean') {
      throw new Error(
        'Invalid night mode value. Acceptable values are true or false',
      );
    }

    // Check token expiration
    await this.checkTokenExpiration();

    // Set device status
    await this.setDeviceStatus(uuid, 'nightmode', value);
  }

  /**
   * Sets the standby for a specific device.
   *
   * @param {string} uuid - The unique identifier of the device.
   * @param {boolean} value - The value to set for the standby mode. Acceptable values are true or false.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   * @throws {Error} - Throws an error if the arguments are missing or invalid.
   */
  public async setStandby(uuid: string, value: boolean): Promise<void> {
    // Validate
    if (typeof uuid !== 'string' || uuid.trim() === '') {
      throw new Error('Invalid or missing UUID');
    }

    // Validate value
    if (typeof value !== 'boolean') {
      throw new Error(
        'Invalid standby value. Acceptable values are true or false',
      );
    }

    // Check token expiration
    await this.checkTokenExpiration();

    // Set device status
    await this.setDeviceStatus(uuid, 'standby', value);
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
    method = 'POST',
    headers?: object,
    retries = 5,
  ): Promise<T> {
    const release = await this.mutex.acquire();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BLUEAIR_API_TIMEOUT);

    await this.checkTokenExpiration();

    try {
      const response: AxiosResponse<T> = await axios({
        url: `${this.blueAirApiUrl}${url}`,
        method,
        headers: {
          'Accept': '*/*',
          'Connection': 'keep-alive',
          'Accept-Encoding': 'gzip, deflate, br',
          'Authorization': `Bearer ${this._authToken}`,
          ...headers,
        },
        data,
        signal: controller.signal,
        timeout: BLUEAIR_API_TIMEOUT,
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

        console.warn(
          `Custom status 229 detected. Retrying in ${retryDelay / 1000}s...`,
        );

        await new Promise((res) => setTimeout(res, retryDelay));

        if (retries > 0) {
          return this.apiCall(url, data, method, headers, retries - 1);
        } else {
          throw new Error('Exceeded retries for status 229.');
        }
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;

        if (status === 429) {
          // Handle rate-limiting with exponential backoff
          const backoff = Math.min(1000 * Math.pow(2, 3 - retries), 60000); // Exponential backoff capped at 60 seconds
          const jitter = Math.random() * 500; // Add jitter to backoff time
          const retryDelay = backoff + jitter;

          console.warn(
            `Rate limit exceeded (status ${status}). Retrying in ${
              retryDelay / 1000
            }s...`,
          );

          await new Promise((res) => setTimeout(res, retryDelay));

          if (retries > 0) {
            return this.apiCall(url, data, method, headers, retries - 1);
          } else {
            throw new Error('Exceeded retries for status 429.');
          }
        } else if (status === 401 || status === 403) {
          console.error(
            `Authentication error (status ${status}). Details:`,
            error.response.data,
          );
          throw new Error(
            `Authentication failed: ${error.response.data.message}`,
          );
        } else {
          console.error(
            `API error (status ${status}). Details:`,
            error.response.data,
          );
          throw new Error(
            `API error with status ${status}: ${JSON.stringify(
              error.response.data,
            )}`,
          );
        }
      } else {
        // Log only the message: the full axios error contains the request
        // headers, including the Bearer token.
        console.error(
          'Unexpected error during API call:',
          error instanceof Error ? error.message : String(error),
        );
      }

      if (retries > 0) {
        console.debug(`Retrying API call (${retries - 1} retries left)...`);
        return this.apiCall(url, data, method, headers, retries - 1);
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`API call failed after retries: ${errorMessage}`);
    } finally {
      clearTimeout(timeout);
      release();
    }
  }

  /**
   * Retries an asynchronous operation a specified number of times with a delay between each attempt.
   * @param fn - A function that returns a Promise. This is the operation that will be retried upon failure.
   * @param retries - The number of times to retry the operation. Default is 5.
   * @param delay - The delay in milliseconds between each retry attempt. Default is 10000ms (10 second).
   * @returns A Promise that resolves with the result of the function fn if it eventually succeeds,
   * or rejects with an error if all retry attempts fail.
   */
  private async retry<T>(
    fn: () => Promise<T>,
    retries = 5,
    baseDelay = 1000, // Base delay in milliseconds
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt >= retries) {
          console.error('All retry attempts failed.');
          throw error; // Re-throw the error after exhausting retries
        }

        // If rate limiting error is detected
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          console.warn(
            `Rate limit exceeded on attempt ${attempt}. Retrying with backoff...`,
          );
        } else {
          console.error(`Retry attempt ${attempt} failed with error:`, error);
        }

        // Apply exponential backoff with jitter
        const delay = Math.random() * baseDelay * Math.pow(2, attempt);
        console.debug(`Retrying in ${Math.round(delay)}ms...`);
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    // Fallback for TypeScript type safety
    throw new Error('This code path should not be reached.');
  }
}
