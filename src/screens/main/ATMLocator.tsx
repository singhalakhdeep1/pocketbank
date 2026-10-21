import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Searchbar, Text } from 'react-native-paper';
import * as Location from 'expo-location';
import { ChipGroup, Empty, ErrorBanner, Loading, Screen } from '@/components/ui';
import { bank } from '@/services/bank';
import { colors } from '@/theme';
import type { Location as BankLocation } from '@/types';

// Used when location permission is denied, so the list is still useful.
const CITIES = {
  'San Francisco': { lat: 37.788, lng: -122.407 },
  'New York': { lat: 40.758, lng: -73.985 },
  London: { lat: 51.514, lng: -0.093 },
  Delhi: { lat: 28.6315, lng: 77.2167 },
  Mumbai: { lat: 19.0544, lng: 72.8315 },
} as const;

const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export default function ATMLocator() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [source, setSource] = useState<string>('');
  const [type, setType] = useState<'all' | 'atm' | 'branch'>('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<BankLocation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const locate = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setSource('your location');
      setPermissionDenied(false);
    } catch {
      setPermissionDenied(true);
    }
  }, []);

  useEffect(() => {
    void locate();
  }, [locate]);

  useEffect(() => {
    if (!coords) return;
    setItems(null);
    bank
      .atms({ ...coords, type, radiusKm: 100 })
      .then((r) => (setItems(r), setError(null)))
      .catch((e: Error) => setError(e.message));
  }, [coords, type]);

  const directions = (l: BankLocation) => {
    const { lat, lng } = l.coordinates;
    const url = Platform.select({ ios: `maps:0,0?q=${encodeURIComponent(l.name)}@${lat},${lng}`, android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(l.name)})`, default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` });
    void Linking.openURL(url as string);
  };

  const filtered = (items ?? []).filter((l) => `${l.name} ${l.address}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <Screen testID="atms">
      <Searchbar placeholder="Search by name or address" value={query} onChangeText={setQuery} style={styles.search} />
      <ChipGroup options={['all', 'atm', 'branch'] as const} value={type} onChange={setType} labels={{ all: 'All', atm: 'ATMs', branch: 'Branches' }} />
      {permissionDenied || !coords ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.bold}>{permissionDenied ? 'Location is off' : 'Finding you…'}</Text>
            <Text style={styles.muted}>Allow location to see the nearest ATMs, or pick a city:</Text>
            <View style={styles.cities}>
              {(Object.keys(CITIES) as (keyof typeof CITIES)[]).map((c) => (
                <Chip key={c} onPress={() => (setCoords(CITIES[c]), setSource(c))} style={styles.city} testID={`city-${c}`}>
                  {c}
                </Chip>
              ))}
            </View>
            <Button icon="crosshairs-gps" onPress={locate}>
              Use my location
            </Button>
          </Card.Content>
        </Card>
      ) : null}
      <ErrorBanner error={error} />
      {coords && !items && !error ? <Loading label="Finding nearby locations…" /> : null}
      {items ? (
        <Text style={styles.muted}>
          {filtered.length} location{filtered.length === 1 ? '' : 's'} near {source}
        </Text>
      ) : null}
      {items && filtered.length === 0 ? <Empty icon="map-marker-off" title="Nothing within 100 km" /> : null}
      {filtered.map((l) => (
        <Card key={l.id} style={styles.card} testID={`atm-${l.id}`}>
          <Card.Title title={`${l.type === 'atm' ? '🏧' : '🏦'}  ${l.name}`} subtitle={l.address} right={() => <Chip compact style={{ marginRight: 12 }}>{formatDistance(l.distance)}</Chip>} />
          <Card.Content>
            <Text style={styles.muted}>Hours: {l.hours}</Text>
            <View style={styles.cities}>
              {l.services.map((s) => (
                <Chip key={s} compact style={styles.city} textStyle={{ fontSize: 11 }}>
                  {s}
                </Chip>
              ))}
            </View>
          </Card.Content>
          <Card.Actions>
            <Button icon="directions" onPress={() => directions(l)}>
              Directions
            </Button>
          </Card.Actions>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { backgroundColor: colors.surface, marginBottom: 8 },
  card: { marginBottom: 10, backgroundColor: colors.surface },
  bold: { fontWeight: '700' },
  muted: { color: colors.muted, marginBottom: 6 },
  cities: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 6 },
  city: { marginRight: 6, marginBottom: 6 },
});
