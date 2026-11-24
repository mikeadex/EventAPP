import { StyleSheet } from 'react-native';
import { spacing, radius, fontSize, theme, palette } from '@ekklesia/ui/tokens';

/**
 * The shared look of the four auth screens.
 *
 * They had four near-identical copies of this block, differing only in which
 * keys each happened to use — so restyling meant changing the same thing four
 * times and getting it slightly wrong somewhere. One copy now.
 *
 * Dark only, like the rest of the refresh so far.
 */
export const authStyles = StyleSheet.create({
  c: {
    flex: 1,
    backgroundColor: theme.dark.backgroundDeep,
    padding: 24,
    justifyContent: 'center',
  },
  center: { alignItems: 'center' },

  /** The headline. 30px per the design, not the old 30px-bold. */
  h: { marginBottom: spacing[2] },
  m: { marginBottom: spacing[6] },

  input: {
    backgroundColor: theme.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: spacing[3],
    fontSize: 16,
    fontFamily: 'Alata_400Regular',
    color: theme.dark.textPrimary,
  },

  /**
   * Errors are the one place the app uses a red rather than the coral. It is
   * close enough to stay in the palette and far enough to read as a warning —
   * the old `color.danger` was near-black, which on this ground was invisible.
   */
  error: { color: '#D9A9A2', marginBottom: spacing[3] },
  hint: { color: theme.dark.textSecondary, marginBottom: spacing[3], lineHeight: 21 },
  resend: { marginBottom: spacing[3] },
  sent: { color: theme.dark.textSecondary, marginBottom: spacing[3] },
  forgot: { alignSelf: 'flex-end', marginBottom: spacing[4] },

  /** Outlined accent, like every other primary action in the refresh. */
  btn: {
    backgroundColor: 'rgba(249,142,128,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.55)',
    paddingVertical: 17,
    borderRadius: radius.full,
    alignItems: 'center',
    marginTop: spacing[2],
  },
  btnText: { color: palette.coral[200], fontSize: 16 },
  btnDisabled: { backgroundColor: 'transparent', borderColor: theme.dark.border },

  muted: { color: theme.dark.textSecondary, fontSize: fontSize.sm },
  link: { color: theme.dark.accent, fontSize: fontSize.sm },
});
