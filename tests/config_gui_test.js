const { By, Builder, Browser, until } = require('selenium-webdriver');
const {Options} = require("selenium-webdriver/chrome.js");
const assert = require("assert");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class config_gui_test_t {
    constructor(driver) {
        this.driver = driver;
        this.spawn_virtual_osm = this.spawn_virtual_osm.bind(this);
    }

    async run_test(headless) {
        try {

            const options = new Options();
            if (headless) {
                options.addArguments('--headless=new')
            }

            this.driver = await new Builder().setChromeOptions(options).build()
            await this.driver.get('http://localhost:8000');

            let title = await this.driver.getTitle();
            assert.equal("OSM Config GUI", title);

            await this.spawn_virtual_osm();
            await this.set_serial_num();
            await sleep(2000);
            await this.set_name();
            await sleep(2000);
            await this.set_interval_mins();
            await sleep(2000);
            await this.fill_wifi_config_table();
            await sleep(3000);
            await this.switch_to_console_tab();


            const disconnect_btn = await this.driver.findElement(By.id('global-disconnect'));
            await disconnect_btn.click();
            await sleep(5000);

        } catch (e) {
            console.log(e)
         } finally {
            await this.driver.quit();
        }
    }

    async spawn_virtual_osm() {
        const connect_btn = await this.driver.findElement(By.id('main-page-websocket-connect'));
        await connect_btn.click();
        await sleep(5000);
    }

    async fill_wifi_config_table() {
        this.driver.findElement(By.id("wifi-ssid-value")).sendKeys("none");
        this.driver.findElement(By.id("wifi-pwd-value")).sendKeys("none");
        this.driver.findElement(By.id("wifi-mqtt-addr-value")).sendKeys("mqtt.addr");
        this.driver.findElement(By.id("wifi-mqtt-user-value")).sendKeys("mqtt-user");
        this.driver.findElement(By.id("wifi-mqtt-pwd-value")).sendKeys("mqtt-pwd");
        this.driver.findElement(By.id("wifi-mqtt-port-value")).click();
        this.driver.findElement(By.id("wifi-mqtt-port-value")).clear();
        this.driver.findElement(By.id("wifi-mqtt-port-value")).sendKeys("443");
        this.driver.findElement(By.id("mqtt-scheme-dropdown")).sendKeys('Websockets (TLS no certs)');

        const send_btn = await this.driver.findElement(By.id('wifi-send-config'));
        await send_btn.click();
    }

    async set_serial_num() {
        this.driver.findElement(By.id("serial-num-input")).sendKeys("osm_test_serial_001");
    }

    async set_name() {
        this.driver.findElement(By.id("name-input")).click();
        this.driver.findElement(By.id("name-input")).clear();
        this.driver.findElement(By.id("name-input")).sendKeys("osm_test_name");
    }

    async set_interval_mins() {
        this.driver.findElement(By.id("home-uplink-input")).sendKeys("15");
        const submit_btn = await this.driver.findElement(By.id('home-uplink-submit'));
        await submit_btn.click();
    }

    async switch_to_console_tab() {
        const console_btn = await this.driver.findElement(By.id('console-tab'));
        await console_btn.click();

        await sleep(1000);

        this.driver.findElement(By.id("console-cmd-input")).sendKeys("?");
        const send_btn = await this.driver.findElement(By.id('console-send-cmd-btn'));
        send_btn.click();
    }

}


let driver;
const tester = new config_gui_test_t(driver);
tester.run_test(false);
