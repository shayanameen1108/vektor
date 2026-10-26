const MIN_LENGTH = 10;

const COMMON = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "qwerty123",
  "qwertyuiop",
  "abc12345",
  "abcd1234",
  "welcome1",
  "welcome123",
  "letmein1",
  "admin",
  "admin123",
  "changeme",
  "passw0rd",
  "p@ssw0rd",
  "vektor123",
  "vektorhq",
]);

export function scorePassword(password: string, email?: string) {
  if (!password) return { score: 0, label: "", hint: "", ok: false };
  const len = password.length;
  if (len < MIN_LENGTH) {
    return {
      score: 0,
      label: "Too short",
      hint: `Needs at least ${MIN_LENGTH} characters (currently ${len}).`,
      ok: false,
    };
  }
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) {
    return {
      score: 1,
      label: "Too common",
      hint: "This password is on the most-breached list. Try a 4-word phrase instead.",
      ok: false,
    };
  }
  if (email && lower === email.toLowerCase()) {
    return {
      score: 1,
      label: "Same as email",
      hint: "Pick something different from your email address.",
      ok: false,
    };
  }
  if (new Set(password).size === 1) {
    return { score: 1, label: "Weak", hint: "Don't use the same character repeated.", ok: false };
  }

  const variety =
    (/[a-z]/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/\d/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);

  if (len >= 16 && variety >= 3) {
    return { score: 4, label: "Excellent", hint: "This is a strong password.", ok: true };
  }
  if (len >= 12 && variety >= 2) {
    return { score: 3, label: "Strong", hint: "Solid password.", ok: true };
  }
  if (variety >= 2) {
    return {
      score: 2,
      label: "Fair",
      hint: "OK — a longer passphrase (16+ chars) would be stronger.",
      ok: true,
    };
  }
  return {
    score: 1,
    label: "Weak",
    hint: "Mix in another character type (letters + numbers or symbols).",
    ok: true,
  };
}

export function isPasswordAcceptable(password: string, email?: string) {
  return scorePassword(password, email).ok;
}

export { MIN_LENGTH };
