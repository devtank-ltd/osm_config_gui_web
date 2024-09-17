const { By, Builder, Browser, until, Key } = require('selenium-webdriver');
const {Options} = require("selenium-webdriver/chrome.js");
const assert = require("assert");
require('events').EventEmitter.defaultMaxListeners = 30;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TIMEOUT = 5000;

class config_gui_test_t {
    constructor(driver) {
        this.driver = driver;
    }

    async get_element(ele_id) {
        try {
            return await this.driver.wait(until.elementLocated(By.id(ele_id)), TIMEOUT);
        } catch {
            return null;
        }
    }

    async run_test(headless) {
        try {

            const options = new Options();
            if (headless) {
                options.addArguments('--headless=new')
            }
            options.addArguments('--no-sandbox')
            options.addArguments('--incognito')

            this.driver = await new Builder().setChromeOptions(options).build()
            await this.driver.get('http://localhost:8000');

            let title = await this.driver.getTitle();
            assert.equal("OSM Config GUI", title);

            await this.spawn_virtual_osm();
            await this.set_serial_num();
            await this.set_name();
            await this.set_interval_mins();
            await this.fill_wifi_config_table();
            await this.switch_to_console_tab();

            const disconnect_btn = await this.get_element('global-disconnect');
            await disconnect_btn.click();
        } catch (e) {
            console.log(e);
         } finally {
            await this.driver.quit();
        }
    }

    async run_real(headless) {
        try {

            const options = new Options();
            if (headless) {
                options.addArguments('--headless=new')
            }
            options.addArguments('--no-sandbox')

            this.driver = await new Builder().setChromeOptions(options).build()
            await this.driver.get('http://localhost:8000');

            let title = await this.driver.getTitle();
            assert.equal("OSM Config GUI", title);

            await this.connect_real_osm();

            await this.lw_comms_fw_update();

            const disconnect_btn = await this.get_element('global-disconnect');
            await disconnect_btn.click();
            await sleep(TIMEOUT);

        } catch (e) {
            console.log(e)
         } finally {
            await this.driver.quit();
        }
    }

    async connect_real_osm() {
        const connect_btn = await this.get_element('main-page-connect');
        await connect_btn.click();
        await sleep(TIMEOUT);
    }

    async spawn_virtual_osm() {
        const connect_btn = await this.get_element('main-page-websocket-connect');
        await connect_btn.click();
        await sleep(TIMEOUT);
        await this.driver.wait(until.elementLocated(By.id('otheropt')), TIMEOUT);
    }

    async select_network() {
        const refresh = await this.get_element("wifi-ssid-refresh");
        await refresh.click();
        await sleep(TIMEOUT);
        const opt = await this.get_element('wifi-opt0');
        const dropdown_btn = await this.get_element("wifi-ssid-dropbtn");
        await dropdown_btn.click();
        const dropdown = await this.get_element("wifi-ssid-dropdown-content");
        await sleep(TIMEOUT);
        if (opt) {
            await opt.click();
        } else {
            console.log('Failed to get network');
        }
    }


    async fill_wifi_config_table() {
        await this.select_network();
        const wifi_pwd = await this.get_element("wifi-pwd-value");
        wifi_pwd.sendKeys("none");
        const mqtt_addr = await this.get_element("wifi-mqtt-addr-value");
        mqtt_addr.sendKeys("mqtt.addr");
        const mqtt_user = await this.get_element("wifi-mqtt-user-value");
        mqtt_user.sendKeys("mqtt-user");
        const mqtt_pwd = await this.get_element("wifi-mqtt-pwd-value");
        mqtt_pwd.sendKeys("mqtt-pwd");
        const mqtt_port = await this.get_element("wifi-mqtt-port-value");
        mqtt_port.click();
        mqtt_port.clear();
        mqtt_port.sendKeys("443");
        const mqtt_sch = await this.get_element("mqtt-scheme-dropdown");
        mqtt_sch.sendKeys('Websockets (TLS no certs)');

        const send_btn = await this.get_element('wifi-send-config');
        await send_btn.click();
        await sleep(TIMEOUT);
    }

    async set_serial_num() {
        const serial = await this.get_element("serial-num-input");
        serial.sendKeys("osm_test_serial_001");
        await this.focus_out();
        await sleep(TIMEOUT);
    }

    async set_name() {
        const name_input = await this.get_element("name-input");
        await name_input.click();
        await name_input.clear();
        await name_input.sendKeys("osm_test_name");
        await this.focus_out();
        await sleep(TIMEOUT);
    }

    async focus_out() {
        const click = this.driver.findElement(By.id("top-level-body"));
        const actions = this.driver.actions({async: true});
        await actions.move({origin: click}).click().perform();
    }

    async set_interval_mins() {
        const home_input = await this.get_element("home-uplink-input")
        home_input.sendKeys("15");
        const submit_btn = await this.get_element('home-uplink-submit');
        await submit_btn.click();
        await sleep(TIMEOUT);
    }

    async switch_to_console_tab() {
        const console_btn = await this.get_element('console-tab');
        await console_btn.click();

        await sleep(TIMEOUT);

        const console_input = await this.get_element("console-cmd-input")
        console_input.sendKeys("j_comms_cfg");
        const send_btn = await this.get_element('console-send-cmd-btn');
        send_btn.click();
        await sleep(TIMEOUT);
    }

    async lw_comms_fw_update() {
        const comms_btn = await this.get_element('comms-btn');
        await comms_btn.click();

        const confirm = await this.driver.switchTo().alert();
        const confirm_text = await confirm.getText();
        await confirm.accept();
    }

}


async function start_test() {
    let driver;
    const tester = new config_gui_test_t(driver);
    const is_headless = true;
    tester.run_test(is_headless);
}


async function run_tests() {
    const thread_count = 10;
    const tasks = [];

    for (let i = 0; i < thread_count; i += 1) {
        tasks.push(start_test());
}
    await Promise.all(tasks);
}

run_tests();
