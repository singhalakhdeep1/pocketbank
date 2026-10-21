import React from 'react';
import { IconButton } from 'react-native-paper';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CardManager } from '@/components/CardManager';
import type { MainStackParamList, TabParamList } from '@/navigation/types';

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Cards'>, NativeStackScreenProps<MainStackParamList>>;

/** Physical debit cards; virtual cards have their own screen (header button). */
export default function CardsScreen({ navigation }: Props) {
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <IconButton icon="credit-card-multiple-outline" iconColor="#fff" onPress={() => navigation.navigate('VirtualCard')} testID="open-virtual-cards" />,
    });
  }, [navigation]);
  return <CardManager kind="PHYSICAL" />;
}
