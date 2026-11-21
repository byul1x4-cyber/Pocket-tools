# 샛별 도구함 (Pocket Tools)

휴대폰에서 자주 쓰는 7가지 생활 도구를 한 화면에 모은 **정적 웹앱**입니다.
사진·PDF·링크가 **서버로 전송되지 않습니다.** 모든 처리는 브라우저(내 폰) 안에서만 이뤄지고, 결과물도 저장 버튼을 누를 때만 기기에 남습니다.

- 배포: <https://byul1x4-cyber.github.io/Pocket-tools/> (레포 이름이 `Pocket-tools` 대문자 P라 주소도 대문자입니다)
- 홈 화면에 추가(iOS Safari → 공유 → 홈 화면에 추가)하면 앱처럼 전체 화면으로 열립니다.

## 업데이트하는 법

```bash
cd pocket-tools
git add -A && git commit -m "내용" && git push origin main
# 1~2분 뒤 https://byul1x4-cyber.github.io/Pocket-tools/ 에 반영
```

## 7가지 도구

| 도구 | 하는 일 |
| --- | --- |
| 🪪 EXIF 삭제 · 모자이크 | 원본에 남은 GPS·기기·촬영시각 정보를 알려 주고, 저장 시 캔버스 재렌더링으로 완전히 제거. 손가락으로 문질러 모자이크/블러(굵기 조절, 되돌리기, 초기화) → PNG/JPG 저장 |
| 🔗 URL 추적 꼬리표 제거 | `utm_*`, `fbclid`, `igsh`, `si`, `ref`, `NaPm`, `gclid`, `mc_*` 등 추적 파라미터 제거. 쿠팡은 상품번호 정식 주소로, 유튜브 단축링크는 정식 주소로 정리. 정리 전/후 글자 수 비교 + 복사 |
| 📄 PDF ↔ 이미지 | 이미지 여러 장을 순서대로 1개 PDF로(jsPDF, 사진에 딱 맞게 / A4), PDF를 페이지별 PNG·JPG로 꺼내기(pdf.js, 화질 선택, 개별·전체 저장) |
| 🗜️ 이미지 압축 · 변환 | 여러 장 동시, 품질 10~100%, 최대 너비(원본/1920/1280/800), JPG·PNG·WebP, 변환 전후 용량·절감률 표시 |
| 📱 만료 없는 QR | 링크·글·와이파이 탭, 크기·색·오류보정 선택, 브라우저에서 직접 그려 PNG 저장 (만료 없음) |
| 🖼️ SNS 비율 리사이즈 | 1:1 / 4:5 / 16:9 / 9:16, 잘리지 않게 맞추고 여백은 흰색·검정·블러(또는 꽉 채우기) |
| 🏷️ 워터마크 일괄 | 여러 장에 같은 문구, 위치(네 모서리·가운데·대각선 반복), 투명도·크기·색 |

## 구조

```
index.html            화면(7개 탭)
css/style.css         모바일 우선 스타일
js/util.js            공통 도우미
js/exif.js           ① EXIF·모자이크
js/url.js            ② URL 정리
js/pdf.js            ③ PDF ↔ 이미지
js/compress.js       ④ 압축·변환
js/qr.js             ⑤ QR
js/resize.js         ⑥ SNS 비율
js/watermark.js      ⑦ 워터마크
js/app.js             탭 전환·초기화·서비스워커
libs/                 jspdf 2.5.2, pdf.js 3.11.174, qrcode-generator 1.4.4 (벤더링)
manifest.json, sw.js  PWA(홈 화면 추가, 오프라인 캐시)
icons/                앱 아이콘(180/192/512, maskable, svg)
screenshots/          검증 스크린샷
```

## 개인정보

- 업로드·전송 없음: 파일은 `URL.createObjectURL`/`FileReader`로만 읽고, 결과는 브라우저에서 만들어 바로 내려받습니다.
- 외부 요청은 이 사이트의 정적 파일뿐이며, 분석 도구·광고·쿠키를 쓰지 않습니다.
- 서비스워커는 오프라인 사용을 위한 로컬 캐시만 합니다.

## 로컬에서 열기

```bash
cd pocket-tools
python3 -m http.server 8080
# http://127.0.0.1:8080
```

## 라이브러리 라이선스

- [jsPDF](https://github.com/parallax/jsPDF) — MIT
- [PDF.js](https://github.com/mozilla/pdf.js) — Apache-2.0
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — MIT
