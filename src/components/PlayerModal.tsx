import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Dimensions, Animated, BackHandler, StatusBar, PanResponder
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '../core';
import { seekTo } from '../providers/MobileNativeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const ARTWORK_SIZE = width - 64;

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function PlayerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const activeTrack = usePlayerStore(state => state.activeTrack);
  const isPlaying   = usePlayerStore(state => state.isPlaying);
  const togglePlay  = usePlayerStore(state => state.togglePlay);
  const nextTrack   = usePlayerStore(state => state.nextTrack);
  const prevTrack   = usePlayerStore(state => state.prevTrack);
  const progress    = usePlayerStore(state => state.progress);
  const duration    = usePlayerStore(state => state.duration);
  const shuffle     = usePlayerStore(state => state.shuffle);
  const repeat      = usePlayerStore(state => state.repeat);
  const setShuffle  = usePlayerStore((state: any) => state.setShuffle);
  const cycleRepeat = usePlayerStore((state: any) => state.cycleRepeat);
  const insets = useSafeAreaInsets();

  // Slide animation
  const translateY = useRef(new Animated.Value(height)).current;
  // Artwork pulse animation when playing
  const artScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(translateY, { toValue: height, duration: 280, useNativeDriver: true }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (isPlaying) {
      Animated.spring(artScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
    } else {
      Animated.spring(artScale, { toValue: 0.88, useNativeDriver: true, tension: 50, friction: 8 }).start();
    }
  }, [isPlaying]);

  // Handle Android back button
  useEffect(() => {
    const onBackPress = () => {
      if (visible) { onClose(); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [visible]);

  // Seekable progress bar
  const progressBarRef = useRef<View>(null);
  const progressBarWidth = useRef(0);

  const handleSeek = (pageX: number, layoutX: number) => {
    const barWidth = progressBarWidth.current;
    if (!barWidth || !duration) return;
    const rawRatio = Math.max(0, Math.min(1, (pageX - layoutX) / barWidth));
    const newPosition = rawRatio * duration;
    usePlayerStore.setState({ progress: newPosition });
    seekTo(newPosition);
  };

  const seekPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => handleSeek(e.nativeEvent.pageX, e.nativeEvent.locationX === 0 ? e.nativeEvent.pageX - (progressBarWidth.current * progressPercent / 100) : e.nativeEvent.pageX - e.nativeEvent.locationX),
    onPanResponderMove: (e, gs) => {
      if (!progressBarRef.current) return;
      progressBarRef.current.measure((_x, _y, width, _h, pageX) => {
        handleSeek(e.nativeEvent.pageX, pageX);
      });
    },
  });


  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const artwork = activeTrack?.artwork_path || activeTrack?.thumbnail || activeTrack?.coverUrl;

  if (!activeTrack) return null;

  return (
    <Animated.View style={[styles.root, { transform: [{ translateY }] }]}>
      <StatusBar barStyle="light-content" />

      {/* Full blurred background from artwork */}
      {artwork ? (
        <Image source={{ uri: artwork }} style={styles.bgImage} blurRadius={40} />
      ) : (
        <View style={[styles.bgImage, { backgroundColor: '#1a1a2e' }]} />
      )}

      {/* Dark overlay */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.72)' }]} />

      {/* Content */}
      <View style={[styles.content, {
        paddingTop: Math.max(insets.top + 12, 48),
        paddingBottom: Math.max(insets.bottom + 12, 24),
      }]}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-down" size={28} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>NOW PLAYING</Text>
          </View>
          <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="ellipsis-horizontal" size={24} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>
        </View>

        {/* Artwork */}
        <View style={styles.artworkContainer}>
          <Animated.View style={[styles.artworkWrapper, { transform: [{ scale: artScale }] }]}>
            {artwork ? (
              <Image source={{ uri: artwork }} style={styles.artwork} />
            ) : (
              <View style={[styles.artwork, styles.artworkPlaceholder]}>
                <Ionicons name="musical-notes" size={80} color="rgba(255,255,255,0.25)" />
              </View>
            )}
          </Animated.View>
        </View>

        {/* Track Info */}
        <View style={styles.infoRow}>
          <View style={styles.infoText}>
            <Text style={styles.title} numberOfLines={1}>{activeTrack.title || 'Unknown Track'}</Text>
            <Text style={styles.artist} numberOfLines={1}>{activeTrack.artist || 'Unknown Artist'}</Text>
          </View>
          <TouchableOpacity style={styles.heartBtn}>
            <Ionicons name="heart-outline" size={26} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
        </View>

        {/* Progress Bar — fully interactive, drag to seek */}
        <View style={styles.progressSection}>
          <View
            ref={progressBarRef}
            style={styles.progressTrack}
            onLayout={(e) => { progressBarWidth.current = e.nativeEvent.layout.width; }}
            {...seekPanResponder.panHandlers}
          >
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            {/* Thumb dot */}
            <View style={[styles.progressThumb, { left: `${progressPercent}%` as any }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(progress)}</Text>
            <Text style={styles.timeText}>{formatTime(duration || activeTrack.duration)}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Shuffle */}
          <TouchableOpacity
            onPress={() => setShuffle && setShuffle(!shuffle)}
            style={styles.sideBtn}
          >
            <Ionicons
              name="shuffle"
              size={22}
              color={shuffle ? '#fff' : 'rgba(255,255,255,0.38)'}
            />
          </TouchableOpacity>

          {/* Prev */}
          <TouchableOpacity onPress={prevTrack} style={styles.skipBtn}>
            <Ionicons name="play-skip-back" size={34} color="#fff" />
          </TouchableOpacity>

          {/* Play / Pause */}
          <TouchableOpacity onPress={togglePlay} style={styles.playBtn} activeOpacity={0.85}>
            <View style={styles.playBtnInner}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={36}
                color="#fff"
                style={{ marginLeft: isPlaying ? 0 : 3 }}
              />
            </View>
          </TouchableOpacity>

          {/* Next */}
          <TouchableOpacity onPress={nextTrack} style={styles.skipBtn}>
            <Ionicons name="play-skip-forward" size={34} color="#fff" />
          </TouchableOpacity>

          {/* Repeat */}
          <TouchableOpacity
            onPress={() => cycleRepeat && cycleRepeat()}
            style={styles.sideBtn}
          >
            <Ionicons
              name={repeat === 'one' ? 'repeat-outline' : 'repeat'}
              size={22}
              color={repeat !== 'none' ? '#fff' : 'rgba(255,255,255,0.38)'}
            />
          </TouchableOpacity>
        </View>

        {/* Bottom Row: Volume + Queue hint */}
        <View style={styles.bottomRow}>
          <Ionicons name="volume-low" size={16} color="rgba(255,255,255,0.35)" />
          <View style={styles.volumeBar}>
            <View style={styles.volumeBarFill} />
          </View>
          <Ionicons name="volume-high" size={16} color="rgba(255,255,255,0.35)" />
        </View>

      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  bgImage: {
    position: 'absolute',
    top: -30, left: -30, right: -30, bottom: -30,
    resizeMode: 'cover',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
  },

  // Artwork
  artworkContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  artworkWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.75,
    shadowRadius: 30,
    elevation: 20,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 20,
    backgroundColor: '#1e1e2e',
  },
  artworkPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 5,
    letterSpacing: -0.3,
  },
  artist: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 15,
    fontWeight: '500',
  },
  heartBtn: {
    padding: 6,
  },

  // Progress
  progressSection: {
    marginBottom: 32,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    marginBottom: 10,
    position: 'relative',
    overflow: 'visible',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    marginLeft: -7,
    shadowColor: '#fff',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  sideBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipBtn: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtn: {
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 16,
  },
  playBtnInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Volume row
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  volumeBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
  },
  volumeBarFill: {
    width: '75%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 2,
  },
});
