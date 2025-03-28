import { disable_interaction } from './disable.js';

export class wifi_config_t {
    constructor(dev, comms) {
        this.dev = dev;
        this.comms = comms;
        this.write_config = this.write_config.bind(this);
        this.populate_wifi_fields = this.populate_wifi_fields.bind(this);
        this.populate_wifi_ssid_dropdown = this.populate_wifi_ssid_dropdown.bind(this);
        this.close_dropdown_menu();
        this.update_wifi_ssid_selection = this.update_wifi_ssid_selection.bind(this);
        this.update_comms_status = this.update_comms_status.bind(this);
        this.add_refresh_listener = this.add_refresh_listener.bind(this);
    }

    async add_listeners() {
        const sendbtn = document.getElementById('wifi-send-config');
        sendbtn.onclick = this.write_config;
    }

    async get_ssid_html() {
        this.resp = await fetch('modules/gui/html/wifi_ssid_dropdown.html');
        this.text = await this.resp.text();
        return this.text;
    }

    async get_status_html() {
        this.resp = await fetch('modules/gui/html/status_refresh.html');
        this.text = await this.resp.text();
        return this.text;
    }

    async get_scheme_html() {
        this.resp = await fetch('modules/gui/html/mqtt_scheme_dropdown.html');
        this.text = await this.resp.text();
        return this.text;
    }

    async close_dropdown_menu() {
        window.onclick = (event) => {
            if (!event.target.matches('.wifi-ssid-dropbtn')) {
                this.dropdowns = document.getElementsByClassName('wifi-ssid-dropdown-content');
                let i;
                for (i = 0; i < this.dropdowns.length; i += 1) {
                    const open_dropdown = this.dropdowns[i];
                    if (open_dropdown.classList.contains('show')) {
                        open_dropdown.classList.remove('show');
                    }
                }
            }
        };
    }

    async show_dropdown_content() {
        this.content = document.getElementById('wifi-ssid-dropdown-content');
        this.content.classList.toggle('show');
    }

    async get_sig_strength_img_path(strength) {
        let resp;
        if (Number(strength) >= -45) {
            resp = await fetch('modules/gui/html/wifi_good.html');
            this.img = await resp.text();
        } else if (Number(strength) >= -55) {
            resp = await fetch('modules/gui/html/wifi_fair.html');
            this.img = await resp.text();
        } else {
            resp = await fetch('modules/gui/html/wifi_weak.html');
            this.img = await resp.text();
        }
        return this.img;
    }

    async get_lock_html() {
        this.resp = await fetch('modules/gui/html/lock.html');
        this.lock = await this.resp.text();
        return this.lock;
    }

    async update_wifi_ssid_selection(e) {
        if (e.target.parentNode.className === 'lock-container') {
            this.current_ssid_sel = e.target.parentNode.parentNode.innerText;
        } else if (e.target.className === 'lock-container') {
            this.current_ssid_sel = e.target.parentNode.innerText;
        } else {
            this.current_ssid_sel = e.target.innerText;
        }
        if (this.current_ssid_sel === 'Other:') {
            this.wifi_ssid_sel.nextElementSibling.style.display = 'inline';
        } else {
            this.wifi_ssid_sel.nextElementSibling.style.display = 'none';
        }
        document.getElementById('wifi-ssid-dropbtn').innerText = this.current_ssid_sel;
    }

