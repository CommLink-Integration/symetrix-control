const net = require('net');
const EventEmitter = require('events');

const { getCommand } = require('./api');

function validRange(value, low, high) {
    if (typeof value !== 'number') return false;
    if (value < low || value > high) return false;
    return true;
}

function validControlId(id) {
    return validRange(id, 0, 10000);
}

function validControlValue(value) {
    return validRange(value, 0, 65535);
}

/**
 * Implements v7.0 of the Composer Control Protocol from Symetrix
 * https://www.symetrix.co/
 * The command/response structure of the API is straightforward to implement. A FIFO queue is
 * created to ensure that each sent command is sent in order and a response is received before
 * sending the next command. If a response is not received within the _noResponseTimeout window
 * it is assumed to be lost and the next command is sent.
 *
 * The difficulty comes in because the Composer endpoint can also be configured to push
 * unsolicited updates which there is not a unique format or header for so it's difficult to know
 * if the incoming packet is from a previously sent command or a push.
 *
 * NOTE: Symetrix seems to have a resolution problem with floating point math so if a value of a fader
 * is set with a resolution of 0.1 db or the equivalent full-range value Symetrix will sometimes
 * round the value incorrectly. e.g. setting a fader to -47.2dB will translate to the fader actually
 * being set to -47.0dB (which matches the value sent by Sytemtrix when querying the value of the same
 * fader). However setting to -47.9dB will be successfully set to -47.9 within Composer. I assume it's
 * a single vs double precision floating point issue within the Symetrix hardware. The difference of
 * a couple tenths of a dB is not usually significant, but should be noted
 */
class Symetrix extends EventEmitter {
    constructor({ host, retryTimeout = 20000, debug = false }) {
        super();
        if (typeof host !== 'string' || !net.isIPv4(host)) {
            console.error('Bad host assignment');
            return;
        }
        this._debug = debug;
        this.host = host;
        this.port = 48631;
        this.retryTimeout = retryTimeout;

        this._noResponseTimeout = 2000; // let the next command go through if no response is received

        this._recvBuffer = '';
        this._sendBuffer = []; // FIFO buffer for sending over the UDP connection
        this._readyToSend = true;

        this._nextResponse = undefined;
        this._nextCb = undefined;

        this.on('readyToSend', () => {
            this._nextResponse = undefined;
            this._nextCb = undefined;
            if (this._sendBuffer.length > 0) {
                const { command, regex, cb } = this._sendBuffer.shift();
                this._send(command, regex, cb);
            } else this._readyToSend = true;
        });

        // eslint-disable-next-line new-cap
        this.sock = new net.createConnection({ port: this.port, host: this.host });
        this.sock.setEncoding('utf8');

        this.sock.on('ready', () => {
            // console.log('Symetrix ready');
            this.emit('connected');
        });

        this.sock.on('error', (err) => {
            console.error('Symetrix connection error:', err);
        });

        this.sock.on('close', () => {
            // console.log('Closed');
            // attempt reconnection after timeout
            if (this.retryTimeout > 0)
                setTimeout(() => {
                    this.sock.connect(this.port, this.host);
                }, this.retryTimeout);
        });

        this.sock.on('data', (data) => {
            // Composer Control spec defines that a response will never be split between \r
            // so if the last character is not \r it means that the local network stack has split the
            // incoming packet(s) and we need to rebuild the sent message
            if (data.slice(-1) !== '\r') {
                this._recvBuffer += data;
                return;
            }
            data = this._recvBuffer + data;
            this._recvBuffer = '';

            // search for the nextResponse
            const split = this._nextResponse ? data.search(this._nextResponse) : -1;

            // for some reason nextResponse can be found in the middle of the data string when a push
            // is happening at the same time as an expected response is being generated/sent
            // I assume this has to do with the underlying socket or OS concatenating packets before
            // the data is allowed to be read here but it could also be a bug on the server side of the
            // Composer API. Regardless, it makes this next chunk required
            let pushData, respData;

            // couldn't find the expected repsonse so should just be a push
            if (split < 0) pushData = data;
            // the expected response is at the beginning so should just be the expected response
            else if (split === 0) respData = data;
            // this is likely the end of a push with the expected response glued onto the end
            else {
                pushData = data.slice(0, split);
                respData = data.slice(split);
            }

            if (pushData) this.emit('push', this._parseMultiple(pushData));

            if (respData) {
                clearTimeout(this._noResponse); // we got a response so clear the timeout
                // console.log('respData:', respData.replace(/\r/g, "\r\n"))
                let response;
                // handle the special case for GSB3
                if (respData.slice(0, 4) === 'GSB3') {
                    // trim the first line which is GSB3 \d{5} \d{5}\r
                    respData = respData.substring(respData.indexOf('\r') + 1);
                    response = this._parseMultiple(respData);
                } else {
                    response = this._parseSingle(respData, this._nextResponse);
                }

                this._nextCb(null, response);
                this.emit('readyToSend');
            }
        });
    }

