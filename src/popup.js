// popup script runs when the extension icon is clicked and the popup.html is loaded
'use strict';
import './popup.css';
import { storage, apiRequest} from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
	document.getElementById('term-block').style.display = 'none';
	document.getElementById('caption-block').style.display = 'none';
	document.getElementById(storage.prompt).value = await storage.get(storage.prompt) || "";
	document.getElementById(storage.apiKey).value = await storage.get(storage.apiKey) || "";

	// register event listener
	document.getElementById(storage.prompt).addEventListener('change', onChangePrompt);
	document.getElementById(storage.apiKey).addEventListener('change', onChangeApiKey);
	document.getElementById('getAllCaptionBtn').addEventListener('click', onGetAllCaption);
	document.getElementById('getAllCaptionBtn_format').addEventListener('click', onGetAllCaptionBtn_format);
	document.getElementById('translateCaptionBtn').addEventListener('click', onTranslateCaptionBtn);
	document.getElementById('recoverLastTranslationBtn').addEventListener('click', onRecoverLastTranslation);
});

// ============================ events ====================================
async function onChangePrompt() {
	const value = document.getElementById(storage.prompt).value;
	storage.set(storage.prompt, value);
}

async function onChangeApiKey() {
	const value = document.getElementById(storage.apiKey).value;
	storage.set(storage.apiKey, value);
}

async function onGetAllCaption() {
	const response = await apiRequest('tab_getAllCaption');
	if (!response || !response.captions)
		return;

	let textToCopy = ""
	document.getElementById('caption-block').style.display = 'none';
	if (response.captions.length > 0) {

		const captionList = document.getElementById('caption-list');
		captionList.innerHTML = '';
		for (let i = 0; i < response.captions.length; i++) {
			const caption = response.captions[i];

			textToCopy += `${caption}\n`

			const listItem = document.createElement('li');
			listItem.textContent = caption;
			listItem.className = 'caption-item';
			captionList.appendChild(listItem);
		}
		document.getElementById('caption-block').style.display = 'block';
	}
	copyToClipboard(textToCopy);
	apiRequest('tab_showNotification', { message: "字幕已复制到剪贴板" });
}

async function onGetAllCaptionBtn_format(showNotification = true) {
	const response = await apiRequest('tab_getAllCaption');
	if (!response || !response.captions)
		return;

	let textToCopy = document.getElementById(storage.prompt).value + "\n";

	// terms
	document.getElementById('term-block').style.display = 'none';
	if (response.terms && Object.keys(response.terms).length > 0) {

		document.getElementById('term-block').style.display = 'block';

		const terms = JSON
			.stringify(response.terms)
			.replace(/[\{\}]/g, '')
		textToCopy += `(如果字幕里出现这些名字或者术语，请使用指定的翻译: ${terms})\n请开始翻译:\n`;

		const termList = document.getElementById('term-list');
		termList.innerHTML = '';
		for (let key of Object.keys(response.terms)) {
			const listItem = document.createElement('li');
			listItem.textContent = `${key} : ${response.terms[key]}`;
			listItem.className = 'term-item';
			termList.appendChild(listItem);
		}
	}

	// captions
	document.getElementById('caption-block').style.display = 'none';
	if (response.captions.length > 0) {

		document.getElementById('caption-block').style.display = 'block';

		const captionList = document.getElementById('caption-list');
		captionList.innerHTML = '';
		for (let i = 0; i < response.captions.length; i++) {
			let caption = response.captions[i];

			// remove <b> and </b> tag
			caption = caption
				.replace(/<b>/g, '')
				.replace(/<\/b>/g, '');
			response.captions[i] = caption;
			caption = `${i + 1}\.${caption}`

			textToCopy += `${caption}\n`

			const listItem = document.createElement('li');
			listItem.textContent = caption;
			listItem.className = 'caption-item';
			captionList.appendChild(listItem);
		}
	}
	copyToClipboard(textToCopy);
	if (showNotification)
		apiRequest('tab_showNotification', { message: "字幕已复制到剪贴板" });
	return { response, textToCopy };
}

async function onTranslateCaptionBtn() {
	const apiKey = document.getElementById(storage.apiKey).value;
	if (!apiKey || apiKey === '') {
		apiRequest('tab_showNotification', { message: "API key不能为空！" });
		return;	
	}

	// 禁用按钮
	const btn = document.getElementById('translateCaptionBtn');
	const btnColor = btn.style.backgroundColor;
	btn.disabled = true;
	btn.style.backgroundColor = "rgb(175, 76, 76)";

	// （插件弹窗 -> 目标tab.content）请求网页上的所有字幕
	const result = await onGetAllCaptionBtn_format(false);
	const { response: tab_response, textToCopy: prompt } = result;
	if (!tab_response || !tab_response.captions)
		return;

	// （插件弹窗 -> 插件后台background）把字幕发给后台请求翻译
	const { captions, terms } = tab_response;
	await apiRequest('bg_translateCaption', { apiKey, captions, terms });

	// 重置按钮
	btn.disabled = false;
	btn.style.backgroundColor = btnColor;
}

async function onRecoverLastTranslation() {
	const last_translation = await storage.get(storage.last_translation);
	if (!last_translation || last_translation === '') {
		apiRequest('tab_showNotification', { message: "没有上一次翻译的内容" });
		return;
	}
	apiRequest('tab_showTranslation', { translation:last_translation, usage:null });
}

// ============================ helper ====================================
async function copyToClipboard(text) {
	try {
		await navigator.clipboard.writeText(text);
		console.log('文本已成功复制到剪贴板');
	} catch (err) {
		console.error('复制到剪贴板时出错: ', err);
	}
}