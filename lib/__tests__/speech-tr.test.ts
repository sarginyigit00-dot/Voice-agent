import { describe, expect, it } from "vitest";
import { numberWords, speakClock, speakHHMM } from "@/lib/speech/tr";

describe("speech/tr", () => {
  it("spells numbers as words", () => {
    expect(numberWords(0)).toBe("sıfır");
    expect(numberWords(15)).toBe("on beş");
    expect(numberWords(59)).toBe("elli dokuz");
  });

  it("speaks clock times", () => {
    expect(speakClock(9, 0)).toBe("sabah dokuz");
    expect(speakClock(14, 30)).toBe("öğleden sonra iki buçuk");
    expect(speakClock(9, 15)).toBe("sabah dokuz on beş");
    expect(speakClock(0, 0)).toBe("gece yarısı");
  });

  it("parses HH:MM and leaves junk untouched", () => {
    expect(speakHHMM("18:00")).toBe("akşam altı");
    expect(speakHHMM("soon")).toBe("soon");
  });
});
