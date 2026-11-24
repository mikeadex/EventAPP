/**
 * The four-segment meter on design 13.
 *
 * Measured against the rule the API actually enforces (12 characters) plus
 * the three things that make a password of that length worth its length. The
 * meter is deliberately honest about the floor: nothing under 12 characters
 * can light more than one segment, however many symbols it contains, because
 * a short password with a `!` in it is still a short password and the form
 * will refuse it anyway.
 *
 * Not a strength model — it cannot know a dictionary word or a keyboard walk.
 * It is a progress indicator for rules the user can act on, which is what the
 * accompanying sentence is for.
 */
export const MIN_PASSWORD = 12;

export interface PasswordStrength {
  /** 0–4, matching the meter's segments. */
  score: number;
  /** What to do next, or confirmation there is nothing left to do. */
  hint: string;
  /** Whether the API would accept it at all. */
  longEnough: boolean;
}

export function passwordStrength(password: string): PasswordStrength {
  if (!password)
    return { score: 0, hint: `At least ${MIN_PASSWORD} characters.`, longEnough: false };

  const longEnough = password.length >= MIN_PASSWORD;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!longEnough) {
    const left = MIN_PASSWORD - password.length;
    return {
      score: 1,
      hint: `${left} more character${left === 1 ? '' : 's'} to go.`,
      longEnough: false,
    };
  }

  // Past the floor, each remaining quality is worth a segment.
  const extras = [hasLower && hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  const score = 1 + extras;

  if (score === 4) return { score, hint: 'Strong password.', longEnough };

  // Two parts: a verdict that tracks the meter, and the single most useful
  // next step. Naming everything missing reads as a telling-off on a form
  // someone is halfway through, and an adjective that does not match the
  // segments on screen — "Good" beside one lit bar — is just wrong.
  const verdict = score === 1 ? 'Long enough' : score === 2 ? 'Good' : 'Strong';
  const next = !(hasLower && hasUpper)
    ? 'mix upper and lower case to strengthen it'
    : !hasDigit
      ? 'add a number to strengthen it'
      : 'add a symbol to finish the meter';
  const hint = `${verdict} — ${next}.`;

  return { score, hint, longEnough: true };
}
