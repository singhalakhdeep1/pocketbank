import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Title, Text } from 'react-native-paper';

export default function CardsScreen() {
    return (
        <View style={styles.container}>
            <Card style={styles.card}>
                <Card.Content>
                    <Title>Credit & Debit Cards</Title>
                    <Text>Your cards will be displayed here</Text>
                </Card.Content>
            </Card>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 10,
    },
    card: {
        elevation: 2,
    },
});
