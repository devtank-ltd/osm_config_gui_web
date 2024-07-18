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
}

let driver;
const tester = new config_gui_test_t(driver);
tester.run_test(false);
