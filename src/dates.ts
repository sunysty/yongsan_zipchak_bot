// GitHub Actions 러너는 UTC로 도는 경우가 많아서, 한국 시간 기준 날짜를 직접 계산합니다.
export function getKstDateStrings(daysAhead: number): string[] {
  const now = new Date();
  // UTC 시각에 9시간을 더하면 KST 벽시계 시각이 됨
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const result: string[] = [];
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(kstNow);
    d.setUTCDate(d.getUTCDate() + i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    result.push(`${yyyy}${mm}${dd}`);
  }
  return result;
}

export function formatShowtimeLabel(scnYmd: string, scnsrtTm: string): string {
  const mm = scnYmd.slice(4, 6);
  const dd = scnYmd.slice(6, 8);
  const hh = scnsrtTm.slice(0, 2);
  const min = scnsrtTm.slice(2, 4);
  return `${mm}/${dd} ${hh}:${min}`;
}
