import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';

interface Contact {
  id: string;
  name: string;
  avatar?: string;
  accountNumber: string;
}

interface P2PTransfersProps {
  userId: string;
  balance: number;
}

export function P2PTransfers({ userId, balance }: P2PTransfersProps) {
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [recentContacts, setRecentContacts] = useState<Contact[]>([
    { id: '1', name: 'John Doe', accountNumber: '****1234' },
    { id: '2', name: 'Jane Smith', accountNumber: '****5678' },
    { id: '3', name: 'Bob Johnson', accountNumber: '****9012' },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTransfer = async () => {
    if (!amount || !recipient) {
      Alert.alert('Error', 'Please enter amount and recipient');
      return;
    }

    const transferAmount = parseFloat(amount);
    if (transferAmount > balance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    if (transferAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/transfers/p2p', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: userId,
          toAccount: recipient,
          amount: transferAmount,
          note,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Transfer completed successfully');
        setAmount('');
        setRecipient('');
        setNote('');
      } else {
        Alert.alert('Error', 'Transfer failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectContact = (contact: Contact) => {
    setRecipient(contact.accountNumber);
  };

  const formatCurrency = (value: string) => {
    if (!value) return '';
    const num = parseFloat(value.replace(/[^0-9.]/g, ''));
    return num ? `$${num.toFixed(2)}` : '';
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Send Money</Text>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
      </View>

      {/* Amount Input */}
      <View style={styles.inputSection}>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
          placeholder="$0.00"
          keyboardType="decimal-pad"
        />
      </View>

      {/* Recipient Input */}
      <View style={styles.inputSection}>
        <Text style={styles.label}>Recipient (Account Number)</Text>
        <TextInput
          style={styles.input}
          value={recipient}
          onChangeText={setRecipient}
          placeholder="Enter account number"
          keyboardType="number-pad"
        />
      </View>

      {/* Note Input */}
      <View style={styles.inputSection}>
        <Text style={styles.label}>Note (Optional)</Text>
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder="Add a note"
          multiline
        />
      </View>

      {/* Recent Contacts */}
      <View style={styles.contactsSection}>
        <Text style={styles.sectionTitle}>Recent Contacts</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {recentContacts.map((contact) => (
            <TouchableOpacity
              key={contact.id}
              style={styles.contactCard}
              onPress={() => selectContact(contact)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{contact.name[0]}</Text>
              </View>
              <Text style={styles.contactName}>{contact.name}</Text>
              <Text style={styles.contactAccount}>{contact.accountNumber}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Quick Amount Buttons */}
      <View style={styles.quickAmountSection}>
        <Text style={styles.sectionTitle}>Quick Amount</Text>
        <View style={styles.quickAmountButtons}>
          {['$10', '$25', '$50', '$100'].map((value) => (
            <TouchableOpacity
              key={value}
              style={styles.quickAmountButton}
              onPress={() => setAmount(value.replace('$', ''))}
            >
              <Text style={styles.quickAmountText}>{value}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Transfer Button */}
      <TouchableOpacity
        style={[styles.transferButton, (!amount || !recipient || isProcessing) && styles.disabledButton]}
        onPress={handleTransfer}
        disabled={!amount || !recipient || isProcessing}
      >
        <Text style={styles.transferButtonText}>
          {isProcessing ? 'Processing...' : 'Send Money'}
        </Text>
      </TouchableOpacity>

      {/* Scan QR Button */}
      <TouchableOpacity style={styles.qrButton}>
        <Text style={styles.qrButtonText}>📷 Scan QR Code</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },
  balanceCard: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  balanceLabel: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },
  balanceAmount: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 8,
  },
  inputSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  amountInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: 'bold',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  contactsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  contactCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  contactAccount: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  quickAmountSection: {
    marginBottom: 24,
  },
  quickAmountButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  transferButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  disabledButton: {
    backgroundColor: '#d1d5db',
  },
  transferButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  qrButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  qrButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});
