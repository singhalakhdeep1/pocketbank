import React from 'react';
import { useAppSelector } from '@/store';
import LockScreen from '@/screens/auth/LockScreen';
import { Loading } from '@/components/ui';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

/** Splash while restoring the session, then sign-in, the biometric lock, or the app. */
export default function AppNavigator() {
  const { bootstrapped, isAuthenticated, locked } = useAppSelector((state) => state.auth);
  if (!bootstrapped) return <Loading label="Starting PocketBank…" />;
  if (!isAuthenticated) return <AuthNavigator />;
  if (locked) return <LockScreen />;
  return <MainNavigator />;
}
