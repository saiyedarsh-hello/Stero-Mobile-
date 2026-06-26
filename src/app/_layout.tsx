import { useState } from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import MobilePlayerBar from '@/components/MobilePlayerBar';
import PlayerModal from '@/components/PlayerModal';
import MobileNativeProvider from '@/providers/MobileNativeProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function RootLayout() {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <MobileNativeProvider>
          <StatusBar style="light" />
          <View style={styles.container}>
          <Tabs screenOptions={{ 
            headerShown: false,
            tabBarStyle: { backgroundColor: '#111', borderTopColor: '#222' },
            tabBarActiveTintColor: '#1db954'
          }}>
            <Tabs.Screen 
              name="index" 
              options={{ 
                title: 'Library', 
                tabBarIcon: ({ color }) => <Ionicons name="library" size={24} color={color} /> 
              }} 
            />
            <Tabs.Screen 
              name="explore" 
              options={{ 
                title: 'Search', 
                tabBarIcon: ({ color }) => <Ionicons name="search" size={24} color={color} /> 
              }} 
            />
          </Tabs>
          
          <PlayerModal 
            visible={isPlayerOpen} 
            onClose={() => setIsPlayerOpen(false)} 
          />

          {/* We position PlayerBar above the tabs */}
          <MobilePlayerBar onPress={() => setIsPlayerOpen(true)} />
        </View>
        </MobileNativeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  }
});
