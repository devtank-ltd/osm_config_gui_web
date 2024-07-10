import { STMApi } from '../../libs/stm-serial-flasher/api/STMapi.js';
import logger from '../../libs/stm-serial-flasher/api/Logger.js';
import tools from '../../libs/stm-serial-flasher/tools.js';
import { move_bar } from './progressbar.js';

const PIN_HIGH = false;
const PIN_LOW = true;

const SYNCHR = 0x7F;
const ACK = 0x79;
const NACK = 0x1F;
const CMD_GET = 0x00;
const CMD_GID = 0x02;
const MAX_WRITE_BLOCK_SIZE_STM32 = 256;
const MAX_WRITE_BLOCK_SIZE_STM8 = 128;

function u8a(array) {
    return new Uint8Array(array);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EwrLoadState = Object.freeze({
    NOT_LOADED: Symbol('not_loaded'),
    LOADING: Symbol('loading'),
    LOADED: Symbol('loaded'),
});

class InfoGET {
    constructor() {
        // Bootloader version
        this.blVersion = null;
        // List of supported commands
        this.commands = [];
    }

    getFamily() {
        return this.commands.indexOf(CMD_GID) === -1 ? 'STM8' : 'STM32';
    }
}

export class osm_flash_api_t extends STMApi {
    constructor(port, params) {
        super(port);
        this.dev = params.dev;
        this.open_params = undefined;
        this.dev_params = {
            baudRate: 115200, databits: 8, stopbits: 1, parity: 'none',
        };
    }

    /**
     * Executes GET command
     * @returns {Promise<InfoGET>}
     */
    async cmdGET() {
        return new Promise((resolve, reject) => {
            if (!this.serial.isOpen()) {
                reject(new Error('Connection must be established before sending commands'));
                return;
            }

            this.serial.write(u8a([CMD_GET, 0xFF ^ CMD_GET]))
                .then(() => sleep(100)) /* Slow machines require a delay to gather full response */
                .then(() => this.readResponse())
                .then(async (resp) => {
                    const response = Array.from(resp);
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response');
                    }

                    if (response.length === 1) {
                        let res = await this.readResponse();
                        [response[1]] = res;
                        res = await this.readResponse(); // bl version
                        [response[2]] = res;
                        for (let i = 0; i <= response[1]; i += 1) {
                            res = await this.readResponse();
                            [response[3 + i]] = res;
                        }
                    }

                    const info = new InfoGET();
                    info.blVersion = `${(response[2] >> 4)}.${(response[2] & 0x0F)}`;
                    for (let i = 0; i < response[1]; i += 1) {
                        info.commands.push(response[3 + i]);
                    }
                    this.commands = info.commands;
                    if (info.getFamily() === 'STM32') {
                        this.writeBlockSize = MAX_WRITE_BLOCK_SIZE_STM32;
                        this.ewrLoadState = EwrLoadState.LOADED;
                    } else {
                        this.writeBlockSize = MAX_WRITE_BLOCK_SIZE_STM8;
                    }
                    resolve(info);
                })
                .catch(reject);
        });
    }

    /**
     * Execute Get ID command
     * STM32 only
     */
    async cmdGID() {
        return new Promise((resolve, reject) => {
            if (!this.commands.length) {
                reject(new Error('Execute GET command first'));
                return;
            }

            if (this.commands.indexOf(CMD_GID) === -1) {
                reject(new Error('GET ID command is not supported by the current target'));
                return;
            }

            if (!this.serial.isOpen()) {
                reject(new Error('Connection must be established before sending commands'));
                return;
            }

            this.serial.write(u8a([CMD_GID, 0xFF ^ CMD_GID]))
                .then(() => sleep(100)) /* Slow machines require a delay to gather full response */
                .then(() => this.readResponse())
                .then((response) => {
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response');
                    }
                    const pid = `0x${tools.b2hexstr(response[2]) + tools.b2hexstr(response[3])}`;
                    resolve(pid);
                })
                .catch(reject);
        });
    }

    /**
     * Connect to the target by resetting it and activating the ROM bootloader
     * @param {object} params
     * @returns {Promise}
     */

    async write(data, address, onProgress, msg) {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            logger.log(`Writing ${data.length} bytes to flash at address 0x${address.toString(16)} using ${this.writeBlockSize} bytes chunks`);
            if (!this.serial.isOpen()) {
                reject(new Error('Connection must be established before sending commands'));
                return;
            }

            const blocksCount = Math.ceil(data.byteLength / this.writeBlockSize);

            let offset = 0;
            const blocks = [];
            for (let i = 0; i < blocksCount; i += 1) {
                const block = {};

                if (i < blocksCount - 1) {
                    block.data = data.subarray(offset, offset + this.writeBlockSize);
                } else {
                    block.data = data.subarray(offset);
                }
                offset += block.data.length;
                blocks.push(block);
            }

            for (let i = 0; i < blocks.length; i += 1) {
                const block = blocks[i];
                try {
                    if (onProgress) {
                        onProgress(i, blocksCount);
                    }
                    const percentage = (i / blocks.length) * 100;
                    move_bar(percentage, msg);
                    await this.cmdWRITE(block.data, address + i * this.writeBlockSize);
                } catch (e) {
                    move_bar(null, null);
                    reject(e);
                    return;
                }
            }
            logger.log('Finished writing');
            move_bar(null, null);
            resolve();
        });
    }

    async connect(params) {
        this.ewrLoadState = EwrLoadState.NOT_LOADED;
        return new Promise((resolve, reject) => {
            if (this.serial.isOpen()) {
                reject(new Error('Port already opened'));
                return;
            }

            this.replyMode = params.replyMode || false;

            const open_params = {
                baudRate: parseInt(params.baudrate, 10),
                parity: this.replyMode ? 'none' : 'even',
            };
            const signal = {};
            this.serial.open(open_params)
                .then(() => {
                    if (navigator.platform === 'Linux armv81' || navigator.platform === 'Linux x86_64') {
                        signal.dataTerminalReady = PIN_HIGH;
                        signal.requestToSend = PIN_HIGH;
                        this.serial.control(signal);
                    }
                })
                .then(() => this.activateBootloader())
                .then(resolve)
                .catch(reject);
        });
    }

    /**
     * Close current connection. Before closing serial connection
     * disable bootloader and reset target
     * @returns {Promise}
     */
    async disconnect() {
        return new Promise((resolve, reject) => {
            const signal = {};
            signal.dataTerminalReady = PIN_HIGH;
            signal.requestToSend = PIN_HIGH;
            this.serial.control(signal)
                .then(() => this.resetTarget())
                .then(() => this.serial.close())
                .then(resolve)
                .catch(reject);
        });
    }

    /**
     * Activate the ROM bootloader
     * @private
     * @returns {Promise}
     */
    async activateBootloader() {
        return new Promise((resolve, reject) => {
            if (!this.serial.isOpen()) {
                reject(new Error('Port must be opened before activating the bootloader'));
                return;
            }

            const signal = {};
            signal.dataTerminalReady = PIN_LOW;
            signal.requestToSend = PIN_HIGH;
            this.serial.control(signal)
                .then(() => {
                    signal.dataTerminalReady = PIN_LOW;
                    signal.requestToSend = PIN_LOW;
                    this.serial.control(signal);
                })
                .then(() => sleep(100)) /* Wait for bootloader to finish booting */
                .then(() => this.serial.write(u8a([SYNCHR])))
                .then(() => this.serial.read())
                .then((response) => {
                    if (response[0] === ACK) {
                        if (this.replyMode) {
                            return this.serial.write(u8a([ACK]));
                        }
                        return Promise.resolve();
                    }
                    console.log(`Unexpected response: ${response}`);
                    return Promise.reject();
                })
                .then(() => {
                    resolve();
                })
                .catch(reject);
        });
    }

    /**
     * Resets the target by toggling a control pin defined in RESET_PIN
     * @private
     * @returns {Promise}
     */
    async resetTarget() {
        return new Promise((resolve, reject) => {
            const signal = {};

            if (!this.serial.isOpen()) {
                reject(new Error('Port must be opened for device reset'));
                return;
            }

            signal.dataTerminalReady = PIN_HIGH;
            signal.requestToSend = PIN_LOW;
            this.serial.control(signal)
                .then(() => {
                    signal.dataTerminalReady = PIN_HIGH;
                    signal.requestToSend = PIN_HIGH;
                    return this.serial.control(signal);
                })
                .then(() => {
                    // wait for device init
                    this.ewrLoadState = EwrLoadState.NOT_LOADED;
                    setTimeout(resolve, 200);
                })
                .catch(reject);
        });
    }
}

