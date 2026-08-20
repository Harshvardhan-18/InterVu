import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth-context';
import { colors, spacing, radius, typography } from '../../theme';

const NAV_ITEMS = [
  { href: '/(tabs)/dashboard',      label: 'Dashboard',       icon: 'grid-outline' as const,     activeIcon: 'grid' as const },
  { href: '/(tabs)/new-interview',  label: 'New Interview',   icon: 'mic-outline' as const,      activeIcon: 'mic' as const },
];

interface SidebarProps {
  onClose: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleNav = (href: string) => {
    onClose();
    router.push(href as any);
  };

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      {/* Logo + Close */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => handleNav('/(tabs)/dashboard')}
          style={styles.logoRow}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#4d8fa2', '#68a9ba']}
            style={styles.logoBox}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Ionicons name="flash" size={16} color="#061014" />
          </LinearGradient>
          <Text style={styles.logoText}>InterVu</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Nav */}
      <View style={styles.nav}>
        <Text style={styles.navLabel}>Navigation</Text>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href.replace('/(tabs)', ''));
          return (
            <TouchableOpacity
              key={item.href}
              onPress={() => handleNav(item.href)}
              style={[styles.navItem, isActive && styles.navItemActive]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={17}
                color={isActive ? colors.accent : colors.textSecondary}
              />
              <Text style={[styles.navLabel2, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
              {isActive && (
                <Ionicons name="chevron-forward" size={12} color={colors.accent} style={{ marginLeft: 'auto' }} />
              )}
            </TouchableOpacity>
          );
        })}

        {/* Disabled items */}
        {[{ label: 'Reports', icon: 'document-text-outline' as const }, { label: 'Settings', icon: 'settings-outline' as const }].map((item) => (
          <View key={item.label} style={[styles.navItem, styles.navItemDisabled]}>
            <Ionicons name={item.icon} size={17} color={colors.textMuted} />
            <Text style={[styles.navLabel2, styles.navLabelDisabled]}>{item.label}</Text>
            <View style={styles.soonBadge}>
              <Text style={styles.soonText}>Soon</Text>
            </View>
          </View>
        ))}
      </View>

      {/* User footer */}
      <View style={styles.footer}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) ?? 'U'}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.userName} numberOfLines={1}>{user?.name ?? 'User'}</Text>
          <Text style={styles.userPlan}>Free Plan</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} hitSlop={10}>
          <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 260,
    height: '100%',
    backgroundColor: colors.surface1,
    borderRightWidth: 1,
    borderRightColor: colors.borderSubtle,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  nav: {
    flex: 1,
    padding: spacing.md,
    paddingTop: spacing.md,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    padding: spacing.sm + 1,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md - 2,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.borderDefault,
  },
  navItemDisabled: {
    opacity: 0.45,
  },
  navLabel2: {
    fontSize: typography.sm + 1.5,
    fontWeight: '500',
    color: colors.textSecondary,
    flex: 1,
  },
  navLabelActive: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  navLabelDisabled: {
    color: colors.textMuted,
  },
  soonBadge: {
    backgroundColor: colors.accentMuted,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  soonText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    padding: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.sm,
    fontWeight: '700',
    color: '#061014',
  },
  userName: {
    fontSize: typography.sm + 0.5,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  userPlan: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
});
