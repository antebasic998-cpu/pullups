import {
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/ThemeContext';
import { Button } from './Button';
import { XIcon } from './Icons';

/**
 * Bare bottom sheet: dimmed backdrop, grabber, rounded top. The Log sheet and
 * every form dialog are built on it.
 */
export function SheetModal({
  visible,
  onClose,
  onShow,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  onShow?: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <RNModal visible={visible} animationType="slide" transparent onRequestClose={onClose} onShow={onShow}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.sheet, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 14) },
          ]}
        >
          <View style={[styles.grab, { backgroundColor: colors.surface3 }]} />
          {children}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

/** Title row with the round close button. */
export function SheetHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      <TouchableOpacity
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={[styles.close, { backgroundColor: colors.surface2, borderColor: colors.border }]}
      >
        <XIcon size={20} strokeWidth={2.2} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

interface ModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onShow?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AppModal({ visible, title, subtitle, onClose, onShow, children, footer }: ModalProps) {
  const { colors } = useTheme();
  return (
    <SheetModal visible={visible} onClose={onClose} onShow={onShow}>
      <SheetHeader title={title} subtitle={subtitle} onClose={onClose} />
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.body} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View> : null}
    </SheetModal>
  );
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  busy,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <AppModal
      visible={visible}
      title={title}
      onClose={onCancel}
      footer={
        <View style={styles.footerRow}>
          <Button label="Cancel" onPress={onCancel} disabled={busy} />
          <Button
            label={busy ? 'Working…' : confirmLabel}
            variant="danger"
            onPress={onConfirm}
            disabled={busy}
          />
        </View>
      }
    >
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, paddingBottom: 16 }}>{message}</Text>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  grab: { width: 40, height: 5, borderRadius: 9, alignSelf: 'center', marginBottom: 14 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 12.5, marginTop: 3 },
  close: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0, flexShrink: 1 },
  footer: { borderTopWidth: 1, paddingTop: 14, marginTop: 6 },
  footerRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
