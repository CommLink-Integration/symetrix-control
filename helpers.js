const apiMin = 0;
const apiMax = 65535;

const defaultFaderMin = -72;
const defaultFaderMax = 12;

const defaultMeterMin = -48;
const defaultMeterMax = 24;

const isOffValue = 0;
const isOnValue = 65535;

const roundTo1 = (val) => Math.round((val + Number.EPSILON) * 10) / 10;

function genericMap(value, inMin, inMax, outMin, outMax) {
    return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
}

// Maps an API value (i.e. [0,65535]) to a value in dB, by default [-72,12]
function apiTodB(value, { min = defaultFaderMin, max = defaultFaderMax } = {}) {
    // 0 <= value <= 65535
    return roundTo1(genericMap(value, apiMin, apiMax, min, max));
}

// Maps a value in dB, by default [-72,12], to an API value (i.e. [0,65535])
function dBToAPI(value, { min = defaultFaderMin, max = defaultFaderMax, relative = false } = {}) {
    // min <= value <= max
    if (relative) return Math.round(genericMap(value, min - max, max - min, -apiMax, apiMax));
    else return Math.round(genericMap(value, min, max, apiMin, apiMax));
}

// Maps a value in percentage, i.e. [0,100], to an API value (i.e. [0,65535])
// If value is negative, assumes that this is a relative measurement so full-span limits are used i.e. [-100,100] to [-65535,65535]
function pctToAPI(value) {
    // 0 <= value <= 100
    if (value > 0) return Math.round(genericMap(value, 0, 100, apiMin, apiMax));
    else return Math.round(genericMap(value, -100, 100, -apiMax, apiMax));
}

// Maps an API value to the standard value for meters [-48dBu,+24dBu]
function apiToMeter(value) {
    return apiTodB(value, { min: defaultMeterMin, max: defaultMeterMax });
}

// Maps an API value to the standard value for faders [-72,12]
function apiToFader(value) {
    return apiTodB(value);
}

// Maps a fader value in dB to an API value
function faderToAPI(value, relative) {
    return dBToAPI(value, { relative });
}

const isOn = (value) => value === isOnValue;

const isOff = (value) => value === isOffValue;

// Maps a selctor index [1,max] to an API value [0,65535]. max is a required input
function selectorToAPI(selected, max) {
    return Math.round(genericMap(selected, 1, max, apiMin, apiMax));
}

// Maps an API value [0,65535] to a selctor index [1,max]. max is a required input
function apiToSelector(value, max) {
    return Math.round(genericMap(value, apiMin, apiMax, 1, max));
}

module.exports = {
    conversions: {
        apiTodB,
        dBToAPI,
        pctToAPI,
        faderToAPI,
        apiToFader,
        apiToMeter,
        selectorToAPI,
        apiToSelector,
        genericMap,
    },
    values: {
        truthy: [true, 'on', 'mute'],
        falsy: [false, 'off', 'unmute'],
        max: isOnValue,
        min: isOffValue,
        isOn,
        isOff,
    },
};
