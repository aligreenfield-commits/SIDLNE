import React, { useState, useEffect } from 'react';
import { Alert, Button, SafeAreaView, StyleSheet, TextInput, View, Text } from 'react-native';
import { createEvent, updateEvent, fetchEventById } from '../lib/api';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function EventForm() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route as any).params || {};
  const editingId: string | undefined = params.id;

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [start, setStart] = useState('');
  const [athlete, setAthlete] = useState('Avery');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingId) {
      setLoading(true);
      fetchEventById(editingId)
        .then((ev) => {
          if (ev) {
            setTitle(ev.title || '');
            setLocation(ev.location || '');
            setStart(ev.start || '');
            setAthlete(ev.athlete || 'Avery');
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [editingId]);

  const submit = async () => {
    try {
      if (!title || !start) return Alert.alert('Missing fields', 'Please provide a title and start date');
      setLoading(true);
      if (editingId) {
        await updateEvent(editingId, { title, location, start, athlete });
        navigation.navigate('EventDetail' as any, { id: editingId });
      } else {
        const ev = await createEvent({ title, location, start, athlete, team: 'Demo Team' });
        navigation.navigate('EventDetail' as any, { id: ev.id });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7f3' }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 12 }}>{editingId ? 'Edit event' : 'Add event'}</Text>
        <TextInput placeholder="Title" value={title} onChangeText={setTitle} style={styles.input} editable={!loading} />
        <TextInput placeholder="Location" value={location} onChangeText={setLocation} style={styles.input} editable={!loading} />
        <TextInput placeholder="Start (ISO)" value={start} onChangeText={setStart} style={styles.input} editable={!loading} />
        <TextInput placeholder="Athlete" value={athlete} onChangeText={setAthlete} style={styles.input} editable={!loading} />
        <Button title={loading ? 'Saving...' : 'Save'} onPress={submit} disabled={loading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ input: { backgroundColor: '#fff', borderColor: '#dfe4d8', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 12 } });
