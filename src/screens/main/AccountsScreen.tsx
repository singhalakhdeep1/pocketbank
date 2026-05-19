import React, { useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Card, Title, Text, Button } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { fetchAccounts } from '@/store/slices/accountsSlice';

export default function AccountsScreen() {
    const dispatch = useDispatch<AppDispatch>();
    const { accounts, loading } = useSelector((state: RootState) => state.accounts);

    useEffect(() => {
        dispatch(fetchAccounts());
    }, []);

    const renderAccount = ({ item }: any) => (
        <Card style={styles.card}>
            <Card.Content>
                <Title>{item.accountType}</Title>
                <Text>Account: {item.accountNumber}</Text>
                <Text style={styles.balance}>${item.balance.toFixed(2)}</Text>
                <Text>Currency: {item.currency}</Text>
                <Text style={[styles.status, { color: item.status === 'ACTIVE' ? 'green' : 'red' }]}>
                    {item.status}
                </Text>
            </Card.Content>
            <Card.Actions>
                <Button>View Details</Button>
                <Button>Transfer</Button>
            </Card.Actions>
        </Card>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={accounts}
                renderItem={renderAccount}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshing={loading}
                onRefresh={() => dispatch(fetchAccounts())}
            />
            <Button
                mode="contained"
                icon="plus"
                style={styles.fab}
                onPress={() => { }}
            >
                New Account
            </Button>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    list: {
        padding: 10,
    },
    card: {
        marginBottom: 10,
        elevation: 2,
    },
    balance: {
        fontSize: 24,
        fontWeight: 'bold',
        marginVertical: 8,
    },
    status: {
        fontWeight: 'bold',
    },
    fab: {
        margin: 16,
    },
});
