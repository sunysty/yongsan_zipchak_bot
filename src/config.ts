// 실제 브라우저 네트워크 캡처로 확인한 값들.
// 감시 대상을 추가/삭제하고 싶으면 WATCH_TARGETS 배열만 고치면 됩니다.

export interface WatchTarget {
  label: string; // 알림 메시지에 표시될 이름
  siteNo: string; // 극장 코드
  movNo: string; // 영화 코드
  keyword: string; // 관 이름(scnsNm)에 이 문자열이 포함되면 알림 대상
}

export const CONFIG = {
  coCd: "A420",
  rtctlScopCd: "08", // 캡처된 요청에서 그대로 가져온 값 (의미 불명, 고정값으로 사용)

  // 오늘부터 며칠 뒤까지 상영 스케줄을 확인할지.
  // expiresAt까지 놓치는 요일이 없도록 그 기간 전체를 커버하게 잡음 (좁게 잡았다가 원하는 요일이
  // 범위 밖이라 놓친 적이 있어서 늘림 — daysAhead가 짧을수록 요청량은 줄지만 놓칠 위험도 커짐)
  daysAhead: 7,

  // 폴링 사이에 상태를 저장해두는 파일 (GitHub Actions에서 커밋되어 다음 실행 때 이어짐)
  stateFilePath: "data/state.json",

  // 체크 사이 대기 시간(초) 범위. 매번 이 사이 랜덤 값으로 쉼 (일정한 간격은 봇 패턴이라 흔들어줌)
  pollIntervalMinSeconds: 15,
  pollIntervalMaxSeconds: 35,

  // 한 번 실행(job)이 내부적으로 반복 체크하는 총 시간(초).
  // 브라우저 실행/쿠키 받기 + Playwright 설치 시간까지 감안해서 5분보다 넉넉히 짧게 잡음
  runBudgetSeconds: 3.5 * 60,

  // 이 날짜(KST) 이후로는 자동으로 체크를 멈춤. 필요하면 이 값만 뒤로 미루면 다시 돌아감.
  expiresAt: "2026-08-15T00:00:00+09:00",
};

export const WATCH_TARGETS: WatchTarget[] = [
  {
    label: "용산 SCREENX · 스파이더맨-브랜드 뉴 데이",
    siteNo: "0013", // CGV 용산아이파크몰
    movNo: "30001192",
    keyword: "SCREENX",
  },
  // 용아맥 IMAX · 오디세이는 다른 봇으로 이미 받고 있어서 제외함.
  // 다시 필요하면 아래 주석 풀면 됨:
  // {
  //   label: "용아맥 IMAX · 오디세이",
  //   siteNo: "0013",
  //   movNo: "30001323",
  //   keyword: "IMAX",
  // },
];