    destructor() {
        this.sock.destroy();
    }

    _parseMultiple(data) {
        const regex = /#(?<id>\d{5})=(?<ret>\d{5})/g; // all multiline responses are in this format
        const response = [];
        [...data.matchAll(regex)].forEach((m) => {
            response.push({ id: Number(m.groups.id), value: Number(m.groups.ret) });
        });
        return response;
    }

    _parseSingle(data, regex) {
        const m = data.match(regex);

        if (m.groups.ret) return m.groups.ret;
        else if (m.groups.ack) return true;
        else if (m.groups.nak) return false;
        else {
            // Should never get here
            console.error('Unkown response format', data);
        }
    }

    async reqToSend(command, regex, cb) {
        // if send buffer is empty, call this._send
        // else add command, regex, cb to buffer
        if (typeof cb !== 'function') {
            throw new Error('Callback is not a function');
        }
        if (this._readyToSend) this._send(command, regex, cb);
        else this._sendBuffer.push({ command, regex, cb });
    }

    /**
     * @param {String} command - the message to send to the Symetrix device
     */
    _send(command, regex, cb) {
        if (this._debug) console.log(`Sending to Symetrix`, command);
        if (this.sock.readyState === 'open' || this.sock.readyState === 'writeOnly') {
            this._readyToSend = false;
            this._nextResponse = regex;
            this._nextCb = cb;
            this.sock.write(command);
            this._noResponse = setTimeout(() => {
                this.emit('readyToSend');
            }, this._noResponseTimeout);
        } else {
            console.error('Could not send to Symetrix. Socket not ready.');
        }
    }

    // #region Controls

