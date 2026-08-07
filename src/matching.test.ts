import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesKeyword } from "./matching.js";

test("이름에 키워드가 포함되면 true", () => {
  assert.equal(matchesKeyword("SCREENX", "14관[SCREENX]"), true);
});

test("대소문자 무시하고 매칭", () => {
  assert.equal(matchesKeyword("screenx", "14관[SCREENX]"), true);
  assert.equal(matchesKeyword("SCREENX", "14관[screenx]"), true);
});

test("키워드가 없으면 false", () => {
  assert.equal(matchesKeyword("IMAX", "14관[SCREENX]"), false);
});

test("여러 이름 중 하나라도 매칭되면 true", () => {
  assert.equal(matchesKeyword("IMAX", undefined, "10관[IMAX]"), true);
});

test("모든 이름이 undefined면 false", () => {
  assert.equal(matchesKeyword("IMAX", undefined, undefined), false);
});

test("빈 문자열 이름은 매칭되지 않음", () => {
  assert.equal(matchesKeyword("IMAX", ""), false);
});
