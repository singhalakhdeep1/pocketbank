import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';

interface ATM {
  id: string;
  name: string;
  type: 'atm' | 'branch';
  address: string;
  distance: number;
  hours: string;
  services: string[];
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface ATMLocatorProps {
  userId: string;
}

export function ATMLocator({ userId }: ATMLocatorProps) {
  const [atms, setAtms] = useState<ATM[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'atm' | 'branch'>('all');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchATMs();
    }
  }, [userLocation, selectedType]);

  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Location error:', error);
        setIsLoading(false);
      }
    );
  };

  const fetchATMs = async () => {
    if (!userLocation) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/atms?lat=${userLocation.lat}&lng=${userLocation.lng}&type=${selectedType}`
      );
      if (response.ok) {
        const data = await response.json();
        setAtms(data);
      }
    } catch (error) {
      console.error('Failed to fetch ATMs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDirections = (atm: ATM) => {
    const url = `https://maps.google.com/?q=${atm.coordinates.lat},${atm.coordinates.lng}`;
    // In a real app, you would open this in a webview or use Linking.openURL
    console.log('Open directions:', url);
  };

  const filteredATMs = atms.filter(atm =>
    atm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    atm.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Find ATM/Branch</Text>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name or address..."
        />
      </View>

      {/* Type Filter */}
      <View style={styles.filterContainer}>
        {(['all', 'atm', 'branch'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterButton,
              selectedType === type && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedType(type)}
          >
            <Text style={[
              styles.filterText,
              selectedType === type && styles.filterTextActive,
            ]}>
              {type === 'all' ? 'All' : type === 'atm' ? 'ATMs' : 'Branches'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Finding nearby locations...</Text>
        </View>
      ) : filteredATMs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No locations found</Text>
        </View>
      ) : (
        <>
          {/* Results Count */}
          <Text style={styles.resultsCount}>
            {filteredATMs.length} location{filteredATMs.length !== 1 ? 's' : ''} found
          </Text>

          {/* ATM List */}
          {filteredATMs.map((atm) => (
            <View key={atm.id} style={styles.atmCard}>
              <View style={styles.atmHeader}>
                <View style={styles.atmIcon}>
                  <Text style={styles.atmIconText}>
                    {atm.type === 'atm' ? '🏧' : '🏦'}
                  </Text>
                </View>
                <View style={styles.atmInfo}>
                  <Text style={styles.atmName}>{atm.name}</Text>
                  <Text style={styles.atmAddress}>{atm.address}</Text>
                </View>
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>{formatDistance(atm.distance)}</Text>
                </View>
              </View>

              <View style={styles.atmDetails}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Hours</Text>
                  <Text style={styles.detailValue}>{atm.hours}</Text>
                </View>

                <View style={styles.servicesContainer}>
                  <Text style={styles.servicesLabel}>Services</Text>
                  <View style={styles.servicesList}>
                    {atm.services.slice(0, 3).map((service) => (
                      <View key={service} style={styles.serviceTag}>
                        <Text style={styles.serviceText}>{service}</Text>
                      </View>
                    ))}
                    {atm.services.length > 3 && (
                      <Text style={styles.moreServices}>+{atm.services.length - 3}</Text>
                    )}
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.directionsButton}
                onPress={() => getDirections(atm)}
              >
                <Text style={styles.directionsButtonText}>🗺 Get Directions</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Location Permission Notice */}
      {!userLocation && !isLoading && (
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Location Required</Text>
          <Text style={styles.permissionText}>
            Enable location services to find nearby ATMs and branches
          </Text>
          <TouchableOpacity style={styles.enableButton} onPress={getCurrentLocation}>
            <Text style={styles.enableButtonText}>Enable Location</Text>
          </TouchableOpacity>
        </View>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#1f2937',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  resultsCount: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  atmCard: {
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
  atmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  atmIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  atmIconText: {
    fontSize: 24,
  },
  atmInfo: {
    flex: 1,
  },
  atmName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  atmAddress: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  distanceBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
  },
  atmDetails: {
    marginBottom: 12,
  },
  detailItem: {
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
  },
  servicesContainer: {
    marginTop: 8,
  },
  servicesLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  servicesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  serviceTag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  serviceText: {
    fontSize: 12,
    color: '#374151',
  },
  moreServices: {
    fontSize: 12,
    color: '#6b7280',
  },
  directionsButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  directionsButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  permissionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  enableButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 24,
  },
  enableButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
