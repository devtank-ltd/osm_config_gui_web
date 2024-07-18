const { By, Builder, Browser, until } = require('selenium-webdriver');
const {Options} = require("selenium-webdriver/chrome.js");
const assert = require("assert");


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
            console.log(options);

            this.driver = await new Builder().setChromeOptions(options).build()
            await this.driver.get('http://localhost:8000');

            let title = await this.driver.getTitle();
            assert.equal("OSM Config GUI", title);

            await this.spawn_virtual_osm();

            await this.fill_wifi_config_table();

            const disconnect_btn = await this.driver.findElement(By.id('global-disconnect'));
            await disconnect_btn.click();
        } catch (e) {
            console.log(e)
        } finally {
             await this.driver.quit();
        }
    }

    async spawn_virtual_osm() {
        const connect_btn = await this.driver.findElement(By.id('main-page-websocket-connect'));
        await connect_btn.click();

        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        await sleep(5000);
    }

    async fill_wifi_config_table() {
        this.driver.findElement(By.id("wifi-ssid-value")).sendKeys("value", "none");
        this.driver.findElement(By.id("wifi-pwd-value")).sendKeys("value", "none");
        this.driver.findElement(By.id("wifi-mqtt-addr-value")).sendKeys("value", "mqtt.addr");
        this.driver.findElement(By.id("wifi-mqtt-user-value")).sendKeys("value", "mqtt-user");
        this.driver.findElement(By.id("wifi-mqtt-pwd-value")).sendKeys("value", "mqtt-pwd");
        this.driver.findElement(By.id("wifi-mqtt-port-value")).sendKeys("value", "443");
        this.driver.findElement(By.id("mqtt-scheme-dropdown")).sendKeys('Websockets (TLS no certs)');

        const send_btn = await this.driver.findElement(By.id('wifi-send-config'));
        await send_btn.click();
    }



}

let driver;
const tester = new config_gui_test_t(driver);
tester.run_test(false);
