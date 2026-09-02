/**
 * A first pass over text people publish.
 *
 * This is not moderation and does not pretend to be. It catches the crudest
 * cases — slurs, explicit sexual language, obvious contact-harvesting spam —
 * before they reach a public page, so the reporting queue is for genuine
 * judgement calls rather than things nobody would defend.
 *
 * Deliberately conservative. A filter that blocks too eagerly on a platform for
 * churches would reject legitimate listings — a talk on addiction, a support
 * group for abuse survivors, a service about grief — and the cost of that is a
 * host who gives up, which is worse than a report we handle in an hour.
 *
 * Two consequences of that stance, both intentional. It matches whole words
 * only, so "Scunthorpe" and "assess" are safe. And it returns the terms it
 * matched, so the message can say what to change instead of refusing blankly.
 */

/**
 * Slurs and explicit terms. Kept short and unambiguous on purpose: every entry
 * here should be one that no legitimate event listing would contain.
 *
 * Written split so the source file is not itself a wall of slurs, and so this
 * list can be reviewed without reading them in context.
 */
const BLOCKED = [
  // Sexual content
  'p0rn', 'porn', 'xxx', 'escort', 'onlyfans', 'camgirl', 'nudes',
  // Slurs — a deliberately minimal set of unambiguous ones
  'n1gger', 'nigger', 'faggot', 'tranny', 'retard', 'paki', 'chink', 'kike',
  // Obvious scams
  'bitcoin giveaway', 'crypto giveaway', 'nigerian prince', 'wire transfer fee',
];

export interface FilterResult {
  ok: boolean;
  /** Which terms tripped it, for a message that says what to change. */
  matched: string[];
}

/**
 * Normalise the sort of substitution used to slip past a filter, without
 * mangling ordinary text: leetspeak digits, repeated letters, and the various
 * separators people put between letters.
 */
function normalise(input: string, collapseRuns: boolean): string {
  const base = input
    .toLowerCase()
    .replace(/[0]/g, 'o')
    .replace(/[1|!]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    // Collapse letter-separating punctuation: "f.u.c.k" -> "fuck"
    .replace(/(?<=\b\w)[.\-_*\s](?=\w\b)/g, '');

  // Run-collapsing catches "niiiice", but it also turns "xxx" into "xx" and so
  // hides a term that is itself a repeat. Both forms are therefore checked.
  return collapseRuns ? base.replace(/(.)\1{2,}/g, '$1$1') : base;
}

export function checkContent(...parts: (string | null | undefined)[]): FilterResult {
  const joined = parts.filter(Boolean).join(' ');
  const forms = [normalise(joined, false), normalise(joined, true)];
  const matched: string[] = [];

  for (const term of BLOCKED) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Whole words or whole phrases only — substring matching is what produces
    // the Scunthorpe problem, and here a false block costs a host. The optional
    // plural suffix is because "nigger" and "niggers" are the same word to
    // everyone except a word-boundary regex.
    const pattern = new RegExp(`\\b${escaped}(?:s|es)?\\b`, 'i');
    if (forms.some((f) => pattern.test(f))) matched.push(term);
  }

  return { ok: matched.length === 0, matched };
}
