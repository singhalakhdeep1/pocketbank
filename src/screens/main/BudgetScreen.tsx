import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button, ProgressBar, Chip, FAB, Portal, Modal } from 'react-native-paper';
import { PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

interface BudgetCategory {
  id: string;
  name: string;
  spent: number;
  limit: number;
  color: string;
}

interface Budget {
  id: string;
  name: string;
  period: 'monthly' | 'weekly';
  totalLimit: number;
  totalSpent: number;
  categories: BudgetCategory[];
}

export default function BudgetScreen() {
  const [budgets, setBudgets] = useState<Budget[]>([
    {
      id: '1',
      name: 'Monthly Budget',
      period: 'monthly',
      totalLimit: 5000,
      totalSpent: 3250,
      categories: [
        { id: '1', name: 'Housing', spent: 1500, limit: 1500, color: '#FF6384' },
        { id: '2', name: 'Food', spent: 600, limit: 800, color: '#36A2EB' },
        { id: '3', name: 'Transport', spent: 300, limit: 400, color: '#FFCE56' },
        { id: '4', name: 'Entertainment', spent: 450, limit: 300, color: '#4BC0C0' },
        { id: '5', name: 'Shopping', spent: 400, limit: 500, color: '#9966FF' },
      ],
    },
  ]);

  const [modalVisible, setModalVisible] = useState(false);

  const currentBudget = budgets[0];
  const remaining = currentBudget.totalLimit - currentBudget.totalSpent;
  const progress = currentBudget.totalSpent / currentBudget.totalLimit;

  const pieData = currentBudget.categories.map(cat => ({
    name: cat.name,
    population: cat.spent,
    color: cat.color,
    legendFontColor: '#333',
    legendFontSize: 12,
  }));

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.title}>Budget</Title>
        <Paragraph style={styles.subtitle}>Track your spending</Paragraph>
      </View>

      <Card style={styles.overviewCard}>
        <Card.Content>
          <Title style={styles.budgetTitle}>{currentBudget.name}</Title>
          <View style={styles.overviewRow}>
            <View>
              <Text style={styles.overviewLabel}>Spent</Text>
              <Text style={styles.overviewValue}>${currentBudget.totalSpent.toLocaleString()}</Text>
            </View>
            <View>
              <Text style={styles.overviewLabel}>Limit</Text>
              <Text style={styles.overviewValue}>${currentBudget.totalLimit.toLocaleString()}</Text>
            </View>
            <View>
              <Text style={styles.overviewLabel}>Remaining</Text>
              <Text style={[styles.overviewValue, remaining >= 0 ? styles.positive : styles.negative]}>
                ${remaining.toLocaleString()}
              </Text>
            </View>
          </View>
          <ProgressBar
            progress={Math.min(progress, 1)}
            color={progress > 0.9 ? '#F44336' : progress > 0.7 ? '#FF9800' : '#4CAF50'}
            style={styles.progressBar}
          />
          <Text style={styles.progressText}>{(progress * 100).toFixed(0)}% of budget used</Text>
        </Card.Content>
      </Card>

      <Card style={styles.chartCard}>
        <Card.Content>
          <Title style={styles.chartTitle}>Spending by Category</Title>
          <PieChart
            data={pieData}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
            style={styles.chart}
          />
        </Card.Content>
      </Card>

      <Title style={styles.sectionTitle}>Categories</Title>
      {currentBudget.categories.map((category) => {
        const categoryProgress = category.spent / category.limit;
        const isOverBudget = category.spent > category.limit;
        return (
          <Card key={category.id} style={styles.categoryCard}>
            <Card.Content>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryInfo}>
                  <View style={[styles.colorDot, { backgroundColor: category.color }]} />
                  <Title style={styles.categoryName}>{category.name}</Title>
                </View>
                <Chip
                  mode="flat"
                  style={[styles.statusChip, isOverBudget ? styles.overBudget : styles.onTrack]}
                >
                  {isOverBudget ? 'Over Budget' : 'On Track'}
                </Chip>
              </View>
              <View style={styles.categoryStats}>
                <Text style={styles.categorySpent}>${category.spent.toLocaleString()}</Text>
                <Text style={styles.categoryLimit}> of ${category.limit.toLocaleString()}</Text>
              </View>
              <ProgressBar
                progress={Math.min(categoryProgress, 1)}
                color={isOverBudget ? '#F44336' : categoryProgress > 0.8 ? '#FF9800' : '#4CAF50'}
                style={styles.categoryProgress}
              />
            </Card.Content>
            <Card.Actions>
              <Button mode="text">Edit Limit</Button>
              <Button mode="text">View Transactions</Button>
            </Card.Actions>
          </Card>
        );
      })}

      <Card style={styles.tipsCard}>
        <Card.Content>
          <Title style={styles.tipsTitle}>Budget Tips</Title>
          <Paragraph style={styles.tip}>• You're spending 50% over on Entertainment. Consider reducing subscriptions.</Paragraph>
          <Paragraph style={styles.tip}>• Great job staying under your Housing budget!</Paragraph>
          <Paragraph style={styles.tip}>• Set aside $200 for unexpected expenses.</Paragraph>
        </Card.Content>
      </Card>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      />

      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modalContent}>
          <Title>Add Budget Category</Title>
          <Button mode="contained" onPress={() => setModalVisible(false)} style={styles.modalButton}>
            Create
          </Button>
        </Modal>
      </Portal>
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
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
    color: '#666',
  },
  overviewCard: {
    marginBottom: 20,
    elevation: 2,
  },
  budgetTitle: {
    fontSize: 20,
    marginBottom: 16,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  overviewLabel: {
    fontSize: 14,
    color: '#666',
  },
  overviewValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: '#F44336',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  chartCard: {
    marginBottom: 20,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  chart: {
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  categoryCard: {
    marginBottom: 12,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryName: {
    fontSize: 16,
  },
  statusChip: {
    fontSize: 10,
  },
  overBudget: {
    backgroundColor: '#FFEBEE',
  },
  onTrack: {
    backgroundColor: '#E8F5E9',
  },
  categoryStats: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  categorySpent: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoryLimit: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  categoryProgress: {
    height: 6,
    borderRadius: 3,
  },
  tipsCard: {
    marginBottom: 20,
    elevation: 2,
    backgroundColor: '#E3F2FD',
  },
  tipsTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  tip: {
    fontSize: 14,
    marginBottom: 8,
    color: '#1565C0',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 10,
  },
  modalButton: {
    marginTop: 16,
  },
});
