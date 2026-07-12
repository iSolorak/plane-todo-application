import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme";

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  secureTextEntry?: boolean;
  keyboardType?: "default" | "url";
  autoFocus?: boolean;
  autoCorrect?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  minHeight?: number;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  autoCapitalize = "none",
  secureTextEntry,
  keyboardType = "default",
  autoFocus,
  autoCorrect = false,
  multiline,
  numberOfLines,
  minHeight,
}: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? "top" : "center"}
        scrollEnabled={multiline}
        style={[
          styles.input,
          multiline ? styles.inputMultiline : null,
          minHeight ? { minHeight } : null,
          error ? styles.inputError : null,
        ]}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { ...typography.caption, color: colors.text, fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  inputMultiline: {
    lineHeight: 22,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  inputError: { borderColor: colors.red },
  error: { ...typography.caption, color: colors.red },
});
