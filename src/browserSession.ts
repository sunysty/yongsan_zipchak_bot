import { chromium, type Browser, type Page } from "playwright";

export interface BrowserSession {
  browser: Browser;
  page: Page;
  close: () => Promise<void>;
}

// job(실행) 한 번당 딱 한 번만 브라우저를 띄워서 재사용합니다.
// CGV 홈페이지를 한 번 방문해서 Cloudflare 챌린지를 통과하고 진짜 쿠키를 받아둔 다음,
// 이후 API 호출은 이 페이지의 fetch(브라우저 네트워크 스택)로 실행합니다.
export async function openBrowserSession(): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "ko-KR",
  });
  const page = await context.newPage();

  await page.goto("https://cgv.co.kr/", { waitUntil: "networkidle", timeout: 30000 });
  // Cloudflare JS 챌린지가 있다면 풀릴 시간을 좀 더 줌
  await page.waitForTimeout(3000);

  return {
    browser,
    page,
    close: async () => {
      await browser.close();
    },
  };
}