export class rak3172_flash_api_t extends STMApi {
    constructor(port, params) {
        super(port);
        this.dev = params.dev;
        this.open_params = undefined;
        this.dev_params = {
            baudRate: 115200, databits: 8, stopbits: 1, parity: 'none',
        };
        this.comms_mode_span = 3100;
    }

    /**
     * Connect to the target by resetting it and activating the ROM bootloader
     * @param {object} params
     * @returns {Promise}
     */
    async connect(params) {
        const open_params = {
            baudRate: parseInt(params.baudrate, 10),
            parity: this.replyMode ? 'none' : 'even',
        };
        this.open_params = open_params;
        this.ewrLoadState = EwrLoadState.NOT_LOADED;
        return new Promise((resolve, reject) => {
            this.activateBootloader()
                .then(resolve)
                .catch(reject);
        });
    }

    /**
     * Close current connection. Before closing serial connection
     * disable bootloader and reset target
     * @returns {Promise}
     */
    async disconnect() {
        const { dev_params } = this;
        return new Promise((resolve, reject) => {
            this.serial.close()
                .then(() => setTimeout(() => {
                    this.dev.port.open(dev_params)
                        .then(() => this.dev.do_cmd_multi('comms_boot 0'))
                        .then(() => this.resetTarget())
                        .then(() => this.dev.do_cmd_multi('?'))
                        .then(resolve)
                        .catch(reject);
                }, 4000));
        });
    }

