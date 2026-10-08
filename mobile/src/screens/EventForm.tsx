import React, { useEffect, useState } from 'react';
import { Alert, Button, SafeAreaView, StyleSheet, TextInput, View, Text } from 'react-native';
import { createEvent, updateEvent, fetchEventById } from '../lib/api';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function EventForm() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editingId: string | undefined = route.params?.id;

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [athlete, setAthlete] = useState('Avery');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!editingId) return;

    setLoading(true);
    fetchEventById(editingId)
      .then((ev) => {
        if (!ev) return;
        setTitle(ev.title || '');
        setLocation(ev.location || '');
        setStart(ev.start || '');
        setEnd(ev.end || '');
        setAthlete(ev.athlete || 'Avery');
      })
      .catch(() => {
        Alert.alert('Event load failed', 'This event could not be loaded.');
      })
      .finally(() => setLoading(false));
  }, [editingId]);

  const submit = async () => {
    try {
      const trimmedTitle = title.trim();
      const trimmedStart = start.trim();
      if (!trimmedTitle || !trimmedStart) {
        return Alert.alert('Missing fields', 'Please provide a title and start date.');
      }

      const payload = {
        title: trimmedTitle,
        location: location.trim(),
        start: trimmedStart,
        end: end.trim() || undefined,
        athlete: athlete.trim() || 'Avery',
        team: 'Demo Team',
      };

      setLoading(true);
      if (editingId) {
        await updateEvent(editingId, payload);
        navigation.navigate('EventDetail', { id: editingId });
      } else {
        const ev = await createEvent(payload);
        navigation.navigate('EventDetail', { id: ev.id });
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
        <TextInput placeholder="Start (ISO timestamp)" value={start} onChangeText={setStart} style={styles.input} editable={!loading} />
        <TextInput placeholder="End (optional ISO timestamp)" value={end} onChangeText={setEnd} style={styles.input} editable={!loading} />
        <TextInput placeholder="Athlete" value={athlete} onChangeText={setAthlete} style={styles.input} editable={!loading} />
        <Button title={loading ? 'Saving...' : 'Save'} onPress={submit} disabled={loading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#fff',
    borderColor: '#dfe4d8',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
});
