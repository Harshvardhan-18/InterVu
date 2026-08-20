import React, { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ScoreRing from '../../../components/ui/ScoreRing';
import { api, type ReportResponse } from '../../../lib/api';
import { colors, spacing, radius, typography } from '../../../theme';

const scoreColor = (s: number) =>
  s >= 8 ? colors.success : s >= 6 ? colors.warning : colors.danger;

const scoreBg = (s: number) =>
  s >= 8
    ? { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' }
    : s >= 6
    ? { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' }
    : { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' };

const gradeLabel = (score: number) =>
  score >= 90 ? 'Excellent' :
  score >= 76 ? 'Good' :
  score >= 61 ? 'Average' :
  score >= 41 ? 'Below Average' : 'Needs Work';

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const interviewId = Number(id);
  const router = useRouter();

  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!interviewId) return;
    api.reports.get(interviewId)
      .then(setReport)
      .catch(() => setError('Failed to load report. Please try again.'))
      .finally(() => setLoading(false));
  }, [interviewId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>Loading report…</Text>
      </SafeAreaView>
    );
  }

  if (error || !report) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Report not available.'}</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/dashboard')} style={styles.backBtnSm}>
          <Text style={styles.backBtnSmText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const sectionScores = Object.entries(report.report.section_scores);
  const date = new Date(report.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const grade = gradeLabel(report.overall_score);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/dashboard')} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>Dashboard</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Page header */}
        <View style={{ marginBottom: spacing.xl }}>
          <View style={styles.badgeRow}>
            <View style={styles.completeBadge}>
              <Text style={styles.completeBadgeText}>Interview Complete</Text>
            </View>
            <Text style={styles.dateText}>{date}</Text>
          </View>
          <Text style={styles.title}>Feedback Report</Text>
          <Text style={styles.subtitle}>{report.role} · {report.company}</Text>
        </View>

        {/* Hero score card */}
        <LinearGradient
          colors={['rgba(104,169,186,0.12)', 'rgba(104,169,186,0.06)', 'rgba(9,9,11,0)']}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <ScoreRing score={report.overall_score} size={140} strokeWidth={10} />
          <Text style={styles.heroTitle}>Overall Performance</Text>
          <View style={[styles.gradeBadge, { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.25)' }]}>
            <Text style={[styles.gradeBadgeText, { color: colors.success }]}>{grade}</Text>
          </View>
          <Text style={styles.summary}>{report.report.summary}</Text>
          <View style={styles.heroMeta}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.heroMetaVal}>{sectionScores.length}</Text>
              <Text style={styles.heroMetaLabel}>Sections</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Section breakdown */}
        {sectionScores.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="bar-chart" size={16} color={colors.accent} />
              <Text style={styles.cardTitle}>Section Breakdown</Text>
            </View>
            {sectionScores.map(([label, score]) => {
              const pct = (score / 10) * 100;
              const c = scoreColor(score);
              const { bg, border } = scoreBg(score);
              return (
                <View key={label} style={{ marginBottom: spacing.md }}>
                  <View style={styles.sectionRow}>
                    <Text style={styles.sectionLabel}>{label}</Text>
                    <View style={[styles.sectionBadge, { backgroundColor: bg, borderColor: border }]}>
                      <Text style={[styles.sectionBadgeText, { color: c }]}>{score.toFixed(1)}/10</Text>
                    </View>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: c }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Strong / Weak */}
        <View style={styles.gridRow}>
          {/* Strengths */}
          <View style={[styles.halfCard, { borderColor: 'rgba(34,197,94,0.15)' }]}>
            <View style={styles.halfCardHeader}>
              <View style={[styles.halfCardIcon, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                <Ionicons name="trending-up" size={14} color={colors.success} />
              </View>
              <Text style={[styles.halfCardTitle, { color: colors.success }]}>Strong Areas</Text>
            </View>
            {report.report.strong_topics.map((t) => (
              <View key={t} style={styles.topicRow}>
                <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                <Text style={styles.topicText}>{t}</Text>
              </View>
            ))}
          </View>

          {/* Weaknesses */}
          <View style={[styles.halfCard, { borderColor: 'rgba(239,68,68,0.15)' }]}>
            <View style={styles.halfCardHeader}>
              <View style={[styles.halfCardIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                <Ionicons name="alert-circle" size={14} color={colors.danger} />
              </View>
              <Text style={[styles.halfCardTitle, { color: colors.danger }]}>Improve</Text>
            </View>
            {report.report.weak_topics.map((t) => (
              <View key={t} style={styles.topicRow}>
                <View style={styles.weakDot} />
                <Text style={styles.topicText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recommendations */}
        {report.report.recommendations.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.halfCardIcon, { backgroundColor: colors.accentMuted }]}>
                <Ionicons name="book" size={14} color={colors.accent} />
              </View>
              <Text style={styles.cardTitle}>Recommendations</Text>
            </View>
            {report.report.recommendations.map((rec, i) => (
              <View key={i} style={styles.recRow}>
                <Ionicons name="chevron-forward" size={13} color={colors.accent} style={{ marginTop: 2, flexShrink: 0 }} />
                <Text style={styles.recText}>{rec}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <TouchableOpacity onPress={() => router.push('/(tabs)/new-interview')} activeOpacity={0.85} style={{ marginBottom: spacing.sm }}>
          <LinearGradient colors={['#4d8fa2', '#68a9ba']} style={styles.actionBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={styles.actionBtnText}>Start New Interview</Text>
            <Ionicons name="arrow-forward" size={15} color="white" />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(tabs)/dashboard')}
          style={styles.actionBtnSecondary}
          activeOpacity={0.75}
        >
          <Text style={styles.actionBtnSecondaryText}>Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  center: { flex: 1, backgroundColor: colors.bgBase, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { fontSize: typography.sm, color: colors.textMuted },
  errorText: { fontSize: typography.base, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.xl },
  backBtnSm: { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  backBtnSmText: { fontSize: typography.sm, fontWeight: '600', color: colors.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, height: 48, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, backgroundColor: colors.surface1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backText: { fontSize: typography.sm, color: colors.textMuted },
  scroll: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: 60 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  completeBadge: { backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  completeBadgeText: { fontSize: 11, fontWeight: '700', color: colors.success, textTransform: 'uppercase', letterSpacing: 0.7 },
  dateText: { fontSize: typography.sm, color: colors.textMuted },
  title: { fontSize: typography['2xl'], fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: typography.sm + 0.5, color: colors.textSecondary },
  heroCard: { borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(104,169,186,0.2)', padding: spacing.xl, alignItems: 'center', marginBottom: spacing.xl, gap: spacing.sm },
  heroTitle: { fontSize: typography.xl, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginTop: spacing.sm },
  gradeBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  gradeBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  summary: { fontSize: typography.base, color: colors.textSecondary, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
  heroMeta: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.sm },
  heroMetaVal: { fontSize: typography.xl, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  heroMetaLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  card: { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  cardTitle: { fontSize: typography.md, fontWeight: '700', color: colors.textPrimary },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionLabel: { fontSize: typography.sm + 0.5, fontWeight: '600', color: colors.textPrimary },
  sectionBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 2 },
  sectionBadgeText: { fontSize: typography.sm, fontWeight: '700' },
  barTrack: { height: 6, backgroundColor: colors.surface3, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  gridRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  halfCard: { flex: 1, backgroundColor: colors.surface1, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  halfCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  halfCardIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  halfCardTitle: { fontSize: typography.sm, fontWeight: '700' },
  topicRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: spacing.xs + 1 },
  topicText: { fontSize: typography.sm, fontWeight: '600', color: colors.textPrimary, flex: 1, lineHeight: 18 },
  weakDot: { width: 13, height: 13, borderRadius: 6.5, borderWidth: 1.5, borderColor: colors.danger, marginTop: 2.5, flexShrink: 0 },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surface2, borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
  recText: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20, flex: 1 },
  actionBtn: { borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  actionBtnText: { fontSize: typography.base, fontWeight: '700', color: 'white' },
  actionBtnSecondary: { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  actionBtnSecondaryText: { fontSize: typography.base, fontWeight: '600', color: colors.textSecondary },
});
