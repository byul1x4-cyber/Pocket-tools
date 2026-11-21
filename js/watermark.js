/* ⑦ 워터마크 일괄 추가 */
(function () {
  'use strict';
  const PT = window.PT;

  const MAX_SIDE = 3000;
  let files = [];
  let results = [];   // {name, blob, url, w, h}

  function drawWatermark(img, text, opts) {
    const scale = PT.fitScale(img.naturalWidth, img.naturalHeight, MAX_SIDE);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const c = PT.makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    const fontSize = Math.max(12, Math.round(w * opts.sizeRatio));
    const weight = 700;
    ctx.font = weight + ' ' + fontSize + 'px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = opts.opacity;

    const pad = Math.round(w * 0.035);

    if (opts.pos === 'tile') {
      // 대각선 반복 패턴
      const metrics = ctx.measureText(text);
      const stepX = Math.max(metrics.width * 1.5, fontSize * 6);
      const stepY = Math.max(fontSize * 3.2, 60);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.PI / 6);
      const cols = Math.ceil(Math.sqrt(w * w + h * h) / stepX) + 2;
      const rows = Math.ceil(Math.sqrt(w * w + h * h) / stepY) + 2;
      ctx.textAlign = 'center';
      for (let r = -rows; r <= rows; r++) {
        for (let col = -cols; col <= cols; col++) {
          const x = col * stepX + (r % 2 ? stepX / 2 : 0);
          const y = r * stepY;
          paintText(ctx, text, x, y, opts, fontSize);
        }
      }
      ctx.restore();
    } else {
      let x;
      let y;
      let align = 'left';
      if (opts.pos === 'br') { x = w - pad; y = h - pad; align = 'right'; }
      else if (opts.pos === 'bl') { x = pad; y = h - pad; align = 'left'; }
      else if (opts.pos === 'tr') { x = w - pad; y = pad + fontSize; align = 'right'; }
      else if (opts.pos === 'tl') { x = pad; y = pad + fontSize; align = 'left'; }
      else { x = w / 2; y = h / 2 + fontSize / 3; align = 'center'; }
      ctx.textAlign = align;
      paintText(ctx, text, x, y, opts, fontSize);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintText(ctx, text, x, y, opts, fontSize) {
    // 사진이 밝든 어둡든 읽히도록 얇은 그림자
    ctx.save();
    ctx.shadowColor = opts.color === '#000000' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = Math.max(2, fontSize * 0.12);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, fontSize * 0.03);
    ctx.fillStyle = opts.color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  async function run() {
    const text = PT.$('#wmText').value.trim();
    if (!files.length || !text) return;
    const btn = PT.$('#wmRun');
    PT.busy(btn, true, '넣는 중');
    results.forEach((r) => r.url && URL.revokeObjectURL(r.url));
    results = [];
    const opts = {
      pos: PT.$('#wmPos').value,
      color: PT.$('#wmColor').value,
      sizeRatio: parseFloat(PT.$('#wmSize').value) || 0.045,
      opacity: (parseInt(PT.$('#wmOpacity').value, 10) || 60) / 100
    };
    try {
      for (const file of files) {
        const img = await PT.loadImage(file);
        const canvas = drawWatermark(img, text, opts);
        const blob = await PT.canvasToBlob(canvas, 'image/jpeg', 0.92);
        results.push({
          name: PT.baseName(file.name) + '-워터마크.jpg',
          blob,
          url: URL.createObjectURL(blob),
          w: canvas.width,
          h: canvas.height
        });
      }
      render();
      PT.toast(files.length + '장에 워터마크를 넣었어요');
    } catch (err) {
      PT.toast('실패: ' + PT.errorText(err));
    } finally {
      PT.busy(btn, false);
    }
  }

  function render() {
    const grid = PT.$('#wmGrid');
    grid.innerHTML = '';
    results.forEach((r) => {
      const fig = document.createElement('figure');
      fig.innerHTML = '<img alt="" src="' + r.url + '"><figcaption>' + r.w + '×' + r.h + '</figcaption>';
      fig.addEventListener('click', () => {
        PT.download(r.blob, r.name);
        PT.toast('저장했어요');
      });
      grid.appendChild(fig);
    });
    PT.$('#wmCountBadge').textContent = results.length + '장 완성';
    PT.$('#wmResultCard').classList.remove('hidden');
  }

  function refresh() {
    const text = PT.$('#wmText').value.trim();
    PT.$('#wmRun').disabled = !(files.length && text);
    PT.$('#wmHint').textContent = !files.length
      ? '사진과 문구를 넣으면 버튼이 켜져요.'
      : !text
        ? '워터마크로 넣을 문구를 적어 주세요.'
        : files.length + '장에 "' + text + '" 를 넣어요';
  }

  function init() {
    if (!PT.$('#wmFiles')) return;
    PT.$('#wmFiles').addEventListener('change', (e) => {
      files = Array.from(e.target.files || []).slice(0, 20);
      e.target.value = '';
      refresh();
    });
    PT.$('#wmText').addEventListener('input', refresh);
    PT.$('#wmColorSwap').addEventListener('click', () => {
      const el = PT.$('#wmColor');
      el.value = el.value.toLowerCase() === '#000000' ? '#ffffff' : '#000000';
      PT.$('#wmColorSwap').textContent = el.value.toLowerCase() === '#000000' ? '흰색으로' : '검정으로';
    });
    const op = PT.$('#wmOpacity');
    op.addEventListener('input', () => { PT.$('#wmOpacityOut').textContent = op.value + '%'; });
    PT.$('#wmRun').addEventListener('click', run);
    PT.$('#wmSaveAll').addEventListener('click', async () => {
      const btn = PT.$('#wmSaveAll');
      PT.busy(btn, true, '저장 중');
      try {
        await PT.downloadMany(results.map((r) => ({ blob: r.blob, name: r.name })));
        PT.toast(results.length + '장 저장했어요');
      } finally { PT.busy(btn, false); }
    });
  }

  PT.initWatermark = init;
})();
