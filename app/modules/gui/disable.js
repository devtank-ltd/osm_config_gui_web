export async function disable_fieldset(bool) {
    if (typeof bool === 'boolean') {
        document.getElementById('global-fieldset').disabled = bool;
    }
    return bool;
}

export async function disable_navbar(bool) {
    if (typeof bool === 'boolean') {
        const nav = document.getElementById('navbar');
        const topnav = document.getElementById('topnav');
        const tags = nav.getElementsByTagName('a');
        const settings_btn = document.getElementById('global-save-setting');
        const load_btn = document.getElementById('global-load-osm-config');
        const save_btn = document.getElementById('global-save-osm-config');
        const disc_btn = document.getElementById('global-disconnect');

        settings_btn.disabled = bool;
        load_btn.disabled = bool;
        save_btn.disabled = bool;
        disc_btn.disabled = bool;
        if (bool === true) {
            settings_btn.style.pointerEvents = 'none';
            load_btn.style.pointerEvents = 'none';
            save_btn.style.pointerEvents = 'none';
            disc_btn.style.pointerEvents = 'none';
            topnav.style.background = 'grey';
            for (let i = 0; i < tags.length; i += 1) {
                tags[i].style.pointerEvents = 'none';
            }
        } else {
            settings_btn.style.pointerEvents = 'auto';
            load_btn.style.pointerEvents = 'auto';
            save_btn.style.pointerEvents = 'auto';
            disc_btn.style.pointerEvents = 'auto';
            topnav.style.removeProperty('background');
            for (let i = 0; i < tags.length; i += 1) {
                tags[i].style.pointerEvents = 'auto';
            }
        }
    }
    return bool;
}

export async function disable_interaction(bool) {
    if (typeof bool === 'boolean') {
        await disable_fieldset(bool);
        await disable_navbar(bool);
    }
    return bool;
}

export async function limit_characters(cell, max_len) {
    const cellt = cell.target;
    let text = cellt.innerHTML;
    if (cellt.nodeName === 'INPUT') {
        text = cellt.value;
        if (text.length > max_len) {
            cellt.value = text.slice(0, max_len);
        }
    } else if (text.length > max_len) {
        cellt.innerHTML = text.slice(0, max_len);
    }
}
