import { CONFIG, WATCH_TARGETS } from "./config.js";
import { fetchScheduleForDate, CgvApiError } from "./cgvClient.js";
import { loadState, saveState } from "./state.js";
import { sendTelegramMessage } from "./telegram.js";
import { getKstDateStrings, formatShowtimeLabel } from "./dates.js";
import type { StateFile, StoredShow } from "./types.js";

function matchesKeyword(keyword: string, ...names: (string | undefined)[]): boolean {
  return names.some((n) => n?.toUpperCase().includes(keyword.toUpperCase()));
}

async function main() {
  const prevState = await loadState();
  const nextState: StateFile = { ...prevState };
  const newlyFound: { label: string; showLabel: string; scnsNm: string; frSeatCnt: string }[] = [];

  const dates = getKstDateStrings(CONFIG.daysAhead);
  let totalRequests = 0;
  let failedRequests = 0;

  for (const target of WATCH_TARGETS) {
    for (const scnYmd of dates) {
      totalRequests++;
      let showtimes;
      try {
        showtimes = await fetchScheduleForDate(scnYmd, target.siteNo, target.movNo);
      } catch (err) {
        const msg = err instanceof CgvApiError ? err.message : String(err);
        console.error(msg);
        failedRequests++;
        continue;
      }

      const matched = showtimes.filter((s) => matchesKeyword(target.keyword, s.scnsNm, s.expoScnsNm));

      for (const show of matched) {
        // 대상(영화+극장+관 종류)마다 겹치지 않도록 키에 movNo까지 포함
        const key = `${target.movNo}_${target.siteNo}_${show.scnYmd}_${show.scnsNo}_${show.scnsrtTm}`;

        const stored: StoredShow = {
          scnsNm: show.scnsNm,
          prodNm: show.expoProdNm ?? show.movNm,
          scnYmd: show.scnYmd,
          scnsrtTm: show.scnsrtTm,
          frSeatCnt: show.frSeatCnt,
          firstSeenAt: prevState[key]?.firstSeenAt ?? new Date().toISOString(),
        };
        nextState[key] = stored;

        if (!prevState[key]) {
          newlyFound.push({
            label: target.label,
            showLabel: formatShowtimeLabel(show.scnYmd, show.scnsrtTm),
            scnsNm: show.scnsNm,
            frSeatCnt: show.frSeatCnt,
          });
        }
      }

      // CGV 서버에 너무 빠르게 연달아 요청하지 않도록 살짝 텀을 둠
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  if (newlyFound.length > 0) {
    // 텔레그램 메시지 길이 제한(4096자)에 걸리지 않도록 묶어서 여러 통으로 나눠 보냄
    const CHUNK_SIZE = 25;
    const chunks: (typeof newlyFound)[] = [];
    for (let i = 0; i < newlyFound.length; i += CHUNK_SIZE) {
      chunks.push(newlyFound.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
      const lines = chunks[i]
        .map((n) => `[${n.label}]\n${n.showLabel} / ${n.scnsNm} (잔여 ${n.frSeatCnt}석)`)
        .join("\n\n");
      const header =
        chunks.length > 1
          ? `🍿 CGV 새 회차 오픈! (${i + 1}/${chunks.length})`
          : "🍿 CGV 새 회차 오픈!";
      await sendTelegramMessage(`${header}\n\n${lines}\n\nhttps://cgv.co.kr`);
      await new Promise((r) => setTimeout(r, 500));
    }
    console.log(`새 회차 ${newlyFound.length}건 알림 전송 완료 (${chunks.length}통으로 분할)`);
  } else {
    console.log("새로 열린 회차 없음");
  }

  if (totalRequests > 0 && failedRequests === totalRequests) {
    // 모든 요청이 실패한 경우 = 십중팔구 차단/구조 변경. 상태 저장은 건너뜀.
    console.error("모든 요청이 실패했습니다. state.json은 갱신하지 않습니다.");
    process.exitCode = 1;
    return;
  }

  await saveState(nextState);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
