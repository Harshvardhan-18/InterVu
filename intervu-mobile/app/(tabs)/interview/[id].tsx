import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, FlatList, KeyboardAvoidingView,
  Platform, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, type Evaluation } from '../../../lib/api';
import { colors, spacing, radius, typography } from '../../../theme';

type Message = {
  role: 'interviewer' | 'user';
  content: string;
  evaluation?: Evaluation;
};

export default function InterviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const interviewId = Number(id);
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [complete, setComplete] = useState(false);
  const [expandedEval, setExpandedEval] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!interviewId) return;
    api.interviews.get(interviewId).then((data) => {
      const rebuilt: Message[] = [];
      for (const entry of data.history) {
        rebuilt.push({ role: 'interviewer', content: entry.question, evaluation: entry.evaluation ?? undefined });
        if (entry.answer !== null) rebuilt.push({ role: 'user', content: entry.answer });
      }
      setMessages(rebuilt);
      if (data.status === 'completed') setComplete(true);
    }).catch(console.error).finally(() => setLoadingInitial(false));
  }, [interviewId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [messages, submitting]);

  const scoreColor = (s: number) =>
    s >= 8 ? colors.success : s >= 6 ? colors.warning : colors.danger;

  const handleSubmit = async () => {
    if (!answer.trim() || submitting) return;
    const userMsg: Message = { role: 'user', content: answer };
    setMessages((prev) => [...prev, userMsg]);
    const submitted = answer;
    setAnswer('');
    setSubmitting(true);
    try {
      const res = await api.interviews.submitAnswer(interviewId, submitted);
      if (res.interview_complete || !res.next_question) {
        setMessages((prev) => [...prev, {
          role: 'interviewer',
          content: 'Thank you for completing the interview! Let me put together your feedback.',
          evaluation: res.evaluation,
        }]);
        setComplete(true);
      } else {
        const combined = res.next_acknowledgment
          ? `${res.next_acknowledgment} ${res.next_question}`
          : res.next_question;
        setMessages((prev) => [...prev, { role: 'interviewer', content: combined!, evaluation: res.evaluation }]);
      }
    } catch {
      setMessages((prev) => prev.slice(0, -1));
      setAnswer(submitted);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndEarly = async () => {
    if (ending) return;
    setEnding(true);
    try {
      await api.interviews.endEarly(interviewId);
      router.push(`/(tabs)/report/${interviewId}` as any);
    } catch { setEnding(false); }
  };

  if (loadingInitial) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>Loading interview…</Text>
      </SafeAreaView>
    );
  }

  const allData: (Message | 'typing')[] = submitting
    ? [...messages, 'typing']
    : messages;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/dashboard')} hitSlop={10}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Interview Session</Text>
        {!complete && (
          <TouchableOpacity onPress={handleEndEarly} disabled={ending || messages.length === 0}>
            <Text style={[styles.endBtn, (ending || messages.length === 0) && { opacity: 0.4 }]}>
              {ending ? 'Ending…' : 'End'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Chat */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={allData}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            if (item === 'typing') {
              return (
                <View style={styles.msgRow}>
                  <LinearGradient colors={['#4d8fa2', '#68a9ba']} style={styles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name="flash" size={11} color="#061014" />
                  </LinearGradient>
                  <View style={styles.typingBubble}>
                    <Text style={styles.typingText}>Evaluating</Text>
                    <View style={styles.typingDots}>
                      {[0, 1, 2].map((i) => <View key={i} style={styles.dot} />)}
                    </View>
                  </View>
                </View>
              );
            }
            const msg = item as Message;
            const i = index;
            return (
              <View style={{ marginBottom: spacing.lg }}>
                {msg.role === 'interviewer' ? (
                  <View>
                    <View style={styles.msgRow}>
                      <LinearGradient colors={['#4d8fa2', '#68a9ba']} style={styles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                        <Ionicons name="flash" size={11} color="#061014" />
                      </LinearGradient>
                      <Text style={styles.aiLabel}>AI Interviewer</Text>
                    </View>
                    <View style={styles.aiBubble}>
                      <Text style={styles.bubbleText}>{msg.content}</Text>
                    </View>
                    {msg.evaluation && (
                      <View style={styles.evalSection}>
                        <TouchableOpacity
                          onPress={() => setExpandedEval(expandedEval === i ? null : i)}
                          style={styles.evalBtn}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="bar-chart" size={13} color={colors.textMuted} />
                          <Text style={styles.evalBtnText}>Previous answer</Text>
                          <Text style={[styles.evalScore, { color: scoreColor(msg.evaluation.score) }]}>
                            {msg.evaluation.score}/10
                          </Text>
                          <Ionicons
                            name={expandedEval === i ? 'chevron-down' : 'chevron-forward'}
                            size={12} color={colors.textMuted}
                          />
                        </TouchableOpacity>
                        {expandedEval === i && (
                          <View style={styles.evalExpanded}>
                            <Text style={styles.evalFeedback}>{msg.evaluation.brief_feedback}</Text>
                            <View style={styles.evalGrid}>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.evalGridLabel, { color: colors.success }]}>Strengths</Text>
                                {msg.evaluation.strengths.map((s) => (
                                  <View key={s} style={styles.evalItem}>
                                    <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                                    <Text style={styles.evalItemText}>{s}</Text>
                                  </View>
                                ))}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.evalGridLabel, { color: colors.warning }]}>Improve</Text>
                                {msg.evaluation.weaknesses.map((w) => (
                                  <View key={w} style={styles.evalItem}>
                                    <View style={styles.weakDot} />
                                    <Text style={styles.evalItemText}>{w}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.userMsgContainer}>
                    <View style={styles.userBubble}>
                      <Text style={styles.bubbleText}>{msg.content}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
        />

        {/* Input area */}
        <View style={styles.inputArea}>
          {complete ? (
            <TouchableOpacity
              onPress={() => router.push(`/(tabs)/report/${interviewId}` as any)}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#4d8fa2', '#68a9ba']} style={styles.reportBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={styles.reportBtnText}>View Full Report</Text>
                <Ionicons name="arrow-forward" size={16} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                value={answer}
                onChangeText={setAnswer}
                placeholder="Type your answer…"
                placeholderTextColor={colors.textMuted}
                style={styles.textInput}
                multiline
              />
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!answer.trim() || submitting}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={answer.trim() && !submitting ? ['#4d8fa2', '#68a9ba'] : [colors.surface2, colors.surface2]}
                  style={styles.sendBtn}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="send" size={15} color={answer.trim() && !submitting ? 'white' : colors.textMuted} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  center: { flex: 1, backgroundColor: colors.bgBase, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { fontSize: typography.sm, color: colors.textMuted },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, height: 52,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surface1,
  },
  headerTitle: { fontSize: typography.sm + 0.5, fontWeight: '600', color: colors.textSecondary },
  endBtn: { fontSize: typography.sm, fontWeight: '600', color: colors.textMuted },
  chatContent: { padding: spacing.xl, paddingBottom: spacing.lg },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  avatar: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  aiLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7 },
  aiBubble: { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 4, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, padding: spacing.lg, marginLeft: 34 },
  userMsgContainer: { alignItems: 'flex-end' },
  userBubble: { backgroundColor: 'rgba(104,169,186,0.22)', borderWidth: 1, borderColor: 'rgba(104,169,186,0.3)', borderRadius: 18, borderTopRightRadius: 4, padding: spacing.md, maxWidth: '85%' },
  bubbleText: { fontSize: typography.base, color: colors.textPrimary, lineHeight: 22 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 12, padding: spacing.md },
  typingText: { fontSize: typography.sm, color: colors.textMuted },
  typingDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.textMuted },
  evalSection: { marginTop: spacing.sm, marginLeft: 34 },
  evalBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md, padding: spacing.md },
  evalBtnText: { flex: 1, fontSize: typography.xs + 0.5, color: colors.textSecondary, fontWeight: '500' },
  evalScore: { fontSize: typography.lg, fontWeight: '800' },
  evalExpanded: { marginTop: 6, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md, padding: spacing.md },
  evalFeedback: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },
  evalGrid: { flexDirection: 'row', gap: spacing.lg },
  evalGridLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm },
  evalItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 5 },
  evalItemText: { fontSize: typography.xs + 0.5, color: colors.textSecondary, lineHeight: 18, flex: 1 },
  weakDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: colors.warning, marginTop: 2 },
  inputArea: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.bgBase },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  textInput: { flex: 1, fontSize: typography.base, color: colors.textPrimary, lineHeight: 22, maxHeight: 160, paddingVertical: 0 },
  sendBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  reportBtn: { borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  reportBtnText: { fontSize: typography.md, fontWeight: '700', color: 'white' },
});
