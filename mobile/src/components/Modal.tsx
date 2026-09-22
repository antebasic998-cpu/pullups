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
import { useTheme } from '../lib/ThemeContext';

interface ModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AppModal({ visible, title, subtitle, onClose, children, footer }: ModalProps) {
  const { colors } = useTheme();
  return (
    <RNModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.close, { borderColor: colors.border }]}>
              <Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.body}>
            {children}
          </ScrollView>
          {footer ? <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
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
          <TouchableOpacity onPress={onCancel} disabled={busy} style={[styles.footerBtn, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onConfirm}
            disabled={busy}
            style={[styles.footerBtn, { backgroundColor: colors.danger, borderColor: colors.danger }]}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>{busy ? 'Working…' : confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>{message}</Text>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  header: { flexDirection: 'row', padding: 16, gap: 12, alignItems: 'flex-start' },
  title: { fontSize: 17, fontWeight: '600' },
  subtitle: { fontSize: 12, marginTop: 4 },
  close: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, maxHeight: 420 },
  footer: { borderTopWidth: 1, padding: 16 },
  footerRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  footerBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
