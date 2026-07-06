import { useMemo, useState } from "react";
import React, { ReactNode } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TextInputProps,
  ViewStyle,
  StyleProp,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";
import { Ionicons } from "@expo/vector-icons";

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  testID,
  fullWidth = true,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
  fullWidth?: boolean;
}) {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const isDisabled = disabled || loading;
  const styleMap = {
    primary: { bg: Colors.primary, fg: "#fff", border: Colors.primary },
    outline: { bg: "transparent", fg: Colors.primary, border: Colors.primary },
    ghost: { bg: "transparent", fg: Colors.primary, border: "transparent" },
    danger: { bg: Colors.error, fg: "#fff", border: Colors.error },
  }[variant];

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.btn,
        {
          backgroundColor: styleMap.bg,
          borderColor: styleMap.border,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={styleMap.fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon && <Ionicons name={icon} size={18} color={styleMap.fg} />}
          <Text style={[styles.btnText, { color: styleMap.fg }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function Input({
  label,
  error,
  containerStyle,
  isPassword,
  ...rest
}: TextInputProps & { label?: string; error?: string; containerStyle?: StyleProp<ViewStyle>; isPassword?: boolean }) {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const [showPwd, setShowPwd] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, containerStyle]}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <TextInput
          placeholderTextColor={Colors.textTertiary}
          {...rest}
          secureTextEntry={isPassword ? !showPwd : rest.secureTextEntry}
          style={[styles.input, error ? { borderColor: Colors.error } : null, rest.style, isPassword ? { paddingRight: 40 } : null]}
        />
        {isPassword && (
          <TouchableOpacity 
            onPress={() => setShowPwd(!showPwd)} 
            style={{ position: 'absolute', right: 12, height: '100%', justifyContent: 'center' }}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          >
            <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

export function Badge({
  label,
  variant = "info",
  small,
}: {
  label: string;
  variant?: "success" | "error" | "warning" | "info" | "neutral";
  small?: boolean;
}) {
  const Colors = useColors();
  const map = {
    success: { bg: Colors.successBg, fg: Colors.success },
    error: { bg: Colors.errorBg, fg: Colors.error },
    warning: { bg: Colors.warningBg, fg: Colors.warning },
    info: { bg: Colors.infoBg, fg: Colors.info },
    neutral: { bg: Colors.borderLight, fg: Colors.textSecondary },
  }[variant];
  return (
    <View
      style={{
        backgroundColor: map.bg,
        paddingHorizontal: small ? 8 : 10,
        paddingVertical: small ? 3 : 5,
        borderRadius: 999,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: map.fg, fontSize: small ? 10 : 11, fontWeight: "700", letterSpacing: 0.3 }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export function EmptyState({ icon = "leaf-outline", title, subtitle }: { icon?: any; title: string; subtitle?: string }) {
  const Colors = useColors();
  return (
    <View style={{ alignItems: "center", padding: 32, marginTop: 32 }}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: Colors.borderLight,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Ionicons name={icon} size={36} color={Colors.textTertiary} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.text, marginBottom: 4 }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 14, color: Colors.textSecondary, textAlign: "center" }}>{subtitle}</Text>}
    </View>
  );
}

export function FAB({ onPress, icon = "add", testID }: { onPress: () => void; icon?: any; testID?: string }) {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.fab}
    >
      <Ionicons name={icon} size={28} color="#fff" />
    </TouchableOpacity>
  );
}

export function PickerModal<T extends { id: string; nama: string }>({
  visible,
  title,
  items,
  onSelect,
  onClose,
  selectedId,
}: {
  visible: boolean;
  title: string;
  items: T[];
  onSelect: (item: T) => void;
  onClose: () => void;
  selectedId?: string;
}) {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={{ alignItems: "center", paddingTop: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 12 }} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 12, color: Colors.text }}>{title}</Text>
          <ScrollView style={{ maxHeight: 400 }}>
            {items.length === 0 ? (
              <Text style={{ color: Colors.textSecondary, padding: 16, textAlign: "center" }}>
                Belum ada data
              </Text>
            ) : (
              items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: Colors.borderLight,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 15, color: Colors.text }}>{item.nama}</Text>
                  {selectedId === item.id && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function ConfirmDialog({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  confirmText = "Hapus",
  danger = true,
}: {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  danger?: boolean;
}) {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.dialogBackdrop}>
        <View style={styles.dialogBox}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.text, marginBottom: 8 }}>{title}</Text>
          <Text style={{ fontSize: 14, color: Colors.textSecondary, marginBottom: 20 }}>{message}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title="Batal" variant="outline" onPress={onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={confirmText} variant={danger ? "danger" : "primary"} onPress={onConfirm} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function AlertDialog({
  visible,
  title,
  message,
  onConfirm,
  confirmText = "OK",
  variant = "primary",
}: {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  variant?: "primary" | "danger" | "outline";
}) {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onConfirm}>
      <View style={styles.dialogBackdrop}>
        <View style={styles.dialogBox}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.text, marginBottom: 8 }}>{title}</Text>
          <Text style={{ fontSize: 14, color: Colors.textSecondary, marginBottom: 20 }}>{message}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title={confirmText} variant={variant} onPress={onConfirm} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const Colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.text }}>{title}</Text>
      {action}
    </View>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 15, fontWeight: "700" },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  inputLabel: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 6 },
  errorText: { color: Colors.error, fontSize: 12, marginTop: 4 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
    maxHeight: "80%",
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialogBox: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 24,
    width: "100%",
    maxWidth: 380,
  },
});
