// These are special formatted strings for regex find and replace for required parameter values
// The identifier for replaceable values is {VAL}

/**
 * The Composer Control Protocol is based off of a Telnet-style command/response structure
 * The return value format is not consistent so in order to make this somewhat maintainable
 * the `commands` object tries to list all of the commands, their arguments, and the format
 * of the expected return string.
 *
 * The base property is the format for the command string with arguments specified by the
 * `args` property. In the call to buildCommandString() the input args are substituted for
 * the placeholders in the base string. buildCommandString() contains the logic to handle
 * edge cases where it's not a simple find/replace
 *
 * The respRegex property is a regex string with named groups which are then checked against
 * when a command response is received.
 */
const commands = {
    controlSet: {
        base: 'CS {CID} {VAL}',
        args: {
            id: 'CID',
            value: 'VAL',
        },
        respRegex: /(?<ack>ACK)|(?<nak>NAK)\s/,
    },
    changeController: {
        base: 'CC {CID} {DECINC} {VAL}',
        args: {
            id: 'CID',
            decinc: 'DECINC',
            value: 'VAL',
        },
        respRegex: /(?<ack>ACK)|(?<nak>NAK)\s/,
    },
    controlGet: {
        base: 'GS2 {CID}', // better formatted return than GS {CID}
        args: {
            id: 'CID',
        },
        respRegex: /\d{1,5} (?<ret>\d{1,5})/,
    },
    controlGetBlock: {
        base: 'GSB3 {CID} {SIZE}', // better formatted return than GSB {CID} {SIZE}
        args: {
            id: 'CID',
            size: 'SIZE',
        },
        respRegex: /GSB3 \d{5} \d{5}/,
    },
    getPreset: {
        base: 'GPR',
        args: {},
        respRegex: /(?<ret>\d+)/,
    },
    loadPreset: {
        base: 'LP {VAL}',
        args: {
            value: 'VAL',
        },
        respRegex: /(?<ack>ACK)|(?<nak>NAK)\s/,
    },
    setSystemString: {
        base: 'SSYSS {STR}={VAL}',
        args: {
            string: 'STR',
            value: 'VAL',
        },
        respRegex: /(?<ack>ACK)|(?<nak>NAK)\s/,
    },
    getSystemString: {
        base: 'GSYSS {STR}',
        args: {
            string: 'STR',
        },
        respRegex: /GSYSS (?<ret>.*)\s/,
    },
    flashUnit: {
        base: 'FU',
        args: {},
        respRegex: /(?<ack>ACK)|(?<nak>NAK)\s/,
    },
    pushState: {
        base: 'PU{EN} {LOW} {HIGH}',
        args: {
            enable: 'EN',
            low: 'LOW',
            high: 'HIGH',
        },
        respRegex: /(?<ack>ACK)|(?<nak>NAK)\s/,
    },
    getPushEnabled: {
        base: 'GPU {LOW} {HIGH}',
        args: {
            low: 'LOW',
            high: 'HIGH',
        },
        respRegex: /(?<ack>ACK)|(?<ret>\d{5})]/,
    },
    pushRefresh: {
        base: 'PUR {LOW} {HIGH}',
        args: {
            low: 'LOW',
            high: 'HIGH',
        },
        respRegex: /(?<ack>ACK)|(?<nak>NAK)\s/,
    },
    pushClear: {
        base: 'PUC {LOW} {HIGH}',
        args: {
            low: 'LOW',
            high: 'HIGH',
        },
        respRegex: /(?<ack>ACK)|(?<nak>NAK)\s/,
    },
    setPushInterval: {
        base: 'PUI {VAL}',
        args: {
            value: 'VAL',
        },
        respRegex: /(?<ack>ACK)|(?<nak>NAK)\s/,
    },
    setPushThreshold: {
        base: 'PUT {PARAM_THRESH} {METER_THRESH}',
        args: {
            other: 'PARAM_THRESH',
            meter: 'METER_THRESH',
        },
        respRegex: /(?<ack>ACK)|(?<nak>NAK)\s/,
    },
    reboot: {
        base: 'R!',
        args: {},
        respRegex: /(?<ack>.*)/,
    },
};

/**
 * Takes a desired command and command arguments as input and returns a formatted
 * command string that the Composer Control Protocol is expecting. If the input
 * command is not found in the commands object, undefined is returned
 * @param {string} command - the desired command string to build, must be in the commands object or undefined is returned
 * @param {object} inArgs - a list of arguments to add to the command string
 * @returns {object} the build command string and the associated regex string to parse the response
 */
function buildCommandString(command, inArgs) {
    // console.log(command, inArgs)
    if (command in commands) {
        let cmd = '$q ' + commands[command].base; // prefix everything with $q to enforce quiet mode on responses
        // let cmd = commands[command].base; // prefix everything with $q to enforce quiet mode on responses
        // console.log(cmd)
        for (const arg in commands[command].args) {
            let val;
            // Handle special cases for potential arguments
            switch (arg) {
                case 'decinc':
                    // This is only for the changeController command
                    val = inArgs.value >= 0 ? '1' : '0';
                    inArgs.value = Math.abs(inArgs.value);
                    break;
                case 'enable':
                    // just for the pushState command
                    val = inArgs.enable ? 'E' : 'D';
                    break;
                default:
                    val = inArgs[arg];
                    // to handle arguments that are undefined in inArgs
                    if (typeof val === 'undefined') val = '';
                    break;
            }
            cmd = cmd.replace(`{${commands[command].args[arg]}}`, val);
            // console.log(cmd)
        }
        return { command: `${cmd.trim()}\r`, response: commands[command].respRegex };
    } else return undefined;
}

module.exports = { commands, getCommand: buildCommandString };
