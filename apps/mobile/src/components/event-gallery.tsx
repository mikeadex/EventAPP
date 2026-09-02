import { useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { color, spacing, radius, fontSize } from '@ekklesia/ui/tokens';

export interface GalleryItem {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  embedUrl?: string;
}

/**
 * The event gallery: swipe through photos, tap a video to play it.
 *
 * Video plays inside a web view rather than a native player, because the source
 * is a YouTube or Vimeo embed — their players handle the formats, the ads and
 * the terms of use, and reimplementing that would mean breaking their terms as
 * well as writing more code.
 *
 * The web view is loaded only when someone taps play. Mounting one per video up
 * front would start several players on a page that might never be scrolled to,
 * which on a mid-range Android is felt immediately.
 */
function canUseWebView(): boolean {
  return requireOptionalNativeModule('RNCWebView') != null;
}

const { width: SCREEN } = Dimensions.get('window');

export function EventGallery({ items }: { items: GalleryItem[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const scroller = useRef<ScrollView>(null);

  if (items.length === 0) return null;

  // Width is read at render, not module load — Dimensions at module scope
  // returns a stale value before the window is measured.
  const width = SCREEN;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) {
      setIndex(next);
      // Stop a video when it is swiped away, rather than leaving audio playing
      // over the next photo.
      setPlaying(null);
    }
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ width, height: width * 0.66 }}
      >
        {items.map((item) => (
          <View key={item.id} style={{ width, height: width * 0.66 }}>
            {item.kind === 'IMAGE' ? (
              <Image source={{ uri: item.url }} style={styles.media} resizeMode="cover" />
            ) : playing === item.id && item.embedUrl && canUseWebView() ? (
              <VideoPlayer embedUrl={item.embedUrl} />
            ) : (
              <Pressable
                style={styles.media}
                onPress={() => {
                  // No web view in this build — hand off to the YouTube app or
                  // the browser rather than doing nothing.
                  if (!canUseWebView() || !item.embedUrl) {
                    void Linking.openURL(item.url);
                    return;
                  }
                  setPlaying(item.id);
                }}
              >
                {item.thumbnailUrl ? (
                  <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.videoFallback]} />
                )}
                <View style={styles.playButton}>
                  <Ionicons name="play" size={26} color={color.ink[900]} />
                </View>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>

      {items.length > 1 && (
        <View style={styles.dots}>
          {items.map((item, i) => (
            <View key={item.id} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      )}

      {items[index]?.caption ? (
        <Text style={styles.caption}>{items[index]!.caption}</Text>
      ) : null}
    </View>
  );
}

function VideoPlayer({ embedUrl }: { embedUrl: string }) {
  // Required lazily so the module is only touched on a build that has it.
  const { WebView } = require('react-native-webview') as {
    WebView: React.ComponentType<Record<string, unknown>>;
  };
  return (
    <WebView
      source={{ uri: `${embedUrl}?autoplay=1&playsinline=1` }}
      style={styles.media}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      // The embed is a fixed provider URL built from a validated id, so there is
      // nothing user-supplied to navigate to — but keep it penned in regardless.
      originWhitelist={['https://www.youtube.com', 'https://player.vimeo.com']}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[2] },
  media: { width: '100%', height: '100%', backgroundColor: color.ink[100] },
  videoFallback: { backgroundColor: color.ink[200] },
  playButton: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing[1], marginTop: spacing[2] },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.ink[300] },
  dotOn: { backgroundColor: color.ink[900], width: 18 },
  caption: {
    fontSize: fontSize.sm,
    color: color.ink[500],
    textAlign: 'center',
    paddingHorizontal: spacing[5],
  },
});
