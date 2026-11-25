import type { IconName } from '@/components/icons';

/**
 * The event categories the API accepts (`EventCategory` in @ekklesia/shared),
 * with the labels, icons and cover palettes the web shows for them.
 *
 * The palettes are art, not UI colour: `Cover` paints them into a generated
 * image for events without a photo, and `.cover-art` inverts that image on
 * the light theme. They are the one place hex is allowed outside tokens.
 */
export const CATEGORIES = [
  { value: 'service', label: 'Service', icon: 'building', palette: ['#21161a', '#5e2a24', '#ffc9c2'] },
  { value: 'worship', label: 'Worship', icon: 'music', palette: ['#3a1712', '#7e1d14', '#f98e80'] },
  { value: 'prayer', label: 'Prayer', icon: 'sparkle', palette: ['#160f12', '#3b2226', '#f98e80'] },
  { value: 'youth', label: 'Youth', icon: 'bolt', palette: ['#2a1016', '#c4392c', '#ffc9c2'] },
  { value: 'kids', label: 'Kids', icon: 'child', palette: ['#2a1410', '#9a3a2c', '#ffd9d2'] },
  { value: 'small_group', label: 'Small group', icon: 'users', palette: ['#1d1013', '#5c1d17', '#ffd9d2'] },
  { value: 'conference', label: 'Conference', icon: 'mic', palette: ['#1f1418', '#4a2a2e', '#d9564a'] },
  { value: 'outreach', label: 'Outreach', icon: 'handHeart', palette: ['#2a1410', '#9a3a2c', '#f98e80'] },
  { value: 'social', label: 'Social', icon: 'coffee', palette: ['#21161a', '#5e2a24', '#ffc9c2'] },
  { value: 'fundraiser', label: 'Fundraiser', icon: 'coins', palette: ['#2b0f0c', '#7e1d14', '#ffb4a8'] },
  { value: 'class', label: 'Class', icon: 'book', palette: ['#21161a', '#5e2a24', '#ffc9c2'] },
  { value: 'other', label: 'Other', icon: 'grid', palette: ['#160f12', '#3b2226', '#f98e80'] },
] as const satisfies readonly {
  value: string;
  label: string;
  icon: IconName;
  palette: readonly [string, string, string];
}[];

export type CategoryValue = (typeof CATEGORIES)[number]['value'];

export function categoryOf(value: string | null | undefined) {
  const v = (value ?? '').toLowerCase();
  return CATEGORIES.find((c) => c.value === v) ?? CATEGORIES[CATEGORIES.length - 1]!;
}

export function isCategory(value: string | null | undefined): value is CategoryValue {
  return CATEGORIES.some((c) => c.value === value);
}
