import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { AuthProvider, useAuth } from '../lib/auth-context';

// Required for New Architecture / Expo Go SDK 54
enableScreens();

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/dashboard');
    }
  }, [user, isLoading]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    Font.loadAsync({
      'Telma':        require('../assets/fonts/Telma-Regular.ttf'),
      'Telma-Medium': require('../assets/fonts/Telma-Medium.ttf'),
      'Telma-Bold':   require('../assets/fonts/Telma-Bold.ttf'),
      'Telma-Black':  require('../assets/fonts/Telma-Black.ttf'),
      'Inter':           require('../assets/fonts/Inter-Inter_400Regular.ttf'),
      'Inter-Medium':    require('../assets/fonts/Inter-Inter_500Medium.ttf'),
      'Inter-SemiBold':  require('../assets/fonts/Inter-Inter_600SemiBold.ttf'),
      'Inter-Bold':      require('../assets/fonts/Inter-Inter_700Bold.ttf'),
    }).finally(() => {
      SplashScreen.hideAsync();
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="light" />
        <RootLayoutNav />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
