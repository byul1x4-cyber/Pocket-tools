/* ⑥ SNS 비율 리사이즈 */
(function () {
  'use strict';
  const PT = window.PT;

  const RATIO = {
    '1:1': [1080, 1080],
    '4:5': [1080, 1350],
    '16:9': [1920, 1080],
    '9:16': [1080, 1920]
  };

  const SUPPORTS_FILTER = (() => {
    try {
      const c = document.createElement('canvas').getContext('2d');
      c.filter = 'blur(2px)';
      return c.filter === 'blur(2px)';
    } catch (e) { return false; }
  })();

  let files = [];
  let results = [];   // {name, blob, url, w, h}

  function drawCover(ctx, img, w, h) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  function blurBackdrop(ctx, img, w, h) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    if (SUPPORTS_FILTER) {
      ctx.save();
      ctx.filter = 'blur(' + Math.round(w / 32) + 'px) saturate(1.15)';
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      ctx.filter = 'none';
      ctx.restore();
    } else {
      // 필터 미지원 브라우저: 아주 작게 그린 뒤 확대해 흐림 효과
      const tiny = PT.makeCanvas(Math.max(2, Math.round(w / 26)), Math.max(2, Math.round(h / 26)));
      const tc = tiny.getContext('2d');
      drawCover(tc, img, tiny.width, tiny.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, 0, 0, w, h);
    }
    // 살짝 어둡게 해서 가운데 사진이 돋보이게
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, w, h);
  }

  async function convert(file) {
    const img = await PT.loadImage(file);
    const [w, h] = RATIO[PT.$('#rsRatio').value] || RATIO['1:1'];
    const fill = PT.$('#rsFill').value;

    const c = PT.makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (fill === 'cover') {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      drawCover(ctx, img, w, h);
    } else {
      if (fill === 'white') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
      else if (fill === 'black') { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h); }
      else blurBackdrop(ctx, img, w, h);

      const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * s;
      const dh = img.naturalHeight * s;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }

    const blob = await PT.canvasToBlob(c, 'image/jpeg', 0.92);
    return {
      name: PT.baseName(file.name) + '-' + PT.$('#rsRatio').value.replace(':', 'x') + '.jpg',
      blob,
      url: URL.createObjectURL(blob),
      w, h
    };
  }

  async function run() {
    if (!files.length) return;
    const btn = PT.$('#rsRun');
    PT.busy(btn, true, '변환 중');
    results.forEach((r) => r.url && URL.revokeObjectURL(r.url));
    results = [];
    try {
      for (const f of files) results.push(await convert(f));
      render();
      PT.toast(results.length + '장 변환했어요');
    } catch (err) {
      PT.toast('변환 실패: ' + PT.errorText(err));
    } finally {
      PT.busy(btn, false);
    }
  }

  function render() {
    const grid = PT.$('#rsGrid');
    grid.innerHTML = '';
    results.forEach((r, i) => {
      const fig = document.createElement('figure');
      fig.innerHTML = '<img alt="' + escapeHtml(r.name) + '" src="' + r.url + '"><figcaption>' + r.w + '×' + r.h + '</figcaption>';
      fig.addEventListener('click', () => {
        PT.download(r.blob, r.name);
        PT.toast('저장했어요');
      });
      grid.appendChild(fig);
    });
    PT.$('#rsResultCard').classList.remove('hidden');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function init() {
    if (!PT.$('#rsFiles')) return;
    PT.$('#rsFiles').addEventListener('change', (e) => {
      files = Array.from(e.target.files || []).slice(0, 20);
      e.target.value = '';
      PT.$('#rsRun').disabled = files.length === 0;
      const [w, h] = RATIO[PT.$('#rsRatio').value] || RATIO['1:1'];
      PT.$('#rsHint').textContent = files.length
        ? files.length + '장 → ' + w + '×' + h + ' 로 변환해요'
        : '사진을 고르면 변환 버튼이 켜져요.';
    });
    PT.$('#rsRun').addEventListener('click', run);
    PT.$('#rsRatio').addEventListener('change', () => {
      const [w, h] = RATIO[PT.$('#rsRatio').value] || RATIO['1:1'];
      PT.$('#rsHint').textContent = files.length
        ? files.length + '장 → ' + w + '×' + h + ' 로 변환해요'
        : '사진을 고르면 변환 버튼이 켜져요.';
    });
    PT.$('#rsSaveAll').addEventListener('click', async () => {
      const btn = PT.$('#rsSaveAll');
      PT.busy(btn, true, '저장 중');
      try {
        await PT.downloadMany(results.map((r) => ({ blob: r.blob, name: r.name })));
        PT.toast(results.length + '장 저장했어요');
      } finally { PT.busy(btn, false); }
    });
  }

  PT.initResize = init;
})();
