import React, { useState } from 'react';
import { Alert, Button, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getSupabaseClient } from '../lib/supabase';

export default function RideCreate() {
  const [title, setTitle] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user?.id) {
        return Alert.alert('Sign in required');
      }

      const { error } = await supabase.from('rides').insert({
        title: title || 'Ride request',
        pickup_location: pickupLocation || 'Not set',
        notes,
        status: 'open',
        event_id: null,
      });

      if (error) throw error;
      Alert.alert('Ride added', 'Your ride request is now waiting for a driver.');
      setTitle('');
      setPickupLocation('');
      setNotes('');
    } catch (e: any) {
      Alert.alert('Error', e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7f3' }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 12 }}>Request a ride</Text>
        <TextInput placeholder="Ride title" value={title} onChangeText={setTitle} style={styles.input} />
        <TextInput placeholder="Pickup location" value={pickupLocation} onChangeText={setPickupLocation} style={styles.input} />
        <TextInput placeholder="Notes" value={notes} onChangeText={setNotes} style={styles.input} multiline />
        <Button title={loading ? 'Saving...' : 'Create ride request'} onPress={submit} disabled={loading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: '#fff', borderColor: '#dfe4d8', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 12 },
});
