
// ==UserScript==
// @name         NR Date Time Range Picker
// @namespace    https://github.com/netmarkjp/userscript-nr-date-time-range-picker
// @version      0.6.0
// @description  Add useful(=copy/paste enabled) DateTimeRange Input form to New Relic One page.
// @author       BABA Toshiaki <toshiaki@netmark.jp>
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
div.userscript-nr-date-time-range-picker #myPopupTimeRange {
    width: 17em;
}
</style>
<div class="userscript-nr-date-time-range-picker">
    <button id="userscript-nr-date-time-range-picker-btn">【🗓️】</button>
    <div id="myPopup">
        <header>
            <div id="userscript-nr-date-time-range-picker-btn-close">ⓧ</div>
        </header>
        <div id="myPopupBody">
            <div id="myPopupForm">
                <div class="form-group">
                    <label for="myPopupTimeRange">Time Range in Localtime</label><br />
                    <input type="text" id="myPopupTimeRange" name="myPopupTimeRange" placeholder="YYYY/mm/dd HH:MM - YYYY/mm/dd HH:MM" value="" />
                </div>
                <div class="form-group">
                    <button id="myPopupSubmit">GO</button>
                </div>
            </div>
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

function getTimeRangeFromQueryString(): {begin: string; end: string} {
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

function transformLocalDateTimeToUnixtime(localDateTime: string): string {
	const date = new Date(localDateTime);
	return date.getTime().toString(10);
}

function rewriteUrl(url: URL, begin: string, end: string): string {
	// Rewrite begin, end in query string
	url.searchParams.set('begin', begin);
	url.searchParams.set('end', end);

	// Remove duration query string
	url.searchParams.delete('duration');

	const filters = url.searchParams.get('filters');
	const state = url.searchParams.get('state');
	if (filters && state) {
		url.searchParams.delete('state');
	}

	if (url.pathname === '/logger') {
		// filter condisions are dropped when state is dropped.
		// that is unhappy/not-willed behavior, but no way to keep filter condisions.
		url.searchParams.delete('state');
	}

	return url.toString();
}

function addEventSubmit(timeRangeInput: HTMLInputElement) {
	const timeRange = timeRangeInput.value;
	const [begin, end] = timeRange.split('-')
		.map(v => v.trim())
		.map(v => transformLocalDateTimeToUnixtime(v));
	if (begin && end) {
		const newUrl = rewriteUrl(new URL(window.location.href), begin, end);
		window.location.href = newUrl;
	}
}

async function main() {
	let targetDiv = await findElement('.nr-css-DateTimeRangePicker');
	if (targetDiv === undefined) {
		// APM page
		targetDiv = await findElement('.nr-css-DateTimeRangePicker-trigger');
	}

	if (targetDiv) {
		const newDiv = document.createElement('div');
		newDiv.innerHTML = template;
		if (targetDiv.parentNode) {
			/* Render */
			targetDiv.parentNode.insertBefore(newDiv, targetDiv);
			const btn = await findElement('#userscript-nr-date-time-range-picker-btn');
			const popup = await findElement('#myPopup');
			const popupCloseBtn = await findElement('#userscript-nr-date-time-range-picker-btn-close');
			const popupForm = await findElement('#myPopupForm');
			const popupSubmitBtn = await findElement('#myPopupSubmit');
			const popupTimeRangeInput = await findElement('#myPopupTimeRange') as HTMLInputElement;

			if (btn && popup && popupCloseBtn) {
				btn.addEventListener('click', () => {
					if (popup.style && popup.style.display !== 'block') {
						const {begin, end} = getTimeRangeFromQueryString();
						if (popupTimeRangeInput && begin && end) {
							popupTimeRangeInput.value = `${formatUnixTime(begin)} - ${formatUnixTime(end)}`;
						}

						popup.style.display = 'block';
						popupTimeRangeInput.focus();
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
			if (popupForm) {
				popupForm.addEventListener('keydown', event => {
					if (event.key === 'Enter') {
						addEventSubmit(popupTimeRangeInput);
					}
				});
			}

			if (popupSubmitBtn) {
				popupSubmitBtn.addEventListener('click', () => {
					addEventSubmit(popupTimeRangeInput);
				});
			}
		}
	}
}

main(); // eslint-disable-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
