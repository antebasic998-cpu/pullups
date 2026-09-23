import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline,
  autoFocus,
  inputRef,
  returnKeyType,
  onSubmitEditing,
  showSoftInputOnFocus = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  multiline?: boolean;
  autoFocus?: boolean;
  inputRef?: React.Ref<TextInput>;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  showSoftInputOnFocus?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType}
        multiline={multiline}
        autoFocus={autoFocus}
        showSoftInputOnFocus={showSoftInputOnFocus}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={[
          styles.input,
          multiline && styles.multiline,
          { color: colors.text, backgroundColor: colors.surface2, borderColor: colors.border },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
});