    async comms_direct_drain() {
        return new Promise((resolve, reject) => {
            this.dev.do_cmd_multi('comms_boot 1')
                .then(() => this.resetTarget())
                .then(() => this.dev.enter_comms_direct_mode())
                .then(() => this.dev.exit_comms_direct_mode())
                .then(() => {
                    resolve();
                })
                .catch(reject);
        });
    }

    /**
     * Activate the ROM bootloader
     * @private
     * @returns {Promise}
     */
    async activateBootloader() {
        const { open_params } = this;
        return new Promise((resolve, reject) => {
            this.comms_direct_drain()
                .then(() => this.dev.do_cmd_multi('comms_boot 1'))
                .then(() => this.resetTarget())
                .then(() => this.dev.do_cmd('comms_direct'))
                .then(() => this.dev.ll.port.close())
                .then(() => this.serial.open(open_params))
                .then(() => sleep(100)) /* Wait for bootloader to finish booting */
                .then(() => this.serial.write(u8a([SYNCHR])))
                .then(() => this.serial.read())
                .then((response) => {
                    if (response[0] === ACK) {
                        if (this.replyMode) {
                            return this.serial.write(u8a([ACK]));
                        }
                        return Promise.resolve();
                    }
                    console.log(`Unexpected response: ${response}`);
                    return Promise.reject();
                })
                .then(() => {
                    resolve();
                })
                .catch(reject);
        });
    }

    /**
     * Resets the target by toggling a control pin defined in RESET_PIN
     * @private
     * @returns {Promise}
     */
    async resetTarget() {
        return new Promise((resolve, reject) => {
            this.dev.do_cmd_multi('comms_reset 0')
                .then(() => this.dev.do_cmd_multi('comms_reset 1'))
                .then(() => {
                    resolve();
                })
                .catch(reject);
        });
    }
}
