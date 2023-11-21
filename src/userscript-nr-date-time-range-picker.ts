
// ==UserScript==
// @name         NR Date Time Range Picker
// @namespace    https://netmark.jp/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://one.newrelic.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
const retryCount = 10;
const retryTimeoutMs = 300;
const template = `
<style>
div.userscript-nr-date-time-range-picker {
}
div.userscript-nr-date-time-range-picker header{
    text-align: right;
}
div.userscript-nr-date-time-range-picker div#myPopup {
    display: none;
    position: absolute;
    border: 1px solid black;
    background-color :white;
    padding: 10px;
}
div.userscript-nr-date-time-range-picker div.form-group {
    text-align: right;
}
</style>
<div class="userscript-nr-date-time-range-picker">
    <button id="userscript-nr-date-time-range-picker-btn">【🗓️】</button>
    <div id="myPopup">
        <header>
            <div id="userscript-nr-date-time-range-picker-btn-close">ⓧ</div>
        </header>
        <div id="myPopupBody>
            <form>
                <div class="form-group">
                    <label for="myPopupTimeRange">Time Range in Localtime</label>
                    <input type="text" id="myPopupTimeRange" name="myPopupTimeRange" placeholder="YYYY/mm/dd HH:MM - YYYY/mm/dd HH:MM" value="" />
                </div>
                <div class="form-group">
                    <button id="myPopupSubmit">GO</button>
                </div>
            </form>
        </div>
    </div>
</div>
`;

async function findElement(selector: string): Promise<HTMLElement | undefined> {
	for (let i = 0; i < retryCount + 1; i++) {
		const targetDiv = document.querySelector(selector);

		if (targetDiv && targetDiv instanceof HTMLElement) {
			return targetDiv;
		}

		await new Promise(resolve => setTimeout(resolve, retryTimeoutMs)); // eslint-disable-line no-await-in-loop, no-promise-executor-return
	}

	return undefined;
}

async function getTimeRangeFromQueryString(): Promise<{begin: string; end: string}> {
	const url = new URL(window.location.href);
	const begin = url.searchParams.get('begin'); // In GMT unixtime (ms)
	const end = url.searchParams.get('end'); // In GMT unixtime (ms)

	/* Begin and end exist */
	if (begin && end) {
		return {begin, end};
	}

	/* Duration exist */
	const duration = url.searchParams.get('duration'); // In ms
	if (duration) {
		// Now is local time
		const now = new Date();

		// End is GMT unixtime
		const newEnd = now.getTime();

		const newBegin = now.getTime() - Number(duration);
		return {begin: newBegin.toString(10), end: newEnd.toString(10)};
	}

	return {begin: '', end: ''};
}

function formatUnixTime(unixTimeMs: number | string): string {
	if (typeof unixTimeMs === 'string') {
		unixTimeMs = Number(unixTimeMs);
	}

	const date = new Date(unixTimeMs);
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const day = date.getDate().toString().padStart(2, '0');
	const hour = date.getHours().toString().padStart(2, '0');
	const minute = date.getMinutes().toString().padStart(2, '0');

	return `${year}/${month}/${day} ${hour}:${minute}`;
}

async function main() {
	const targetDiv = await findElement('.nr-css-DateTimeRangePicker');
	if (targetDiv) {
		const newDiv = document.createElement('div');
		newDiv.innerHTML = template;
		if (targetDiv.parentNode) {
			/* Render */
			targetDiv.parentNode.insertBefore(newDiv, targetDiv);
			const btn = await findElement('#userscript-nr-date-time-range-picker-btn');
			const popup = await findElement('#myPopup');
			const popupCloseBtn = await findElement('#userscript-nr-date-time-range-picker-btn-close');

			if (btn && popup && popupCloseBtn) {
				btn.addEventListener('click', () => {
					if (popup.style && popup.style.display !== 'block') {
						popup.style.display = 'block';
					} else if (popup.style && popup.style.display === 'block') {
						popup.style.display = 'none';
					}
				});
				window.addEventListener('click', event => {
					if (event.target === popup) {
						popup.style.display = 'none';
					}
				});
				popupCloseBtn.addEventListener('click', () => {
					if (popup.style && popup.style.display !== 'none') {
						popup.style.display = 'none';
					}
				});
			}

			/* Action */
			const {begin, end} = await getTimeRangeFromQueryString();
			const timeRangeInput = await findElement('#myPopupTimeRange');
			if (timeRangeInput && timeRangeInput instanceof HTMLInputElement && begin && end) {
				timeRangeInput.value = `${formatUnixTime(begin)} - ${formatUnixTime(end)}`;
			}
		}
	}
}

main(); // eslint-disable-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
