import WebSerial from '../stm-serial-flasher/src/api/WebSerial.js';
import settings from '../stm-serial-flasher/src/api/Settings.js';

import { osm_flash_api_t } from './flash_apis.js';
import { disable_interaction } from './disable.js';

class flash_controller_t {
    constructor(port) {
        this.port = port;
        this.PAGE_SIZE = 0x800;
        this.SIZE_BOOTLOADER = 2 * this.PAGE_SIZE;
        this.SIZE_CONFIG = 2 * this.PAGE_SIZE;
        this.ADDRESS_BOOTLOADER = parseInt(settings.startAddress, 16);
        this.ADDRESS_CONFIG = this.ADDRESS_BOOTLOADER + this.SIZE_BOOTLOADER;
        this.ADDRESS_FIRMWARE = this.ADDRESS_CONFIG + this.SIZE_CONFIG;
    }

    static flash_start(osmAPI) {
        return new Promise((resolve, reject) => {
            let deviceInfo = {
                family: '-',
                bl: '-',
                pid: '-',
                commands: [],
            };

            osmAPI.connect({ baudrate: 115200, replyMode: false })
                .then(() => osmAPI.cmdGET())
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
                        pid = osmAPI.cmdGID();
                    } else {
                        pid = '-';
                    }
                    deviceInfo.pid = pid;
                    return pid;
                })
                .then(resolve)
                .catch(reject);
        });
    }

    flash_firmware(fw_bin) {
        const loader = document.getElementById('loader');
        loader.style.display = 'block';
        const disabled = disable_interaction(true);
        if (disabled) {
            let osmAPI;
            let serial;
            this.port.close()
                .then(() => {
                    serial = new WebSerial(this.port);
                    serial.onConnect = () => {};
                    serial.onDisconnect = () => {};
                })
                .then(() => { osmAPI = new osm_flash_api_t(serial); })
                .then(() => flash_controller_t.flash_start(osmAPI))
                .then(() => osmAPI.eraseAll())
                .then(() => {
                    const data_bootloader = new Uint8Array(fw_bin.slice(0, this.SIZE_BOOTLOADER));
                    return osmAPI.write(data_bootloader, this.ADDRESS_BOOTLOADER);
                })
                .then(() => {
                    const data_firmware = new Uint8Array(
                        fw_bin.slice(this.ADDRESS_FIRMWARE - this.ADDRESS_BOOTLOADER, -1),
                    );
                    return osmAPI.write(data_firmware, this.ADDRESS_FIRMWARE);
                })
                .then(() => osmAPI.disconnect())
                .then(() => {
                    this.port.open({ baudRate: 115200 });
                    loader.style.display = 'none';
                    disable_interaction(false);
                });
        }
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

    get_latest_firmware_info() {
        fetch('../../fw_releases/latest_fw_info.json')
            .then((resp) => resp.json())
            .then((json) => {
                this.create_firmware_table(json);
            })
            .catch((err) => {
                console.log(err);
            });
    }

    flash_latest(fw_info) {
        const { port } = this.dev;
        if (window.confirm('Are you sure you want to update the firmware?')) {
            const fw_path = fw_info.path;
            fetch(`../../${fw_path}`)
                .then((r) => r.blob())
                .then((resp) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const fw_bin = Uint8Array.from(e.target.result, (c) => c.charCodeAt(0));
                        const controller = new flash_controller_t(port);
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
