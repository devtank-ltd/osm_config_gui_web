import { disable_interaction } from './disable.js';

export class load_configuration_t {
    constructor(dev, comms) {
        this.dev = dev;
        this.comms = comms;
        this.btn = document.getElementById('global-load-osm-config');
        this.open_file_dialog = this.open_file_dialog.bind(this);
        this.write_modbus = this.write_modbus.bind(this);
        this.load_gui_with_config = this.load_gui_with_config.bind(this);
    }

    async add_listener() {
        this.btn.addEventListener('click', this.open_file_dialog);
    }

    load_gui_with_config(content) {
        disable_interaction(true);
        const loader = document.getElementById('loader');
        loader.style.display = 'block';
        this.dev.wipe()
            .then(() => {
                const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
                sleep(2000);
            })
            .then(async () => {
                this.content = JSON.parse(content);
                this.modbus_setup = this.content.modbus_bus.setup;
                this.modbus_devices = this.content.modbus_bus.modbus_devices;
                this.setup = await this.dev.modbus_setup(
                    this.modbus_setup[0],
                    this.modbus_setup[1],
                    this.modbus_setup[2],
                );
                this.devs = await this.write_modbus(this.modbus_devices);
            })
            .then(async () => {
                this.measurements = this.content.measurements;
                for (const [key, value] of Object.entries(this.measurements)) {
                    await this.dev.change_interval(key, value.interval);
                    await this.dev.change_samplecount(key, value.samplecount);
                }
            })
            .then(async () => {
                this.ios = this.content.ios;
                if (this.ios) {
                    for (const [key, value] of Object.entries(this.ios)) {
                        if (value.special) {
                            await this.dev.activate_io(value.special, key, value.edge, value.pull);
                        } else {
                            await this.dev.disable_io(key);
                        }
                    }
                }
            })
            .then(async () => {
                this.comms_type = this.content.comms.type;
            })
            .then(async () => {
                if (this.comms_type.includes('LW')) {
                    this.app_key = this.content.comms.app_key;
                    this.dev_eui = this.content.comms.dev_eui;
                    this.region = this.content.comms.region;
                    if (this.app_key) {
                        await this.dev.do_cmd(`comms_config app-key ${this.app_key}`);
                        await this.dev.do_cmd(`comms_config dev-eui ${this.dev_eui}`);
                        await this.dev.do_cmd(`comms_config region ${this.region}`);
                    }
                } else if (this.comms_type.includes('WIFI')) {
                    this.wifi_ssid = this.content.comms.wifi_ssid;
                    this.wifi_pwd = this.content.comms.wifi_pwd;
                    this.mqtt_addr = this.content.comms.mqtt_addr;
                    this.mqtt_user = this.content.comms.mqtt_user;
                    this.mqtt_pwd = this.content.comms.mqtt_pwd;
                    this.mqtt_port = this.content.comms.mqtt_port;
                    this.mqtt_sch = this.content.comms.mqtt_sch;
                    await this.dev.do_cmd(`comms_config wifi_ssid ${this.wifi_ssid}`);
                    await this.dev.do_cmd(`comms_config wifi_pwd ${this.wifi_pwd}`);
                    await this.dev.do_cmd(`comms_config mqtt_addr ${this.mqtt_addr}`);
                    await this.dev.do_cmd(`comms_config mqtt_user ${this.mqtt_user}`);
                    await this.dev.do_cmd(`comms_config mqtt_pwd ${this.mqtt_pwd}`);
                    await this.dev.do_cmd(`comms_config mqtt_port ${this.mqtt_port}`);
                    await this.dev.do_cmd(`comms_config mqtt_sch ${this.mqtt_sch}`);
                }
            })
            .then(async () => {
                this.cts = this.content.cts;
                for (const [key, value] of Object.entries(this.cts)) {
                    const output_conv = parseFloat(value.output);
                    await this.dev.update_midpoint(key, value.midpoint);
                    await this.dev.set_cc_type(key.slice(-1), value.type);
                    await this.dev.set_cc_gain(key.slice(-1), value.input, output_conv * 1000.0);
                }
            })
            .then(() => this.dev.do_cmd(`name ${this.content.name}`))
            .then(() => this.dev.do_cmd(`serial_num ${this.content.serial_num}`))
            .then(() => this.dev.do_cmd(`interval_mins ${this.content.interval_mins}`))
            .then(() => this.dev.save())
            .then(() => this.dev.do_cmd(`serial_num ${this.content.serial_num}`))
            .then(() => {
                loader.style.display = 'none';
                disable_interaction(false);
                window.location.reload();
            });
    }

    async write_modbus(mb_devs) {
        for (let i = 0; i < mb_devs.length; i += 1) {
            await this.dev.mb_dev_add(
                mb_devs[i].unit,
                mb_devs[i].byteorder,
                mb_devs[i].wordorder,
                mb_devs[i].name,
            );
            const regs = mb_devs[i].registers;
            for (let v = 0; v < regs.length; v += 1) {
                await this.dev.mb_reg_add(
                    mb_devs[i].unit,
                    regs[v].address,
                    regs[v].function,
                    regs[v].datatype,
                    regs[v].reg,
                );
            }
        }
    }

    async open_file_dialog() {
        this.load_file_dialog = document.createElement('input');
        this.load_file_dialog.type = 'file';
        this.load_file_dialog.accept = '.json';
        this.load_file_dialog.onchange = (_) => {
            const reader = new FileReader();
            const file = Array.from(this.load_file_dialog.files)[0];
            if (file.name.includes('.json')) {
                reader.readAsText(file, 'application/json');
                reader.onload = (e) => { this.load_gui_with_config(e.target.result); };
                reader.onerror = (error) => {
                };
            }
        };
        this.load_file_dialog.click();
    }
}
