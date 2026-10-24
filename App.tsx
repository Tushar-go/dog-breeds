import React, { useEffect } from 'react';
import {
  StatusBar,
  ActivityIndicator,
  View,
  useColorScheme,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useBreedStore } from './src/store/useBreedStore';
import { BreedListScreen } from './src/screens/BreedListScreen';
import { BreedDetailScreen } from './src/screens/BreedDetailScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootStackParamList } from './src/types/breed';

const Stack = createNativeStackNavigator<RootStackParamList>();

function WrappedBreedList(
  props: NativeStackScreenProps<RootStackParamList, 'BreedList'>
) {
  return (
    <ErrorBoundary fallbackTitle="Breed List Error Boundary">
      <BreedListScreen {...props} />
    </ErrorBoundary>
  );
}

function WrappedBreedDetail(
  props: NativeStackScreenProps<RootStackParamList, 'BreedDetail'>
) {
  return (
    <ErrorBoundary fallbackTitle="Breed Detail Error Boundary">
      <BreedDetailScreen {...props} />
    </ErrorBoundary>
  );
}

export default function App() {
  const isDark = useColorScheme() === 'dark';
  const {
    isHydrated,
    hydrateFromCache,
    syncWithRemote,
    setOfflineStatus,
  } = useBreedStore();

  useEffect(() => {
    hydrateFromCache().then(() => {
      syncWithRemote();
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setOfflineStatus(offline);
      if (!offline) {
        syncWithRemote();
      }
    });

    return () => unsubscribe();
  }, [hydrateFromCache, syncWithRemote, setOfflineStatus]);

  if (!isHydrated) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: isDark ? '#0B1120' : '#F8FAFC',
        }}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
        <Stack.Navigator
          initialRouteName="BreedList"
          screenOptions={{
            headerStyle: {
              backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
            },
            headerTintColor: isDark ? '#F8FAFC' : '#0F172A',
            headerTitleStyle: { fontWeight: '700' },
          }}
        >
          <Stack.Screen
            name="BreedList"
            component={WrappedBreedList}
            options={{ title: 'Dog Breed Explorer' }}
          />
          <Stack.Screen
            name="BreedDetail"
            component={WrappedBreedDetail}
            options={({ route }) => ({ title: route.params.breedName })}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
