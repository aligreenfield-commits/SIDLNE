import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sampleEvents, sampleTeams } from './src/data/sampleData';
import { getSupabaseClient } from './src/lib/supabase';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState(sampleEvents);
  const [selectedTab, setSelectedTab] = useState<'Overview' | 'Calendar' | 'Teams'>('Overview');

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.from('events').select('*').limit(10);

        if (!error && data && data.length > 0) {
          setEvents(data as any);
        }
      } catch (error) {
        // Gracefully fall back to demo data when Supabase is not configured yet.
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const upcoming = useMemo(
    () => events.filter((event) => new Date(event.start) > new Date()).slice(0, 3),
    [events]
  );

  const renderEvent = ({ item }: { item: (typeof sampleEvents)[number] }) => (
    <View style={styles.eventCard} key={item.id}>
      <View style={styles.eventBar} />
      <View style={styles.eventContent}>
        <Text style={styles.eventTime}>{item.time}</Text>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventMeta}>{item.team}</Text>
        <Text style={styles.eventMeta}>{item.location}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>SIDLNE</Text>
          <Text style={styles.demoTag}>PUBLIC DEMO</Text>
        </View>

        <View style={styles.topCard}>
          <Text style={styles.eyebrow}>UP NEXT</Text>
          <Text style={styles.topTitle}>{upcoming[0]?.title ?? 'Calendar ready'}</Text>
          <Text style={styles.topSubtitle}>{upcoming[0]?.time ?? 'No upcoming events yet'}</Text>
          <Text style={styles.topSubtitle}>{upcoming[0]?.location ?? 'Set up your family schedule'}</Text>
        </View>

        <View style={styles.tabRow}>
          {['Overview', 'Calendar', 'Teams'].map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tab, selectedTab === tab && styles.tabActive]}
              onPress={() => setSelectedTab(tab as typeof selectedTab)}
            >
              <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>{tab}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#c5f65a" />
            <Text style={styles.loadingText}>Loading family schedule...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {selectedTab === 'Overview' && (
              <>
                <Text style={styles.sectionTitle}>This week</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{upcoming.length}</Text>
                    <Text style={styles.statLabel}>upcoming</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{sampleTeams.length}</Text>
                    <Text style={styles.statLabel}>teams</Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Calendar</Text>
                <FlatList
                  data={upcoming}
                  renderItem={renderEvent}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </>
            )}

            {selectedTab === 'Calendar' && (
              <>
                <Text style={styles.sectionTitle}>Calendar</Text>
                <FlatList
                  data={events}
                  renderItem={renderEvent}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </>
            )}

            {selectedTab === 'Teams' && (
              <>
                <Text style={styles.sectionTitle}>Family teams</Text>
                {sampleTeams.map((team) => (
                  <View key={team.id} style={styles.teamCard}>
                    <Text style={styles.teamName}>{team.name}</Text>
                    <Text style={styles.teamMeta}>{team.athlete}</Text>
                    <Text style={styles.teamMeta}>{team.sport}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#171a16',
  },
  container: {
    flex: 1,
    backgroundColor: '#f6f7f3',
  },
  header: {
    backgroundColor: '#171a16',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  brand: {
    color: '#c5f65a',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  demoTag: {
    backgroundColor: '#1f2918',
    color: '#c5f65a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4d5c44',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  topCard: {
    margin: 18,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#171a16',
  },
  eyebrow: {
    color: '#c5f65a',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  topTitle: {
    color: '#fff',
    marginTop: 16,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  topSubtitle: {
    color: '#dfe4d8',
    marginTop: 8,
    fontSize: 14,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#edf1e8',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#171a16',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5e6857',
  },
  tabTextActive: {
    color: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  loadingBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#58654c',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 12,
    color: '#171a16',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#eef3e8',
    borderWidth: 1,
    borderColor: '#dfe8d5',
  },
  statValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#171a16',
    letterSpacing: -1,
  },
  statLabel: {
    marginTop: 6,
    fontSize: 12,
    color: '#58654c',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dfe4d8',
    marginBottom: 12,
    overflow: 'hidden',
  },
  eventBar: {
    width: 6,
    height: 88,
    backgroundColor: '#9a78bf',
  },
  eventContent: {
    flex: 1,
    padding: 14,
  },
  eventTime: {
    fontSize: 16,
    fontWeight: '800',
    color: '#171a16',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#171a16',
    marginTop: 4,
  },
  eventMeta: {
    fontSize: 12,
    color: '#58654c',
    marginTop: 4,
  },
  teamCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dfe4d8',
    marginBottom: 12,
  },
  teamName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#171a16',
  },
  teamMeta: {
    fontSize: 12,
    color: '#58654c',
    marginTop: 4,
  },
});
