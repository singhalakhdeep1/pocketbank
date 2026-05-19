import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Card, Title, Text, Chip } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';

export default function TransactionsScreen() {
    const { transactions } = useSelector((state: RootState) => state.transactions);

    const renderTransaction = ({ item }: any) => (
        <Card style={styles.card}>
            <Card.Content>
                <View style={styles.row}>
                    <View style={styles.transactionInfo}>
                        <Title style={styles.amount}>${item.amount.toFixed(2)}</Title>
                        <Text>{item.description}</Text>
                        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                    </View>
                    <Chip style={styles.chip}>{item.type}</Chip>
                </View>
            </Card.Content>
        </Card>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={transactions}
                renderItem={renderTransaction}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Card style={styles.emptyCard}>
                        <Card.Content>
                            <Text style={styles.emptyText}>No transactions yet</Text>
                        </Card.Content>
                    </Card>
                }
            />
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
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    transactionInfo: {
        flex: 1,
    },
    amount: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    date: {
        color: '#666',
        fontSize: 12,
        marginTop: 4,
    },
    chip: {
        marginLeft: 10,
    },
    emptyCard: {
        marginTop: 20,
    },
    emptyText: {
        textAlign: 'center',
        color: '#666',
    },
});
