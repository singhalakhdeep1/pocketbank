import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

interface SpendingData {
  totalSpent: number;
  budget: number;
  categories: {
    name: string;
    amount: number;
    percentage: number;
    color: string;
  }[];
  monthlyTrend: {
    month: string;
    amount: number;
  }[];
}

interface SpendingAnalyticsProps {
  userId: string;
}

export function SpendingAnalytics({ userId }: SpendingAnalyticsProps) {
  const [data, setData] = useState<SpendingData | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/spending?range=${timeRange}`);
      if (response.ok) {
        const analyticsData = await response.json();
        setData(analyticsData);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No spending data available</Text>
      </View>
    );
  }

  const budgetUsed = data.budget > 0 ? (data.totalSpent / data.budget) * 100 : 0;
  const remaining = data.budget - data.totalSpent;

  return (
    <ScrollView style={styles.container}>
      {/* Time Range Selector */}
      <View style={styles.timeRangeSelector}>
        {(['week', 'month', 'year'] as const).map((range) => (
          <TouchableOpacity
            key={range}
            style={[
              styles.timeRangeButton,
              timeRange === range && styles.timeRangeButtonActive,
            ]}
            onPress={() => setTimeRange(range)}
          >
            <Text style={[
              styles.timeRangeText,
              timeRange === range && styles.timeRangeTextActive,
            ]}>
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Spent</Text>
        <Text style={styles.summaryAmount}>{formatCurrency(data.totalSpent)}</Text>
        <View style={styles.budgetRow}>
          <Text style={styles.budgetLabel}>Budget: {formatCurrency(data.budget)}</Text>
          <Text style={[
            styles.budgetRemaining,
            remaining >= 0 ? styles.positive : styles.negative,
          ]}>
            {remaining >= 0 ? `${formatCurrency(remaining)} left` : `${formatCurrency(Math.abs(remaining))} over`}
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(budgetUsed, 100)}%`,
                  backgroundColor: budgetUsed >= 90 ? '#ef4444' : budgetUsed >= 70 ? '#f59e0b' : '#10b981',
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{budgetUsed.toFixed(0)}%</Text>
        </View>
      </View>

      {/* Spending by Category */}
      <Text style={styles.sectionTitle}>Spending by Category</Text>
      <View style={styles.categoriesContainer}>
        {data.categories.map((category) => (
          <View key={category.name} style={styles.categoryItem}>
            <View style={styles.categoryHeader}>
              <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryAmount}>{formatCurrency(category.amount)}</Text>
            </View>
            <View style={styles.categoryProgressBar}>
              <View style={styles.categoryProgressBarBackground}>
                <View
                  style={[
                    styles.categoryProgressBarFill,
                    {
                      width: `${category.percentage}%`,
                      backgroundColor: category.color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.categoryPercentage}>{category.percentage.toFixed(0)}%</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Monthly Trend */}
      <Text style={styles.sectionTitle}>Monthly Trend</Text>
      <View style={styles.trendCard}>
        <View style={styles.trendChart}>
          {data.monthlyTrend.map((item, index) => {
            const maxAmount = Math.max(...data.monthlyTrend.map(t => t.amount));
            const height = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
            
            return (
              <View key={item.month} style={styles.trendBarContainer}>
                <View
                  style={[
                    styles.trendBar,
                    { height: `${height}%` },
                  ]}
                />
                <Text style={styles.trendLabel}>{item.month}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Insights */}
      <Text style={styles.sectionTitle}>Insights</Text>
      <View style={styles.insightsCard}>
        <View style={styles.insightItem}>
          <Text style={styles.insightIcon}>💡</Text>
          <Text style={styles.insightText}>
            You spent {formatCurrency(data.totalSpent)} this {timeRange}
          </Text>
        </View>
        <View style={styles.insightItem}>
          <Text style={styles.insightIcon}>📊</Text>
          <Text style={styles.insightText}>
            Top category: {data.categories[0]?.name || 'N/A'}
          </Text>
        </View>
        <View style={styles.insightItem}>
          <Text style={styles.insightIcon}>🎯</Text>
          <Text style={[
            styles.insightText,
            remaining >= 0 ? styles.insightPositive : styles.insightNegative,
          ]}>
            {remaining >= 0 ? 'On track with budget' : 'Over budget this period'}
          </Text>
        </View>
      </View>
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
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#9ca3af',
  },
  timeRangeSelector: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timeRangeText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  timeRangeTextActive: {
    color: '#1f2937',
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 4,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  budgetLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  budgetRemaining: {
    fontSize: 14,
    fontWeight: '600',
  },
  positive: {
    color: '#10b981',
  },
  negative: {
    color: '#ef4444',
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
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
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    minWidth: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  categoriesContainer: {
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
  categoryItem: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  categoryProgressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryProgressBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryPercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    minWidth: 35,
    textAlign: 'right',
  },
  trendCard: {
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
  trendChart: {
    flexDirection: 'row',
    height: 150,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  trendBarContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  trendBar: {
    width: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
    minHeight: 4,
  },
  trendLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
  insightsCard: {
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
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  insightPositive: {
    color: '#10b981',
  },
  insightNegative: {
    color: '#ef4444',
  },
});
