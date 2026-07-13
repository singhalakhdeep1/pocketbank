import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, ProgressBar } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

interface Investment {
  id: string;
  name: string;
  type: 'stocks' | 'bonds' | 'crypto' | 'etf';
  value: number;
  invested: number;
  change: number;
  changePercent: number;
}

export default function InvestmentsScreen() {
  const [investments, setInvestments] = useState<Investment[]>([
    { id: '1', name: 'AAPL', type: 'stocks', value: 15000, invested: 12000, change: 3000, changePercent: 25 },
    { id: '2', name: 'GOOGL', type: 'stocks', value: 8000, invested: 10000, change: -2000, changePercent: -20 },
    { id: '3', name: 'BTC', type: 'crypto', value: 25000, invested: 15000, change: 10000, changePercent: 66.67 },
    { id: '4', name: 'US Treasury', type: 'bonds', value: 5000, invested: 5000, change: 0, changePercent: 0 },
    { id: '5', name: 'VOO', type: 'etf', value: 12000, invested: 10000, change: 2000, changePercent: 20 },
  ]);

  const totalValue = investments.reduce((sum, inv) => sum + inv.value, 0);
  const totalInvested = investments.reduce((sum, inv) => sum + inv.invested, 0);
  const totalChange = totalValue - totalInvested;
  const totalChangePercent = (totalChange / totalInvested) * 100;

  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        data: [45000, 48000, 52000, 50000, 58000, 65000],
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.title}>Investments</Title>
        <Paragraph style={styles.subtitle}>Portfolio Value: ${totalValue.toLocaleString()}</Paragraph>
        <View style={styles.changeContainer}>
          <Text style={[styles.change, totalChange >= 0 ? styles.positive : styles.negative]}>
            {totalChange >= 0 ? '+' : ''}${totalChange.toLocaleString()} ({totalChangePercent.toFixed(2)}%)
          </Text>
        </View>
      </View>

      <Card style={styles.chartCard}>
        <Card.Content>
          <Title style={styles.chartTitle">Portfolio Performance</Title>
          <LineChart
            data={chartData}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: { borderRadius: 16 },
            }}
            bezier
            style={styles.chart}
          />
        </Card.Content>
      </Card>

      <Title style={styles.sectionTitle}>Your Holdings</Title>
      {investments.map((investment) => (
        <Card key={investment.id} style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View>
                <Title style={styles.investmentName}>{investment.name}</Title>
                <Chip mode="flat" style={styles.chip}>{investment.type.toUpperCase()}</Chip>
              </View>
              <View style={styles.valueContainer}>
                <Text style={styles.value}>${investment.value.toLocaleString()}</Text>
                <Text style={[styles.change, investment.change >= 0 ? styles.positive : styles.negative]}>
                  {investment.change >= 0 ? '+' : ''}${investment.change.toLocaleString()} ({investment.changePercent.toFixed(2)}%)
                </Text>
              </View>
            </View>
            <ProgressBar
              progress={investment.value / (investment.value + investment.invested)}
              color={investment.change >= 0 ? '#4CAF50' : '#F44336'}
              style={styles.progressBar}
            />
            <Paragraph style={styles.invested}>Invested: ${investment.invested.toLocaleString()}</Paragraph>
          </Card.Content>
          <Card.Actions>
            <Button mode="contained">Buy More</Button>
            <Button mode="outlined">Sell</Button>
          </Card.Actions>
        </Card>
      ))}

      <Card style={styles.summaryCard}>
        <Card.Content>
          <Title style={styles.summaryTitle}>Portfolio Summary</Title>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Invested:</Text>
            <Text style={styles.summaryValue}>${totalInvested.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Current Value:</Text>
            <Text style={styles.summaryValue}>${totalValue.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Return:</Text>
            <Text style={[styles.summaryValue, totalChange >= 0 ? styles.positive : styles.negative]}>
              {totalChange >= 0 ? '+' : ''}${totalChange.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Return %:</Text>
            <Text style={[styles.summaryValue, totalChangePercent >= 0 ? styles.positive : styles.negative]}>
              {totalChangePercent >= 0 ? '+' : ''}{totalChangePercent.toFixed(2)}%
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Button mode="contained" style={styles.addInvestmentButton} icon="plus">
        Add New Investment
      </Button>
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
  changeContainer: {
    marginTop: 8,
  },
  change: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: '#F44336',
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
  card: {
    marginBottom: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  investmentName: {
    fontSize: 18,
    marginBottom: 4,
  },
  chip: {
    alignSelf: 'flex-start',
  },
  valueContainer: {
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  progressBar: {
    marginTop: 8,
    marginBottom: 4,
  },
  invested: {
    fontSize: 12,
    color: '#666',
  },
  summaryCard: {
    marginBottom: 20,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  addInvestmentButton: {
    marginBottom: 20,
  },
});
