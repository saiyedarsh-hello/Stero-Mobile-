import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, FlatList, Image, ScrollView, ActivityIndicator } from 'react-native';
import { usePlayerStore } from '../core';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DiscoverScreen() {
  const fetchLibrary = usePlayerStore((state) => state.fetchLibrary);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const activeTrack = usePlayerStore((state) => state.activeTrack);
  const fetchTrendingSongs = usePlayerStore(state => state.fetchTrendingSongs);
  const fetchTrendingArtists = usePlayerStore(state => state.fetchTrendingArtists);
  const setTrendingData = usePlayerStore(state => state.setTrendingData);
  const trendingSongs = usePlayerStore(state => state.trendingSongs);
  const trendingArtists = usePlayerStore(state => state.trendingArtists);
  const playHistory = usePlayerStore(state => state.playHistory);
  const [loading, setLoading] = useState(false);
  
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Load local library first
    fetchLibrary();
    
    // Fetch Discover data
    const fetchDiscover = async () => {
      setLoading(true);
      try {
        const [artists, songs] = await Promise.all([
          fetchTrendingArtists('english'),
          fetchTrendingSongs('english')
        ]);
        setTrendingData(artists || [], songs || []);
      } catch (e) {
        console.error('Discover fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDiscover();
  }, []);

  const renderTrendingSong = ({ item }: { item: any }) => {
    const isActive = activeTrack?.id === item.id;
    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => playTrack(item, trendingSongs)}
      >
        <Image 
          source={{ uri: item.artwork_path || 'https://via.placeholder.com/150' }} 
          style={styles.cardArtwork} 
        />
        <Text style={[styles.cardTitle, isActive && styles.activeText]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>{item.artist}</Text>
      </TouchableOpacity>
    );
  };

  const renderArtist = ({ item }: { item: any }) => {
    const coverUrl = item.thumbnails?.[0]?.url || 'https://via.placeholder.com/150';
    return (
      <TouchableOpacity style={styles.artistCard}>
        <Image source={{ uri: coverUrl }} style={styles.artistArtwork} />
        <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  const recentlyPlayed = playHistory.slice(0, 5);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Discover</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#1db954" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Top Trending Songs */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Trending Songs</Text>
              <FlatList
                horizontal
                data={trendingSongs}
                keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                renderItem={renderTrendingSong}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              />
            </View>

            {/* Trending Artists */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trending Artists</Text>
              <FlatList
                horizontal
                data={trendingArtists}
                keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                renderItem={renderArtist}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              />
            </View>

            {/* Recently Played */}
            {recentlyPlayed.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recently Played</Text>
                <FlatList
                  horizontal
                  data={recentlyPlayed}
                  keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                  renderItem={renderTrendingSong}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  greeting: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 16,
  },
  iconButton: {
    padding: 4,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  horizontalList: {
    paddingHorizontal: 12,
  },
  card: {
    width: 140,
    marginHorizontal: 8,
  },
  cardArtwork: {
    width: 140,
    height: 140,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#222',
  },
  artistCard: {
    width: 120,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  artistArtwork: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 8,
    backgroundColor: '#222',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardSubtitle: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
  },
  activeText: {
    color: '#1db954',
  },
});
