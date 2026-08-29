import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { checkInTicket } from '@/lib/check-in';

/**
 * Scan tickets at the door.
 *
 * Two things drive the design, both from what a door is actually like. Scanning
 * is continuous — you do not want to tap "scan again" between every attendee —
 * so the camera stays live and a short cooldown stops one QR being read a dozen
 * times while it sits in frame. And the result banner is large and colour-coded,
 * because it is read at arm's length, in a hurry, often outdoors.
 *
 * A duplicate scan is reported as-is rather than as a failure: "already checked
 * in at 10:42" is what lets someone on the gate decide what to do.
 */
const COOLDOWN_MS = 2000;

type Outcome = { ok: boolean; text: string } | null;

export default function ScanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);

  // Refs, not state: the scan callback fires from native on its own cadence and
  // would otherwise read stale values from the render it was created in.
  const lastCode = useRef<string | null>(null);
  const lastAt = useRef(0);

  const onScanned = useCallback(
    async ({ data }: { data: string }) => {
      const now = Date.now();
      // A QR held in frame fires this continuously. Ignore the same code inside
      // the cooldown, so one attendee is one request rather than twenty.
      if (busy || (data === lastCode.current && now - lastAt.current < COOLDOWN_MS)) return;
      lastCode.current = data;
      lastAt.current = now;

      setBusy(true);
      const res = await checkInTicket(id, data);
      setOutcome(res.ok ? { ok: true, text: `${res.name} checked in` } : { ok: false, text: res.message });
      setBusy(false);
    },
    [busy, id],
  );

  if (!permission) return <View style={styles.c} />;

  if (!permission.granted) {
    return (
      <View style={[styles.c, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="camera-outline" size={40} color={color.ink[400]} />
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>
          Ekklesia uses the camera to scan attendee tickets. Nothing is recorded — the
          camera only reads the QR code.
        </Text>
        <Pressable style={styles.primary} onPress={() => void requestPermission()}>
          <Text style={styles.primaryText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.secondary}>
          <Text style={styles.secondaryText}>Enter codes by hand instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.c}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(e) => void onScanned(e)}
      />

      <View style={[styles.top, { paddingTop: insets.top + spacing[2] }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={24} color={color.ink[0]} />
        </Pressable>
        <Text style={styles.topText}>Scan tickets</Text>
      </View>

      <View style={styles.reticle} pointerEvents="none" />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing[4] }]}>
        {outcome && (
          <View style={[styles.banner, outcome.ok ? styles.ok : styles.bad]}>
            <Ionicons
              name={outcome.ok ? 'checkmark-circle' : 'alert-circle'}
              size={22}
              color={outcome.ok ? color.ink[900] : color.ink[0]}
            />
            <Text style={[styles.bannerText, outcome.ok && styles.bannerTextOk]}>
              {outcome.text}
            </Text>
          </View>
        )}
        <Text style={styles.hint}>
          {busy ? 'Checking…' : 'Point the camera at an attendee’s ticket QR'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[3] },
  permTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: color.ink[0],
    marginTop: spacing[2],
  },
  permBody: { fontSize: fontSize.sm, color: color.ink[300], textAlign: 'center' },
  primary: {
    marginTop: spacing[4],
    backgroundColor: color.ink[0],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radius.full,
  },
  primaryText: { color: color.ink[900], fontWeight: fontWeight.semibold, fontSize: fontSize.base },
  secondary: { marginTop: spacing[2], padding: spacing[2] },
  secondaryText: { color: color.ink[300], fontSize: fontSize.sm },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  close: { padding: spacing[1] },
  topText: { color: color.ink[0], fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  reticle: {
    position: 'absolute',
    alignSelf: 'center',
    top: '32%',
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: radius.lg,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing[4],
    gap: spacing[3],
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radius.md,
  },
  // The palette is deliberately monochrome, so success and failure cannot be
  // told apart by hue — `success` and `danger` are both near-black. They are
  // inverted against each other instead: at a door this is read at arm's length
  // and often outdoors, and a wrong call means turning someone away.
  ok: { backgroundColor: color.ink[0] },
  bad: { backgroundColor: color.ink[900] },
  bannerText: { flex: 1, color: color.ink[0], fontSize: fontSize.base, fontWeight: fontWeight.medium },
  bannerTextOk: { color: color.ink[900] },
  hint: { color: color.ink[300], fontSize: fontSize.sm, textAlign: 'center' },
});