    async populate_wifi_ssid_dropdown() {
        disable_interaction(true);
        const input = document.getElementById('wifi-ssid-dropdown-input');
        input.style.display = 'none';
        input.value = '';
        if (this.current_written_ssid.length > 1) {
            this.wifi_ssid_dropbtn.innerText = this.current_written_ssid;
        } else {
            this.wifi_ssid_dropbtn.innerText = 'Select Network';
        }
        const loader = document.getElementById('loader');
        loader.style.opacity = '100';
        this.wifi_ssid_sel.innerHTML = '';
        this.comms_list = await this.dev.network_list();
        loader.style.opacity = '0';
        disable_interaction(false);

        if (this.comms_list) {
            for (let i = 0; i < this.comms_list.length; i += 1) {
                const signal_strength = this.comms_list[i].RSSI;
                const is_locked = this.comms_list[i].encryption;
                const imgpath = await this.get_sig_strength_img_path(signal_strength);
                const opt = document.createElement('a');
                opt.classList.add('wifi-opt');
                opt.id = `wifi-opt${i}`;
                opt.style.display = 'flex';
                opt.style.alignItems = 'center';
                opt.style.height = '15px';
                opt.style.gap = '10px';
                opt.value = this.comms_list[i].SSID;
                opt.innerHTML += this.comms_list[i].SSID;
                opt.style.cursor = 'pointer';
                opt.onclick = this.update_wifi_ssid_selection;
                const div = document.createElement('div');
                if (!is_locked.includes('OPEN')) {
                    const lock = await this.get_lock_html();
                    div.innerHTML += lock;
                }
                div.innerHTML += imgpath;
                opt.innerHTML += div.innerHTML;
                this.wifi_ssid_sel.appendChild(opt);
            }
        } else {
            const emptyopt = document.createElement('option');
            emptyopt.text = '';
            this.wifi_ssid_sel.appendChild(emptyopt);
        }
        await this.add_other_ssid_opt();
    }

    async get_comms_status() {
        const comms_conn = await this.comms.comms_conn;
        const status = comms_conn.includes('1 | Connected') ? 'Connected' : 'Disconnected';
        return status;
    }

    async add_refresh_listener() {
        this.comms_refresh_btn = document.getElementById('comms-status-refresh');
        this.comms_refresh_btn.onclick = this.update_comms_status;
    }

    async update_comms_status() {
        disable_interaction(true);
        const comms_status = await this.get_comms_status();
        const status_input = document.getElementById('wifi-status-value');
        if (status_input) {
            status_input.innerHTML = comms_status;
            status_input.innerHTML += this.status_refresh;
            await this.add_refresh_listener();
        }
        disable_interaction(false);
    }

    async add_other_ssid_opt() {
        const otheropt = document.createElement('a');
        otheropt.text = 'Other:';
        otheropt.value = 'other';
        otheropt.style.cursor = 'pointer';
        otheropt.id = 'otheropt';
        otheropt.onclick = await this.update_wifi_ssid_selection;
        this.wifi_ssid_sel.appendChild(otheropt);
    }

