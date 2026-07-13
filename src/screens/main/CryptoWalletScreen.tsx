import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, Searchbar, SegmentedButtons } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  balance: number;
  value: number;
  change24h: number;
  change7d: number;
}

export default function CryptoWalletScreen() {
  const [selectedTab, setSelectedTab] = useState('portfolio');
  const [searchQuery, setSearchQuery] = useState('');

  const [assets, setAssets] = useState<CryptoAsset[]>([
    { id: '1', symbol: 'BTC', name: 'Bitcoin', balance: 0.05, value: 2500, change24h: 2.5, change7d: 5.2 },
    { id: '2', symbol: 'ETH', name: 'Ethereum', balance: 1.5, value: 3000, change24h: -1.2, change7d: 3.8 },
    { id: '3', symbol: 'SOL', name: 'Solana', balance: 10, value: 1500, change24h: 4.8, change7d: 12.5 },
    { id: '4', symbol: 'USDC', name: 'USD Coin', balance: 500, value: 500, change24h: 0.01, change7d: 0.02 },
  ]);

  const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);

  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [6500, 6800, 7200, 7000, 7500, 7800, 7500],
        color: (opacity = 1) => `rgba(255, 193, 7, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.title}>Crypto Wallet</Title>
        <Paragraph style={styles.subtitle}>Manage your digital assets</Paragraph>
      </View>

      <SegmentedButtons
        value={selectedTab}
        onValueChange={setSelectedTab}
        buttons={[
          { value: 'portfolio', label: 'Portfolio' },
          { value: 'market', label: 'Market' },
          { value: 'transactions', label: 'Transactions' },
        ]}
        style={styles.segmentedButtons}
      />

      {selectedTab === 'portfolio' && (
        <>
          <Card style={styles.totalCard}>
            <Card.Content>
              <Paragraph style={styles.totalLabel}>Total Portfolio Value</Paragraph>
              <Title style={styles.totalValue}>${totalValue.toLocaleString()}</Title>
              <View style={styles.changeRow}>
                <Chip icon="trending-up" mode="flat" style={styles.positiveChip}>+5.2% (7d)</Chip>
              </View>
            </Card.Content>
          </Card>

          <Card style={styles.chartCard}>
            <Card.Content>
              <Title style={styles.chartTitle}>Portfolio Performance</Title>
              <LineChart
                data={chartData}
                width={screenWidth - 40}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(255, 193, 7, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                }}
                bezier
                style={styles.chart}
              />
            </Card.Content>
          </Card>

          <Searchbar
            placeholder="Search assets"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchbar}
          />

          <Title style={styles.sectionTitle}>Your Assets</Title>
          {filteredAssets.map((asset) => (
            <Card key={asset.id} style={styles.assetCard}>
              <Card.Content>
                <View style={styles.assetHeader}>
                  <View>
                    <Title style={styles.assetSymbol}>{asset.symbol}</Title>
                    <Paragraph style={styles.assetName}>{asset.name}</Paragraph>
                  </View>
                  <View style={styles.assetValueContainer}>
                    <Text style={styles.assetValue}>${asset.value.toLocaleString()}</Text>
                    <Text style={styles.assetBalance}>{asset.balance} {asset.symbol}</Text>
                  </View>
                </View>
                <View style={styles.changeRow}>
                  <Chip
                    mode="flat"
                    style={[asset.change24h >= 0 ? styles.positiveChip : styles.negativeChip]}
                  >
                    24h: {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
                  </Chip>
                  <Chip
                    mode="flat"
                    style={[asset.change7d >= 0 ? styles.positiveChip : styles.negativeChip]}
                  >
                    7d: {asset.change7d >= 0 ? '+' : ''}{asset.change7d}%
                  </Chip>
                </View>
              </Card.Content>
              <Card.Actions>
                <Button mode="contained">Buy</Button>
                <Button mode="outlined">Sell</Button>
                <Button mode="text">Send</Button>
              </Card.Actions>
            </Card>
          ))}

          <Button mode="contained" style={styles.addAssetButton} icon="plus">
            Add New Asset
          </Button>
        </>
      )}

      {selectedTab === 'market' && (
        <>
          <Title style={styles.sectionTitle}>Market Overview</Title>
          <Card style={styles.marketCard}>
            <Card.Content>
              <View style={styles.marketRow}>
                <Title style={styles.marketSymbol}>BTC</Title>
                <Text style={styles.marketPrice}>$50,234.50</Text>
                <Chip mode="flat" style={styles.positiveChip}>+2.5%</Chip>
              </View>
              <View style={styles.marketRow}>
                <Title style={styles.marketSymbol}>ETH</Title>
                <Text style={styles.marketPrice}>$2,045.30</Text>
                <Chip mode="flat" style={styles.negativeChip}>-1.2%</Chip>
              </View>
              <View style={styles.marketRow}>
                <Title style={styles.marketSymbol}>SOL</Title>
                <Text style={styles.marketPrice}>$145.80</Text>
                <Chip mode="flat" style={styles.positiveChip}>+4.8%</Chip>
              </View>
            </Card.Content>
          </Card>
        </>
      )}

      {selectedTab === 'transactions' && (
        <>
          <Title style={styles.sectionTitle}>Recent Transactions</Title>
          <Card style={styles.transactionCard}>
            <Card.Content>
              <View style={styles.transactionRow}>
                <View>
                  <Title style={styles.transactionTitle}>Buy BTC</Title>
                  <Paragraph style={styles.transactionDate}>Today, 2:30 PM</Paragraph>
                </View>
                <Text style={[styles.transactionAmount, styles.negative]}>-$500.00</Text>
              </View>
              <View style={styles.transactionRow}>
                <View>
                  <Title style={styles.transactionTitle}>Sell ETH</Title>
                  <Paragraph style={styles.transactionDate}>Yesterday, 10:15 AM</Paragraph>
                </View>
                <Text style={[styles.transactionAmount, styles.positive]}>+$1,200.00</Text>
              </View>
              <View style={styles.transactionRow}>
                <View>
                  <Title style={styles.transactionTitle}>Receive SOL</Title>
                  <Paragraph style={styles.transactionDate}>2 days ago</Paragraph>
                </View>
                <Text style={[styles.transactionAmount, styles.positive]}>+10 SOL</Text>
              </View>
            </Card.Content>
          </Card>
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
  segmentedButtons: {
    marginBottom: 20,
  },
  totalCard: {
    marginBottom: 20,
    elevation: 2,
    backgroundColor: '#FFC107',
  },
  totalLabel: {
    fontSize: 14,
    color: '#333',
  },
  totalValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  changeRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  positiveChip: {
    backgroundColor: '#E8F5E9',
  },
  negativeChip: {
    backgroundColor: '#FFEBEE',
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
  searchbar: {
    marginBottom: 20,
    elevation: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  assetCard: {
    marginBottom: 12,
    elevation: 2,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  assetSymbol: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  assetName: {
    fontSize: 14,
    color: '#666',
  },
  assetValueContainer: {
    alignItems: 'flex-end',
  },
  assetValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  assetBalance: {
    fontSize: 12,
    color: '#666',
  },
  addAssetButton: {
    marginBottom: 20,
  },
  marketCard: {
    marginBottom: 20,
    elevation: 2,
  },
  marketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  marketSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  marketPrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionCard: {
    marginBottom: 20,
    elevation: 2,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  transactionTitle: {
    fontSize: 16,
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: '#F44336',
  },
});
