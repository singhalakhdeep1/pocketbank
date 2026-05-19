import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from '@/screens/main/DashboardScreen';
import AccountsScreen from '@/screens/main/AccountsScreen';
import TransactionsScreen from '@/screens/main/TransactionsScreen';
import CardsScreen from '@/screens/main/CardsScreen';
import ProfileScreen from '@/screens/main/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function MainNavigator() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: keyof typeof Ionicons.glyphMap = 'home';

                    if (route.name === 'Dashboard') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'Accounts') {
                        iconName = focused ? 'wallet' : 'wallet-outline';
                    } else if (route.name === 'Transactions') {
                        iconName = focused ? 'list' : 'list-outline';
                    } else if (route.name === 'Cards') {
                        iconName = focused ? 'card' : 'card-outline';
                    } else if (route.name === 'Profile') {
                        iconName = focused ? 'person' : 'person-outline';
                    }

                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: '#1976d2',
                tabBarInactiveTintColor: 'gray',
                headerStyle: {
                    backgroundColor: '#1976d2',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
            })}
        >
            <Tab.Screen name="Dashboard" component={DashboardScreen} />
            <Tab.Screen name="Accounts" component={AccountsScreen} />
            <Tab.Screen name="Transactions" component={TransactionsScreen} />
            <Tab.Screen name="Cards" component={CardsScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
}
