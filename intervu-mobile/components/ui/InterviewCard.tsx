import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import type { InterviewSummary } from '../../lib/api';

const COMPANY_COLORS: Record<string, string> = {
  Google: '#4285F4', Amazon: '#FF9900', Meta: '#0866FF',
  Microsoft: '#00A4EF', Apple: '#A2AAAD', NVIDIA: '#76B900',
  Stripe: '#635BFF', Uber: '#1D9BF0',
};

const STATUS_CONFIG = {
  completed:   { label: 'Completed',   bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)',   color: '#22C55E' },
  in_progress: { label: 'In Progress', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  color: '#F59E0B' },
  scheduled:   { label: 'Scheduled',   bg: 'rgba(104,169,186,0.1)', border: 'rgba(104,169,186,0.25)', color: '#68a9ba' },
};

interface InterviewCardProps {
  interview: InterviewSummary;
  onPress: () => void;
}

export default function InterviewCard({ interview, onPress }: InterviewCardProps) {
  const accentColor = COMPANY_COLORS[interview.company] ?? colors.accent;
  const status = STATUS_CONFIG[interview.status] ?? STATUS_CONFIG.in_progress;
  const date = new Date(interview.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.card}>
      <View style={styles.row}>
        {/* Company badge */}
        <View style={[styles.companyBadge, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}28` }]}>
          <Text style={[styles.companyInitial, { color: accentColor }]}>
            {interview.company.charAt(0)}
          </Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text style={styles.company} numberOfLines={1}>{interview.company}</Text>
            {interview.score !== null && (
              <Text style={[styles.score, { color: interview.score >= 70 ? colors.success : interview.score >= 50 ? colors.warning : colors.danger }]}>
                {interview.score}/100
              </Text>
            )}
          </View>
          <Text style={styles.role} numberOfLines={1}>{interview.role}</Text>
          <View style={styles.meta}>
            <Text style={styles.date}>{date}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bg, borderColor: status.border }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.sm + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  companyBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  companyInitial: {
    fontSize: typography.md,
    fontWeight: '800',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  company: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  score: {
    fontSize: typography.sm,
    fontWeight: '700',
  },
  role: {
    fontSize: typography.sm + 0.5,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  date: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  statusBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