    async populate_wifi_fields() {
        const title = 'WiFi Configuration';
        const wifi_headers = ['SSID', 'WiFi Password', 'MQTT Address', 'MQTT User', 'MQTT Pwd', 'MQTT Port', 'MQTT Scheme', 'Status'];

        this.current_written_ssid = await this.comms.wifi_ssid;
        const wifi_pwd = await this.comms.wifi_pwd;
        const mqtt_addr = await this.comms.mqtt_addr;
        const mqtt_user = await this.comms.mqtt_user;
        const mqtt_pwd = await this.comms.mqtt_pwd;
        const mqtt_port = await this.comms.mqtt_port;
        const mqtt_scheme = await this.comms.mqtt_sch;
        const scheme_dropdwn = await this.get_scheme_html();
        const ssid_dropdwn = await this.get_ssid_html();
        this.status_refresh = await this.get_status_html();

        const lora_div = document.getElementById('lora-config-div');
        lora_div.style.display = 'none';
        const wifi_res = document.querySelector('div.wifi-config-table');
        wifi_res.style.display = 'block';
        const wifi_btns = document.getElementById('wifi-btns');
        wifi_btns.style.display = 'flex';
        const wifi_tbl = wifi_res.appendChild(document.createElement('table'));
        const wifi_tBody = wifi_tbl.createTBody();
        wifi_tbl.createTHead();

        const wifi_row = wifi_tbl.tHead.insertRow();
        const cell = wifi_row.insertCell();
        cell.colSpan = 2;
        cell.innerText = title;
        cell.style.textAlign = 'center';
        const comms_status = await this.get_comms_status();

        wifi_headers.forEach(async (i) => {
            const r = wifi_tBody.insertRow();
            r.insertCell().innerText = i;
            switch (i) {
            case 'SSID':
                const td = r.insertCell();
                td.innerHTML = ssid_dropdwn;
                this.wifi_ssid_sel = document.getElementById('wifi-ssid-dropdown-content');
                this.wifi_ssid_dropbtn = document.getElementById('wifi-ssid-dropbtn');
                this.wifi_ssid_dropbtn.onclick = this.show_dropdown_content;
                if (this.current_written_ssid.length > 1) {
                    this.wifi_ssid_dropbtn.innerText = this.current_written_ssid;
                } else {
                    this.wifi_ssid_dropbtn.innerText = 'Select Network';
                }
                this.wifi_ssid_refresh = document.getElementById('wifi-ssid-refresh');
                this.wifi_ssid_refresh.onclick = this.populate_wifi_ssid_dropdown;
                this.add_other_ssid_opt();
                break;
            case 'WiFi Password':
                const wi = r.insertCell();
                wi.innerHTML = wifi_pwd;
                wi.id = 'wifi-pwd-value';
                wi.contentEditable = true;
                break;
            case 'MQTT Address':
                const mq = r.insertCell();
                mq.innerHTML = mqtt_addr;
                mq.id = 'wifi-mqtt-addr-value';
                mq.contentEditable = true;
                break;
            case 'MQTT User':
                const mu = r.insertCell();
                mu.innerHTML = mqtt_user;
                mu.id = 'wifi-mqtt-user-value';
                mu.contentEditable = true;
                break;
            case 'MQTT Pwd':
                const mp = r.insertCell();
                mp.innerHTML = mqtt_pwd;
                mp.id = 'wifi-mqtt-pwd-value';
                mp.contentEditable = true;
                break;
            case 'MQTT Port':
                const mport = r.insertCell();
                mport.innerHTML = mqtt_port;
                mport.id = 'wifi-mqtt-port-value';
                mport.contentEditable = true;
                break;
            case 'MQTT Scheme':
                const ms = r.insertCell();
                ms.innerHTML = scheme_dropdwn;
                const sel = document.getElementById('mqtt-scheme-dropdown');
                sel.selectedIndex = parseInt(mqtt_scheme, 10) - 1;
                break;
            case 'Status':
                const st = r.insertCell();
                st.style.display = 'flex';
                st.style.alignItems = 'center';
                st.style.justifyContent = 'space-between';
                st.innerText = comms_status;
                st.innerHTML += this.status_refresh;
                await this.add_refresh_listener();
                st.id = 'wifi-status-value';
                break;
            default:
                break;
            }
        });
    }

    async write_config() {
        await disable_interaction(true);
        const wifimsg = document.getElementById('wifi-msg-div');
        wifimsg.innerText = '';
        let ssid;
        const ssid_input = document.getElementById('wifi-ssid-dropdown-input');
        if (ssid_input.value) {
            ssid = ssid_input.value;
        } else if (this.current_ssid_sel && this.current_ssid_sel !== 'Other:') {
            ssid = this.current_ssid_sel;
        } else {
            ssid = this.current_written_ssid;
        }

        const wifi_pwd = document.getElementById('wifi-pwd-value').innerText;
        const mqtt_addr = document.getElementById('wifi-mqtt-addr-value').innerText;
        const mqtt_user = document.getElementById('wifi-mqtt-user-value').innerText;
        const mqtt_pwd = document.getElementById('wifi-mqtt-pwd-value').innerText;
        const mqtt_port = document.getElementById('wifi-mqtt-port-value').innerText;
        const mqtt_sch = document.getElementById('mqtt-scheme-dropdown').selectedIndex + 1;
        if (ssid.replace(/\s/g, '').length) {
            this.comms.wifi_ssid = ssid;
            this.comms.wifi_pwd = wifi_pwd.replace(/([^\\]),/g, '$1\\,'); /* Insert backslash behind comma unless one already exists */
            this.comms.mqtt_addr = mqtt_addr;
            this.comms.mqtt_user = mqtt_user;
            this.comms.mqtt_pwd = mqtt_pwd.replace(/([^\\]),/g, '$1\\,');
            this.comms.mqtt_port = mqtt_port;
            this.comms.mqtt_path = '';
            this.comms.mqtt_ca = 'none';
            this.comms.mqtt_sch = mqtt_sch;
            wifimsg.innerText = 'Configuration sent.';
        }
        await disable_interaction(false);
    }
}
