/* ② URL 추적 꼬리표 제거 */
(function () {
  'use strict';
  const PT = window.PT;

  /* 값과 상관없이 지우는 파라미터 */
  const TRACK_EXACT = new Set([
    'fbclid', 'gclid', 'gclsrc', 'dclid', 'wbraid', 'gbraid', 'msclkid', 'yclid', 'twclid', 'ttclid',
    'igshid', 'igsh', 'ig_mid', 'igbid', 'si', 'feature', 'ref', 'ref_src', 'ref_url', 'referrer',
    'src', 'source', 'from', 'share', 'share_id', 'share_source', 'sharedvia', 'sharer',
    'mkt_tok', 'trk', 'trkCampaign', 'trackingCode', 'NaPm', 'napm', 'n_media', 'n_query', 'n_rank',
    'n_ad_group', 'n_ad_group_id', 'n_keyword', 'n_keyword_id', 'n_campaign', 'n_campaign_id', 'n_match',
    'spm', 'scm', 'scm_id', 'pvid', 'algo_pvid', 'algo_expid', 'wh_weex', 'scm-url',
    'campaign', 'campaign_id', 'adgroup', 'adgroupid', 'ad_id', 'adset_id', 'creative', 'creative_id',
    'keyword', 'matchtype', 'network', 'device', 'placement', 's_kwcid', 'ef_id',
    '__twitter_impression', 'guccounter', 'guce_referrer', 'guce_referrer_sig', 'soc_src', 'soc_trk',
    'cmpid', 'CNDID', 'af_channel', 'af_sub1', 'pid_partner', '_branch_match_id', 'mibextid',
    'rcm', 'share_from', 'trkid', 'trk_info', 'wt_mc', 'mi_u', 'mi_pl', 'mi_ln', 'xtor',
    'epik', 'pp', 'plkey', 'is_from_webapp', 'sender_device', 'web_id', 'xmt', 'slof', 'hl',
    'utm', 'ga_source', 'ga_medium', 'ga_campaign', 'ga_content', 'ga_term', 'lp', 'at_medium', 'at_campaign',
    'redirect', 'redirect_to', 'return_url', 'next', 'continue_url', 'click_id', 'clickid',
    'gad_source', 'gcl_au', 'gcl_dc', 'srsltid', 'sscid', 'wickedid', 'irclickid', 'irgwc',
    'cid', 'elqTrackId', 'elqTrack', 'assetType', 'assetId', 'campID', 'partner', 'site_id',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'utm_name',
    'utm_reader', 'utm_referrer', 'utm_social', 'utm_brand', 'utm_cid', 'utm_pubreferrer',
    'utm_swu', 'utm_viz_id', 'utm_creative_format', 'utm_marketing_tactic',
    'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref', 'action_object_map', 'action_type_map',
    'action_ref_map', 'hc_ref', 'hc_location', 'fref', 'comment_tracking'
  ]);

  const TRACK_PREFIX = ['utm_', 'mc_', 'pk_', 'mtm_', 'hsa_', '_hs', 'trk_', 'vero_', 'matomo_', 'wt.', 'piwik_', 'ga_', 'at_', 'oly_', 'vgo_', 'sc_', 'nl-', 'nl_', 'n_'];

  /* 값이 있어야 의미가 있는 파라미터는 유지 */
  const KEEP_ALWAYS = new Set(['v', 't', 'list', 'index', 'start', 'q', 'page', 'id', 'productId', 'itemId', 'vendorItemId', 'img_index', 'story_fbid', 'fbid', 'tab', 'type', 'hl', 'cc_load_policy']);

  function isTrack(key) {
    if (KEEP_ALWAYS.has(key)) return false;
    if (TRACK_EXACT.has(key)) return true;
    const lower = key.toLowerCase();
    for (const p of TRACK_PREFIX) if (lower.indexOf(p) === 0) return true;
    return false;
  }

  function host(u) {
    return u.hostname.replace(/^www\./, '').replace(/^m\./, '');
  }

  /* 사이트별 정식 주소 만들기 */
  function normalize(u, removed) {
    const h = u.hostname.toLowerCase();
    const path = u.pathname;

    // 유튜브 단축 → 정식
    if (h === 'youtu.be') {
      const id = path.split('/').filter(Boolean)[0];
      if (id) {
        const out = new URL('https://www.youtube.com/watch');
        out.searchParams.set('v', id);
        const t = u.searchParams.get('t');
        if (t) out.searchParams.set('t', t);
        if (u.searchParams.get('si')) removed.push('si');
        return { url: out.toString(), note: '유튜브 공유 단축주소를 정식 주소로 바꿨어요' };
      }
    }

    // 유튜브: ?si, ?feature 정리
    if (h === 'www.youtube.com' || h === 'youtube.com' || h === 'music.youtube.com') {
      const out = new URL(u.toString());
      const v = out.searchParams.get('v');
      if (!v && /^\/shorts\//.test(path)) {
        const id = path.split('/')[2];
        if (id) {
          out.searchParams.delete('feature');
          return { url: out.toString(), note: '유튜브 쇼츠 주소를 정리했어요' };
        }
      }
    }

    // 쿠팡: 상품 번호만 남기기
    if (/(^|\.)coupang\.com$/.test(h)) {
      const m = path.match(/\/vp\/products\/(\d+)/) || path.match(/\/(?:product|products)\/(\d+)/);
      if (m) {
        const out = new URL('https://www.coupang.com/vp/products/' + m[1]);
        const item = u.searchParams.get('itemId');
        const vendor = u.searchParams.get('vendorItemId');
        if (item) out.searchParams.set('itemId', item);
        if (vendor) out.searchParams.set('vendorItemId', vendor);
        return { url: out.toString(), note: '쿠팡 상품 주소를 상품번호만 남겨 정리했어요' };
      }
      if (/^\/a\//.test(path)) {
        return { url: 'https://' + u.hostname + path, note: '쿠팡 단축링크라 상품번호를 알 수 없어 꼬리표만 지웠어요', keep: true };
      }
    }

    // 쿠팡파트너스
    if (h === 'coupa.ng' || h === 'link.coupang.com') {
      return { url: u.origin + path, note: '제휴 단축링크는 원래 주소를 알 수 없어 꼬리표만 지웠어요', keep: true };
    }

    // 인스타그램 / 스레드: 게시물 주소만 남기고 꼬리표 제거
    if (h === 'instagram.com' || h === 'threads.net' || h === 'threads.com') {
      let p = path.replace(/\/+$/, '');
      if (!p) p = '/';
      const keepIdx = u.searchParams.get('img_index');
      const url = 'https://' + h + p + (keepIdx ? '?img_index=' + encodeURIComponent(keepIdx) : '');
      return { url: url, note: '게시물 주소만 남겼어요' };
    }

    return { url: null, note: null };
  }

  function cleanOne(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;
    let input = text;
    if (!/^https?:\/\//i.test(input)) {
      if (/^[\w.-]+\.[a-z]{2,}(\/|$|\?)/i.test(input)) input = 'https://' + input;
      else return { raw: text, out: text, removed: [], error: '주소 형식이 아니에요', changed: false };
    }
    let u;
    try {
      u = new URL(input);
    } catch (e) {
      return { raw: text, out: text, removed: [], error: '주소를 읽을 수 없어요', changed: false };
    }

    const removed = [];
    const special = normalize(u, removed) || {};
    const note = special.note || null;

    if (special.url) {
      // 사이트별 정식 주소가 만들어졌어도 남은 추적 파라미터는 확인
      const outUrl = new URL(special.url);
      const drop = [];
      outUrl.searchParams.forEach((_, k) => { if (isTrack(k)) drop.push(k); });
      drop.forEach((k) => outUrl.searchParams.delete(k));
      removed.push(...drop);
      const changed = outUrl.toString() !== text;
      return {
        raw: text,
        out: outUrl.toString(),
        removed: unique(removed),
        note: note,
        changed: changed
      };
    }

    // 일반 처리
    const drop = [];
    u.searchParams.forEach((_, k) => { if (isTrack(k)) drop.push(k); });
    drop.forEach((k) => u.searchParams.delete(k));

    // 빈 해시(#) 제거
    let out = u.toString();
    if (/#$/.test(out)) out = out.slice(0, -1);
    if (out.endsWith('?')) out = out.slice(0, -1);

    return {
      raw: text,
      out: out,
      removed: unique(drop),
      note: null,
      changed: out !== text
    };
  }

  function unique(arr) {
    return Array.from(new Set(arr));
  }

  function render(results) {
    const list = PT.$('#urlList');
    list.innerHTML = '';
    let totalBefore = 0;
    let totalAfter = 0;
    const lines = [];

    results.forEach((r) => {
      totalBefore += r.raw.length;
      totalAfter += r.out.length;
      if (r.changed || r.error) lines.push(r.out);

      const div = document.createElement('div');
      div.className = 'item';

      if (r.error) {
        div.innerHTML = '<div class="item-main"><div class="name">' + esc(r.raw) + '</div>' +
          '<div class="meta">' + esc(r.error) + '</div></div>';
        list.appendChild(div);
        return;
      }

      const beforeLen = r.raw.length;
      const afterLen = r.out.length;
      const diff = beforeLen - afterLen;

      let html = '<div class="url-box">' + esc(r.out) + '</div>';
      html += '<div class="stat-row">' +
        '<div class="stat"><b>' + beforeLen + '</b><span>정리 전</span></div>' +
        '<div class="stat"><b>' + afterLen + '</b><span>정리 후</span></div>' +
        '<div class="stat"><b class="' + (diff > 0 ? 'down' : '') + '">' + (diff > 0 ? '-' + diff : '0') + '</b><span>글자 수</span></div>' +
        '</div>';
      if (r.removed && r.removed.length) {
        html += '<div class="chips">' + r.removed.map((k) => '<span class="chip">' + esc(k) + '</span>').join('') + '</div>';
      } else if (!r.changed) {
        html += '<p class="hint ok">✅ 이미 깔끔한 주소예요</p>';
      }
      if (r.note) html += '<p class="hint">' + esc(r.note) + '</p>';

      div.innerHTML = html;
      const btnRow = document.createElement('div');
      btnRow.className = 'item-actions';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn small';
      copyBtn.type = 'button';
      copyBtn.textContent = '이 링크 복사';
      copyBtn.addEventListener('click', async () => {
        const ok = await PT.copyText(r.out);
        PT.toast(ok ? '복사했어요' : '복사가 막혔어요. 길게 눌러 직접 복사해 주세요');
      });
      btnRow.appendChild(copyBtn);
      div.appendChild(btnRow);
      list.appendChild(div);
    });

    const saved = totalBefore - totalAfter;
    const badge = PT.$('#urlSavedBadge');
    if (saved > 0) {
      badge.textContent = '글자 ' + saved + '개 제거';
      badge.className = 'badge ok';
    } else {
      badge.textContent = '지울 꼬리표 없음';
      badge.className = 'badge';
    }

    PT.$('#urlResultCard').classList.remove('hidden');
    const copyRow = PT.$('#urlCopyRow');
    copyRow.classList.remove('hidden');
    copyRow.dataset.payload = lines.join('\n');
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function readClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const t = await navigator.clipboard.readText();
        if (t) { PT.$('#urlInput').value = t; run(); return; }
      }
      PT.toast('붙여넣기가 막혔어요. 입력칸을 길게 눌러 붙여넣어 주세요');
    } catch (e) {
      PT.toast('붙여넣기가 막혔어요. 입력칸을 길게 눌러 붙여넣어 주세요');
    }
  }

  function run() {
    const raw = PT.$('#urlInput').value || '';
    const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!lines.length) { PT.toast('링크를 먼저 붙여넣어 주세요'); return; }
    const results = lines.map(cleanOne).filter(Boolean);
    render(results);
    const saved = results.reduce((a, r) => a + (r.raw.length - r.out.length), 0);
    PT.toast(saved > 0 ? '추적 꼬리표 ' + saved + '글자 지웠어요' : '이미 깔끔한 주소예요');
  }

  function init() {
    if (!PT.$('#urlInput')) return;
    PT.$('#urlClean').addEventListener('click', run);
    PT.$('#urlPaste').addEventListener('click', readClipboard);
    PT.$('#urlCopy').addEventListener('click', async () => {
      const payload = PT.$('#urlCopyRow').dataset.payload || '';
      const ok = await PT.copyText(payload);
      PT.toast(ok ? '정리된 링크를 복사했어요' : '복사가 막혔어요. 길게 눌러 복사해 주세요');
    });
    PT.$('#urlInput').addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run();
    });
    // 붙여넣기만 해도 자동 정리
    PT.$('#urlInput').addEventListener('paste', () => setTimeout(run, 60));
  }

  PT.initUrl = init;
  PT.cleanUrl = cleanOne; // 테스트용
})();
