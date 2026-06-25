import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, FlatList, ActivityIndicator, Image } from 'react-native';
import { usePlayerStore } from '../core';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const playTrack = usePlayerStore(state => state.playTrack);
  const activeTrack = usePlayerStore(state => state.activeTrack);
  const ytSearchResults = usePlayerStore(state => state.ytSearchResults);
  const setYtSearchResults = usePlayerStore(state => state.setYtSearchResults);
  const insets = useSafeAreaInsets();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      // @ts-ignore
      const results = await window.electron.ytSearch(query);
      setYtSearchResults(results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isActive = activeTrack?.id === item.id;
    return (
      <TouchableOpacity 
        style={[styles.resultItem, isActive && styles.activeItem]}
        onPress={() => playTrack(item, ytSearchResults || [])}
      >
        <Image 
          source={{ uri: item.artwork_path || 'https://via.placeholder.com/150' }} 
          style={styles.artwork} 
        />
        <View style={styles.info}>
          <Text style={[styles.title, isActive && styles.activeText]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
        </View>
        <Ionicons name="play-circle-outline" size={28} color={isActive ? '#1db954' : '#888'} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="What do you want to listen to?"
          placeholderTextColor="#888"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearIcon}>
            <Ionicons name="close-circle" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#1db954" />
        </View>
      ) : ytSearchResults && ytSearchResults.length > 0 ? (
        <FlatList
          data={ytSearchResults}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        />
      ) : (
        <View style={styles.centerContent}>
          <Ionicons name="search-outline" size={64} color="#333" />
          <Text style={styles.emptyText}>Find your favorite songs</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  clearIcon: {
    marginLeft: 8,
    padding: 4,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  activeItem: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderBottomWidth: 0,
  },
  artwork: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 12,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  activeText: {
    color: '#1db954',
  },
  artist: {
    color: '#aaa',
    fontSize: 14,
  },
});
