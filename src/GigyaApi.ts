import { BLUEAIR_CONFIG, Region, RegionMap } from "./Consts";

/**
 * Gigya API client for handling authentication.
 */
export default class GigyaApi {
	private api_key: string;
	private gigyaApiUrl: string;

	/**
	 * Constructs a new GigyaApi instance.
	 * @param username - The username for authentication.
	 * @param password - The password for authentication.
	 * @param region - The region code.
	 */
	constructor(
		private readonly username: string,
		private readonly password: string,
		region: Region
	) {
		const config = BLUEAIR_CONFIG[RegionMap[region]].gigyaConfig;
		if (!config) {
			throw new Error(`No config found for region: ${region}`);
		}
		this.api_key = config.apiKey;
		this.gigyaApiUrl = `https://accounts.${config.gigyaRegion}.gigya.com`;
	}

	/**
	 * Retrieves the Gigya session.
	 * @returns A promise that resolves to the session token and secret.
	 */
	public async getGigyaSession(): Promise<{ token: string; secret: string }> {
		const params = new URLSearchParams({
			apiKey: this.api_key,
			loginID: this.username,
			password: this.password,
			targetEnv: "mobile",
		});

		const response = await this.apiCall("/accounts.login", params.toString());

		if (!response.sessionInfo) {
			throw new Error(
				`Gigya session error: sessionInfo in response: ${JSON.stringify(
					response
				)}`
			);
		}

		console.debug("Gigya session received");
		return {
			token: response.sessionInfo.sessionToken,
			secret: response.sessionInfo.sessionSecret,
		};
	}

	/**
	 * Retrieves the Gigya JWT.
	 * @param token - The session token.
	 * @param secret - The session secret.
	 * @returns A promise that resolves to the JWT.
	 */
	public async getGigyaJWT(
		token: string,
		secret: string
	): Promise<{ jwt: string }> {
		const params = new URLSearchParams({
			oauth_token: token,
			secret: secret,
			targetEnv: "mobile",
		});

		const response = await this.apiCall("/accounts.getJWT", params.toString());

		if (!response.id_token) {
			throw new Error(
				`Gigya JWT error: no id_token in response: ${JSON.stringify(response)}`
			);
		}

		console.debug("Gigya JWT received");
		return {
			jwt: response.id_token,
		};
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private async apiCall(url: string, data: string, retries = 3): Promise<any> {
		const controller = new AbortController();
		try {
			const response = await fetch(`${this.gigyaApiUrl}${url}?${data}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Accept: "*/*",
					Connection: "keep-alive",
					"Accept-Encoding": "gzip, deflate, br",
				},
				signal: controller.signal,
			});
			const json = await response.json();
			if (response.status !== 200) {
				throw new Error(
					`API call error with status ${response.status}: ${
						response.statusText
					}, ${JSON.stringify(json)}`
				);
			}
			return json;
		} catch (error) {
			console.error(`API call failed: ${error}`);
			if (retries > 0) {
				console.debug(`Retrying API call (${retries} retries left)...`);
				return this.apiCall(url, data, retries - 1);
			} else {
				throw new Error(`API call failed after ${retries} retries`);
			}
		}
	}
}
