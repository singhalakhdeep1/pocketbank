import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';

interface VirtualCard {
  id: string;
  lastFour: string;
  expiry: string;
  cvv: string;
  cardholder: string;
  balance: number;
  status: 'active' | 'frozen' | 'expired';
  type: 'visa' | 'mastercard';
  dailyLimit: number;
  monthlyLimit: number;
}

interface VirtualCardProps {
  userId: string;
}

export function VirtualCard({ userId }: VirtualCardProps) {
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<VirtualCard | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCards();
  }, [userId]);

  const fetchCards = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/virtual-cards`);
      if (response.ok) {
        const data = await response.json();
        setCards(data);
        if (data.length > 0) {
          setSelectedCard(data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const freezeCard = async (cardId: string) => {
    try {
      const response = await fetch(`/api/virtual-cards/${cardId}/freeze`, {
        method: 'PATCH',
      });

      if (response.ok) {
        setCards(prev =>
          prev.map(card =>
            card.id === cardId
              ? { ...card, status: card.status === 'active' ? 'frozen' : 'active' }
              : card
          )
        );
        Alert.alert('Success', 'Card status updated');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update card status');
    }
  };

  const createNewCard = async () => {
    try {
      const response = await fetch('/api/virtual-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const newCard = await response.json();
        setCards(prev => [...prev, newCard]);
        setSelectedCard(newCard);
        Alert.alert('Success', 'Virtual card created successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create card');
    }
  };

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const maskCardNumber = (lastFour: string) => {
    return `•••• •••• •••• ${lastFour}`;
  };

  const getCardColor = (type: string) => {
    return type === 'visa' ? '#1a1f71' : '#eb001b';
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading virtual cards...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Virtual Cards</Text>

      {cards.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No virtual cards yet</Text>
          <TouchableOpacity style={styles.createButton} onPress={createNewCard}>
            <Text style={styles.createButtonText}>+ Create Virtual Card</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Card Display */}
          {selectedCard && (
            <View style={[styles.card, { backgroundColor: getCardColor(selectedCard.type) }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardType}>{selectedCard.type.toUpperCase()}</Text>
                <View style={[
                  styles.statusBadge,
                  selectedCard.status === 'active' && styles.statusActive,
                  selectedCard.status === 'frozen' && styles.statusFrozen,
                ]}>
                  <Text style={styles.statusText}>{selectedCard.status.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.cardNumber}>
                {showDetails ? maskCardNumber(selectedCard.lastFour) : '•••• •••• •••• ••••'}
              </Text>

              <View style={styles.cardDetails}>
                <View>
                  <Text style={styles.cardLabel}>Cardholder</Text>
                  <Text style={styles.cardValue}>{selectedCard.cardholder}</Text>
                </View>
                <View>
                  <Text style={styles.cardLabel}>Expires</Text>
                  <Text style={styles.cardValue}>{selectedCard.expiry}</Text>
                </View>
                <View>
                  <Text style={styles.cardLabel}>CVV</Text>
                  <Text style={styles.cardValue}>{showDetails ? selectedCard.cvv : '•••'}</Text>
                </View>
              </View>

              <View style={styles.cardBalance}>
                <Text style={styles.balanceLabel}>Available Balance</Text>
                <Text style={styles.balanceAmount}>{formatCurrency(selectedCard.balance)}</Text>
              </View>
            </View>
          )}

          {/* Card Actions */}
          {selectedCard && (
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setShowDetails(!showDetails)}
              >
                <Text style={styles.actionButtonText}>
                  {showDetails ? '🔒 Hide Details' : '👁 Show Details'}
                </Text>
              </TouchableOpacity>

              {selectedCard.status === 'active' ? (
                <TouchableOpacity
                  style={[styles.actionButton, styles.freezeButton]}
                  onPress={() => freezeCard(selectedCard.id)}
                >
                  <Text style={styles.actionButtonText}>❄️ Freeze Card</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.actionButton, styles.unfreezeButton]}
                  onPress={() => freezeCard(selectedCard.id)}
                >
                  <Text style={styles.actionButtonText}>🔓 Unfreeze Card</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Spending Limits */}
          {selectedCard && (
            <View style={styles.limitsCard}>
              <Text style={styles.limitsTitle}>Spending Limits</Text>
              
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>Daily Limit</Text>
                <Text style={styles.limitValue}>{formatCurrency(selectedCard.dailyLimit)}</Text>
              </View>
              
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>Monthly Limit</Text>
                <Text style={styles.limitValue}>{formatCurrency(selectedCard.monthlyLimit)}</Text>
              </View>

              <TouchableOpacity style={styles.editLimitsButton}>
                <Text style={styles.editLimitsButtonText}>Edit Limits</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Card Selector */}
          {cards.length > 1 && (
            <View style={styles.cardSelector}>
              <Text style={styles.selectorTitle}>Your Cards</Text>
              {cards.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  style={[
                    styles.cardOption,
                    selectedCard?.id === card.id && styles.cardOptionSelected,
                  ]}
                  onPress={() => setSelectedCard(card)}
                >
                  <View style={[styles.cardOptionDot, { backgroundColor: getCardColor(card.type) }]} />
                  <Text style={styles.cardOptionText}>
                    {card.type.toUpperCase()} •••• {card.lastFour}
                  </Text>
                  {selectedCard?.id === card.id && (
                    <Text style={styles.cardOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Create New Card Button */}
          <TouchableOpacity style={styles.createButton} onPress={createNewCard}>
            <Text style={styles.createButtonText}>+ Create New Card</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardType: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#10b981',
  },
  statusFrozen: {
    backgroundColor: '#f59e0b',
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardNumber: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 24,
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  cardLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginBottom: 4,
  },
  cardValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  cardBalance: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: 16,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  balanceAmount: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  freezeButton: {
    backgroundColor: '#fef3c7',
  },
  unfreezeButton: {
    backgroundColor: '#d1fae5',
  },
  limitsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  limitsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  limitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  limitLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  limitValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  editLimitsButton: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    alignItems: 'center',
  },
  editLimitsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  cardSelector: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  cardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  cardOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  cardOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  cardOptionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  cardOptionCheck: {
    fontSize: 18,
    color: '#3b82f6',
  },
  createButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
