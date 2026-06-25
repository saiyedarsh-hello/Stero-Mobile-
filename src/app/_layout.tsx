import { DarkTheme, ThemeProvider, Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import MobilePlayerBar from '@/components/MobilePlayerBar';
import MobileNativeProvider from '@/providers/MobileNativeProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider value={DarkTheme}>
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
          {/* We position PlayerBar above the tabs */}
          <View style={styles.playerBarWrapper}>
            <MobilePlayerBar />
          </View>
        </View>
      </MobileNativeProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  playerBarWrapper: {
    position: 'absolute',
    bottom: 48, // approximate height of tab bar
    left: 0,
    right: 0,
  }
});
