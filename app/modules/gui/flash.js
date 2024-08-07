import WebSerial from '../../libs/stm-serial-flasher/api/WebSerial.js';
import settings from '../../libs/stm-serial-flasher/api/Settings.js';
import tools from '../../libs/stm-serial-flasher/tools.js';

import { osm_flash_api_t, rak3172_flash_api_t } from './flash_apis.js';
import { disable_interaction } from './disable.js';
import { move_bar } from './progressbar.js';

class flash_controller_base_t {
    constructor(params) {
        this.port = params.port;
        this.api_type = params.api_type;
        this.api_ext_params = params.api_ext_params;
        this.baudrate = params.baudrate;
        this.flash_firmware = this.flash_firmware.bind(this);
    }

    static async write_data(api, records, msg) {
        for (const rec of records) {
            await api.write(rec.data, rec.address, null, msg);
        }
    }

    static async write_comms_data(api, records, msg) {
        const records_len = records.length;
        for (let i = 0; i < records.length; i += 1) {
            const percentage = (i / records_len) * 100;
            move_bar(percentage, msg);
            await api.write(records[i].data, records[i].address, null, msg);
        }
        move_bar(null, null);
    }

    flash_start(stm_api) {
        return new Promise((resolve, reject) => {
            let deviceInfo = {
                family: '-',
                bl: '-',
                pid: '-',
                commands: [],
            };
            stm_api.connect({ baudrate: this.baudrate, replyMode: false })
                .then(() => stm_api.cmdGET())
                .then((info) => {
                    deviceInfo = {
                        bl: info.blVersion,
                        commands: info.commands,
                        family: info.getFamily(),
                    };
                })
                .then(() => {
                    let pid;
                    if (deviceInfo.family === 'STM32') {
                        pid = stm_api.cmdGID();
                    } else {
                        pid = '-';
                    }
                    deviceInfo.pid = pid;
                    return pid;
                })
                .then(resolve)
                .catch((e) => {
                    console.log(e);
                    reject();
                });
        });
    }

    flash_firmware(fw_bin) {
        const errlabel = document.getElementById('errorlabel');
        errlabel.style.display = 'none';
        const msg = 'Writing OSM firmware...';
        const disabled = disable_interaction(true);
        if (disabled) {
            let stm_api;
            let serial;
            this.port.close()
                .then(() => {
                    serial = new WebSerial(this.port);
                    serial.onConnect = () => {};
                    serial.onDisconnect = () => {};
                })
                .then(() => { stm_api = new this.api_type(serial, this.api_ext_params); })
                .then(() => this.flash_start(stm_api))
                .then(() => stm_api.eraseAll())
                .then(() => {
                    const records = this.get_records(fw_bin);
                    return flash_controller_base_t.write_data(stm_api, records, msg);
                })
                .then(() => stm_api.disconnect())
                .then(() => {
                    window.location.reload();
                })
                .catch(async () => {
                    errlabel.style.display = 'block';
                    errlabel.textContent = 'Failed to write firmware.';
                    await stm_api.disconnect();
                    disable_interaction(false);
                });
        }
    }
}

class flash_controller_t extends flash_controller_base_t {
    constructor(dev) {
        super({
            port: dev.port,
            api_type: osm_flash_api_t,
            api_ext_params: { dev },
            baudrate: '115200',
        });
        this.PAGE_SIZE = 0x800;
        this.SIZE_BOOTLOADER = 2 * this.PAGE_SIZE;
        this.SIZE_CONFIG = 2 * this.PAGE_SIZE;
        this.ADDRESS_BOOTLOADER = parseInt(settings.startAddress, 16);
        this.ADDRESS_CONFIG = this.ADDRESS_BOOTLOADER + this.SIZE_BOOTLOADER;
        this.ADDRESS_FIRMWARE = this.ADDRESS_CONFIG + this.SIZE_CONFIG;
    }

    get_records(data) {
        const records = [{
            data: new Uint8Array(data.slice(0, this.SIZE_BOOTLOADER)),
            address: this.ADDRESS_BOOTLOADER,
        },
        {
            data: new Uint8Array(
                data.slice(this.ADDRESS_FIRMWARE - this.ADDRESS_BOOTLOADER, -1),
            ),
            address: this.ADDRESS_FIRMWARE,
        }];
        return records;
    }
}

class rak3172_flash_controller_t extends flash_controller_base_t {
    constructor(dev) {
        super({
            port: dev.port,
            api_type: rak3172_flash_api_t,
            api_ext_params: { dev },
            baudrate: '57600',
        });
    }

    flash_start(stm_api) {
        return new Promise((resolve, reject) => {
            let deviceInfo = {
                family: '-',
                bl: '-',
                pid: '-',
                commands: [],
            };
            stm_api.connect({ baudrate: this.baudrate, replyMode: false })
                .then(() => stm_api.cmdGET())
                .then((info) => {
                    deviceInfo = {
                        bl: info.blVersion,
                        commands: info.commands,
                        family: info.getFamily(),
                    };
                })
                .then(() => {
                    let pid;
                    if (deviceInfo.family === 'STM32') {
                        pid = stm_api.cmdGID();
                    } else {
                        pid = '-';
                    }
                    deviceInfo.pid = pid;
                    return pid;
                })
                .then(resolve)
                .catch((e) => {
                    console.log(e);
                    reject();
                });
        });
    }

