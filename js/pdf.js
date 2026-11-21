/* ③ PDF ↔ 이미지 */
(function () {
  'use strict';
  const PT = window.PT;

  let mode = 'img2pdf';
  const imgs = [];      // {file, img, url, w, h}
  let pdfPages = [];    // {blob, url, w, h, name}
  let pdfName = 'document';

  /* ── 이미지 → PDF ─────────────────────── */
  async function addImages(files) {
    const list = Array.from(files || []).slice(0, 30);
    for (const file of list) {
      if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)) continue;
      try {
        const img = await PT.loadImage(file);
        imgs.push({ file, img, url: URL.createObjectURL(file), w: img.naturalWidth, h: img.naturalHeight });
      } catch (e) {
        PT.toast(PT.errorText(e));
      }
    }
    renderImgList();
  }

  function renderImgList() {
    const box = PT.$('#pdfImageList');
    box.innerHTML = '';
    imgs.forEach((it, i) => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML =
        '<div class="item-top">' +
        '<img class="thumb" alt="" src="' + it.url + '">' +
        '<div class="item-main"><div class="name">' + i + 1 + '. ' + PT.shortName(it.file.name.replace(/^\d+\.\s*/, ''), 22) + '</div>' +
        '<div class="meta">' + it.w + '×' + it.h + ' · ' + PT.fmtBytes(it.file.size) + '</div></div>' +
        '<button class="icon-btn" type="button" data-act="up" aria-label="위로">↑</button>' +
        '<button class="icon-btn" type="button" data-act="down" aria-label="아래로">↓</button>' +
        '<button class="icon-btn" type="button" data-act="del" aria-label="빼기">✕</button>' +
        '</div>';
      div.querySelector('[data-act=up]').disabled = i === 0;
      div.querySelector('[data-act=down]').disabled = i === imgs.length - 1;
      div.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === 'up' && i > 0) { [imgs[i - 1], imgs[i]] = [imgs[i], imgs[i - 1]]; }
        if (act === 'down' && i < imgs.length - 1) { [imgs[i + 1], imgs[i]] = [imgs[i], imgs[i + 1]]; }
        if (act === 'del') imgs.splice(i, 1);
        renderImgList();
      });
      box.appendChild(div);
    });
    PT.$('#pdfMakePdf').disabled = imgs.length === 0;
    PT.$('#pdfImgHint').textContent = imgs.length
      ? imgs.length + '장이 ' + imgs.length + '페이지로 묶여요. ↑↓로 순서를 바꿀 수 있어요.'
      : '사진을 고르면 순서를 바꿀 수 있어요.';
  }

  function imgToJpegUrl(img, maxSide) {
    const scale = PT.fitScale(img.naturalWidth, img.naturalHeight, maxSide);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const c = PT.makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { url: c.toDataURL('image/jpeg', 0.9), w, h };
  }

  async function makePdf() {
    const btn = PT.$('#pdfMakePdf');
    if (!imgs.length) return;
    PT.busy(btn, true, 'PDF 만드는 중');
    try {
      const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (!jsPDFCtor) throw new Error('PDF 라이브러리를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.');
      const pageMode = PT.$('#pdfPageSize').value;
      let doc = null;

      for (let i = 0; i < imgs.length; i++) {
        const it = imgs[i];
        const jpg = imgToJpegUrl(it.img, 2400);
        // 96dpi px → pt (1px = 0.75pt)
        if (pageMode === 'fit') {
          const wPt = jpg.w * 0.75;
          const hPt = jpg.h * 0.75;
          const orientation = wPt > hPt ? 'landscape' : 'portrait';
          if (!doc) {
            doc = new jsPDFCtor({ unit: 'pt', format: [wPt, hPt], orientation, compress: true });
          } else {
            doc.addPage([wPt, hPt], orientation);
          }
          doc.addImage(jpg.url, 'JPEG', 0, 0, wPt, hPt, undefined, 'FAST');
        } else {
          if (!doc) doc = new jsPDFCtor({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
          else doc.addPage('a4', 'portrait');
          const pw = doc.internal.pageSize.getWidth();
          const ph = doc.internal.pageSize.getHeight();
          const margin = 24;
          const availW = pw - margin * 2;
          const availH = ph - margin * 2;
          const s = Math.min(availW / jpg.w, availH / jpg.h);
          const w = jpg.w * s;
          const h = jpg.h * s;
          doc.addImage(jpg.url, 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h, undefined, 'FAST');
        }
        if (i === 0) doc.setProperties({ title: PT.baseName(imgs[0].file.name) });
      }

      const blob = doc.output('blob');
      const name = (imgs.length === 1 ? PT.baseName(imgs[0].file.name) : '모아찍기-' + PT.stamp()) + '.pdf';
      PT.download(blob, name);
      PT.$('#pdfImgHint').textContent = '✅ ' + PT.shortName(name) + ' 저장했어요 · ' + imgs.length + '페이지 · ' + PT.fmtBytes(blob.size);
      PT.toast('PDF ' + imgs.length + '페이지로 저장했어요');
    } catch (err) {
      PT.$('#pdfImgHint').textContent = '⚠️ ' + PT.errorText(err);
      PT.toast('PDF 만들기 실패: ' + PT.errorText(err));
    } finally {
      PT.busy(btn, false);
    }
  }

  /* ── PDF → 이미지 ─────────────────────── */
  function ensurePdfLib() {
    const lib = window.pdfjsLib;
    if (!lib) throw new Error('PDF 라이브러리를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.');
    lib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';
    return lib;
  }

  function clearPages() {
    pdfPages.forEach((p) => { if (p.url) URL.revokeObjectURL(p.url); });
    pdfPages = [];
    PT.$('#pdfPageGrid').innerHTML = '';
    PT.$('#pdfSaveAll').classList.add('hidden');
  }

  async function loadPdf(file) {
    if (!file) return;
    const hint = PT.$('#pdfHint');
    hint.className = 'hint';
    hint.textContent = 'PDF를 여는 중이에요…';
    clearPages();
    try {
      const lib = ensurePdfLib();
      const buf = await file.arrayBuffer();
      const pdf = await lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
      pdfName = PT.baseName(file.name);
      const scale = parseFloat(PT.$('#pdfQuality').value) || 2;
      const grid = PT.$('#pdfPageGrid');

      for (let p = 1; p <= pdf.numPages; p++) {
        hint.textContent = '페이지 ' + p + ' / ' + pdf.numPages + ' 변환 중…';
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: scale });
        // 너무 커지지 않게 상한
        const maxSide = Math.max(viewport.width, viewport.height);
        const cap = 3000;
        const vp = maxSide > cap ? page.getViewport({ scale: scale * (cap / maxSide) }) : viewport;
        const canvas = PT.makeCanvas(vp.width, vp.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;

        const blob = await PT.canvasToBlob(canvas, 'image/png');
        const url = URL.createObjectURL(blob);
        pdfPages.push({ blob, url, w: canvas.width, h: canvas.height, page: p });
        canvas.width = 0; canvas.height = 0;

        const pageRef = pdfPages[pdfPages.length - 1];
        const fig = document.createElement('figure');
        fig.innerHTML = '<img alt="' + p + '페이지" src="' + url + '"><figcaption>' + p + '쪽 저장</figcaption>';
        fig.addEventListener('click', () => savePage(pageRef));
        grid.appendChild(fig);
        await PT.sleep(0);
      }

      PT.$('#pdfSaveAll').classList.remove('hidden');
      hint.className = 'hint ok';
      hint.textContent = '✅ ' + pdf.numPages + '페이지를 사진으로 꺼냈어요. 썸네일을 누르면 그 페이지만 저장돼요.';
    } catch (err) {
      hint.className = 'hint warn';
      const msg = /password/i.test(String(err && err.message))
        ? '비밀번호가 걸린 PDF예요. 잠금을 푼 뒤 다시 시도해 주세요.'
        : PT.errorText(err);
      hint.textContent = '⚠️ ' + msg;
    }
  }

  async function savePage(page, idx) {
    if (!page) return;
    const fmt = PT.$('#pdfOutFormat').value;
    let blob = page.blob;
    let ext = 'png';
    if (fmt === 'jpg') {
      const img = await PT.loadImage(page.url);
      const c = PT.makeCanvas(page.w, page.h);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      blob = await PT.canvasToBlob(c, 'image/jpeg', 0.92);
      ext = 'jpg';
    }
    const name = pdfName + '-p' + String(page.page).padStart(2, '0') + '.' + ext;
    PT.download(blob, name);
    PT.toast(PT.shortName(name) + ' 저장했어요');
    if (typeof idx === 'number') { /* 표시용 */ }
  }

  async function saveAll() {
    const btn = PT.$('#pdfSaveAll');
    if (!pdfPages.length) return;
    PT.busy(btn, true, '저장 중');
    try {
      for (let i = 0; i < pdfPages.length; i++) {
        await savePage(pdfPages[i], i);
        await PT.sleep(420);
      }
      PT.toast(pdfPages.length + '페이지 모두 저장했어요');
    } finally {
      PT.busy(btn, false);
    }
  }

  function init() {
    if (!PT.$('#pdfMode')) return;

    mode = PT.segInit('#pdfMode', (m) => {
      mode = m;
      PT.$('#pdfImg2Pdf').classList.toggle('hidden', m !== 'img2pdf');
      PT.$('#pdfPdf2Img').classList.toggle('hidden', m !== 'pdf2img');
    });

    PT.$('#pdfImages').addEventListener('change', (e) => {
      addImages(e.target.files);
      e.target.value = '';
    });
    PT.$('#pdfMakePdf').addEventListener('click', makePdf);

    PT.$('#pdfFile').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) loadPdf(f);
    });
    PT.$('#pdfSaveAll').addEventListener('click', saveAll);
    PT.$('#pdfQuality').addEventListener('change', () => {
      PT.$('#pdfHint').className = 'hint';
      PT.$('#pdfHint').textContent = '화질을 바꾸면 PDF를 다시 열어야 적용돼요.';
    });
  }

  PT.initPdf = init;
})();
