import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';

interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  limit: number;
  spent: number;
}

interface BudgetCategoriesProps {
  userId: string;
}

export function BudgetCategories({ userId }: BudgetCategoriesProps) {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryLimit, setNewCategoryLimit] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, [userId]);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/budget-categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addCategory = async () => {
    if (!newCategoryName || !newCategoryLimit) return;

    try {
      const response = await fetch('/api/budget-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: newCategoryName,
          limit: parseFloat(newCategoryLimit),
        }),
      });

      if (response.ok) {
        const newCategory = await response.json();
        setCategories(prev => [...prev, newCategory]);
        setShowAddModal(false);
        setNewCategoryName('');
        setNewCategoryLimit('');
      }
    } catch (error) {
      console.error('Failed to add category:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return '#ef4444';
    if (percentage >= 70) return '#f59e0b';
    return '#10b981';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Budget Categories</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addButtonText}>+ Add Category</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Text style={styles.loadingText}>Loading categories...</Text>
      ) : categories.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No budget categories yet</Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => setShowAddModal(true)}
          >
            <Text style={styles.startButtonText}>Create Your First Budget</Text>
          </TouchableOpacity>
        </View>
      ) : (
        categories.map((category) => {
          const percentage = (category.spent / category.limit) * 100;
          const remaining = category.limit - category.spent;

          return (
            <View key={category.id} style={styles.categoryCard}>
              <View style={styles.categoryHeader}>
                <View style={[styles.iconContainer, { backgroundColor: category.color }]}>
                  <Text style={styles.icon}>{category.icon}</Text>
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categorySpent}>
                    Spent: {formatCurrency(category.spent)}
                  </Text>
                </View>
                <View style={styles.categoryLimit}>
                  <Text style={styles.limitText}>{formatCurrency(category.limit)}</Text>
                  <Text style={[
                    styles.remainingText,
                    remaining < 0 && styles.overBudget
                  ]}>
                    {remaining >= 0 ? `${formatCurrency(remaining)} left` : `${formatCurrency(Math.abs(remaining))} over`}
                  </Text>
                </View>
              </View>

              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: getProgressColor(percentage),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.percentageText, { color: getProgressColor(percentage) }]}>
                  {percentage.toFixed(0)}%
                </Text>
              </View>
            </View>
          );
        })
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Budget Category</Text>

            <View style={styles.modalInput}>
              <Text style={styles.modalLabel}>Category Name</Text>
              <TextInput
                style={styles.textInput}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="e.g., Groceries"
              />
            </View>

            <View style={styles.modalInput}>
              <Text style={styles.modalLabel}>Monthly Limit</Text>
              <TextInput
                style={styles.textInput}
                value={newCategoryLimit}
                onChangeText={setNewCategoryLimit}
                placeholder="$0.00"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={addCategory}
              >
                <Text style={styles.confirmButtonText}>Add</Text>
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
  addButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
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
  categoryCard: {
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
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 24,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  categorySpent: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  categoryLimit: {
    alignItems: 'flex-end',
  },
  limitText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  remainingText: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 2,
  },
  overBudget: {
    color: '#ef4444',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
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
    width: '80%',
    maxWidth: 320,
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
