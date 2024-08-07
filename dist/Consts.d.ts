export declare enum Region {
    EU = "EU",
    AU = "AU",
    CN = "CN",
    RU = "RU",
    US = "US"
}
export declare const RegionMap: {
    [key in Region]: string;
};
type AWSConfigValue = {
    restApiId: string;
    awsRegion: string;
    regionCode: string;
};
type AWSConfig = {
    [key: string]: AWSConfigValue;
};
export declare const AWS_CONFIG: AWSConfig;
type GigyaConfigValue = {
    gigyaRegion: string;
    apiKey: string;
};
type APIConfig = {
    [key: string]: {
        awsConfig: AWSConfigValue;
        gigyaConfig: GigyaConfigValue;
    };
};
export declare const BLUEAIR_CONFIG: APIConfig;
export declare const LOGIN_EXPIRATION: number;
export declare const BLUEAIR_API_TIMEOUT: number;
export type BlueAirDeviceStatusResponse = {
    deviceInfo: {
        id: string;
        configuration: {
            di: {
                cma: string;
                name: string;
                sku: string;
                mfv: string;
                ofv: string;
                hw: string;
                ds: string;
            };
            _it: string;
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
export declare const defaultConfig: Config;
export declare const defaultDeviceConfig: DeviceConfig;
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
export declare const BlueAirDeviceSensorDataMap: {
    fsp0: string;
    hcho: string;
    h: string;
    pm1: string;
    pm10: string;
    pm2_5: string;
    t: string;
    tVOC: string;
};
export type FullBlueAirDeviceState = BlueAirDeviceState & BlueAirDeviceSensorData;
export {};
