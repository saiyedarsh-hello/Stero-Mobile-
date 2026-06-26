import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { usePlayerStore } from '../core';
import { Ionicons } from '@expo/vector-icons';
import { seekTo } from '../providers/MobileNativeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MobilePlayerBar({ onPress }: { onPress?: () => void }) {
  const activeTrack = usePlayerStore((state) => state.activeTrack);
  const isPlaying   = usePlayerStore((state) => state.isPlaying);
  const togglePlay  = usePlayerStore((state) => state.togglePlay);
  const nextTrack   = usePlayerStore((state) => state.nextTrack);
  const progress    = usePlayerStore((state) => state.progress);
  const duration    = usePlayerStore((state) => state.duration);
  const insets      = useSafeAreaInsets();

  const progressBarWidthRef = useRef(0);

  if (!activeTrack) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const artwork = activeTrack.artwork_path || activeTrack.thumbnail || (activeTrack as any).coverUrl;

  const handleProgressTap = (e: any) => {
    if (!duration || !progressBarWidthRef.current) return;
    const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / progressBarWidthRef.current));
    const newPos = ratio * duration;
    usePlayerStore.setState({ progress: newPos });
    seekTo(newPos);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[styles.container, { bottom: (insets.bottom || 0) + 49 }]}
    >
      {/* Blurred background using artwork */}
      {artwork && (
        <Image source={{ uri: artwork }} style={styles.bgBlur} blurRadius={25} />
      )}
      {/* Dark scrim */}
      <View style={styles.scrim} />

      {/* Thin seekable progress line at top */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleProgressTap}
        style={styles.progressTrack}
        onLayout={(e) => { progressBarWidthRef.current = e.nativeEvent.layout.width; }}
      >
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </TouchableOpacity>

      {/* Main row */}
      <View style={styles.content}>
        {/* Artwork */}
        <View style={styles.artworkWrapper}>
          {artwork ? (
            <Image source={{ uri: artwork }} style={styles.artwork} />
          ) : (
            <View style={[styles.artwork, styles.artworkPlaceholder]}>
              <Ionicons name="musical-note" size={20} color="rgba(255,255,255,0.4)" />
            </View>
          )}
        </View>

        {/* Title + Artist */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{activeTrack.title || 'Unknown'}</Text>
          <Text style={styles.artist} numberOfLines={1}>{activeTrack.artist || 'Unknown Artist'}</Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); togglePlay(); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); nextTrack(); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="play-skip-forward" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 10,
    right: 10,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },
  bgBlur: {
    position: 'absolute',
    top: -10, left: -10, right: -10, bottom: -10,
    resizeMode: 'cover',
  },
  scrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(14, 12, 22, 0.82)',
  },
  progressTrack: {
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  artworkWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2a2040',
  },
  artworkPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  artist: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
});
