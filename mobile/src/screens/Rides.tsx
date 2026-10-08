import React, { useEffect, useState } from 'react';
import { Alert, FlatList, SafeAreaView, Text, TouchableOpacity, View, Button } from 'react-native';
import { fetchRides, assignDriver } from '../lib/api';
import { getSupabaseClient } from '../lib/supabase';

export default function Rides() {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetchRides();
      setRides(res || []);
    } catch (e: any) {
      Alert.alert('Could not load rides', e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const takeRide = async (rideId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user?.id) return Alert.alert('Sign in required');
      await assignDriver(rideId, sessionData.session.user.id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || String(e));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7f3' }}>
      <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 20, fontWeight: '800' }}>Rides</Text>
        <Button title="Refresh" onPress={load} />
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Loading rides…</Text></View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#dfe4d8' }}>
              <Text style={{ fontWeight: '800' }}>{item.title || 'Ride request'}</Text>
              <Text style={{ color: '#58654c', marginTop: 6 }}>{item.pickup_location || 'Pickup location not set'}</Text>
              <Text style={{ marginTop: 8 }}>{item.status || 'open'} {item.driver_profile_id ? `· assigned` : ''}</Text>
              {!item.driver_profile_id && (
                <TouchableOpacity style={{ marginTop: 10 }} onPress={() => takeRide(item.id)}>
                  <Text style={{ color: '#356f28', fontWeight: '800' }}>Take this ride</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
