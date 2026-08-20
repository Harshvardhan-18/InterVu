import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography } from '../../theme';

interface ScoreRingProps {
  score: number;    // 0–100
  size?: number;
  strokeWidth?: number;
}

export default function ScoreRing({ score, size = 120, strokeWidth = 8 }: ScoreRingProps) {
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? colors.success :
    score >= 65 ? colors.warning :
    colors.danger;

  const grade =
    score >= 85 ? 'Excellent' :
    score >= 70 ? 'Good' :
    score >= 55 ? 'Average' :
    'Needs Work';

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </Svg>
        {/* Center text */}
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={[styles.scoreText, { color, fontSize: size >= 120 ? 28 : 20 }]}>
            {score}
          </Text>
          {size >= 100 && (
            <Text style={styles.outOf}>/100</Text>
          )}
        </View>
      </View>

      {/* Grade badge */}
      <View style={[styles.badge, { backgroundColor: `${color}18`, borderColor: `${color}30` }]}>
        <Text style={[styles.badgeText, { color }]}>{grade}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -1,
  },
  outOf: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
});
