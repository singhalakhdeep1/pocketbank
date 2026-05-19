import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, Text, Avatar } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { fetchAccounts } from '@/store/slices/accountsSlice';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
    const dispatch = useDispatch<AppDispatch>();
    const { accounts } = useSelector((state: RootState) => state.accounts);
    const { user } = useSelector((state: RootState) => state.auth);

    useEffect(() => {
        dispatch(fetchAccounts());
    }, []);

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    const stats = [
        { title: 'Total Balance', value: `$${totalBalance.toFixed(2)}`, icon: 'wallet', color: '#1976d2' },
        { title: 'Active Accounts', value: accounts.length.toString(), icon: 'card', color: '#2e7d32' },
        { title: 'Active Cards', value: '3', icon: 'card-outline', color: '#ed6c02' },
        { title: 'Active Loans', value: '1', icon: 'cash', color: '#9c27b0' },
    ];

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.greeting}>Welcome back,</Text>
                <Title style={styles.name}>{user?.firstName} {user?.lastName}</Title>
            </View>

            <View style={styles.statsContainer}>
                {stats.map((stat, index) => (
                    <Card key={index} style={styles.statCard}>
                        <Card.Content style={styles.statContent}>
                            <Avatar.Icon
                                size={48}
                                icon={stat.icon}
                                style={[styles.statIcon, { backgroundColor: stat.color }]}
                            />
                            <Text style={styles.statValue}>{stat.value}</Text>
                            <Text style={styles.statTitle}>{stat.title}</Text>
                        </Card.Content>
                    </Card>
                ))}
            </View>

            <Card style={styles.card}>
                <Card.Title title="Recent Transactions" />
                <Card.Content>
                    <Text>No recent transactions</Text>
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Title title="Quick Actions" />
                <Card.Content style={styles.quickActions}>
                    <View style={styles.actionButton}>
                        <Avatar.Icon size={48} icon="swap-horizontal" />
                        <Text style={styles.actionText}>Transfer</Text>
                    </View>
                    <View style={styles.actionButton}>
                        <Avatar.Icon size={48} icon="qrcode-scan" />
                        <Text style={styles.actionText}>Scan QR</Text>
                    </View>
                    <View style={styles.actionButton}>
                        <Avatar.Icon size={48} icon="credit-card" />
                        <Text style={styles.actionText}>Pay Bill</Text>
                    </View>
                    <View style={styles.actionButton}>
                        <Avatar.Icon size={48} icon="cellphone" />
                        <Text style={styles.actionText}>Recharge</Text>
                    </View>
                </Card.Content>
            </Card>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        padding: 20,
        backgroundColor: '#1976d2',
    },
    greeting: {
        fontSize: 16,
        color: '#fff',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    statsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 10,
    },
    statCard: {
        width: '48%',
        margin: '1%',
        elevation: 2,
    },
    statContent: {
        alignItems: 'center',
        padding: 16,
    },
    statIcon: {
        marginBottom: 8,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statTitle: {
        fontSize: 12,
        color: '#666',
    },
    card: {
        margin: 10,
        elevation: 2,
    },
    quickActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    actionButton: {
        alignItems: 'center',
    },
    actionText: {
        marginTop: 8,
        fontSize: 12,
    },
});
