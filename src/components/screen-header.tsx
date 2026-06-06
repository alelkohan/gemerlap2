import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";
import { ReactNode, useMemo } from "react";

export function ScreenHeader({ title, action }: { title: string; action?: ReactNode }) {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const router = useRouter();
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
        <Ionicons name="chevron-back" size={24} color={Colors.text} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ minWidth: 40, alignItems: "flex-end" }}>{action}</View>
    </View>
  );
}

export function ScreenContainer({ children, title, action }: { children: ReactNode; title: string; action?: ReactNode }) {
  const Colors = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <ScreenHeader title={title} action={action} />
      {children}
    </SafeAreaView>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: { padding: 8, minWidth: 40 },
  title: { fontSize: 17, fontWeight: "700", color: Colors.text, flex: 1, textAlign: "center" },
});
