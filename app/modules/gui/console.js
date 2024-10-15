import { disable_interaction, disable_navbar } from './disable.js';

export class console_t {
    constructor(dev) {
        this.dev = dev;
        this.help_btn = this.help_btn.bind(this);
        this.send_cmd = this.send_cmd.bind(this);
        this.bind_debug_btns = this.bind_debug_btns.bind(this);
        this.debug_mode = this.debug_mode.bind(this);
    }

    async open_console() {
        this.doc = document.getElementById('main-page-body');
        this.response = await fetch('modules/gui/html/console.html');
        this.text = await this.response.text();
        this.doc.innerHTML = this.text;
        await this.help_btn();
        await this.bind_input_submit();
        await this.bind_debug_btns();
    }

    async help_btn() {
        this.expand_btn = document.getElementById('con-help');
        this.form_container = document.getElementById('help-container');
        this.help = await this.dev.help();
        this.form_container.innerHTML = this.help;
        this.expand_btn.addEventListener('click', () => {
            this.form_container.style.display = (this.form_container.style.display === 'block') ? 'none' : 'block';
        });
    }

    async bind_input_submit() {
        this.send = document.getElementById('console-send-cmd-btn').addEventListener('click', this.send_cmd);
        this.enter = document.getElementById('console-cmd-input').addEventListener('keyup', this.send_cmd);
    }

    async send_cmd(e) {
        if (e.key === 'Enter' || e.pointerType === 'mouse' || e.type === 'click') {
            this.input = e.target;
            this.text = e.target.value;
            this.cmd = document.getElementById('console-cmd-input');
            this.value = this.cmd.value;
            let output;
            if (this.text || this.value) {
                output = this.dev.ll.write(this.value);
                this.cmd.value = '';
            }
            this.input.focus();
        }
    }

    async enter_debug_mode(activate_debug_mode) {
        if (activate_debug_mode) {
            this.in_debug_mode = true;
        } else {
            this.in_debug_mode = false;
        }
    }

    async bind_debug_btns() {
        const start = document.getElementById('debug-start-btn');
        const stop = document.getElementById('debug-stop-btn');
        start.addEventListener('click', async () => {
            await disable_navbar(true);
            await this.enter_debug_mode(true);
            this.debug_mode();
        });
        stop.addEventListener('click', async () => {
            await this.enter_debug_mode(false);
            await disable_navbar(false);
        });
    }

    async debug_mode() {
        let msgs;
        if (this.in_debug_mode) {
            try {
                msgs = await this.dev.debug_read();
                if (msgs) {
                    this.terminal_para = document.getElementById('console-terminal-para');
                    this.term = document.getElementById('console-terminal');
                    this.terminal_para.textContent += msgs;
                    this.term.scrollTop = this.term.scrollHeight - this.term.clientHeight;
                }
            } catch (e) {
                console.log(`Error in debug mode: ${e}`);
            }
            setTimeout(this.debug_mode, 100);
        } else {
            await this.dev.do_cmd('debug 0');
        }
    }
}
