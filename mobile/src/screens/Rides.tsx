import React, { useEffect, useState } from 'react';
import { Alert, FlatList, SafeAreaView, Text, TouchableOpacity, View, Button, ActivityIndicator } from 'react-native';
import { fetchRides, takeRide, unassignRide } from '../lib/api';
import { getSupabaseClient } from '../lib/supabase';

export default function Rides() {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      setCurrentUserId(data.session?.user?.id ?? null);
      await load();
    })();
  }, []);

  const takeRideOptimistic = async (rideId: string) => {
    if (!currentUserId) return Alert.alert('Sign in required');
    const prev = rides.slice();
    const idx = rides.findIndex(r => r.id === rideId);
    if (idx === -1) return;
    const updated = { ...rides[idx], driver_profile_id: currentUserId, status: 'assigned', driver: { display_name: 'You' } };
    setRides([...rides.slice(0, idx), updated, ...rides.slice(idx + 1)]);
    try {
      await takeRide(rideId, currentUserId);
      await load();
    } catch (err: any) {
      setRides(prev);
      Alert.alert('Could not take ride', err.message || String(err));
    }
  };

  const unassignOptimistic = async (rideId: string) => {
    const prev = rides.slice();
    const idx = rides.findIndex(r => r.id === rideId);
    if (idx === -1) return;
    const updated = { ...rides[idx], driver_profile_id: null, status: 'open', driver: null };
    setRides([...rides.slice(0, idx), updated, ...rides.slice(idx + 1)]);
    try {
      await unassignRide(rideId);
      await load();
    } catch (err: any) {
      setRides(prev);
      Alert.alert('Could not unassign', err.message || String(err));
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7f3' }}>
      <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 20, fontWeight: '800' }}>Rides</Text>
        <Button title="Refresh" onPress={load} />
      </View>

      {rides.length === 0 ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#171a16' }}>No rides yet</Text>
          <Text style={{ marginTop: 6, color: '#58654c' }}>Create a ride request to get started.</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#dfe4d8' }}>
              <Text style={{ fontWeight: '800' }}>{item.title || item.event?.title || 'Ride request'}</Text>
              <Text style={{ color: '#58654c', marginTop: 6 }}>
                {item.event?.start ? new Date(item.event.start).toLocaleString() : (item.pickup_location || 'Pickup location not set')}
              </Text>
              <Text style={{ marginTop: 8 }}>{item.status || 'open'} {item.driver ? `· ${item.driver.display_name}` : ''}</Text>

              {!item.driver_profile_id ? (
                <TouchableOpacity style={{ marginTop: 10 }} onPress={() => takeRideOptimistic(item.id)}>
                  <Text style={{ color: '#356f28', fontWeight: '800' }}>Take this ride</Text>
                </TouchableOpacity>
              ) : (item.driver_profile_id === currentUserId) ? (
                <TouchableOpacity style={{ marginTop: 10 }} onPress={() => unassignOptimistic(item.id)}>
                  <Text style={{ color: '#b44', fontWeight: '700' }}>Unassign</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
