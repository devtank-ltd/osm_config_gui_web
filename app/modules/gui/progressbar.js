export function move_bar(width, text) {
    const barlen = width;
    const progress = document.getElementById('progress');
    const bar = document.getElementById('progressbar');
    const label = document.getElementById('progresslabel');
    progress.style.display = 'block';
    label.style.display = 'block';
    // eslint-disable-next-line no-use-before-define
    label.innerHTML = text;

    if (barlen >= 100 || !width) {
        progress.style.display = 'none';
        label.style.display = 'none';
    } else {
        bar.style.width = `${barlen}%`;
    }
}