    /**
     * Use this command to move a controller position on the currently addressed unit to a new absolute value
     * @param {number} id - the control ID to set, between 1 and 10000
     * @param {number} value - the value to set the control ID to, between 0 and 65535
     * @return {Promise}
     */
    controlSet(id, value) {
        return new Promise((resolve, reject) => {
            if (!validControlId(id) || !validControlValue(value))
                reject(Error(`controlSet invalid id ${id} or value ${value}`));
            const { command, response } = getCommand('controlSet', { id, value });
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    /**
     * Use this command to move a controller to a new relative value. This command will increment or decrement
     * a controller by a specified amount
     * @param {number} id - the control ID to set, between 1 and 10000
     * @param {number} value - the value to change the control ID by, between -65535 and 65535
     * @return {Promise}
     */
    controlChange(id, value) {
        return new Promise((resolve, reject) => {
            if (!validControlId(id) || !validRange(value, -65535, 65535))
                reject(Error(`controlChange invalid id ${id} or value ${value}`));
            const { command, response } = getCommand('changeController', { id, value });
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    /**
     * This command will return the controller position (value) associated with a specific controller number
     * @param {number} id - the control ID to get, between 1 and 10000
     * @return {Promise}
     */
    controlGet(id) {
        return new Promise((resolve, reject) => {
            if (!validControlId(id)) reject(Error(`controlGet invalid id ${id}`));
            const { command, response } = getCommand('controlGet', { id });
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    /**
     * This command will return the controller position (value) of a specific range of consecutive controller numbers.
     * @param {number} id - the first control ID to get, between 1 and 10000
     * @param {number} size - the number of consecutive control IDs to get, between 1 and 256
     * @return {Promise}
     */
    async controlGetBlock(id, size) {
        return new Promise((resolve, reject) => {
            if (!validControlId(id) || !validRange(size, 1, 256))
                reject(Error(`controlGetBlock invalid id ${id} or size ${size}`));
            const { command, response } = getCommand('controlGetBlock', { id, size });
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }
    // #endregion Controls

    // #region Configuration
    /**
     * This command will instantly reboot the unit
     * @return {Promise}
     */
    reboot() {
        return new Promise((resolve, reject) => {
            const { command, response } = getCommand('reboot');
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    /**
     * This command momentarily flashes the front panel LEDs of the unit being addressed
     * @return {Promise}
     */
    flashUnit() {
        return new Promise((resolve, reject) => {
            const { command, response } = getCommand('flashUnit');
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    /**
     * This command sets a system string such as a speed dial name or number. Refer to the Composer Control
     * documentation for details on valid strings and values
     * @param {string} resource - the string resource to set
     * @param {string} value - the value to set the string resource to
     * @return {Promise}
     */
    setSystemString(resource, value) {
        return new Promise((resolve, reject) => {
            if (typeof resource !== 'string' || typeof value !== 'string')
                reject(Error(`setSystemString invalid resource ${resource} or value ${value}`));
            const { command, response } = getCommand('setSystemString', { string: resource, value });
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    /**
     * This command sets a system string such as a speed dial name or number. Refer to the Composer Control
     * documentation for details on valid strings
     * @param {string} resource - the string resource to get
     * @return {Promise}
     */
    getSystemString(resource) {
        return new Promise((resolve, reject) => {
            if (typeof resource !== 'string') reject(Error(`setSystemString invalid resource ${resource}`));
            const { command, response } = getCommand('getSystemString', { string: resource });
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }
    // #endregion Configuration

    // #region Presets
    /**
     * This command will return the last preset that was loaded
     * @return {Promise}
     */
    getPreset() {
        return new Promise((resolve, reject) => {
            const { command, response } = getCommand('getPreset');
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    /**
     * This command will load the specified preset (1-1000) on the currently addressed unit.
     * @param {number} id - the preset number to set, between 1 and 1000
     * @return {Promise}
     */
    loadPreset(id) {
        return new Promise((resolve, reject) => {
            if (!validRange(id, 1, 1000)) reject(Error(`loadPreset invalid preset ${id}`));
            const { command, response } = getCommand('loadPreset', { id });
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }
    // #endregion Presets

    // #region Pushing
    /**
     * This command enables or disables the push feature for an individual controller or range of controllers.
     * To select an individual controller to enable/disable push on set high equal to low
     * Using the default values will enable or disable pushing for all control IDs
     * @param {boolean} enable - if push should be enabled or disabled
     * @param {number} [low] - the lowest control ID that should be enabled/disabled, defaults to 1
     * @param {number} [high] - the highest control ID that should be enabled/disabled, defaults to 10000
     * @return {Promise}
     */
    pushState(enable, { low = 1, high = 10000 } = {}) {
        return new Promise((resolve, reject) => {
            if (typeof enable === 'undefined') reject(Error(`pushState enable/disable not set`));
            const { command, response } = getCommand('pushState', { enable, low, high });
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    /**
     * This command returns a list of all controllers currently enabled for push on the addressed device.
     * To select an individual controller set high equal to low
     * Using the default values will query all control IDs
     * @param {number} [low] - the lowest control ID that should be queried, defaults to 1
     * @param {number} [high] - the highest control ID that should be queried, defaults to 10000
     * @return {Promise}
     */
    getPushEnabled({ low = 1, high = 10000 } = {}) {
        return new Promise((resolve, reject) => {
            const { command, response } = getCommand('getPushEnabled', { low, high });
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    /**
     * This command causes data to be pushed immediately even if it hasn’t changed (assuming push is enabled).
     * To select an individual controller to refresh set high equal to low. Using the default values will
     * refresh all control IDs
     * @param {number} [low] - the lowest control ID that should be refreshed, defaults to 1
     * @param {number} [high] - the highest control ID that should be refreshed, defaults to 10000
     * @return {Promise}
     */
    pushRefresh({ low = 1, high = 10000 } = {}) {
        return new Promise((resolve, reject) => {
            const { command, response } = getCommand('pushRefresh', { low, high });
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    /**
     * This command causes previous changes in data to be ignored and not pushed. It may be desirable to issue
     * this command when first enabling push to prevent being swamped by the flood incoming data.
     * To select an individual controller to clear set high equal to low. Using the default values will
     * clear all control IDs
     * @param {number} [low] - the lowest control ID that should be refreshed, defaults to 1
     * @param {number} [high] - the highest control ID that should be refreshed, defaults to 10000
     * @return {Promise}
     */
    pushClear({ low = 1, high = 10000 } = {}) {
        return new Promise((resolve, reject) => {
            const { command, response } = getCommand('pushClear', { low, high });
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    /**
     * This command changes the minimum length of time between consecutive pushes of data. At power-up,
     * this value defaults to 100 milliseconds. Interval must be between 20 (20ms) and 30000 (30s)
     * @param {number} value - the new push interval in milliseconds
     * @return {Promise}
     */
    pushInterval(value) {
        return new Promise((resolve, reject) => {
            if (!validRange(value, 20, 30000)) reject(Error(`pushInterval invalid interval ${value}`));
            const { command, response } = getCommand('setPushInterval', { value });
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    /**
     * This command changes the push threshold value. The threshold is the amount a value must change from
     * the previous push before it is pushed again. SymNet maintains two thresholds: one for parameter data
     * such as faders and buttons, and another for meters (including LEDs). It may be desirable to use a
     * large threshold for meters to avoid constant pushing of values. The power-on default for both is 1.
     * @param {number} [meter] - the threshold for meters, defaults to 1
     * @param {number} [other] - the threshold for everything else, defaults to 1
     * @return {Promise}
     */
    pushThreshold({ meter = 1, other = 1 } = {}) {
        return new Promise((resolve, reject) => {
            if (typeof meter !== 'number' || typeof other !== 'number')
                reject(Error(`pushThreshold invalid threshold ${other || meter}`));
            const { command, response } = getCommand('setPushThreshold', { meter, other });
            this.reqToSend(command, response, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    // #endregion Pushing
}

module.exports = {
    Symetrix,
    helpers: require('./helpers.js'),
};
