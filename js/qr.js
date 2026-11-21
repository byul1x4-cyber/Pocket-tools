/* ⑤ 만료 없는 QR 생성기 */
(function () {
  'use strict';
  const PT = window.PT;

  let mode = 'url';
  let lastBlob = null;
  let lastPayload = '';

  function escWifi(s) {
    return String(s || '').replace(/([\\;,:"])/g, '\\$1');
  }

  function payload() {
    if (mode === 'wifi') {
      const ssid = PT.$('#qrSsid').value.trim();
      const pass = PT.$('#qrPass').value;
      const sec = PT.$('#qrSec').value;
      if (!ssid) throw new Error('와이파이 이름(SSID)을 넣어 주세요.');
      const p = sec === 'nopass' ? '' : escWifi(pass);
      const t = sec === 'nopass' ? 'nopass' : sec;
      return 'WIFI:T:' + t + ';S:' + escWifi(ssid) + ';P:' + p + ';;';
    }
    if (mode === 'text') {
      const t = PT.$('#qrText').value;
      if (!t.trim()) throw new Error('QR에 담을 내용을 넣어 주세요.');
      return t;
    }
    let url = PT.$('#qrUrl').value.trim();
    if (!url) throw new Error('주소를 넣어 주세요.');
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) url = 'https://' + url;
    return url;
  }

  function draw() {
    const text = payload();
    const qr = window.qrcode(0, PT.$('#qrEcc').value || 'M');
    qr.addData(text);
    qr.make();

    const count = qr.getModuleCount();
    const target = parseInt(PT.$('#qrSize').value, 10) || 1024;
    const quiet = 4;
    const total = count + quiet * 2;
    let cell = Math.floor(target / total);
    if (cell < 1) cell = 1;
    const px = total * cell;

    const canvas = PT.$('#qrCanvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = PT.$('#qrBg').value;
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = PT.$('#qrFg').value;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
      }
    }

    lastPayload = text;
    PT.$('#qrResultCard').classList.remove('hidden');

    const kind = mode === 'wifi' ? '와이파이' : mode === 'text' ? '글' : '링크';
    const shown = mode === 'wifi' ? 'WIFI:T:' + PT.$('#qrSec').value + ';S:' + PT.$('#qrSsid').value + ';P:***;;' : text;
    PT.$('#qrInfo').innerHTML = kind + ' QR · ' + px + '×' + px + 'px · 오류보정 ' + PT.$('#qrEcc').value +
      ' · 만료 없음 (내 폰에서 그린 이미지)<br><span style="opacity:.7;word-break:break-all">' + escapeHtml(shown.slice(0, 120)) + '</span>';

    return canvas;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function init() {
    if (!PT.$('#qrMode')) return;
    mode = PT.segInit('#qrMode', (m) => {
      mode = m;
      PT.$('#qrUrlBox').classList.toggle('hidden', m !== 'url');
      PT.$('#qrTextBox').classList.toggle('hidden', m !== 'text');
      PT.$('#qrWifiBox').classList.toggle('hidden', m !== 'wifi');
    });

    PT.$('#qrMake').addEventListener('click', () => {
      try {
        draw();
        PT.toast('QR을 만들었어요');
      } catch (err) {
        PT.toast(PT.errorText(err));
      }
    });

    PT.$('#qrSave').addEventListener('click', async () => {
      const btn = PT.$('#qrSave');
      PT.busy(btn, true, '저장 중');
      try {
        const canvas = draw();
        const blob = await PT.canvasToBlob(canvas, 'image/png');
        lastBlob = blob;
        const base = mode === 'wifi' ? 'wifi-' + (PT.$('#qrSsid').value.trim() || 'qr') : mode === 'text' ? 'text' : 'link';
        PT.download(blob, 'QR-' + base.replace(/[^\w가-힣-]+/g, '_').slice(0, 24) + '.png');
        PT.toast('QR 이미지를 저장했어요');
      } catch (err) {
        PT.toast(PT.errorText(err));
      } finally {
        PT.busy(btn, false);
      }
    });

    PT.$('#qrCopyImg').addEventListener('click', async () => {
      try {
        const canvas = draw();
        if (!navigator.clipboard || !window.ClipboardItem) throw new Error('이 브라우저는 이미지 복사를 지원하지 않아요. 저장 버튼을 눌러 주세요.');
        const blob = await PT.canvasToBlob(canvas, 'image/png');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        PT.toast('QR 이미지를 복사했어요');
      } catch (err) {
        PT.toast(PT.errorText(err));
      }
    });
  }

  PT.initQr = init;
})();
