import { BlueAirAwsClient } from '../src/BlueAirAwsClient';
import { Region, Config, BlueAirDeviceDiscovery } from '../src/Consts';
import * as dotenv from 'dotenv';

dotenv.config();

const correctConfig: Config = {
  name: '51b94892-295e-46dd-9fc1-4a73cc162e4d',
  username: process.env.CORRECT_NAME!,
  password: process.env.RIGHT_PASSWORD!,
  region: Region.EU,
  verboseLogging: true,
  uiDebug: true,
  pollingInterval: 5000,
  devices: [],
};

describe('BlueAirAwsClient', () => {
  let client: BlueAirAwsClient;
  let devices: BlueAirDeviceDiscovery[] = [];
  let accountuuid: string = '';
  let uuids: string[] = [];
  let initialized = false;

  beforeAll(async () => {
    jest.setTimeout(30000); // Set a global timeout of 30 seconds for all tests in this suite
    client = new BlueAirAwsClient(
      correctConfig.username,
      correctConfig.password,
    );
    initialized = await client.initialize();
    if (initialized) {
      devices = await client.getDevices();
      uuids = devices.map((device) => device.uuid);
      accountuuid = devices[0].name; // Using the first device name as accountuuid
    } else {
      console.error('Initialization failed. Skipping tests.');
    }
  });

  describe('BlueAirAwsClient Region Mapping', () => {
  let client: BlueAirAwsClient;

  beforeAll(() => {
    client = new BlueAirAwsClient('dummyUsername', 'dummyPassword');
  });

  test('should map us-east-1 to US region', () => {
    const region = client['mapAwsRegionToRegion']('us-east-1');
    expect(region).toBe(Region.US);
  });

  test('should map us-east-2 to US region', () => {
    const region = client['mapAwsRegionToRegion']('us-east-2');
    expect(region).toBe(Region.US);
  });

  test('should map eu-west-1 to EU region', () => {
    const region = client['mapAwsRegionToRegion']('eu-west-1');
    expect(region).toBe(Region.EU);
  });

  test('should map cn-north-1 to CN region', () => {
    const region = client['mapAwsRegionToRegion']('cn-north-1');
    expect(region).toBe(Region.CN);
  });

  test('should map ap-southeast-2 to AU region', () => {
    const region = client['mapAwsRegionToRegion']('ap-southeast-2');
    expect(region).toBe(Region.AU);
  });

  test('should map eu-central-1 to RU region', () => {
    const region = client['mapAwsRegionToRegion']('eu-central-1');
    expect(region).toBe(Region.RU);
  });

  test('should throw an error for an unknown AWS region', () => {
    expect(() => client['mapAwsRegionToRegion']('unknown-region')).toThrow(
      'No region mapping found for AWS region: unknown-region'
    );
  });
});

  test('should initialize correctly', () => {
    expect(client).toBeInstanceOf(BlueAirAwsClient);
    expect(initialized).toBe(true);
  });

  test('should get devices', () => {
    if (!initialized) {
      return console.error('Initialization failed. Skipping test.');
    }
    expect(Array.isArray(devices)).toBe(true);
    expect(devices.length).toBeGreaterThan(0);
    devices.forEach((device) => {
      expect(device).toHaveProperty('uuid');
      expect(device).toHaveProperty('mac');
      expect(device).toHaveProperty('name');
      console.debug(`Device: ${JSON.stringify(device)}`);
    });
    console.debug(`Devices: ${JSON.stringify(devices)}`);
  });

  test('should get device status', async () => {
    if (!initialized) {
      return console.error('Initialization failed. Skipping test.');
    }
    const deviceStatuses = await client.getDeviceStatus(accountuuid, uuids);
    expect(Array.isArray(deviceStatuses)).toBe(true);
    expect(deviceStatuses.length).toBe(uuids.length);
    deviceStatuses.forEach((status) => {
      expect(status).toHaveProperty('id');
      expect(status).toHaveProperty('name');
      expect(status).toHaveProperty('sensorData');
      expect(status).toHaveProperty('state');
      console.debug(`Device Status: ${JSON.stringify(status)}`);
    });
    console.debug(`Device statuses: ${JSON.stringify(deviceStatuses)}`);
  }, 30000); // Increase the timeout for this specific test

  test('should set child lock to true', async () => {
    if (!initialized) {
      return console.error('Initialization failed. Skipping test.');
    }
    const uuid = uuids[0]; // Use the first device UUID for the test

    // Set child lock to true
    await client.setDeviceStatus(uuid, 'childlock', true);

    // Wait for 3 seconds
    await new Promise((resolve) => setTimeout(resolve, 3000));

    let deviceStatus = await client.getDeviceStatus(accountuuid, [uuid]);
    console.debug(`Device Status: ${JSON.stringify(deviceStatus)}`);
    let childLockState = deviceStatus[0].state.childlock;
    console.debug(`Child lock state: ${childLockState}`);
    expect(childLockState).toBe(true);
  }, 30000); // Increase the timeout for this specific test

  test('should set child lock to false', async () => {
    if (!initialized) {
      return console.error('Initialization failed. Skipping test.');
    }
    const uuid = uuids[0]; // Use the first device UUID for the test

    // Set child lock to false
    await client.setDeviceStatus(uuid, 'childlock', false);

    // Wait for 3 seconds
    await new Promise((resolve) => setTimeout(resolve, 3000));

    let deviceStatus = await client.getDeviceStatus(accountuuid, [uuid]);
    console.debug(`Device Status: ${JSON.stringify(deviceStatus)}`);
    let childLockState = deviceStatus[0].state.childlock;
    console.debug(`Child lock state: ${childLockState}`);
    expect(childLockState).toBe(false);
  }, 30000); // Increase the timeout for this specific test
});
