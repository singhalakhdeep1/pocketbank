import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { setSessionExpiredHandler } from './src/services/api';
import { store, useAppDispatch } from './src/store';
import { bootstrap, lock, sessionExpired } from './src/store/slices/authSlice';
import { theme } from './src/theme';
import AppNavigator from './src/navigation/AppNavigator';

const LOCK_AFTER_MS = 60_000;

function Root() {
  const dispatch = useAppDispatch();
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    setSessionExpiredHandler(() => dispatch(sessionExpired()));
    void dispatch(bootstrap());
    // Re-lock behind biometrics when the app was in the background for more than a minute.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current && Date.now() - backgroundedAt.current > LOCK_AFTER_MS) dispatch(lock());
      if (state === 'active') backgroundedAt.current = null;
    });
    return () => sub.remove();
  }, [dispatch]);

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <PaperProvider theme={theme}>
          <Root />
        </PaperProvider>
      </Provider>
    </SafeAreaProvider>
  );
}
