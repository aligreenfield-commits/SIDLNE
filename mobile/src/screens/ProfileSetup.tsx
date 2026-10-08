import React, { useEffect, useState } from 'react';
import { Alert, Button, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getSupabaseClient } from '../lib/supabase';
import { upsertProfile, createHouseholdWithMember, joinHouseholdById } from '../lib/profile';
import { useNavigation } from '@react-navigation/native';

export default function ProfileSetup() {
  const [displayName, setDisplayName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [joinHouseholdId, setJoinHouseholdId] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    const fillEmailFromSession = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user;
      if (user && user.email) {
        setDisplayName(user.user_metadata?.full_name || user.email.split('@')[0]);
      }
    };
    fillEmailFromSession();
  }, []);

  const submit = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: sdata } = await supabase.auth.getSession();
      const user = sdata?.session?.user;
      if (!user) return Alert.alert('Not signed in', 'Please sign in first');

      await upsertProfile({ id: user.id, display_name: displayName, email: user.email || '' });

      if (householdName.trim()) {
        await createHouseholdWithMember(householdName.trim(), user.id);
      } else if (joinHouseholdId.trim()) {
        await joinHouseholdById(joinHouseholdId.trim(), user.id);
      }

      // Navigate to main events screen
      navigation.reset({ index: 0, routes: [{ name: 'Events' as any }] });
    } catch (e: any) {
      Alert.alert('Error', e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome — set up your profile</Text>
        <Text style={styles.hint}>This info stays in your family group and is used for invites and ride assignments.</Text>
        <TextInput placeholder="Display name" value={displayName} onChangeText={setDisplayName} style={styles.input} />
        <Text style={{ marginTop: 8, fontWeight: '700' }}>Household (optional)</Text>
        <TextInput placeholder="Create household (e.g. Greenfield Family)" value={householdName} onChangeText={setHouseholdName} style={styles.input} />
        <Text style={{ textAlign: 'center', marginVertical: 6 }}>— or —</Text>
        <TextInput placeholder="Join household (paste household id)" value={joinHouseholdId} onChangeText={setJoinHouseholdId} style={styles.input} />
        <View style={{ marginTop: 12 }}>
          <Button title={loading ? 'Saving...' : 'Save and continue'} onPress={submit} disabled={loading} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7f3' },
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: '900', color: '#171a16', marginBottom: 8 },
  hint: { color: '#58654c', marginBottom: 12 },
  input: { backgroundColor: '#fff', borderColor: '#dfe4d8', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 12 }
});
