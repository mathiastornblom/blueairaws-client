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
const axios_1 = __importDefault(require("axios"));
const Consts_1 = require("./Consts");
/**
 * Gigya API client for handling authentication.
 */
class GigyaApi {
    /**
     * Constructs a new GigyaApi instance.
     * @param username - The username for authentication.
     * @param password - The password for authentication.
     * @param region - The region code.
     */
    constructor(username, password, region) {
        this.username = username;
        this.password = password;
        const config = Consts_1.BLUEAIR_CONFIG[Consts_1.RegionMap[region]].gigyaConfig;
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
    getGigyaSession() {
        return __awaiter(this, void 0, void 0, function* () {
            const params = new URLSearchParams({
                apiKey: this.api_key,
                loginID: this.username,
                password: this.password,
                targetEnv: "mobile",
            });
            const response = yield this.apiCall("/accounts.login", params.toString());
            if (!response.sessionInfo) {
                throw new Error(`Gigya session error: sessionInfo in response: ${JSON.stringify(response)}`);
            }
            console.debug("Gigya session received");
            return {
                token: response.sessionInfo.sessionToken,
                secret: response.sessionInfo.sessionSecret,
            };
        });
    }
    /**
     * Retrieves the Gigya JWT.
     * @param token - The session token.
     * @param secret - The session secret.
     * @returns A promise that resolves to the JWT.
     */
    getGigyaJWT(token, secret) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = new URLSearchParams({
                oauth_token: token,
                secret: secret,
                targetEnv: "mobile",
            });
            const response = yield this.apiCall("/accounts.getJWT", params.toString());
            if (!response.id_token) {
                throw new Error(`Gigya JWT error: no id_token in response: ${JSON.stringify(response)}`);
            }
            console.debug("Gigya JWT received");
            return {
                jwt: response.id_token,
            };
        });
    }
    apiCall(url_1, data_1) {
        return __awaiter(this, arguments, void 0, function* (url, data, retries = 3) {
            const controller = new AbortController();
            try {
                const axiosConfig = {
                    url: `${this.gigyaApiUrl}${url}?${data}`,
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        Accept: "*/*",
                        Connection: "keep-alive",
                        "Accept-Encoding": "gzip, deflate, br",
                    },
                    signal: controller.signal,
                    timeout: 10000, // Timeout for the request
                };
                const response = yield (0, axios_1.default)(axiosConfig);
                const json = response.data;
                if (response.status !== 200) {
                    throw new Error(`API call error with status ${response.status}: ${response.statusText}, ${JSON.stringify(json)}`);
                }
                return json;
            }
            catch (error) {
                console.error(`API call failed: ${error}`);
                if (retries > 0) {
                    console.debug(`Retrying API call (${retries} retries left)...`);
                    return this.apiCall(url, data, retries - 1);
                }
                else {
                    throw new Error(`API call failed after ${retries} retries`);
                }
            }
        });
    }
}
exports.default = GigyaApi;
