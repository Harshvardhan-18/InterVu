import React, { useState } from 'react';
import {
  ScrollView, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AppShell from '../../components/layout/AppShell';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { colors, spacing, radius, typography } from '../../theme';

const COMPANIES = [
  { name: 'Google',    color: '#4285F4', initials: 'G'  },
  { name: 'Amazon',    color: '#FF9900', initials: 'A'  },
  { name: 'NVIDIA',    color: '#76B900', initials: 'N'  },
  { name: 'Meta',      color: '#0866FF', initials: 'M'  },
  { name: 'Microsoft', color: '#00A4EF', initials: 'MS' },
  { name: 'Apple',     color: '#A2AAAD', initials: 'AP' },
  { name: 'Stripe',    color: '#635BFF', initials: 'ST' },
  { name: 'Uber',      color: '#1D9BF0', initials: 'UB' },
];

const DIFFICULTIES = [
  { id: 'Easy',   label: 'Easy',   desc: 'Entry level, warming up',    color: '#22C55E' },
  { id: 'Medium', label: 'Medium', desc: 'Industry standard depth',    color: '#F59E0B' },
  { id: 'Hard',   label: 'Hard',   desc: 'FAANG senior-level rigor',   color: '#EF4444' },
];

const PIPELINE_STEPS = [
  { key: 'researching', label: 'Researching company & role' },
  { key: 'extracting',  label: 'Extracting interview patterns' },
  { key: 'building',    label: 'Building RAG knowledge base' },
  { key: 'generating',  label: 'Generating interview blueprint' },
];

const QUICK_ROLES = ['Software Engineer L3', 'SDE-1', 'PTX Compiler Intern', 'ML Engineer', 'Frontend Engineer'];

type Difficulty = 'Easy' | 'Medium' | 'Hard';
type PipelineKey = 'researching' | 'extracting' | 'building' | 'generating';

export default function NewInterviewScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [company, setCompany] = useState('');
  const [companyQuery, setCompanyQuery] = useState('');
  const [role, setRole] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [loading, setLoading] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<PipelineKey | null>(null);
  const [doneSteps, setDoneSteps] = useState<string[]>([]);

  const filteredCompanies = COMPANIES.filter((c) =>
    c.name.toLowerCase().includes(companyQuery.toLowerCase())
  );

  const canProceed = step === 1 ? !!company : step === 2 ? !!role : true;
  const stepDots = [{ n: 1, label: 'Company' }, { n: 2, label: 'Role' }, { n: 3, label: 'Difficulty' }, { n: 4, label: 'Generate' }];

  const handleStart = async () => {
    if (!company || !role || !user) return;
    setLoading(true);
    const steps: PipelineKey[] = ['researching', 'extracting', 'building', 'generating'];
    setPipelineStep(steps[0]);
    try {
      const resultPromise = api.interviews.start({
        user_id: user.user_id,
        username: user.name,
        company, role, difficulty,
      });
      for (let i = 1; i < steps.length; i++) {
        await new Promise((res) => setTimeout(res, 1500));
        setDoneSteps((prev) => [...prev, steps[i - 1]]);
        setPipelineStep(steps[i]);
      }
      const result = await resultPromise;
      setDoneSteps((prev) => [...prev, steps[steps.length - 1]]);
      router.push(`/(tabs)/interview/${result.interview_id}` as any);
    } catch {
      Alert.alert('Error', 'Failed to start interview. Please try again.');
      setLoading(false);
      setPipelineStep(null);
      setDoneSteps([]);
    }
  };

  return (
    <AppShell>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Back */}
        <TouchableOpacity
          onPress={() => step > 1 && !loading ? setStep((s) => s - 1) : router.push('/(tabs)/dashboard')}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={14} color={colors.textMuted} />
          <Text style={styles.backText}>{step > 1 && !loading ? 'Back' : 'Dashboard'}</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.title}>New Interview</Text>
        <Text style={styles.subtitle}>Set up a personalised interview session powered by real company data.</Text>

        {/* Step dots */}
        <View style={styles.stepper}>
          {stepDots.map((s, i) => (
            <React.Fragment key={s.n}>
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  step > s.n && styles.stepDotDone,
                  step === s.n && styles.stepDotActive,
                ]}>
                  {step > s.n
                    ? <Ionicons name="checkmark" size={12} color="white" />
                    : <Text style={[styles.stepNum, step >= s.n && { color: 'white' }]}>{s.n}</Text>
                  }
                </View>
                <Text style={[styles.stepLabel, step >= s.n && styles.stepLabelActive]}>{s.label}</Text>
              </View>
              {i < stepDots.length - 1 && (
                <View style={[styles.stepLine, step > s.n && styles.stepLineDone]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Step 1: Company */}
        {step === 1 && (
          <View>
            <Text style={styles.fieldLabel}>Target Company</Text>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={14} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
              <TextInput
                value={companyQuery}
                onChangeText={setCompanyQuery}
                placeholder="Search company…"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
            </View>
            <View style={styles.companyGrid}>
              {filteredCompanies.map((c) => {
                const selected = company === c.name;
                return (
                  <TouchableOpacity
                    key={c.name}
                    onPress={() => { setCompany(c.name); setCompanyQuery(c.name); }}
                    style={[styles.companyBtn, selected && styles.companyBtnSelected]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.companyBadge, { backgroundColor: `${c.color}18`, borderColor: `${c.color}28` }]}>
                      <Text style={[styles.companyInitial, { color: c.color }]}>{c.initials}</Text>
                    </View>
                    <Text style={[styles.companyName, selected && styles.companyNameSelected]}>{c.name}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={15} color={colors.accent} style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            {companyQuery && !COMPANIES.find((c) => c.name.toLowerCase() === companyQuery.toLowerCase()) && (
              <TouchableOpacity onPress={() => setCompany(companyQuery)} style={styles.customCompanyBtn}>
                <Ionicons name="add" size={14} color={colors.accent} />
                <Text style={styles.customCompanyText}>Use "{companyQuery}"</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Step 2: Role */}
        {step === 2 && (
          <View>
            <Text style={styles.fieldLabel}>Role / Position</Text>
            <TextInput
              value={role}
              onChangeText={setRole}
              placeholder="e.g. Software Engineer L3…"
              placeholderTextColor={colors.textMuted}
              style={styles.roleInput}
              autoFocus
            />
            <Text style={styles.hint}>Be specific — "SDE-1 Backend" gets better questions than "Engineer"</Text>
            <View style={styles.quickRoles}>
              {QUICK_ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRole(r)}
                  style={[styles.chip, role === r && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, role === r && styles.chipTextSelected]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 3: Difficulty */}
        {step === 3 && (
          <View>
            <Text style={styles.fieldLabel}>Select Difficulty</Text>
            {DIFFICULTIES.map((d) => {
              const selected = difficulty === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => setDifficulty(d.id as Difficulty)}
                  style={[styles.diffBtn, selected && { borderColor: `${d.color}40`, backgroundColor: `${d.color}0F` }]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.diffDot, { backgroundColor: `${d.color}18`, borderColor: `${d.color}28` }]}>
                    <View style={[styles.diffDotInner, { backgroundColor: d.color }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.diffLabel, selected && { color: d.color }]}>{d.label}</Text>
                    <Text style={styles.diffDesc}>{d.desc}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={selected ? d.color : colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Step 4: Review / Loading */}
        {step === 4 && (
          <View>
            {!loading ? (
              <View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Interview Summary</Text>
                  {[{ label: 'Company', value: company }, { label: 'Role', value: role }, { label: 'Difficulty', value: difficulty }].map((item) => (
                    <View key={item.label} style={styles.summaryRow}>
                      <Text style={styles.summaryKey}>{item.label}</Text>
                      <Text style={styles.summaryVal}>{item.value}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity onPress={handleStart} activeOpacity={0.85}>
                  <LinearGradient colors={['#4d8fa2', '#68a9ba']} style={styles.startBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={styles.startBtnText}>Generate Personalised Interview</Text>
                    <Ionicons name="arrow-forward" size={16} color="#061014" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.pipelineCard}>
                <LinearGradient colors={['#4d8fa2', '#68a9ba']} style={styles.pipelineIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <ActivityIndicator color="#061014" />
                </LinearGradient>
                <Text style={styles.pipelineTitle}>Building your interview…</Text>
                <Text style={styles.pipelineSub}>Researching {company} · {role}</Text>
                <View style={{ gap: spacing.lg, marginTop: spacing.xl }}>
                  {PIPELINE_STEPS.map(({ key, label }) => {
                    const isDone = doneSteps.includes(key);
                    const isActive = pipelineStep === key;
                    return (
                      <View key={key} style={styles.pipelineStep}>
                        <View style={[styles.pipelineStepIcon, isDone && styles.pipelineStepDone, isActive && styles.pipelineStepActive]}>
                          {isDone
                            ? <Ionicons name="checkmark" size={14} color={colors.success} />
                            : isActive
                            ? <ActivityIndicator size="small" color={colors.accent} />
                            : <Ionicons name="ellipse-outline" size={14} color={colors.textMuted} />
                          }
                        </View>
                        <View>
                          <Text style={[styles.pipelineStepLabel, isDone && { color: colors.success }, isActive && { color: colors.textPrimary }]}>{label}</Text>
                          {isActive && <Text style={styles.pipelineInProgress}>In progress…</Text>}
                          {isDone && <Text style={styles.pipelineComplete}>Complete</Text>}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Next button */}
        {step < 4 && !loading && (
          <TouchableOpacity
            onPress={() => canProceed && setStep((s) => s + 1)}
            disabled={!canProceed}
            activeOpacity={0.85}
            style={{ marginTop: spacing.xl }}
          >
            <LinearGradient
              colors={canProceed ? ['#4d8fa2', '#68a9ba'] : [colors.surface2, colors.surface2]}
              style={styles.nextBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Text style={[styles.nextBtnText, !canProceed && { color: colors.textMuted }]}>Continue</Text>
              <Ionicons name="chevron-forward" size={16} color={canProceed ? '#061014' : colors.textMuted} />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.xl, paddingBottom: 60 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xl },
  backText: { fontSize: typography.sm, color: colors.textMuted },
  title: { fontSize: typography['2xl'], fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: typography.sm + 0.5, color: colors.textSecondary, marginBottom: spacing.xxl },
  stepper: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxl },
  stepItem: { alignItems: 'center', gap: 5 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: colors.accentDim, borderColor: 'transparent', shadowColor: colors.accent, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  stepDotDone: { backgroundColor: colors.success, borderColor: 'transparent' },
  stepNum: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  stepLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, whiteSpace: 'nowrap' } as any,
  stepLabelActive: { color: colors.textSecondary },
  stepLine: { flex: 1, height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: spacing.xs, marginBottom: 16 },
  stepLineDone: { backgroundColor: 'rgba(34,197,94,0.4)' },
  fieldLabel: { fontSize: typography.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm, },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  searchInput: { flex: 1, fontSize: typography.base, color: colors.textPrimary, paddingVertical: spacing.md },
  companyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  companyBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, width: '47.5%', backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md, padding: spacing.md },
  companyBtnSelected: { backgroundColor: colors.accentMuted, borderColor: 'rgba(104,169,186,0.4)' },
  companyBadge: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  companyInitial: { fontSize: 12, fontWeight: '800' },
  companyName: { fontSize: typography.sm + 0.5, fontWeight: '500', color: colors.textSecondary, flex: 1 },
  companyNameSelected: { fontWeight: '600', color: colors.textPrimary },
  customCompanyBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  customCompanyText: { fontSize: typography.sm, color: colors.textSecondary },
  roleInput: { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md, padding: spacing.md, fontSize: typography.base, color: colors.textPrimary, marginBottom: spacing.sm },
  hint: { fontSize: typography.sm, color: colors.textMuted, marginBottom: spacing.md },
  quickRoles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 3 },
  chipSelected: { backgroundColor: colors.accentMuted, borderColor: 'rgba(104,169,186,0.35)' },
  chipText: { fontSize: typography.xs + 0.5, color: colors.textMuted },
  chipTextSelected: { color: colors.textSecondary },
  diffBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg + 2, borderRadius: radius.md + 2, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface1, marginBottom: spacing.sm },
  diffDot: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  diffDotInner: { width: 10, height: 10, borderRadius: 5 },
  diffLabel: { fontSize: typography.base, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  diffDesc: { fontSize: typography.sm, color: colors.textMuted },
  summaryCard: { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.xl },
  summaryTitle: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  summaryKey: { fontSize: typography.sm + 0.5, color: colors.textMuted },
  summaryVal: { fontSize: typography.sm + 0.5, fontWeight: '600', color: colors.textPrimary },
  startBtn: { borderRadius: radius.md + 2, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  startBtnText: { fontSize: typography.md, fontWeight: '700', color: '#061014' },
  pipelineCard: { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.xl, padding: spacing.xxl, alignItems: 'center' },
  pipelineIcon: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  pipelineTitle: { fontSize: typography.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  pipelineSub: { fontSize: typography.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  pipelineStep: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, width: '100%' },
  pipelineStepIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  pipelineStepDone: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.25)' },
  pipelineStepActive: { backgroundColor: colors.accentMuted, borderColor: colors.borderDefault },
  pipelineStepLabel: { fontSize: typography.sm + 0.5, fontWeight: '600', color: colors.textMuted },
  pipelineInProgress: { fontSize: 11, color: colors.accent, marginTop: 2 },
  pipelineComplete: { fontSize: 11, color: colors.success, marginTop: 2 },
  nextBtn: { borderRadius: radius.md, padding: spacing.md + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  nextBtnText: { fontSize: typography.base, fontWeight: '600', color: '#061014' },
});
