import { describe, expect, it } from "vitest";

import { isPasswordAcceptable, MIN_LENGTH, scorePassword } from "@/lib/password";

/**
 * Password strength bands as surfaced by the PasswordStrength meter on signup
 * (score, label, hint) plus whether the form accepts the password.
 */

const EMAIL = "alice@example.com";

function band(password: string, email?: string) {
  const { score, label, ok } = scorePassword(password, email);
  return { score, label, ok };
}

describe("password length floor", () => {
  it("publishes a 10-character minimum", () => {
    expect(MIN_LENGTH).toBe(10);
  });

  it("scores an empty password as unusable", () => {
    expect(scorePassword("")).toEqual({ score: 0, label: "", hint: "", ok: false });
  });

  it("reports one short of the floor as too short and the floor itself as measurable", () => {
    expect(band("abcdefghi")).toEqual({ score: 0, label: "Too short", ok: false });
    expect(band("abcdefghij").label).not.toBe("Too short");
  });

  it("quotes the current length in the too-short hint", () => {
    expect(scorePassword("abc").hint).toBe("Needs at least 10 characters (currently 3).");
  });
});

describe("rejected passwords", () => {
  it.each(["password12", "password123", "password1234", "1234567890", "qwertyuiop", "welcome123"])(
    "rejects the breached-list entry %s",
    (password) => {
      expect(band(password)).toEqual({ score: 1, label: "Too common", ok: false });
    },
  );

  it("rejects breached-list entries whatever the casing", () => {
    for (const password of ["password123", "Password123", "PASSWORD123"]) {
      expect(band(password).label).toBe("Too common");
      expect(band(password).ok).toBe(false);
    }
  });

  it("applies the length floor before the breached list", () => {
    for (const password of ["admin", "vektorhq", "p@ssw0rd", "changeme", "12345678"]) {
      expect(band(password)).toEqual({ score: 0, label: "Too short", ok: false });
    }
  });

  it("rejects a password identical to the account email", () => {
    expect(band(EMAIL, EMAIL)).toEqual({ score: 1, label: "Same as email", ok: false });
    expect(band(EMAIL, EMAIL.toUpperCase())).toEqual({
      score: 1,
      label: "Same as email",
      ok: false,
    });
  });

  it("only blocks the email match when the email is supplied", () => {
    expect(band(EMAIL)).toEqual({ score: 3, label: "Strong", ok: true });
  });

  it("rejects a single character repeated at any length", () => {
    expect(band("aaaaaaaaaa")).toEqual({ score: 1, label: "Weak", ok: false });
    expect(band("WWWWWWWWWWW")).toEqual({ score: 1, label: "Weak", ok: false });
    expect(band("!!!!!!!!!!!")).toEqual({ score: 1, label: "Weak", ok: false });
  });
});

describe("strength bands", () => {
  it("maps the meter labels onto scores 1 to 4", () => {
    expect(band("abcdefghij")).toEqual({ score: 1, label: "Weak", ok: true });
    expect(band("tender1234")).toEqual({ score: 2, label: "Fair", ok: true });
    expect(band("tendertender1")).toEqual({ score: 3, label: "Strong", ok: true });
    expect(band("Vektor-Tender-2026")).toEqual({ score: 4, label: "Excellent", ok: true });
  });

  it("needs 16 characters and three character types for Excellent", () => {
    expect(band("vektor-tender123")).toEqual({ score: 4, label: "Excellent", ok: true });
    expect(band("vektor-tender12")).toEqual({ score: 3, label: "Strong", ok: true });
    expect(band("correct horse battery")).toEqual({ score: 3, label: "Strong", ok: true });
  });

  it("reaches Strong at 12 characters with two character types", () => {
    expect(band("tender123456")).toEqual({ score: 3, label: "Strong", ok: true });
    expect(band("tender12345")).toEqual({ score: 2, label: "Fair", ok: true });
  });

  it("holds Fair from the length floor up to 11 characters", () => {
    expect(band("tender1234")).toEqual({ score: 2, label: "Fair", ok: true });
    expect(band("tender 1234")).toEqual({ score: 2, label: "Fair", ok: true });
  });

  it("counts a space or punctuation as a character type", () => {
    expect(band("tender-tender-1").score).toBe(3);
    expect(band("tender tender1").score).toBe(3);
  });

  it("labels a long single-type password Weak but still accepts it", () => {
    expect(scorePassword("abcdefghijklmnop")).toEqual({
      score: 1,
      label: "Weak",
      hint: "Mix in another character type (letters + numbers or symbols).",
      ok: true,
    });
    expect(isPasswordAcceptable("abcdefghijklmnop")).toBe(true);
  });

  it("recommends a longer passphrase only in the fair band", () => {
    expect(scorePassword("tender1234").hint).toContain("16+ chars");
    expect(scorePassword("tendertender1").hint).toBe("Solid password.");
    expect(scorePassword("Vektor-Tender-2026").hint).toBe("This is a strong password.");
  });
});

describe("signup acceptance", () => {
  it.each([
    "",
    "abcdefghi",
    "aaaaaaaaaa",
    "password123",
    "PASSWORD123",
    "qwertyuiop",
    EMAIL,
    "tender1234",
    "abcdefghij",
    "tendertender1",
    "Vektor-Tender-2026",
    "vektor-tender123",
  ])("isPasswordAcceptable agrees with the meter for %s", (password) => {
    expect(isPasswordAcceptable(password, EMAIL)).toBe(scorePassword(password, EMAIL).ok);
  });

  it("accepts two character types at the length floor", () => {
    expect(isPasswordAcceptable("tender1234")).toBe(true);
    expect(isPasswordAcceptable("tender1234", EMAIL)).toBe(true);
  });

  it("blocks a password that repeats the account email", () => {
    expect(isPasswordAcceptable(EMAIL, EMAIL)).toBe(false);
    expect(isPasswordAcceptable(EMAIL)).toBe(true);
  });
});
