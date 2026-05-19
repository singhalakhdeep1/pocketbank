import React from 'react';
import { Provider } from 'react-redux';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { store } from './src/store';
import { theme } from './src/theme';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Provider store={store}>
                <PaperProvider theme={theme}>
                    <NavigationContainer>
                        <StatusBar style="light" />
                        <AppNavigator />
                    </NavigationContainer>
                </PaperProvider>
            </Provider>
        </GestureHandlerRootView>
    );
}
