import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SignIn from '../screens/SignIn';
import EventsList from '../screens/EventsList';
import EventForm from '../screens/EventForm';
import EventDetail from '../screens/EventDetail';
import Rides from '../screens/Rides';
import ProfileSetup from '../screens/ProfileSetup';
import { getSupabaseClient } from '../lib/supabase';
import { getProfile } from '../lib/profile';

export type RootStackParamList = {
  SignIn: undefined;
  ProfileSetup: undefined;
  Events: undefined;
  EventForm: { id?: string } | undefined;
  EventDetail: { id: string };
  Rides: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);

      if (data.session?.user?.id) {
        try {
          const p = await getProfile(data.session.user.id);
          setProfile(p ?? null);
        } catch (e) {
          setProfile(null);
        }
      }

      setLoading(false);
    };
    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s?.session ?? null);
      if (s?.session?.user?.id) {
        getProfile(s.session.user.id).then((p) => setProfile(p ?? null)).catch(() => setProfile(null));
      } else {
        setProfile(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!session ? (
          <Stack.Screen name="SignIn" component={SignIn} options={{ headerShown: false }} />
        ) : !profile ? (
          <Stack.Screen name="ProfileSetup" component={ProfileSetup} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Events" component={EventsList} options={{ title: 'Your Schedule' }} />
            <Stack.Screen name="EventForm" component={EventForm} options={{ title: 'Add / Edit Event' }} />
            <Stack.Screen name="EventDetail" component={EventDetail} options={{ title: 'Event' }} />
            <Stack.Screen name="Rides" component={Rides} options={{ title: 'Rides' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
