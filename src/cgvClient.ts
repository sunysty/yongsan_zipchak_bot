import type { Page } from "playwright";
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

// page.evaluate 안에서 실행되는 fetch는 Node의 fetch가 아니라
// 실제 브라우저(Chromium)의 네트워크 스택을 그대로 씁니다 — 쿠키, TLS 지문 등이 진짜 브라우저와 동일합니다.
export async function fetchScheduleForDate(
  page: Page,
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

  const result = await page.evaluate(async (targetUrl: string) => {
    try {
      const res = await fetch(targetUrl, { headers: { Accept: "application/json" } });
      const text = await res.text();
      return { ok: true as const, status: res.status, text };
    } catch (err) {
      return { ok: false as const, status: 0, text: String(err) };
    }
  }, url.toString());

  if (!result.ok || result.status !== 200) {
    throw new CgvApiError(
      `CGV API가 ${result.status}를 반환했습니다 (siteNo=${siteNo}, movNo=${movNo}, ${scnYmd}). Cloudflare 차단일 수 있습니다.`
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(result.text);
  } catch {
    throw new CgvApiError(
      `CGV API 응답이 JSON이 아닙니다 (siteNo=${siteNo}, movNo=${movNo}, ${scnYmd}). 응답 앞부분: ${result.text.slice(0, 200)}`
    );
  }

  const showtimes = findShowtimeArray(json);
  if (!showtimes) {
    return [];
  }
  return showtimes;
}
