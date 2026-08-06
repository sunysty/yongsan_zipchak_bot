// CGV searchSchByMov 응답의 개별 상영 회차 항목.
// 실제 캡처된 응답에서 확인된 필드만 타입으로 남기고, 나머지는 무시합니다.
export interface CgvShowtime {
  scnsNo: string; // 상영관 번호
  scnsNm: string; // 상영관 이름 (예: "14관[SCREENX]")
  expoScnsNm?: string;
  scnYmd: string; // 상영일자 YYYYMMDD
  scnsrtTm: string; // 시작시간 HHmm
  scnendTm: string; // 종료시간 HHmm
  movNo: string;
  movNm: string;
  expoProdNm?: string;
  cpSeatCnt: string; // 총 좌석수
  stcnt: string; // 총 좌석수 (동일 의미로 추정)
  frSeatCnt: string; // 잔여 좌석수
  [key: string]: unknown;
}

// 상태 파일에 저장하는 형태 (회차별 최소 정보)
export interface StoredShow {
  scnsNm: string;
  prodNm: string;
  scnYmd: string;
  scnsrtTm: string;
  frSeatCnt: string;
  firstSeenAt: string; // ISO timestamp, 최초 감지 시각
}

export type StateFile = Record<string, StoredShow>;
