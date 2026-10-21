import { MD3LightTheme, type MD3Theme } from 'react-native-paper';

export const colors = {
  primary: '#1976d2',
  primaryDark: '#0d47a1',
  secondary: '#dc004e',
  background: '#f4f6fa',
  surface: '#ffffff',
  surfaceAlt: '#e8edf5',
  text: '#1f2937',
  muted: '#6b7280',
  positive: '#0f9d58',
  negative: '#d93025',
  warning: '#f59e0b',
  chart: ['#1976d2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
};

export const theme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    secondary: colors.secondary,
    background: colors.background,
    surface: colors.surface,
    error: colors.negative,
    onPrimary: '#ffffff',
    onSecondary: '#ffffff',
    onBackground: colors.text,
    onSurface: colors.text,
    onError: '#ffffff',
  },
};

export const chartConfig = {
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
  propsForDots: { r: '3' },
};
