import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

const Stack = createStackNavigator();

export default function AppNavigator() {
    const { isAuthenticated } = useSelector((state: RootState) => state.auth);

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!isAuthenticated ? (
                <Stack.Screen name="Auth" component={AuthNavigator} />
            ) : (
                <Stack.Screen name="Main" component={MainNavigator} />
            )}
        </Stack.Navigator>
    );
}
