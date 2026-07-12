import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';

interface Bill {
  id: string;
  name: string;
  category: string;
  amount: number;
  dueDate: Date;
  status: 'pending' | 'paid' | 'overdue';
  autoPay: boolean;
}

interface BillPaymentsProps {
  userId: string;
}

export function BillPayments({ userId }: BillPaymentsProps) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBills();
  }, [userId]);

  const fetchBills = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/bills`);
      if (response.ok) {
        const data = await response.json();
        setBills(data);
      }
    } catch (error) {
      console.error('Failed to fetch bills:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const payBill = async (billId: string) => {
    try {
      const response = await fetch(`/api/bills/${billId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        setBills(prev =>
          prev.map(bill =>
            bill.id === billId ? { ...bill, status: 'paid' } : bill
          )
        );
        Alert.alert('Success', 'Bill paid successfully');
        setShowPaymentModal(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pay bill');
    }
  };

  const toggleAutoPay = async (billId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/bills/${billId}/autopay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentStatus }),
      });

      if (response.ok) {
        setBills(prev =>
          prev.map(bill =>
            bill.id === billId ? { ...bill, autoPay: !currentStatus } : bill
          )
        );
      }
    } catch (error) {
      console.error('Failed to toggle autopay:', error);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#10b981';
      case 'overdue': return '#ef4444';
      default: return '#f59e0b';
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      utilities: '💡',
      rent: '🏠',
      insurance: '🛡️',
      phone: '📱',
      internet: '🌐',
      credit_card: '💳',
      subscription: '📺',
    };
    return icons[category] || '📄';
  };

  const pendingBills = bills.filter(b => b.status === 'pending' || b.status === 'overdue');
  const totalDue = pendingBills.reduce((sum, bill) => sum + bill.amount, 0);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading bills...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Total Due</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(totalDue)}</Text>
          <Text style={styles.summarySubtitle}>{pendingBills.length} pending bills</Text>
        </View>

        {/* Bills List */}
        <Text style={styles.sectionTitle}>Your Bills</Text>
        
        {bills.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No bills to pay</Text>
          </View>
        ) : (
          bills.map((bill) => (
            <View key={bill.id} style={styles.billCard}>
              <View style={styles.billHeader}>
                <View style={styles.billIcon}>
                  <Text style={styles.iconText}>{getCategoryIcon(bill.category)}</Text>
                </View>
                <View style={styles.billInfo}>
                  <Text style={styles.billName}>{bill.name}</Text>
                  <Text style={styles.billCategory}>{bill.category}</Text>
                </View>
                <View style={styles.billStatus}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(bill.status) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(bill.status) }]}>
                    {bill.status}
                  </Text>
                </View>
              </View>

              <View style={styles.billDetails}>
                <View>
                  <Text style={styles.detailLabel}>Amount</Text>
                  <Text style={styles.detailValue}>{formatCurrency(bill.amount)}</Text>
                </View>
                <View>
                  <Text style={styles.detailLabel}>Due Date</Text>
                  <Text style={styles.detailValue}>{formatDate(bill.dueDate)}</Text>
                </View>
                <View>
                  <Text style={styles.detailLabel}>Auto Pay</Text>
                  <TouchableOpacity
                    onPress={() => toggleAutoPay(bill.id, bill.autoPay)}
                    style={styles.autoPayToggle}
                  >
                    <View style={[styles.toggleTrack, { backgroundColor: bill.autoPay ? '#3b82f6' : '#d1d5db' }]}>
                      <View style={[styles.toggleThumb, { transform: [{ translateX: bill.autoPay ? 20 : 0 }] }]} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {bill.status !== 'paid' && (
                <TouchableOpacity
                  style={styles.payButton}
                  onPress={() => {
                    setSelectedBill(bill);
                    setShowPaymentModal(true);
                  }}
                >
                  <Text style={styles.payButtonText}>Pay Now</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        {/* Add Bill Button */}
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add New Bill</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Payment Confirmation Modal */}
      {showPaymentModal && selectedBill && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Confirm Payment</Text>
            <Text style={styles.modalBillName}>{selectedBill.name}</Text>
            <Text style={styles.modalAmount}>{formatCurrency(selectedBill.amount)}</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowPaymentModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => payBill(selectedBill.id)}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  summaryCard: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  summaryTitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },
  summaryAmount: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 8,
  },
  summarySubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
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
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 24,
  },
  billInfo: {
    flex: 1,
  },
  billName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  billCategory: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  billStatus: {
    alignItems: 'flex-end',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  billDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 2,
  },
  autoPayToggle: {
    marginTop: 4,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  payButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  payButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  modalBillName: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
  },
  modalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
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
    backgroundColor: '#10b981',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
