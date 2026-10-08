import React, { useState, useEffect } from 'react';
import { Alert, Button, SafeAreaView, StyleSheet, TextInput, View, Text, Platform } from 'react-native';
import { createEvent, updateEvent, fetchEventById } from '../lib/api';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function EventForm() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editingId: string | undefined = route.params?.id;

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
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
        setStartText(ev.start || '');
        setEndText(ev.end || '');
        setAthlete(ev.athlete || 'Avery');

        if (ev.start) setStartDate(new Date(ev.start));
        if (ev.end) setEndDate(new Date(ev.end));
      })
      .catch(() => {
        Alert.alert('Event load failed', 'This event could not be loaded.');
      })
      .finally(() => setLoading(false));
  }, [editingId]);

  const onStartChange = (event: any, selected?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selected) {
      setStartDate(selected);
      setStartText(selected.toISOString());
    }
  };

  const onEndChange = (event: any, selected?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selected) {
      setEndDate(selected);
      setEndText(selected.toISOString());
    }
  };

  const submit = async () => {
    try {
      const trimmedTitle = title.trim();
      const trimmedStart = startText.trim();
      const trimmedEnd = endText.trim();

      if (!trimmedTitle || !trimmedStart) {
        return Alert.alert('Missing fields', 'Please provide a title and start date.');
      }

      const payload: any = {
        title: trimmedTitle,
        location: location.trim() || undefined,
        start: trimmedStart,
        end: trimmedEnd || undefined,
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

        {Platform.OS === 'web' ? (
          <TextInput placeholder="Start (ISO timestamp)" value={startText} onChangeText={setStartText} style={styles.input} editable={!loading} />
        ) : (
          <View style={{ marginBottom: 12 }}>
            <Button title={startDate ? `Start: ${startDate.toLocaleString()}` : 'Pick start time'} onPress={() => setShowStartPicker(true)} />
            {showStartPicker && (
              <DateTimePicker value={startDate ?? new Date()} mode="datetime" display="default" onChange={onStartChange} />
            )}
          </View>
        )}

        {Platform.OS === 'web' ? (
          <TextInput placeholder="End (optional ISO timestamp)" value={endText} onChangeText={setEndText} style={styles.input} editable={!loading} />
        ) : (
          <View style={{ marginBottom: 12 }}>
            <Button title={endDate ? `End: ${endDate.toLocaleString()}` : 'Pick end time (optional)'} onPress={() => setShowEndPicker(true)} />
            {showEndPicker && (
              <DateTimePicker value={endDate ?? new Date()} mode="datetime" display="default" onChange={onEndChange} />
            )}
          </View>
        )}

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