    flash_firmware(records) {
        const serial = new WebSerial(this.port);
        serial.onConnect = () => {};
        serial.onDisconnect = () => {};
        const stm_api = new rak3172_flash_api_t(serial, this.api_ext_params);
        const proglabel = document.getElementById('progresslabel');
        const errlabel = document.getElementById('errorlabel');
        errlabel.style.display = 'none';
        proglabel.style.display = 'block';
        proglabel.textContent = 'Initiating comms firmware update...';
        this.flash_start(stm_api)
            .then(() => stm_api.eraseAll())
            .then(() => {
                const msg = 'Writing LoRaWAN firmware...';
                return flash_controller_base_t.write_comms_data(stm_api, records, msg);
            })
            .then(() => stm_api.disconnect())
            .then(() => disable_interaction(false))
            .catch(async () => {
                move_bar(null, null);
                proglabel.style.display = 'none';
                errlabel.style.display = 'block';
                errlabel.textContent = 'Failed to write comms firmware.';
                await stm_api.disconnect();
                disable_interaction(false);
            });
    }
}

export class firmware_t {
    constructor(dev) {
        this.dev = dev;
        this.create_firmware_table = this.create_firmware_table.bind(this);
        this.flash_latest = this.flash_latest.bind(this);
    }

    async create_firmware_table(fw_info) {
        await disable_interaction(true);
        const json_fw = fw_info;
        const tablediv = document.getElementById('home-firmware-table');

        const tbl = tablediv.appendChild(document.createElement('table'));
        const body = tbl.createTBody();
        tbl.createTHead();

        const title = tbl.tHead.insertRow();
        const title_cell = title.insertCell();
        title_cell.textContent = 'Latest Firmware Available';

        for (const [key, value] of Object.entries(json_fw)) {
            if (key !== 'path') {
                const fw_row = body.insertRow();
                const keyh = fw_row.insertCell();
                let key_f;
                if (key === 'sha') {
                    key_f = key.toUpperCase();
                } else {
                    key_f = key.charAt(0).toUpperCase() + key.slice(1);
                }
                keyh.textContent = `${key_f}: ${value}`;
            }
        }

        const flash_btn = document.getElementById('fw-btn');
        flash_btn.style.display = 'block';
        flash_btn.addEventListener('click', () => { this.flash_latest(fw_info); });

        await disable_interaction(false);
    }

    async get_latest_firmware_info(model) {
        try {
            const j = await fetch('../../fw_releases/latest_fw_info.json');
            const resp = await j.json();
            const fw_entry = resp.find((element) => element.path.startsWith(`${model}_release`) && element.path.endsWith('.bin'));
            if (!fw_entry) {
                console.log(`No fw entry for model ${model}`);
            }
            console.log(`FW entry for model ${model}`);
            await this.create_firmware_table(fw_entry);
            return true;
        } catch (e) {
            console.log(e);
            return false;
        }
    }

    flash_latest(fw_info) {
        const { port } = this.dev;
        if (window.confirm('Have you downloaded your configuration? Flashing firmware may result in loss of config.')) {
            const fw_path = fw_info.path;
            fetch(`../../fw_releases/${fw_path}`)
                .then((r) => r.blob())
                .then((resp) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const fw_bin = Uint8Array.from(e.target.result, (c) => c.charCodeAt(0));
                        const controller = new flash_controller_t(this.dev);
                        controller.flash_firmware(fw_bin);
                    };
                    reader.onerror = (e) => {
                        console.log(e);
                    };
                    reader.readAsBinaryString(resp);
                });
        }
    }
}

export class rak3172_firmware_t {
    constructor(dev) {
        this.dev = dev;
        this.add_comms_btn_listener = this.add_comms_btn_listener.bind(this);
    }

    flash_latest() {
        if (window.confirm('Are you sure you want to update the LoRaWAN Communications firmware?')) {
            fetch('../../fw_releases/RAK3172-E_latest_final.hex')
                .then((r) => r.blob())
                .then((resp) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const records = tools.parseHex(
                            true,
                            256,
                            e.target.result,
                        );
                        const rak3172_flash_controller = new rak3172_flash_controller_t(this.dev);
                        const disabled = disable_interaction(true);
                        rak3172_flash_controller.flash_firmware(records);
                    };
                    reader.onerror = (e) => {
                        console.log(e);
                    };
                    reader.readAsBinaryString(resp);
                });
        }
    }

    async add_comms_btn_listener() {
        const flash_btn = document.getElementById('comms-btn');
        flash_btn.style.display = 'block';
        flash_btn.addEventListener('click', () => { this.flash_latest(); });
    }
}
