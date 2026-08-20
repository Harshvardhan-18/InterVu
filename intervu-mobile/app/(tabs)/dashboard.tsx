import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AppShell from '../../components/layout/AppShell';
import InterviewCard from '../../components/ui/InterviewCard';
import { api, type InterviewSummary } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { colors, spacing, radius, typography } from '../../theme';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInterviews = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      const data = await api.interviews.list(user.user_id);
      setInterviews(data);
    } catch (e) {
      console.error('Failed to fetch interviews:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.user_id]);

  useEffect(() => { fetchInterviews(); }, [fetchInterviews]);

  const onRefresh = () => { setRefreshing(true); fetchInterviews(); };

  const completed = interviews.filter((i) => i.score !== null);
  const avgScore = completed.length > 0
    ? Math.round(completed.reduce((a, i) => a + (i.score ?? 0), 0) / completed.length)
    : 0;
  const best = completed.length > 0
    ? [...completed].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
    : null;

  return (
    <AppShell>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user?.name}!</Text>
          <Text style={styles.subtitle}>Continue improving your interview readiness.</Text>
        </View>

        {/* Hero CTA card */}
        <LinearGradient
          colors={['rgba(104,169,186,0.15)', 'rgba(104,169,186,0.08)', 'rgba(9,9,11,0)']}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroRow}>
            <LinearGradient
              colors={['#4d8fa2', '#68a9ba']}
              style={styles.heroIcon}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Ionicons name="flash" size={20} color="#061014" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Ready to practice?</Text>
              <Text style={styles.heroSub}>Your next interview session is waiting.</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/new-interview')}
            style={styles.heroBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.heroBtnText}>Start Interview</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.textPrimary} />
          </TouchableOpacity>
        </LinearGradient>

        {/* Stat cards */}
        {!loading && interviews.length > 0 && (
          <View style={styles.statGrid}>
            <StatCard label="Total" value={String(interviews.length)} icon="mic" />
            <StatCard label="Avg Score" value={`${avgScore}/100`} icon="bar-chart" />
            {best && <StatCard label="Best" value={best.company} icon="trophy" color={colors.success} />}
            <StatCard label="Completed" value={String(completed.length)} icon="checkmark-circle" color={colors.success} />
          </View>
        )}

        {/* History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Interview History</Text>
            <Text style={styles.sectionCount}>{interviews.length} sessions</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
          ) : interviews.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No interviews yet. Start your first one above.</Text>
            </View>
          ) : (
            interviews.map((interview) => (
              <InterviewCard
                key={interview.id}
                interview={interview}
                onPress={() =>
                  router.push(
                    interview.status === 'completed'
                      ? `/(tabs)/report/${interview.id}` as any
                      : `/(tabs)/interview/${interview.id}` as any
                  )
                }
              />
            ))
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
}

function StatCard({ label, value, icon, color = colors.accent }: {
  label: string; value: string; icon: string; color?: string;
}) {
  return (
    <View style={statStyles.card}>
      <Ionicons name={icon as any} size={16} color={color} style={{ marginBottom: 6 }} />
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'flex-start',
  },
  value: {
    fontSize: typography.lg,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  label: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
});

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  header: { marginBottom: spacing.xl },
  greeting: { fontSize: typography.base, color: colors.textSecondary },
  name: { fontSize: typography['3xl'], fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, lineHeight: 36 },
  subtitle: { fontSize: typography.sm + 0.5, color: colors.textSecondary, marginTop: 4 },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(104,169,186,0.2)',
    marginBottom: spacing.xl,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  heroIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: typography.md, fontWeight: '700', color: colors.textPrimary },
  heroSub: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
  },
  heroBtnText: { fontSize: typography.sm + 0.5, fontWeight: '600', color: colors.textPrimary },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2, marginBottom: spacing.xl },
  section: {},
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: typography.md, fontWeight: '700', color: colors.textPrimary },
  sectionCount: { fontSize: typography.sm, color: colors.textMuted },
  empty: { padding: spacing.xxl, alignItems: 'center' },
  emptyText: { fontSize: typography.sm + 0.5, color: colors.textMuted, textAlign: 'center' },
});
