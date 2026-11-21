/* 공통 도우미 — 모든 처리는 이 브라우저 안에서만 이뤄집니다. */
(function () {
  'use strict';

  const PT = (window.PT = window.PT || {});

  PT.$ = (sel, root) => (root || document).querySelector(sel);
  PT.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ── 파일 크기 ─────────────────────────── */
  PT.fmtBytes = function (n) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    return (n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 2 : 1) + ' MB';
  };

  PT.savedPct = function (before, after) {
    if (!before) return 0;
    return Math.round((1 - after / before) * 100);
  };

  /* ── 이름 다듬기 ───────────────────────── */
  PT.baseName = function (name) {
    return String(name || 'file').replace(/\.[^.]+$/, '');
  };

  PT.stamp = function () {
    const d = new Date();
    const p = (x) => String(x).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  };

  PT.shortName = function (name, max) {
    max = max || 26;
    const s = String(name || '');
    if (s.length <= max) return s;
    const dot = s.lastIndexOf('.');
    const ext = dot > 0 ? s.slice(dot) : '';
    return s.slice(0, Math.max(6, max - ext.length - 2)) + '…' + ext;
  };

  /* ── 저장 ─────────────────────────────── */
  PT.download = function (blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 4000);
  };

  PT.downloadUrl = function (dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 4000);
  };

  /* 아이폰은 연속 다운로드가 막히는 경우가 있어 간격을 둡니다. */
  PT.downloadMany = async function (items, onProgress) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.blob) PT.download(it.blob, it.name);
      else if (it.dataUrl) PT.downloadUrl(it.dataUrl, it.name);
      if (onProgress) onProgress(i + 1, items.length);
      await PT.sleep(450);
    }
  };

  PT.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ── 캔버스 ───────────────────────────── */
  PT.canvasToBlob = function (canvas, type, quality) {
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob-failed'))), type, quality);
      } else {
        try {
          const dataUrl = canvas.toDataURL(type, quality);
          const bin = atob(dataUrl.split(',')[1]);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type }));
        } catch (e) {
          reject(e);
        }
      }
    });
  };

  PT.extFor = function (mime) {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'jpg';
  };

  /* iOS 사파리에서도 안전한 이미지 로더 */
  PT.loadImage = function (fileOrUrl) {
    return new Promise((resolve, reject) => {
      const isFile = typeof fileOrUrl !== 'string';
      const url = isFile ? URL.createObjectURL(fileOrUrl) : fileOrUrl;
      const img = new Image();
      img.onload = () => {
        if (isFile) setTimeout(() => URL.revokeObjectURL(url), 0);
        resolve(img);
      };
      img.onerror = () => {
        if (isFile) URL.revokeObjectURL(url);
        reject(new Error('이미지를 열 수 없어요. HEIC 사진은 사진 앱에서 JPG로 저장한 뒤 다시 시도해 주세요.'));
      };
      img.decoding = 'async';
      img.src = url;
    });
  };

  /* 긴 변 기준 축소 비율 */
  PT.fitScale = function (w, h, maxSide) {
    if (!maxSide) return 1;
    const longest = Math.max(w, h);
    return longest > maxSide ? maxSide / longest : 1;
  };

  PT.makeCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };

  /* 투명도 고려한 배경 채우기 */
  PT.drawFitted = function (ctx, img, dw, dh) {
    ctx.drawImage(img, 0, 0, dw, dh);
  };

  /* ── UI ──────────────────────────────── */
  let toastTimer = null;
  PT.toast = function (msg, ms) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2200);
  };

  PT.copyText = async function (text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fall through */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  };

  PT.setTab = function (name) { /* app.js가 채웁니다 */ };

  /* 세그먼트 버튼 그룹 */
  PT.segInit = function (sel, onChange) {
    const box = document.querySelector(sel);
    if (!box) return () => {};
    let current = box.querySelector('button.is-on') ? box.querySelector('button.is-on').dataset.mode : null;
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-mode]');
      if (!btn) return;
      box.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b === btn));
      current = btn.dataset.mode;
      onChange(current, btn);
    });
    return () => current;
  };

  /* 버튼 로딩 상태 */
  PT.busy = function (btn, on, label) {
    if (!btn) return;
    if (on) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>' + (label || '처리 중');
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  };

  PT.errorText = function (err) {
    const m = (err && err.message) || String(err);
    if (/blob-failed/.test(m)) return '파일을 만들지 못했어요. 다시 시도해 주세요.';
    return m;
  };
})();
