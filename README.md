# CGV 예매 오픈 알림봇

CGV 특정 극장/영화/특별관 조합에 새 회차가 뜨면 텔레그램으로 알림을 보내는 개인용 도구입니다.
`src/config.ts`의 `WATCH_TARGETS` 배열에 감시하고 싶은 조합을 여러 개 등록할 수 있습니다 (기본값: 용산 SCREENX 스파이더맨, 용아맥 IMAX 오디세이).
결제/좌석 예매는 자동화하지 않습니다 — 알림을 받으면 직접 CGV 앱/사이트에서 예매하세요.

## 동작 방식

5분마다(GitHub Actions 스케줄) `WATCH_TARGETS`에 등록된 각 대상마다
`https://cgv.co.kr/api/v1/booking/searchSchByMov` 를 오늘부터 14일치 호출해서,
관 이름에 지정한 키워드(SCREENX, IMAX 등)가 들어간 회차 목록을 이전 실행 결과(`data/state.json`)와 비교합니다.
새로 생긴 회차가 있으면 텔레그램으로 알림을 보내고, 상태 파일을 갱신해서 리포에 커밋합니다.

## 처음 설정하는 법

### 1. 텔레그램 봇 만들기

1. 텔레그램에서 `@BotFather` 검색 → `/newbot` → 이름 정하면 토큰(`123456:ABC-...`)을 줍니다. 이게 `TELEGRAM_BOT_TOKEN`.
2. 방금 만든 봇한테 아무 메시지나 하나 보냅니다 (예: "안녕").
3. 브라우저로 `https://api.telegram.org/bot<위에서 받은 토큰>/getUpdates` 접속 → 응답 JSON 안에 `"chat":{"id":123456789,...}` 이 숫자가 `TELEGRAM_CHAT_ID`.

### 2. GitHub 리포 만들고 이 코드 올리기

```bash
cd cgv-screenx-alert
git init
git add .
git commit -m "init"
gh repo create cgv-screenx-alert --private --source=. --push
# gh 없으면 GitHub 웹에서 리포 만들고 git remote add origin ... 후 push
```

### 3. Secrets 등록

리포 Settings → Secrets and variables → Actions → New repository secret 에서 두 개 추가:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

### 4. 워크플로우 켜기

Actions 탭에서 "CGV SCREENX Alert" 워크플로우가 보이면, 우측 "Run workflow" 버튼으로 한 번 수동 실행해서 정상 동작하는지 확인하세요.
(스케줄은 최초 push 후 자동으로 5분 간격으로 돌기 시작합니다.)

## 첫 실행 때 꼭 확인할 것

CGV 응답의 정확한 최상위 JSON 구조(어떤 키 아래에 배열이 들어있는지)까지는 캡처하지 못해서,
`src/cgvClient.ts`가 응답을 재귀적으로 뒤져서 회차 배열을 자동으로 찾도록 만들어뒀습니다.
Actions 로그에서 첫 실행 결과를 확인해서:

- "새로 열린 SCREENX 회차 없음" 이 뜨면 정상 동작 중인 겁니다.
- "CGV API 응답이 JSON이 아닙니다" 에러가 뜨면 Cloudflare 봇 차단에 걸린 것이니, 저한테 로그 붙여넣어 주시면 우회 방법(헤더 추가 또는 Playwright 방식 전환)을 같이 찾아보면 됩니다.
- 배열을 못 찾는 에러가 나면 응답 구조가 예상과 달라서 그런 것이니, 실제 응답 원문을 공유해주세요.

## 감시 대상 추가/변경하고 싶으면

`src/config.ts`의 `WATCH_TARGETS` 배열에 항목을 추가/수정하면 됩니다.

```ts
export const WATCH_TARGETS: WatchTarget[] = [
  { label: "표시할 이름", siteNo: "극장 코드", movNo: "영화 코드", keyword: "SCREENX" },
  // 필요한 만큼 추가
];
```

`siteNo`, `movNo`는 CGV 예매 페이지에서 극장/영화를 선택했을 때 개발자도구 Network 탭의
`searchSchByMov` 요청 쿼리스트링에서 확인할 수 있고, `keyword`는 관 이름(`scnsNm`, 예: "IMAX관", "14관[SCREENX]")에
포함된 문자열을 넣으면 됩니다. 텔레그램 봇/Secrets는 하나만 있으면 되고, 모든 대상의 알림이 같은 챗으로 옵니다.
