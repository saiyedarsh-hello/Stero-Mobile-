import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { usePlayerStore } from '../core';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MobilePlayerBar() {
  const activeTrack = usePlayerStore((state) => state.activeTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const nextTrack = usePlayerStore((state) => state.nextTrack);
  const insets = useSafeAreaInsets();

  if (!activeTrack) return null;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: '30%' }]} /> 
      </View>
      <View style={styles.content}>
        <Image 
          source={{ uri: activeTrack.artwork_path || 'https://via.placeholder.com/150' }} 
          style={styles.artwork} 
        />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{activeTrack.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{activeTrack.artist}</Text>
        </View>
        <View style={styles.controls}>
          <TouchableOpacity onPress={togglePlay} style={styles.playButton}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={nextTrack} style={styles.nextButton}>
            <Ionicons name="play-skip-forward" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(25, 25, 25, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#333',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  progressContainer: {
    height: 2,
    backgroundColor: '#333',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1db954',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  artist: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  playButton: {
    padding: 4,
  },
  nextButton: {
    padding: 4,
  },
});
