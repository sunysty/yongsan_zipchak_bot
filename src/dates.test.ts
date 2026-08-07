import { test } from "node:test";
import assert from "node:assert/strict";
import { getKstDateStrings, formatShowtimeLabel } from "./dates.js";

test("getKstDateStrings: daysAhead+1개의 날짜를 반환", () => {
  const result = getKstDateStrings(2);
  assert.equal(result.length, 3);
});

test("getKstDateStrings: 각 항목은 YYYYMMDD 8자리 숫자 문자열", () => {
  const result = getKstDateStrings(3);
  for (const d of result) {
    assert.match(d, /^\d{8}$/);
  }
});

test("getKstDateStrings: 날짜가 하루씩 오름차순으로 이어짐", () => {
  const result = getKstDateStrings(4);
  for (let i = 1; i < result.length; i++) {
    const prev = new Date(
      Number(result[i - 1].slice(0, 4)),
      Number(result[i - 1].slice(4, 6)) - 1,
      Number(result[i - 1].slice(6, 8))
    );
    const curr = new Date(
      Number(result[i].slice(0, 4)),
      Number(result[i].slice(4, 6)) - 1,
      Number(result[i].slice(6, 8))
    );
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    assert.equal(diffDays, 1);
  }
});

test("getKstDateStrings: daysAhead가 0이면 오늘 하루만 반환", () => {
  const result = getKstDateStrings(0);
  assert.equal(result.length, 1);
});

test("formatShowtimeLabel: MM/DD HH:MM 형식으로 변환", () => {
  assert.equal(formatShowtimeLabel("20260814", "1930"), "08/14 19:30");
});

test("formatShowtimeLabel: 자정 시간도 올바르게 처리", () => {
  assert.equal(formatShowtimeLabel("20260101", "0005"), "01/01 00:05");
});
