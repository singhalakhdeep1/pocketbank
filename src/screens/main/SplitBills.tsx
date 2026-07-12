import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';

interface SplitBill {
  id: string;
  title: string;
  totalAmount: number;
  createdBy: string;
  createdAt: Date;
  participants: {
    userId: string;
    name: string;
    amount: number;
    paid: boolean;
  }[];
  status: 'pending' | 'settled';
}

interface SplitBillsProps {
  userId: string;
  userName: string;
}

export function SplitBills({ userId, userName }: SplitBillsProps) {
  const [splitBills, setSplitBills] = useState<SplitBill[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBillTitle, setNewBillTitle] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [contacts] = useState([
    { id: '1', name: 'John Doe' },
    { id: '2', name: 'Jane Smith' },
    { id: '3', name: 'Bob Johnson' },
  ]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSplitBills();
  }, [userId]);

  const fetchSplitBills = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/split-bills`);
      if (response.ok) {
        const data = await response.json();
        setSplitBills(data);
      }
    } catch (error) {
      console.error('Failed to fetch split bills:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createSplitBill = async () => {
    if (!newBillTitle || !newBillAmount || selectedParticipants.length === 0) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const totalAmount = parseFloat(newBillAmount);
    const amountPerPerson = totalAmount / (selectedParticipants.length + 1);

    const participants = [
      { userId, name: userName, amount: amountPerPerson, paid: false },
      ...selectedParticipants.map(id => {
        const contact = contacts.find(c => c.id === id);
        return {
          userId: id,
          name: contact?.name || 'Unknown',
          amount: amountPerPerson,
          paid: false,
        };
      }),
    ];

    try {
      const response = await fetch('/api/split-bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newBillTitle,
          totalAmount,
          createdBy: userId,
          participants,
        }),
      });

      if (response.ok) {
        const newBill = await response.json();
        setSplitBills(prev => [newBill, ...prev]);
        setShowCreateModal(false);
        setNewBillTitle('');
        setNewBillAmount('');
        setSelectedParticipants([]);
        Alert.alert('Success', 'Split bill created successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create split bill');
    }
  };

  const settleBill = async (billId: string) => {
    try {
      const response = await fetch(`/api/split-bills/${billId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        setSplitBills(prev =>
          prev.map(bill =>
            bill.id === billId
              ? {
                  ...bill,
                  participants: bill.participants.map(p =>
                    p.userId === userId ? { ...p, paid: true } : p
                  ),
                  status: bill.participants.every(p => p.paid || p.userId === userId)
                    ? 'settled'
                    : bill.status,
                }
              : bill
          )
        );
        Alert.alert('Success', 'Your share has been settled');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to settle bill');
    }
  };

  const toggleParticipant = (contactId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Split Bills</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createButtonText}>+ New Split</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Text style={styles.loadingText}>Loading split bills...</Text>
      ) : splitBills.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No split bills yet</Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.startButtonText}>Create Your First Split</Text>
          </TouchableOpacity>
        </View>
      ) : (
        splitBills.map((bill) => {
          const userShare = bill.participants.find(p => p.userId === userId);
          const isSettled = userShare?.paid || false;

          return (
            <View key={bill.id} style={styles.billCard}>
              <View style={styles.billHeader}>
                <View style={styles.billIcon}>
                  <Text style={styles.billIconText}>💸</Text>
                </View>
                <View style={styles.billInfo}>
                  <Text style={styles.billTitle}>{bill.title}</Text>
                  <Text style={styles.billDate}>{formatDate(bill.createdAt)}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  isSettled ? styles.statusSettled : styles.statusPending,
                ]}>
                  <Text style={[
                    styles.statusText,
                    isSettled ? styles.statusTextSettled : styles.statusTextPending,
                  ]}>
                    {isSettled ? 'Settled' : 'Pending'}
                  </Text>
                </View>
              </View>

              <View style={styles.billDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total</Text>
                  <Text style={styles.detailValue}>{formatCurrency(bill.totalAmount)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Your Share</Text>
                  <Text style={[
                    styles.detailValue,
                    !isSettled && styles.oweAmount,
                  ]}>
                    {formatCurrency(userShare?.amount || 0)}
                  </Text>
                </View>
              </View>

              <View style={styles.participantsContainer}>
                <Text style={styles.participantsLabel}>
                  Split with {bill.participants.length} people
                </Text>
                <View style={styles.participantsList}>
                  {bill.participants.slice(0, 4).map((participant) => (
                    <View
                      key={participant.userId}
                      style={[
                        styles.participantDot,
                        participant.paid && styles.participantPaid,
                      ]}
                    >
                      <Text style={styles.participantInitial}>
                        {participant.name[0]}
                      </Text>
                    </View>
                  ))}
                  {bill.participants.length > 4 && (
                    <View style={styles.moreParticipants}>
                      <Text style={styles.moreParticipantsText}>
                        +{bill.participants.length - 4}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {!isSettled && (
                <TouchableOpacity
                  style={styles.settleButton}
                  onPress={() => settleBill(bill.id)}
                >
                  <Text style={styles.settleButtonText}>Settle Your Share</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}

      {/* Create Split Bill Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Create Split Bill</Text>

            <View style={styles.modalInput}>
              <Text style={styles.modalLabel}>Bill Title</Text>
              <TextInput
                style={styles.textInput}
                value={newBillTitle}
                onChangeText={setNewBillTitle}
                placeholder="e.g., Dinner at Restaurant"
              />
            </View>

            <View style={styles.modalInput}>
              <Text style={styles.modalLabel}>Total Amount</Text>
              <TextInput
                style={styles.textInput}
                value={newBillAmount}
                onChangeText={setNewBillAmount}
                placeholder="$0.00"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.modalInput}>
              <Text style={styles.modalLabel}>Split With</Text>
              <View style={styles.contactsList}>
                {contacts.map((contact) => (
                  <TouchableOpacity
                    key={contact.id}
                    style={[
                      styles.contactOption,
                      selectedParticipants.includes(contact.id) && styles.contactOptionSelected,
                    ]}
                    onPress={() => toggleParticipant(contact.id)}
                  >
                    <View style={styles.contactAvatar}>
                      <Text style={styles.contactAvatarText}>{contact.name[0]}</Text>
                    </View>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    {selectedParticipants.includes(contact.id) && (
                      <Text style={styles.contactCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={createSplitBill}
              >
                <Text style={styles.confirmButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
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
  startButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  billCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  billHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  billIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  billIconText: {
    fontSize: 24,
  },
  billInfo: {
    flex: 1,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  billDate: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusSettled: {
    backgroundColor: '#d1fae5',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextSettled: {
    color: '#10b981',
  },
  statusTextPending: {
    color: '#f59e0b',
  },
  billDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  detailRow: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  oweAmount: {
    color: '#ef4444',
  },
  participantsContainer: {
    marginBottom: 12,
  },
  participantsLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  participantsList: {
    flexDirection: 'row',
    gap: 8,
  },
  participantDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantPaid: {
    backgroundColor: '#d1fae5',
  },
  participantInitial: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  moreParticipants: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreParticipantsText: {
    fontSize: 12,
    color: '#6b7280',
  },
  settleButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  settleButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
  },
  modalInput: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  contactsList: {
    gap: 8,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  contactOptionSelected: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  contactCheck: {
    fontSize: 18,
    color: '#3b82f6',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
