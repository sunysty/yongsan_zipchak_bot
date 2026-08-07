// 관 이름(들) 중 하나라도 keyword를 포함하면 true (대소문자 무시)
export function matchesKeyword(keyword: string, ...names: (string | undefined)[]): boolean {
  return names.some((n) => n?.toUpperCase().includes(keyword.toUpperCase()));
}
