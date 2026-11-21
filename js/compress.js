/* ④ 이미지 압축 · 포맷 변환 */
(function () {
  'use strict';
  const PT = window.PT;

  let files = [];
  let results = [];   // {name, blob, url, before, after, w, h}

  const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

  function renderInputs() {
    PT.$('#cmpRun').disabled = files.length === 0;
    PT.$('#cmpHint').textContent = files.length
      ? files.length + '장 선택됨 · 아래 설정으로 압축해요'
      : 'PNG는 품질 대신 색 손실 없이 저장돼요(용량은 줄지 않을 수 있어요).';
  }

  async function processImg(file) {
    const img = await PT.loadImage(file);
    const maxW = parseInt(PT.$('#cmpMaxWidth').value, 10) || 0;
    let scale = 1;
    if (maxW && img.naturalWidth > maxW) scale = maxW / img.naturalWidth;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const fmt = PT.$('#cmpFormat').value;
    const quality = (parseInt(PT.$('#cmpQuality').value, 10) || 72) / 100;

    const c = PT.makeCanvas(w, h);
    const ctx = c.getContext('2d');
    if (fmt === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';   // JPG는 투명 부분을 흰색으로
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await PT.canvasToBlob(c, fmt, fmt === 'image/png' ? undefined : quality);
    const ext = MIME_EXT[fmt] || 'jpg';
    return {
      name: PT.baseName(file.name) + '-압축.' + ext,
      blob,
      url: URL.createObjectURL(blob),
      before: file.size,
      after: blob.size,
      w, h, ext, from: file.name
    };
  }

  async function run() {
    if (!files.length) return;
    const btn = PT.$('#cmpRun');
    PT.busy(btn, true, '압축 중');
    results.forEach((r) => r.url && URL.revokeObjectURL(r.url));
    results = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const r = await processImg(files[i]);
        results.push(r);
      }
      renderResults();
      const before = results.reduce((a, r) => a + r.before, 0);
      const after = results.reduce((a, r) => a + r.after, 0);
      const pct = PT.savedPct(before, after);
      PT.toast(pct > 0 ? '용량 ' + pct + '% 줄었어요' : '변환 완료 · 용량은 크게 줄지 않았어요');
    } catch (err) {
      PT.toast('압축 실패: ' + PT.errorText(err));
    } finally {
      PT.busy(btn, false);
    }
  }

  function renderResults() {
    const card = PT.$('#cmpResultCard');
    const list = PT.$('#cmpList');
    list.innerHTML = '';
    const before = results.reduce((a, r) => a + r.before, 0);
    const after = results.reduce((a, r) => a + r.after, 0);
    const pct = PT.savedPct(before, after);
    const badge = PT.$('#cmpTotalBadge');
    badge.textContent = (pct > 0 ? '총 ' + pct + '% 절감 · ' : '총 ') + PT.fmtBytes(before) + ' → ' + PT.fmtBytes(after);
    badge.className = pct > 0 ? 'badge ok' : 'badge';

    results.forEach((r, i) => {
      const p = PT.savedPct(r.before, r.after);
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML =
        '<div class="item-top">' +
        '<img class="thumb" alt="" src="' + r.url + '">' +
        '<div class="item-main">' +
        '<div class="name">' + PT.shortName(r.name, 24) + '</div>' +
        '<div class="meta">' + r.w + '×' + r.h + ' · ' + PT.fmtBytes(r.before) + ' → ' + PT.fmtBytes(r.after) +
        ' <span class="' + (p >= 0 ? 'down' : 'up') + '">' + (p >= 0 ? '-' + p : '+' + Math.abs(p)) + '%</span></div>' +
        '</div></div>' +
        '<div class="item-actions"><button class="btn small" type="button" data-i="' + i + '">저장</button></div>';
      div.querySelector('button').addEventListener('click', () => {
        PT.download(r.blob, r.name);
        PT.toast(PT.shortName(r.name) + ' 저장했어요');
      });
      list.appendChild(div);
    });
    card.classList.remove('hidden');
  }

  function init() {
    if (!PT.$('#cmpFiles')) return;
    PT.$('#cmpFiles').addEventListener('change', (e) => {
      files = Array.from(e.target.files || []).slice(0, 20);
      e.target.value = '';
      renderInputs();
    });
    const q = PT.$('#cmpQuality');
    q.addEventListener('input', () => { PT.$('#cmpQualityOut').textContent = q.value + '%'; });
    PT.$('#cmpRun').addEventListener('click', run);
    PT.$('#cmpFormat').addEventListener('change', () => {
      const fmt = PT.$('#cmpFormat').value;
      q.disabled = fmt === 'image/png';
      PT.$('#cmpHint').textContent = fmt === 'image/png'
        ? 'PNG는 품질 대신 색 손실 없이 저장돼요. 사진은 보통 JPG가 훨씬 가벼워요.'
        : files.length + '장 선택됨 · 아래 설정으로 압축해요';
    });
    PT.$('#cmpSaveAll').addEventListener('click', async () => {
      const btn = PT.$('#cmpSaveAll');
      PT.busy(btn, true, '저장 중');
      try {
        await PT.downloadMany(results.map((r) => ({ blob: r.blob, name: r.name })));
        PT.toast(results.length + '장 저장했어요');
      } finally { PT.busy(btn, false); }
    });
  }

  PT.initCompress = init;
})();
