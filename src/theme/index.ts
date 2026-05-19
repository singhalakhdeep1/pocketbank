import { DefaultTheme, MD3Theme } from 'react-native-paper';

export const theme: MD3Theme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: '#1976d2',
        secondary: '#dc004e',
        background: '#f5f5f5',
        surface: '#ffffff',
        error: '#f44336',
        onPrimary: '#ffffff',
        onSecondary: '#ffffff',
        onBackground: '#000000',
        onSurface: '#000000',
        onError: '#ffffff',
    },
};
