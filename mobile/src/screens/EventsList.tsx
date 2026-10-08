import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, Text, TouchableOpacity, View, StyleSheet, Button } from 'react-native';
import { fetchEvents } from '../lib/api';
import { useIsMounted } from '../utils/useIsMounted';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function EventsList() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isMounted = useIsMounted();
  const navigation = useNavigation<NavigationProp>();

  const load = useCallback(async () => {
    try {
      const res = await fetchEvents();
      if (isMounted.current) setEvents(res);
    } catch (e) {
      // ignore and keep demo data
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [isMounted]);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('EventDetail', { id: item.id })}>
      <View style={styles.cardLeft} />
      <View style={styles.cardBody}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>{item.team} · {new Date(item.start).toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7f3' }}>
      <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 20, fontWeight: '800' }}>Events</Text>
        <Button title="New" onPress={() => navigation.navigate('EventForm', {})} />
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : (
        <FlatList data={events} keyExtractor={(i) => String(i.id)} renderItem={renderItem} contentContainerStyle={{ padding: 16 }} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginBottom: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#dfe4d8' },
  cardLeft: { width: 8, height: 80, backgroundColor: '#9a78bf' },
  cardBody: { padding: 12, flex: 1 },
  title: { fontWeight: '800', fontSize: 16 },
  meta: { marginTop: 6, color: '#58654c' },
});
