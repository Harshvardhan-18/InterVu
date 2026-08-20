import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Animated, Dimensions, TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sidebar from './Sidebar';
import { colors, spacing, typography } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = 260;

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export default function AppShell({ children, title }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const openSidebar = () => {
    setOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -SIDEBAR_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => setOpen(false));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={openSidebar} style={styles.hamburger} hitSlop={10}>
          <Ionicons name="menu" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.brand}>InterVu</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>

      {/* Sidebar overlay + drawer */}
      {open && (
        <TouchableWithoutFeedback onPress={closeSidebar}>
          <Animated.View
            style={[
              styles.overlay,
              { opacity: overlayAnim },
            ]}
          />
        </TouchableWithoutFeedback>
      )}

      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <Sidebar onClose={closeSidebar} />
        </SafeAreaView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surface1,
  },
  hamburger: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  brand: {
    fontSize: typography.base + 1,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    height: '100%',
    zIndex: 20,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 4, height: 0 },
    elevation: 12,
  },
});
