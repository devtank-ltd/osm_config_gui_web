import { disable_interaction } from './disable.js';

export class wifi_config_t {
    constructor(comms) {
        this.comms = comms;
        this.write_config = this.write_config.bind(this);
    }

    async add_listeners() {
        const sendbtn = document.getElementById('wifi-send-config');
        sendbtn.onclick = this.write_config;
    }

    async get_scheme_html() {
        this.resp = await fetch('modules/gui/html/mqtt_scheme_dropdown.html');
        this.text = await this.resp.text();
        return this.text;
    }

    async populate_wifi_fields() {
        const title = 'WiFi Configuration';
        const wifi_headers = ['SSID', 'WiFi Password', 'MQTT Address', 'MQTT User', 'MQTT Password', 'MQTT Port', 'MQTT Scheme', 'Status'];

        const ssid = await this.comms.wifi_ssid;
        const wifi_pwd = await this.comms.wifi_pwd;
        const mqtt_addr = await this.comms.mqtt_addr;
        const mqtt_user = await this.comms.mqtt_user;
        const mqtt_pwd = await this.comms.mqtt_pwd;
        const mqtt_port = await this.comms.mqtt_port;
        const mqtt_scheme = await this.comms.mqtt_sch;
        const scheme_dropdwn = await this.get_scheme_html();

        let conn = await this.comms.comms_conn;

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
        cell.textContent = title;

        wifi_headers.forEach((i) => {
            const r = wifi_tBody.insertRow();
            r.insertCell().textContent = i;
            switch (i) {
            case 'SSID':
                const td = r.insertCell();
                td.textContent = ssid;
                td.id = 'wifi-ssid-value';
                td.contentEditable = true;
                break;
            case 'WiFi Password':
                const wi = r.insertCell();
                wi.textContent = wifi_pwd;
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
            case 'MQTT Password':
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
                conn = (conn === '1 | Connected') ? 'Connected' : 'Disconnected';
                st.textContent = conn;
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
        wifimsg.textContent = '';
        const ssid = document.getElementById('wifi-ssid-value').textContent;
        const wifi_pwd = document.getElementById('wifi-pwd-value').textContent;
        const mqtt_addr = document.getElementById('wifi-mqtt-addr-value').textContent;
        const mqtt_user = document.getElementById('wifi-mqtt-user-value').textContent;
        const mqtt_pwd = document.getElementById('wifi-mqtt-pwd-value').textContent;
        const mqtt_port = document.getElementById('wifi-mqtt-port-value').textContent;
        const mqtt_sch = document.getElementById('mqtt-scheme-dropdown').selectedIndex + 1;

        this.comms.wifi_ssid = ssid;
        this.comms.wifi_pwd = wifi_pwd.replace(/([^\\]),/g, '$1\\,'); /* Insert backslash behind comma unless one already exists */
        this.comms.mqtt_addr = mqtt_addr;
        this.comms.mqtt_user = mqtt_user;
        this.comms.mqtt_pwd = mqtt_pwd.replace(/([^\\]),/g, '$1\\,');
        this.comms.mqtt_port = mqtt_port;
        this.comms.mqtt_path = 'none'; /* Current firmware doesn't allow CA to be an empty string */
        this.comms.mqtt_ca = 'none';
        this.comms.mqtt_sch = mqtt_sch;

        wifimsg.textContent = 'Configuration sent.';
        await disable_interaction(false);
    }
}
