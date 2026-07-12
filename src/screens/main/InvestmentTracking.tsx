import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

interface Investment {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  change: number;
  changePercent: number;
}

interface InvestmentTrackingProps {
  userId: string;
}

export function InvestmentTracking({ userId }: InvestmentTrackingProps) {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalGain, setTotalGain] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchInvestments();
  }, [userId]);

  const fetchInvestments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/investments`);
      if (response.ok) {
        const data = await response.json();
        setInvestments(data);
        
        const total = data.reduce((sum: number, inv: Investment) => 
          sum + (inv.quantity * inv.currentPrice), 0
        );
        const gain = data.reduce((sum: number, inv: Investment) => 
          sum + ((inv.currentPrice - inv.avgPrice) * inv.quantity), 0
        );
        
        setTotalValue(total);
        setTotalGain(gain);
      }
    } catch (error) {
      console.error('Failed to fetch investments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading investments...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Portfolio Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Portfolio Value</Text>
        <Text style={styles.summaryValue}>{formatCurrency(totalValue)}</Text>
        <View style={styles.gainRow}>
          <Text style={[styles.gainLabel, totalGain >= 0 ? styles.gainPositive : styles.gainNegative]}>
            {totalGain >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(totalGain))}
          </Text>
          <Text style={[styles.gainPercent, totalGain >= 0 ? styles.gainPositive : styles.gainNegative]}>
            {formatPercent((totalGain / (totalValue - totalGain)) * 100)}
          </Text>
        </View>
      </View>

      {/* Performance Chart Placeholder */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Performance (30 Days)</Text>
        <View style={styles.chartPlaceholder}>
          <Text style={styles.chartPlaceholderText}>📈 Chart Visualization</Text>
        </View>
      </View>

      {/* Holdings */}
      <Text style={styles.sectionTitle}>Your Holdings</Text>
      
      {investments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No investments yet</Text>
          <TouchableOpacity style={styles.startButton}>
            <Text style={styles.startButtonText}>Start Investing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        investments.map((investment) => (
          <View key={investment.id} style={styles.investmentCard}>
            <View style={styles.investmentHeader}>
              <View style={styles.symbolContainer}>
                <Text style={styles.symbol}>{investment.symbol}</Text>
              </View>
              <View style={styles.investmentInfo}>
                <Text style={styles.investmentName}>{investment.name}</Text>
                <Text style={styles.quantity}>{investment.quantity} shares</Text>
              </View>
              <View style={styles.investmentValue}>
                <Text style={styles.currentPrice}>{formatCurrency(investment.currentPrice)}</Text>
                <Text style={[
                  styles.change,
                  investment.change >= 0 ? styles.changePositive : styles.changeNegative
                ]}>
                  {formatPercent(investment.changePercent)}
                </Text>
              </View>
            </View>

            <View style={styles.investmentDetails}>
              <View>
                <Text style={styles.detailLabel}>Avg Cost</Text>
                <Text style={styles.detailValue}>{formatCurrency(investment.avgPrice)}</Text>
              </View>
              <View>
                <Text style={styles.detailLabel}>Total Value</Text>
                <Text style={styles.detailValue}>
                  {formatCurrency(investment.quantity * investment.currentPrice)}
                </Text>
              </View>
              <View>
                <Text style={styles.detailLabel}>Gain/Loss</Text>
                <Text style={[
                  styles.detailValue,
                  (investment.currentPrice - investment.avgPrice) >= 0 ? styles.gainPositive : styles.gainNegative
                ]}>
                  {formatCurrency((investment.currentPrice - investment.avgPrice) * investment.quantity)}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}

      {/* Add Investment Button */}
      <TouchableOpacity style={styles.addButton}>
        <Text style={styles.addButtonText}>+ Add Investment</Text>
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
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  summaryCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  summaryLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  summaryValue: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 8,
  },
  gainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  gainLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  gainPositive: {
    color: '#10b981',
  },
  gainNegative: {
    color: '#ef4444',
  },
  gainPercent: {
    fontSize: 16,
    fontWeight: '500',
  },
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  chartPlaceholder: {
    height: 200,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartPlaceholderText: {
    fontSize: 16,
    color: '#9ca3af',
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
  investmentCard: {
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
  investmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  symbolContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  symbol: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  investmentInfo: {
    flex: 1,
  },
  investmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  quantity: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  investmentValue: {
    alignItems: 'flex-end',
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  change: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  changePositive: {
    color: '#10b981',
  },
  changeNegative: {
    color: '#ef4444',
  },
  investmentDetails: {
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
});
