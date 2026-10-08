import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, SafeAreaView, Text, View } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { deleteEvent, fetchEventById } from '../lib/api';

export default function EventDetail() {
  const route = useRoute();
  const navigation = useNavigation();
  const { id } = (route as any).params;
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const ev = await fetchEventById(id);
        setEvent(ev);
      } catch (err: any) {
        Alert.alert('Error', err.message || String(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const remove = async () => {
    Alert.alert('Delete event', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(id);
            navigation.navigate('Events' as any);
          } catch (e: any) {
            Alert.alert('Error', e.message || String(e));
          }
        },
      },
    ]);
  };

  if (loading) return <ActivityIndicator />;

  if (!event) return <SafeAreaView style={{ padding: 16 }}><Text>Event not found</Text></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7f3', padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: '800' }}>{event.title}</Text>
      <Text style={{ color: '#58654c', marginTop: 8 }}>{event.team}</Text>
      <Text style={{ marginTop: 12 }}>{new Date(event.start).toLocaleString()}</Text>
      <View style={{ marginTop: 20 }}>
        <Button title="Edit" onPress={() => navigation.navigate('EventForm' as any, { id: event.id })} />
      </View>
      <View style={{ marginTop: 12 }}>
        <Button title="Delete" color="#cc241a" onPress={remove} />
      </View>
    </SafeAreaView>
  );
}
