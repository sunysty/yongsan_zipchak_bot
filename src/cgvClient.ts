import { CONFIG } from "./config.js";
import type { CgvShowtime } from "./types.js";

const BASE_URL = "https://cgv.co.kr/api/v1/booking/searchSchByMov";

// 실제 캡처로 확인된 응답 구조는 최상위 "data" 키 아래 배열입니다.
// 혹시 날짜/상황에 따라 래핑이 달라지는 경우에 대비해, "data"가 없거나
// 배열이 아니면 객체를 재귀적으로 뒤져서 "scnsNo" 키를 가진 배열을 찾습니다.
function findShowtimeArray(node: unknown, depth = 0): CgvShowtime[] | null {
  if (depth > 6 || node == null) return null;

  if (Array.isArray(node)) {
    if (
      node.length > 0 &&
      typeof node[0] === "object" &&
      node[0] !== null &&
      "scnsNo" in (node[0] as object)
    ) {
      return node as CgvShowtime[];
    }
    for (const item of node) {
      const found = findShowtimeArray(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    // 빠른 경로: 확인된 구조
    if (Array.isArray(obj.data)) {
      const found = findShowtimeArray(obj.data, depth + 1);
      if (found) return found;
    }
    for (const value of Object.values(obj)) {
      const found = findShowtimeArray(value, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

export class CgvApiError extends Error {}

export async function fetchScheduleForDate(
  scnYmd: string,
  siteNo: string,
  movNo: string
): Promise<CgvShowtime[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set("coCd", CONFIG.coCd);
  url.searchParams.set("siteNo", siteNo);
  url.searchParams.set("scnYmd", scnYmd);
  url.searchParams.set("movNo", movNo);
  url.searchParams.set("rtctlScopCd", CONFIG.rtctlScopCd);

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "ko-KR",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new CgvApiError(
      `CGV API가 ${res.status}를 반환했습니다 (siteNo=${siteNo}, movNo=${movNo}, ${scnYmd}). Cloudflare 차단일 수 있습니다.`
    );
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // JSON이 아니면 Cloudflare 챌린지 페이지(HTML) 등을 받은 것으로 간주
    throw new CgvApiError(
      `CGV API 응답이 JSON이 아닙니다 (siteNo=${siteNo}, movNo=${movNo}, ${scnYmd}). Cloudflare 봇 차단 가능성 있음. 응답 앞부분: ${text.slice(0, 200)}`
    );
  }

  const showtimes = findShowtimeArray(json);
  if (!showtimes) {
    // 그 날짜에 상영이 아예 없는 경우일 수도 있으니 에러 대신 빈 배열
    return [];
  }
  return showtimes;
}
