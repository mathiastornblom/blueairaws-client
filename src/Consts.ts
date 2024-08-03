export enum Region {
  EU = 'EU',
  AU = 'AU',
  CN = 'CN',
  RU = 'RU',
  US = 'US',
}

export const RegionMap: { [key in Region]: string } = {
  [Region.US]: 'us',
  [Region.CN]: 'cn',
  [Region.EU]: 'eu',
  [Region.AU]: 'au',
  [Region.RU]: 'ru',
};

type AWSConfigValue = {
  restApiId: string;
  awsRegion: string;
};

type AWSConfig = { [key: string]: AWSConfigValue };

export const AWS_CONFIG: AWSConfig = {
  us: {
    restApiId: 'on1keymlmh',
    awsRegion: 'us-east-2',
  },
  eu: {
    restApiId: 'hkgmr8v960',
    awsRegion: 'eu-west-1',
  },
  cn: {
    restApiId: 'ftbkyp79si',
    awsRegion: 'cn-north-1',
  },
  au: {
    restApiId: '3lcm4dxjhk',
    awsRegion: 'ap-southeast-2',
  },
  ru: {
    restApiId: 'f3g4h7ik0l',
    awsRegion: 'eu-central-1',
  },
};

type GigyaConfigValue = {
  gigyaRegion: string;
  apiKey: string;
};

type GigyaConfig = { [key: string]: GigyaConfigValue };

const GIGYA_CONFIG: GigyaConfig = {
  us: {
    gigyaRegion: 'us1',
    apiKey:
      '3_-xUbbrIY8QCbHDWQs1tLXE-CZBQ50SGElcOY5hF1euE11wCoIlNbjMGAFQ6UwhMY',
  },
  eu: {
    gigyaRegion: 'eu1',
    apiKey:
      '3_qRseYzrUJl1VyxvSJANalu_kNgQ83swB1B9uzgms58--5w1ClVNmrFdsDnWVQQCl',
  },
  cn: {
    gigyaRegion: 'cn1',
    apiKey:
      '3_h3UEfJnA-zDpFPR9L4412HO7Mz2VVeN4wprbWYafPN1gX0kSnLcZ9VSfFi7bEIIU',
  },
  au: {
    gigyaRegion: 'au1',
    apiKey:
      '3_Z2N0mIFC6j2fx1z2sq76R3pwkCMaMX2y9btPb0_PgI_3wfjSJoofFnBbxbtuQksN',
  },
  ru: {
    gigyaRegion: 'ru1',
    apiKey:
      '3_wYhHEBaOcS_w6idVM3mh8UjyjOP-3Dwn3w9Z6AYc0FhGf-uIwUkrcoCdsYarND2k',
  },
};

type APIConfig = {
  [key: string]: {
    awsConfig: AWSConfigValue;
    gigyaConfig: GigyaConfigValue;
  };
};

export const BLUEAIR_CONFIG: APIConfig = Object.keys(RegionMap).reduce(
  (acc, key) => {
    const regionKey = key as Region;
    const regionCode = RegionMap[regionKey];
    acc[regionCode] = {
      awsConfig: AWS_CONFIG[regionCode],
      gigyaConfig: GIGYA_CONFIG[regionCode],
    };
    return acc;
  },
  {} as APIConfig,
);

export const LOGIN_EXPIRATION = 3600 * 1000 * 24; // n hours in milliseconds
export const BLUEAIR_API_TIMEOUT = 5 * 1000; // n seconds in milliseconds

export type BlueAirDeviceStatusResponse = {
  deviceInfo: {
    id: string;
    configuration: {
      di: {
        cma: string; //'c4:dd:57:92:3e:34';
        name: string; //'Sovrumsrenare';
        sku: string; //'106121';
        mfv: string; //'1.0.12';
        ofv: string; //'2.1.1';
        hw: string; //'high_1.5';
        ds: string; //'110612100000110110006948';
      };
      _it: string; //"urn:blueair:openapi:version:healthprotect:0.0.5";
    };
    sensordata: {
      n: string;
      t: number;
      v: number;
    }[];
    states: {
      n: string;
      t: number;
      v?: number;
      vb?: boolean;
    }[];
  }[];
};

export type Config = {
  name: string;
  username: string;
  password: string;
  region: Region;
  verboseLogging: boolean;
  uiDebug: boolean;
  pollingInterval: number;
  devices: DeviceConfig[];
};

export type DeviceConfig = {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  filterChangeLevel: number;
  led: boolean;
  airQualitySensor: boolean;
  co2Sensor: boolean;
  temperatureSensor: boolean;
  humiditySensor: boolean;
  germShield: boolean;
  nightMode: boolean;
};

export const defaultConfig: Config = {
  name: 'BlueAir Platform',
  uiDebug: false,
  verboseLogging: false,
  username: '',
  password: '',
  region: Region.EU,
  pollingInterval: 5000,
  devices: [],
};

export const defaultDeviceConfig: DeviceConfig = {
  id: '',
  name: '',
  model: '',
  serialNumber: '',
  filterChangeLevel: 90,
  led: false,
  airQualitySensor: false,
  co2Sensor: false,
  temperatureSensor: false,
  humiditySensor: false,
  germShield: false,
  nightMode: false,
};

export type BlueAirDeviceDiscovery = {
  mac: string;
  'mcu-firmware': string;
  name: string;
  type: string;
  'user-type': string;
  uuid: string;
  'wifi-firmware': string;
};

export type BlueAirDeviceState = {
  cfv?: string;
  germshield?: boolean;
  gsnm?: boolean;
  standby?: boolean;
  fanspeed?: number;
  childlock?: boolean;
  nightmode?: boolean;
  mfv?: string;
  automode?: boolean;
  ofv?: string;
  brightness?: number;
  safetyswitch?: boolean;
  filterusage?: number;
  disinfection?: boolean;
  disinftime?: number;
};

export type BlueAirDeviceSensorData = {
  fanspeed?: number;
  hcho?: number;
  humidity?: number;
  pm1?: number;
  pm10?: number;
  pm2_5?: number;
  temperature?: number;
  voc?: number;
};

export type BlueAirDeviceStatus = {
  id: string;
  name: string;
  model: string;
  mac: string;
  wifi: string;
  mcu: string;
  serial: string;
  state: BlueAirDeviceState;
  sensorData: BlueAirDeviceSensorData;
};

export type BlueAirSetStateBody = {
  n: string;
  v?: number;
  vb?: boolean;
};

export const BlueAirDeviceSensorDataMap = {
  fsp0: 'fanspeed',
  hcho: 'hcho',
  h: 'humidity',
  pm1: 'pm1',
  pm10: 'pm10',
  pm2_5: 'pm2_5',
  t: 'temperature',
  tVOC: 'voc',
};

export type FullBlueAirDeviceState = BlueAirDeviceState &
  BlueAirDeviceSensorData;
