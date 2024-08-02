"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlueAirDeviceSensorDataMap = exports.defaultDeviceConfig = exports.defaultConfig = exports.BLUEAIR_API_TIMEOUT = exports.LOGIN_EXPIRATION = exports.BLUEAIR_CONFIG = exports.RegionMap = exports.Region = void 0;
var Region;
(function (Region) {
    Region["EU"] = "EU";
    Region["AU"] = "AU";
    Region["CN"] = "CN";
    Region["RU"] = "RU";
    Region["US"] = "US";
})(Region || (exports.Region = Region = {}));
exports.RegionMap = {
    [Region.US]: 'us',
    [Region.CN]: 'cn',
    [Region.EU]: 'eu',
    [Region.AU]: 'au',
    [Region.RU]: 'ru',
};
const AWS_CONFIG = {
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
const GIGYA_CONFIG = {
    us: {
        gigyaRegion: 'us1',
        apiKey: '3_-xUbbrIY8QCbHDWQs1tLXE-CZBQ50SGElcOY5hF1euE11wCoIlNbjMGAFQ6UwhMY',
    },
    eu: {
        gigyaRegion: 'eu1',
        apiKey: '3_qRseYzrUJl1VyxvSJANalu_kNgQ83swB1B9uzgms58--5w1ClVNmrFdsDnWVQQCl',
    },
    cn: {
        gigyaRegion: 'cn1',
        apiKey: '3_h3UEfJnA-zDpFPR9L4412HO7Mz2VVeN4wprbWYafPN1gX0kSnLcZ9VSfFi7bEIIU',
    },
    au: {
        gigyaRegion: 'au1',
        apiKey: '3_Z2N0mIFC6j2fx1z2sq76R3pwkCMaMX2y9btPb0_PgI_3wfjSJoofFnBbxbtuQksN',
    },
    ru: {
        gigyaRegion: 'ru1',
        apiKey: '3_wYhHEBaOcS_w6idVM3mh8UjyjOP-3Dwn3w9Z6AYc0FhGf-uIwUkrcoCdsYarND2k',
    },
};
exports.BLUEAIR_CONFIG = Object.keys(exports.RegionMap).reduce((acc, key) => {
    const regionKey = key;
    const regionCode = exports.RegionMap[regionKey];
    acc[regionCode] = {
        awsConfig: AWS_CONFIG[regionCode],
        gigyaConfig: GIGYA_CONFIG[regionCode],
    };
    return acc;
}, {});
exports.LOGIN_EXPIRATION = 3600 * 1000 * 24; // n hours in milliseconds
exports.BLUEAIR_API_TIMEOUT = 5 * 1000; // n seconds in milliseconds
exports.defaultConfig = {
    name: 'BlueAir Platform',
    uiDebug: false,
    verboseLogging: false,
    username: '',
    password: '',
    region: Region.EU,
    pollingInterval: 5000,
    devices: [],
};
exports.defaultDeviceConfig = {
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
exports.BlueAirDeviceSensorDataMap = {
    fsp0: 'fanspeed',
    hcho: 'hcho',
    h: 'humidity',
    pm1: 'pm1',
    pm10: 'pm10',
    pm2_5: 'pm2_5',
    t: 'temperature',
    tVOC: 'voc',
};
