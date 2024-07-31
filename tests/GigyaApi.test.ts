import GigyaApi from "../src/GigyaApi";
import { Region } from "../src/Consts";
import * as dotenv from "dotenv";

dotenv.config();

const correctUsername = process.env.CORRECT_NAME!;
const correctPassword = process.env.RIGHT_PASSWORD!;
const region = Region.EU;

describe("GigyaApi", () => {
	let api: GigyaApi;

	beforeAll(() => {
		api = new GigyaApi(correctUsername, correctPassword, region);
	});

	test("should initialize correctly", () => {
		expect(api).toBeInstanceOf(GigyaApi);
	});

	test("should get Gigya session", async () => {
		const session = await api.getGigyaSession();
		expect(session).toHaveProperty("token");
		expect(session).toHaveProperty("secret");
	});

	test("should get Gigya JWT", async () => {
		const session = await api.getGigyaSession();
		const jwt = await api.getGigyaJWT(session.token, session.secret);
		expect(jwt).toHaveProperty("jwt");
	});
});
