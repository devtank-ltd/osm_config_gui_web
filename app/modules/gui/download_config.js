import { disable_interaction } from './disable.js';

export class save_configuration_t {
    constructor(dev, comms) {
        this.dev = dev;
        this.comms = comms;
        this.btn = document.getElementById('global-save-osm-config');
        this.save_config = this.save_config.bind(this);
    }

    async add_event_listeners() {
        this.btn.addEventListener('click', this.save_config);
    }

    async save_config() {
        await disable_interaction(true);
        const loader = document.getElementById('loader');
        loader.style.display = 'block';
        const ios_regex = /\IO (?<io>[0-9]{2}) : +(\[(?<specials_avail>[A-Za-z0-9 \|]+)\])? ((USED (?<special_used>[A-Za-z0-9]+)( (?<edge>F|R|B))?)|(?<dir>IN|OUT)) (?<pupd>DOWN|UP|NONE|D|U|N)( = (?<level>ON|OFF))?/;

        const json_pop = {
            version: null,
            serial_num: null,
            interval_mins: null,
            comms: {},
            ios: {},
            cts: {
                CC1: {
                    midpoint: null,
                    type: null,
                    input: null,
                    output: null
                },
                CC2: {
                    midpoint: null,
                    type: null,
                    input: null,
                    output: null
                },
                CC3: {
                    midpoint: null,
                    type: null,
                    input: null,
                    output: null
                },
            },
            modbus_bus: {
                setup: null,
                modbus_devices: [],
            },
            measurements: {},
        };

        this.ios = await this.dev.ios();
        this.measurements = await this.dev.get_measurements();
        this.mb_config = await this.dev.modbus_config();
        this.comms_type = await this.dev.comms_type();

        const [mode, baud, parity] = this.mb_config.config;
        const mb_devs = this.mb_config.devices;
        json_pop.modbus_bus.setup = [mode, baud, parity];

        for (let i = 0; i < mb_devs.length; i += 1) {
            const { name } = mb_devs[i];
            const { byteorder } = mb_devs[i];
            const unit = mb_devs[i].unit_id;
            const { wordorder } = mb_devs[i];

            json_pop.modbus_bus.modbus_devices.push({
                name,
                byteorder,
                wordorder,
                unit,
                registers: [],
            });

            const mb_regs = mb_devs[i].registers;
            for (let v = 0; v < mb_regs.length; v += 1) {
                const reg = mb_regs[v].name;
                const { func } = mb_regs[v];
                const n = Number(mb_regs[v].hex);
                const address = '0x'.concat(n.toString(16));
                const { datatype } = mb_regs[v];
                json_pop.modbus_bus.modbus_devices[i].registers.push({
                    reg,
                    function: func,
                    address,
                    datatype,
                });
            }
        }

        for (let i = 0; i < this.ios.length; i += 1) {
            const m = await this.ios[i].match(ios_regex);
            if (!m) {
                break;
            }
            const { io } = await m.groups;
            const { special_used } = await m.groups;
            const { edge } = await m.groups;
            const { dir } = await m.groups;
            let { pupd } = await m.groups;

            if (special_used) {
                json_pop.ios[io] = {
                    special: special_used,
                };
            } else {
                json_pop.ios[io] = {};
            }
            if (edge) {
                json_pop.ios[io].edge = edge;
            }
            if (pupd) {
                if (pupd === 'D') {
                    pupd = 'DOWN';
                } else if (pupd === 'U') {
                    pupd = 'UP';
                } else if (pupd === 'N') {
                    pupd = 'NONE';
                }
                json_pop.ios[io].pull = pupd;
            }
            if (dir) {
                json_pop.ios[io].direction = dir;
            } else if (!dir && !special_used) {
                json_pop.ios[io].direction = 'IN';
            }
        }

        for (let v = 1; v < this.measurements.length; v += 1) {
            const meas = this.measurements[v][0];
            const interval = this.measurements[v][1];
            const samplecount = this.measurements[v][2];

            json_pop.measurements[meas] = {
                interval,
                samplecount,
            };
        }

        const serial_num = await this.dev.serial_number;
        json_pop.serial_num = serial_num;
        json_pop.version = await this.dev.firmware_version;
        json_pop.interval_mins = await this.dev.interval_mins;
        if (this.comms_type.includes('LW')) {
            json_pop.comms.type = 'LW';
            json_pop.comms.dev_eui = await this.comms.lora_deveui;
            json_pop.comms.app_key = await this.comms.lora_appkey;
            json_pop.comms.region = await this.comms.lora_region;
        } else if (this.comms_type.includes('WIFI')) {
            json_pop.comms.type = 'WIFI';
            json_pop.comms.ssid = await this.comms.wifi_ssid;
            json_pop.comms.wifi_pwd = await this.comms.wifi_pwd;
            json_pop.comms.mqtt_addr = await this.comms.mqtt_addr;
            json_pop.comms.mqtt_user = await this.comms.mqtt_user;
            json_pop.comms.mqtt_pwd = await this.comms.mqtt_pwd;
            json_pop.comms.mqtt_port = await this.comms.mqtt_port;
        }

        json_pop.cts.CC1.midpoint = await this.dev.get_cc_mp(1);
        json_pop.cts.CC2.midpoint = await this.dev.get_cc_mp(2);
        json_pop.cts.CC3.midpoint = await this.dev.get_cc_mp(3);
        const type1 = await this.dev.get_cc_type(1);
        const type2 = await this.dev.get_cc_type(2);
        const type3 = await this.dev.get_cc_type(3);
        json_pop.cts.CC1.type = type1.slice(-1)
        json_pop.cts.CC2.type = type2.slice(-1)
        json_pop.cts.CC3.type = type3.slice(-1)

        const gain = await this.dev.get_cc_gain();

        gain.forEach((i, index) => {
            let meas = null;
            const meas_regex = /^(CC\d+)/;
            const meas_match = i.match(meas_regex);
            if (meas_match) {
                meas = meas_match[1];
                console.log(meas);
            }
            const input_ext = /EXT max:\s(\d+(\.\d+)?)/;
            const match = i.match(input_ext);

            if (match) {
                const input = match[1];
                json_pop.cts[meas].input = input;
            } else {
                const output_reg = /INT max:\s(\d+(\.\d+)?)/;
                const output_ext = i.match(output_reg);
                if (output_ext) {
                    const output = output_ext[1];
                    json_pop.cts[meas].output = output;
                }
            }
        })

        const json_str = JSON.stringify(json_pop).replace(/\\n/g, '');
        const json_final = JSON.parse(json_str);

        this.create_download(json_final);
        loader.style.display = 'none';
        await disable_interaction(false);
    }


    async create_download(contents) {
        const dlAnchorElem = window.document.createElement('a');
        window.document.body.appendChild(dlAnchorElem);
        this.dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(contents, null, 2))}`;

        dlAnchorElem.setAttribute('href', this.dataStr);
        dlAnchorElem.setAttribute('download', 'config.json');
        dlAnchorElem.click();
    }
}
