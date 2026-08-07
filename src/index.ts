import { readFile, writeFile } from "node:fs/promises";
import type { Page } from "playwright";
import { CONFIG, WATCH_TARGETS } from "./config.js";
import { fetchScheduleForDate, CgvApiError } from "./cgvClient.js";
import { openBrowserSession } from "./browserSession.js";
import { loadState, saveState } from "./state.js";
import { sendTelegramMessage } from "./telegram.js";
import { getKstDateStrings, formatShowtimeLabel } from "./dates.js";
import { matchesKeyword } from "./matching.js";
import type { StateFile, StoredShow } from "./types.js";

const FAILURE_MARKER_PATH = "data/last_failure_alert.txt";
const FAILURE_ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 같은 알림 1시간에 한 번만

async function shouldSendFailureAlert(): Promise<boolean> {
  try {
    const raw = await readFile(FAILURE_MARKER_PATH, "utf-8");
    const last = new Date(raw.trim()).getTime();
    return Date.now() - last > FAILURE_ALERT_COOLDOWN_MS;
  } catch {
    return true; // 마커 파일이 없으면 처음 겪는 실패 → 알림 보냄
  }
}

async function markFailureAlertSent() {
  await writeFile(FAILURE_MARKER_PATH, new Date().toISOString(), "utf-8");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type NewlyFound = { label: string; showLabel: string; scnsNm: string; frSeatCnt: string };

/** 한 번의 체크 사이클: 모든 대상 x 모든 날짜를 조회해서 knownState 기준으로 새로 생긴 회차를 찾는다. */
async function checkOnce(
  page: Page,
  knownState: StateFile
): Promise<{ updatedState: StateFile; newlyFound: NewlyFound[]; anySucceeded: boolean }> {
  const updatedState: StateFile = { ...knownState };
  const newlyFound: NewlyFound[] = [];
  const dates = getKstDateStrings(CONFIG.daysAhead);
  let anySucceeded = false;

  for (const target of WATCH_TARGETS) {
    for (const scnYmd of dates) {
      let showtimes;
      try {
        showtimes = await fetchScheduleForDate(page, scnYmd, target.siteNo, target.movNo);
        anySucceeded = true;
      } catch (err) {
        const msg = err instanceof CgvApiError ? err.message : String(err);
        console.error(msg);
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
          firstSeenAt: knownState[key]?.firstSeenAt ?? new Date().toISOString(),
        };
        updatedState[key] = stored;

        if (!knownState[key]) {
          newlyFound.push({
            label: target.label,
            showLabel: formatShowtimeLabel(show.scnYmd, show.scnsrtTm),
            scnsNm: show.scnsNm,
            frSeatCnt: show.frSeatCnt,
          });
        }
      }

      // CGV 서버에 너무 빠르게 연달아 요청하지 않도록 살짝 텀을 둠
      await sleep(200);
    }
  }

  return { updatedState, newlyFound, anySucceeded };
}

async function notify(newlyFound: NewlyFound[]) {
  // 텔레그램 메시지 길이 제한(4096자)에 걸리지 않도록 묶어서 여러 통으로 나눠 보냄
  const CHUNK_SIZE = 25;
  const chunks: NewlyFound[][] = [];
  for (let i = 0; i < newlyFound.length; i += CHUNK_SIZE) {
    chunks.push(newlyFound.slice(i, i + CHUNK_SIZE));
  }

  for (let i = 0; i < chunks.length; i++) {
    const lines = chunks[i]
      .map((n) => `[${n.label}]\n${n.showLabel} / ${n.scnsNm} (잔여 ${n.frSeatCnt}석)`)
      .join("\n\n");
    const header =
      chunks.length > 1 ? `🍿 CGV 새 회차 오픈! (${i + 1}/${chunks.length})` : "🍿 CGV 새 회차 오픈!";
    await sendTelegramMessage(`${header}\n\n${lines}\n\nhttps://cgv.co.kr`);
    await sleep(500);
  }
}

async function main() {
  if (Date.now() >= new Date(CONFIG.expiresAt).getTime()) {
    console.log(
      `expiresAt(${CONFIG.expiresAt}) 지남 - 체크를 건너뜁니다. 계속 쓰려면 src/config.ts의 expiresAt을 뒤로 미루세요.`
    );
    return;
  }

  let knownState = await loadState();
  const startedAt = Date.now();
  const budgetMs = CONFIG.runBudgetSeconds * 1000;

  let anySucceededEver = false;
  let cycles = 0;

  console.log("브라우저 세션 여는 중 (CGV 홈페이지 방문해서 쿠키 받는 중)...");
  const session = await openBrowserSession();
  console.log("브라우저 세션 준비 완료");

  try {
    while (Date.now() - startedAt < budgetMs) {
      cycles++;
      const { updatedState, newlyFound, anySucceeded } = await checkOnce(session.page, knownState);
      knownState = updatedState;
      if (anySucceeded) anySucceededEver = true;

      if (newlyFound.length > 0) {
        console.log(`[cycle ${cycles}] 새 회차 ${newlyFound.length}건 발견, 알림 전송`);
        await notify(newlyFound);
      } else {
        console.log(`[cycle ${cycles}] 새로 열린 회차 없음`);
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed >= budgetMs) break;
      const remaining = budgetMs - elapsed;
      // 매번 똑같은 간격이면 그 자체가 봇 패턴이라, min~max 사이 랜덤 간격을 씀
      const jitterMs =
        (CONFIG.pollIntervalMinSeconds +
          Math.random() * (CONFIG.pollIntervalMaxSeconds - CONFIG.pollIntervalMinSeconds)) *
        1000;
      await sleep(Math.min(jitterMs, remaining));
    }
  } finally {
    await session.close();
  }

  if (!anySucceededEver) {
    // 이번 실행 내내 단 한 번도 CGV 요청이 성공하지 못한 경우 = 십중팔구 차단/구조 변경.
    console.error("모든 요청이 실패했습니다. state.json은 갱신하지 않습니다.");
    if (await shouldSendFailureAlert()) {
      await sendTelegramMessage(
        "⚠️ CGV 알림봇 경고\n\nCGV 요청이 계속 실패하고 있습니다 (차단되었거나 API 구조가 바뀌었을 수 있음).\nGitHub Actions 로그를 확인해주세요."
      );
      await markFailureAlertSent();
    }
    process.exitCode = 1;
    return;
  }

  await saveState(knownState);
  console.log(`총 ${cycles}회 체크 완료`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
