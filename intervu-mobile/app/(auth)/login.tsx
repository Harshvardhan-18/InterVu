import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { colors, spacing, radius, typography } from '../../theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  const canSubmit = name.trim().length > 0 && email.trim().length > 0;

  const handleLogin = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      const result = await api.auth.login({ name: name.trim(), email: email.trim() });
      await login(result);
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      Alert.alert('Login Error', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        {/* Logo */}
        <View style={styles.logoRow}>
          <LinearGradient
            colors={['#4d8fa2', '#68a9ba']}
            style={styles.logoBox}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Ionicons name="flash" size={18} color="#061014" />
          </LinearGradient>
          <Text style={styles.logoText}>InterVu</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.heading}>Welcome</Text>
          <Text style={styles.subheading}>
            Enter your details to start or continue your interview prep.
          </Text>

          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Your Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Harsh"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, nameFocused && styles.inputFocused]}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              autoCapitalize="words"
            />
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="harsh@test.com"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, emailFocused && styles.inputFocused]}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              autoCapitalize="none"
              keyboardType="email-address"
              onSubmitEditing={handleLogin}
            />
          </View>

          {/* Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={canSubmit ? ['#4d8fa2', '#68a9ba'] : [colors.surface2, colors.surface2]}
              style={styles.button}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              {loading ? (
                <ActivityIndicator color="#061014" />
              ) : (
                <Text style={[styles.buttonText, !canSubmit && styles.buttonTextDisabled]}>
                  Get Started
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.hint}>
            No password needed. We use your email to keep your interviews saved across sessions.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginBottom: spacing.xxl,
    justifyContent: 'center',
  },
  logoBox: {
    width: 38,
    height: 38,
    borderRadius: radius.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#68a9ba',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: colors.surface1,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  heading: {
    fontSize: typography['2xl'],
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: typography.base,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.base,
    color: colors.textPrimary,
  },
  inputFocused: {
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  button: {
    borderRadius: radius.md,
    padding: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  buttonText: {
    fontSize: typography.base,
    fontWeight: '700',
    color: '#061014',
  },
  buttonTextDisabled: {
    color: colors.textMuted,
  },
  hint: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
