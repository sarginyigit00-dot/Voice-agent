import { describe, expect, it } from "vitest";
import { integerWords, numberWords, ordinalWords, speakAddressTr, speakClock, speakHHMM } from "@/lib/speech/tr";

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

  it("spells larger numbers and ordinals", () => {
    expect(integerWords(100)).toBe("yüz");
    expect(integerWords(1250)).toBe("bin iki yüz elli");
    expect(integerWords(124)).toBe("yüz yirmi dört");
    expect(ordinalWords(2)).toBe("ikinci");
    expect(ordinalWords(4)).toBe("dördüncü");
    expect(ordinalWords(10)).toBe("onuncu");
  });

  it("speaks addresses without abbreviations or digits", () => {
    expect(speakAddressTr("Caferağa Mah. Moda Cad. No: 24 Kat: 2, Kadıköy / İstanbul")).toBe(
      "Caferağa Mahallesi Moda Caddesi numara yirmi dört, ikinci kat, Kadıköy, İstanbul",
    );
    expect(speakAddressTr("Bağdat Cd. No:124/3 D:7, Maltepe")).toBe(
      "Bağdat Caddesi numara yüz yirmi dört bölü üç, daire yedi, Maltepe",
    );
    // Words merely containing an abbreviation stay intact.
    expect(speakAddressTr("Nokta Sokağı, Cadde Bostan")).toBe("Nokta Sokağı, Cadde Bostan");
  });
});
