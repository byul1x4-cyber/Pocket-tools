/* 앱 시작 · 탭 전환 */
(function () {
  'use strict';
  const PT = window.PT;

  function setTab(name, opts) {
    const tab = document.getElementById('tab-' + name);
    const panel = document.getElementById('panel-' + name);
    if (!tab || !panel) return;
    PT.$$('.tab').forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) {
        try {
          t.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } catch (e) { /* 무시 */ }
      }
    });
    PT.$$('.panel').forEach((p) => p.classList.toggle('is-active', p === panel));
    if (!opts || opts.hash !== false) {
      try { history.replaceState(null, '', '#' + name); } catch (e) { /* 무시 */ }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  PT.setTab = setTab;

  function init() {
    PT.$$('.tab').forEach((t) => {
      t.addEventListener('click', () => setTab(t.dataset.tool));
    });

    const inits = [
      ['Exif', PT.initExif],
      ['Url', PT.initUrl],
      ['Pdf', PT.initPdf],
      ['Compress', PT.initCompress],
      ['Qr', PT.initQr],
      ['Resize', PT.initResize],
      ['Watermark', PT.initWatermark]
    ];
    inits.forEach(([name, fn]) => {
      if (typeof fn !== 'function') {
        console.warn('[도구함] 초기화 함수 없음:', name);
        return;
      }
      try {
        fn();
      } catch (err) {
        console.error('[도구함] ' + name + ' 초기화 실패', err);
      }
    });

    // 주소의 #도구 로 바로 열기
    const hash = (location.hash || '').replace('#', '');
    if (hash && document.getElementById('panel-' + hash)) setTab(hash, { hash: false });

    window.addEventListener('hashchange', () => {
      const h = (location.hash || '').replace('#', '');
      if (h && document.getElementById('panel-' + h)) setTab(h, { hash: false });
    });

    // 홈 화면 앱(PWA) 캐시
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { /* 오프라인 캐시는 없어도 동작 */ });
      });
    }

    // 화면 회전·크기 변경 시 모자이크 캔버스 비율 유지
    window.addEventListener('resize', () => {
      const c = document.getElementById('exifCanvas');
      if (c) c.style.maxWidth = '100%';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
