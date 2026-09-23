import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Card, Muted, SectionTitle } from '../components/Bits';
import { useSettings } from '../lib/SettingsContext';
import { useTheme } from '../lib/ThemeContext';

export function SettingsScreen() {
  const { colors } = useTheme();
  const { celebrationsEnabled, setCelebrationsEnabled } = useSettings();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      <Muted>Personal preferences — stored on this device only.</Muted>

      <Card style={styles.card}>
        <SectionTitle>Gamification</SectionTitle>
        <View style={[styles.row, { borderTopColor: colors.border }]}>
          <View style={styles.copy}>
            <Text style={[styles.label, { color: colors.text }]}>XP & achievement animations</Text>
            <Text style={[styles.hint, { color: colors.muted }]}>
              Show the full-screen celebration when you log a result, earn XP, level up, or unlock a badge.
            </Text>
          </View>
          <Switch
            value={celebrationsEnabled}
            onValueChange={setCelebrationsEnabled}
            trackColor={{ false: colors.surface3, true: colors.accent }}
            thumbColor={celebrationsEnabled ? colors.accentInk : colors.muted}
          />
        </View>
      </Card>

      {!celebrationsEnabled ? (
        <Text style={[styles.note, { color: colors.faint }]}>
          Celebrations are off — you'll get a short toast after logging instead.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  card: { padding: 14, gap: 10, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  copy: { flex: 1, gap: 4 },
  label: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 17 },
  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: 2 },
});
