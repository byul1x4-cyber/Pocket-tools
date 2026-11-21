/* ① EXIF 삭제 · 모자이크 */
(function () {
  'use strict';
  const PT = window.PT;

  const MAX_SIDE = 2000;   // 편집 캔버스 최대 긴 변(아이폰 메모리 보호)
  const UNDO_MAX = 4;

  let base = null;      // 원본을 그려 둔 캔버스
  let work = null;      // 결과 캔버스
  let workCtx = null;
  let view = null;      // 화면에 보이는 캔버스
  let srcInfo = null;   // {name, size, w, h, exif}
  let undo = [];
  let brush = 60;
  let mode = 'mosaic';
  let drawing = false;
  let lastPt = null;
  let pixCache = null;  // 모자이크용 축소 캔버스
  let pixBlock = 0;
  let dirty = false;

  /* ── EXIF 조사(제거 전 안내용) ───────────── */
  function parseExifHead(buf) {
    const out = { hasExif: false, bytes: 0, gps: false, camera: false, date: false };
    try {
      const dv = new DataView(buf.buffer || buf, buf.byteOffset || 0, buf.byteLength);
      if (dv.getUint16(0) !== 0xffd8) return out; // JPEG 아님
      let off = 2;
      while (off + 4 < dv.byteLength) {
        if (dv.getUint8(off) !== 0xff) break;
        const marker = dv.getUint8(off + 1);
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
        if (marker === 0xda) break; // 이미지 데이터 시작
        const len = dv.getUint16(off + 2);
        if (len < 2) break;
        if (marker === 0xe1) {
          const start = off + 4;
          // "Exif\0\0"
          if (dv.getUint32(start) === 0x45786966 && dv.getUint16(start + 4) === 0) {
            out.hasExif = true;
            out.bytes += len;
            // EXIF 안에서 쓰인 태그들 훑기(빅/리틀엔디언 모두)
            const seg = new Uint8Array(dv.buffer, dv.byteOffset + start, Math.min(len, dv.byteLength - start));
            for (let i = 6; i + 1 < seg.length; i++) {
              if (seg[i] === 0x88 && seg[i + 1] === 0x25) out.gps = true;       // GPS IFD pointer
              if (seg[i] === 0x01 && seg[i + 1] === 0x0f) out.camera = true;    // Make
              if (seg[i] === 0x90 && seg[i + 1] === 0x03) out.date = true;      // DateTimeOriginal
            }
          }
        }
        off += 2 + len;
      }
      // XMP도 함께 있으면 지워짐
      const head = new Uint8Array(dv.buffer || buf, dv.byteOffset || 0, Math.min(4096, dv.byteLength));
      const txt = String.fromCharCode.apply(null, head);
      if (txt.indexOf('http://ns.adobe.com/xap') > -1) out.xmp = true;
    } catch (e) { /* 무시 */ }
    return out;
  }

  async function inspectFile(file) {
    const head = await file.slice(0, Math.min(file.size, 256 * 1024)).arrayBuffer();
    return parseExifHead(new Uint8Array(head));
  }

  function describeExif(info) {
    if (!info.hasExif) return null;
    const parts = [];
    if (info.gps) parts.push('촬영 위치(GPS)');
    if (info.camera) parts.push('기기 정보');
    if (info.date) parts.push('촬영 시각');
    return parts;
  }

  /* ── 모자이크 그리기 ─────────────────────── */
  function buildPixelCache() {
    const block = Math.max(4, Math.round(brush / 3));
    if (pixCache && pixBlock === block) return;
    pixBlock = block;
    const sw = Math.max(1, Math.round(work.width / block));
    const sh = Math.max(1, Math.round(work.height / block));
    pixCache = PT.makeCanvas(sw, sh);
    const c = pixCache.getContext('2d');
    c.imageSmoothingEnabled = true;
    c.drawImage(work, 0, 0, sw, sh);
  }

  function stampAt(x, y) {
    const r = brush / 2;
    workCtx.save();
    workCtx.beginPath();
    workCtx.arc(x, y, r, 0, Math.PI * 2);
    workCtx.closePath();
    workCtx.clip();
    if (mode === 'mosaic') {
      workCtx.imageSmoothingEnabled = false;
      workCtx.drawImage(pixCache, 0, 0, pixCache.width, pixCache.height, 0, 0, work.width, work.height);
      workCtx.imageSmoothingEnabled = true;
    } else {
      const px = Math.max(4, brush / 6);
      workCtx.filter = 'blur(' + px.toFixed(1) + 'px)';
      workCtx.drawImage(work, 0, 0);
      workCtx.filter = 'none';
    }
    workCtx.restore();
  }

  function strokeTo(x, y) {
    if (!lastPt) { stampAt(x, y); lastPt = { x, y }; return; }
    const dx = x - lastPt.x;
    const dy = y - lastPt.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(2, brush / 6);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) stampAt(lastPt.x + (dx * i) / n, lastPt.y + (dy * i) / n);
    lastPt = { x, y };
  }

  function syncView() {
    // 화면 캔버스에 작업 캔버스를 그대로 복사
    view.width = work.width;
    view.height = work.height;
    const vc = view.getContext('2d');
    vc.clearRect(0, 0, view.width, view.height);
    vc.drawImage(work, 0, 0);
    // 모자이크 캐시는 다음 획에서 새로 만듭니다.
    pixCache = null;
    pixBlock = 0;
  }

  function pushUndo() {
    try {
      const snap = workCtx.getImageData(0, 0, work.width, work.height);
      undo.push(snap);
      if (undo.length > UNDO_MAX) undo.shift();
    } catch (e) { /* 메모리 부족 시 건너뜀 */ }
  }

  /* ── 좌표 변환 ─────────────────────────── */
  function pointFrom(e) {
    const rect = view.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * work.width;
    const y = ((e.clientY - rect.top) / rect.height) * work.height;
    return { x, y };
  }

  /* ── 파일 열기 ─────────────────────────── */
  async function openFile(file) {
    if (!file) return;
    const infoEl = PT.$('#exifMeta');
    infoEl.className = 'hint';
    infoEl.textContent = '사진을 읽고 있어요…';
    try {
      const exif = await inspectFile(file);
      const img = await PT.loadImage(file);
      const scale = PT.fitScale(img.naturalWidth, img.naturalHeight, MAX_SIDE);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);

      base = PT.makeCanvas(w, h);
      const bc = base.getContext('2d');
      bc.drawImage(img, 0, 0, w, h);

      work = PT.makeCanvas(w, h);
      workCtx = work.getContext('2d', { willReadFrequently: true });
      if (file.type === 'image/png' || file.type === 'image/webp') {
        workCtx.drawImage(base, 0, 0);
      } else {
        // 투명 PNG가 아닌 사진은 흰 바탕(EXIF 없는 새 그림)
        workCtx.drawImage(base, 0, 0);
      }

      srcInfo = { name: file.name, size: file.size, w, h, exif, origW: img.naturalWidth, origH: img.naturalHeight };
      undo = [];
      dirty = false;

      view = PT.$('#exifCanvas');
      view.width = w;
      view.height = h;
      view.getContext('2d').drawImage(work, 0, 0);

      PT.$('#exifEditor').classList.remove('hidden');
      PT.$('#exifEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });

      const types = describeExif(exif);
      if (exif.hasExif) {
        infoEl.className = 'hint warn';
        infoEl.innerHTML = '⚠️ 원본에 <b>EXIF 메타데이터 ' + PT.fmtBytes(exif.bytes) + '</b>' +
          (types && types.length ? ' — ' + types.join(' · ') + ' 포함' : '') +
          '<br>저장하면 이 정보가 <b>완전히 사라진</b> 새 이미지로 만들어져요.';
      } else {
        infoEl.className = 'hint ok';
        infoEl.innerHTML = '✅ 이 사진에는 지울 EXIF 정보가 없어요. 그래도 저장하면 깨끗한 새 이미지로 다시 그려 저장해요.' +
          '<br>사진 ' + img.naturalWidth + '×' + img.naturalHeight + ' → ' + w + '×' + h + ' 로 처리';
      }
      PT.$('#exifSaveInfo').textContent = '';
      updateSaveInfo();
    } catch (err) {
      infoEl.className = 'hint warn';
      infoEl.textContent = PT.errorText(err);
    }
  }

  function updateSaveInfo() {
    if (!srcInfo) return;
    const el = PT.$('#exifSaveInfo');
    const viaExif = srcInfo.exif.hasExif;
    el.innerHTML = '저장 결과: <b>' + work.width + '×' + work.height + 'px</b> · EXIF ' +
      (viaExif ? '<b class="down">삭제됨</b>' : '없음') +
      ' · 서버 전송 없음';
  }

  /* ── 초기화 ───────────────────────────── */
  function init() {
    const fileInput = PT.$('#exifFile');
    if (!fileInput) return;
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      openFile(f);
      fileInput.value = '';
    });

    mode = PT.segInit('#exifMode', (m) => {
      mode = m;
      PT.$('#exifModeBadge').textContent = m === 'mosaic' ? '모자이크' : '블러';
    });

    const brushEl = PT.$('#exifBrush');
    const brushOut = PT.$('#exifBrushOut');
    brushEl.addEventListener('input', () => {
      brush = +brushEl.value;
      brushOut.textContent = brushEl.value;
      pixCache = null;
    });
    brush = +brushEl.value;

    const canvas = PT.$('#exifCanvas');

    canvas.addEventListener('pointerdown', (e) => {
      if (!work) return;
      e.preventDefault();
      drawing = true;
      lastPt = null;
      pushUndo();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      buildPixelCache();
      const p = pointFrom(e);
      stampAt(p.x, p.y);
      lastPt = p;
      dirty = true;
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!drawing || !work) return;
      e.preventDefault();
      const p = pointFrom(e);
      strokeTo(p.x, p.y);
    });

    const stop = (e) => {
      if (!drawing) return;
      drawing = false;
      lastPt = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      syncView();
      pixCache = null;
      updateSaveInfo();
    };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('pointerleave', (e) => { if (drawing && e.pointerType === 'mouse') stop(e); });

    // 사파리 구형 폴백(포인터 이벤트 미지원)
    if (!window.PointerEvent) {
      canvas.addEventListener('mousedown', (e) => {
        if (!work) return;
        drawing = true; lastPt = null; pushUndo(); buildPixelCache();
        const p = pointFrom(e); stampAt(p.x, p.y); lastPt = p; dirty = true;
      });
      canvas.addEventListener('mousemove', (e) => {
        if (!drawing) return;
        const p = pointFrom(e); strokeTo(p.x, p.y);
      });
      canvas.addEventListener('mouseup', () => {
        if (!drawing) return; drawing = false; lastPt = null; syncView(); updateSaveInfo();
      });
      canvas.addEventListener('touchstart', (e) => {
        if (!work) return;
        e.preventDefault();
        drawing = true; lastPt = null; pushUndo(); buildPixelCache();
        const t = e.touches[0];
        const p = pointFrom(t); stampAt(p.x, p.y); lastPt = p; dirty = true;
      }, { passive: false });
      canvas.addEventListener('touchmove', (e) => {
        if (!drawing) return;
        e.preventDefault();
        const t = e.touches[0];
        const p = pointFrom(t); strokeTo(p.x, p.y);
      }, { passive: false });
      canvas.addEventListener('touchend', () => {
        if (!drawing) return; drawing = false; lastPt = null; syncView(); updateSaveInfo();
      });
    }

    PT.$('#exifUndo').addEventListener('click', () => {
      if (!undo.length) { PT.toast('되돌릴 작업이 없어요'); return; }
      const snap = undo.pop();
      workCtx.putImageData(snap, 0, 0);
      syncView();
      updateSaveInfo();
      PT.toast('한 단계 되돌렸어요');
    });

    PT.$('#exifReset').addEventListener('click', () => {
      if (!base) return;
      workCtx.clearRect(0, 0, work.width, work.height);
      workCtx.drawImage(base, 0, 0);
      undo = [];
      syncView();
      updateSaveInfo();
      PT.toast('처음 사진으로 되돌렸어요');
    });

    async function save(type, quality, ext) {
      if (!work) return;
      const btn = type === 'image/png' ? PT.$('#exifSavePng') : PT.$('#exifSaveJpg');
      PT.busy(btn, true, '저장 중');
      try {
        const blob = await PT.canvasToBlob(work, type, quality);
        const name = PT.baseName(srcInfo.name) + '-exif제거.' + ext;
        PT.download(blob, name);
        const el = PT.$('#exifSaveInfo');
        el.innerHTML = '✅ <b>' + PT.shortName(name) + '</b> 저장했어요 · ' + PT.fmtBytes(blob.size) +
          ' · EXIF 삭제 완료 · 서버로 보내지 않았어요';
        PT.toast('저장했어요 · EXIF 삭제 완료');
      } catch (err) {
        PT.toast('저장 실패: ' + PT.errorText(err));
      } finally {
        PT.busy(btn, false);
      }
    }

    PT.$('#exifSavePng').addEventListener('click', () => save('image/png', undefined, 'png'));
    PT.$('#exifSaveJpg').addEventListener('click', () => save('image/jpeg', 0.92, 'jpg'));
  }

  window.PT.initExif = init;
})();
