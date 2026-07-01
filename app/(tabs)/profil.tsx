import { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/lib/auth-context";
import { Colors } from "@/src/lib/theme";
import { useColors, useThemeMode } from "@/src/lib/theme-context";
import { Card, Badge, ConfirmDialog } from "@/src/components/ui";

function initials(nama: string): string {
  return nama
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function ProfilScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);

  if (!user) return null;

  const doLogout = async () => {
    setShowLogout(false);
    await logout();
    router.replace("/login");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Profil</Text>

        <Card style={{ marginTop: 16, alignItems: "center", padding: 24 }}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user.nama)}</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.text, marginTop: 14 }}>{user.nama}</Text>
          <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>{user.no_hp}</Text>
          <View style={{ marginTop: 10 }}>
            <Badge
              label={user.role === "admin" ? "Administrator" : (user.role === "auditor" ? "Auditor" : "Petugas")}
              variant={user.role === "admin" ? "success" : (user.role === "auditor" ? "warning" : "info")}
            />
          </View>
          {user.created_at && (
            <Text style={{ fontSize: 11, color: Colors.textTertiary, marginTop: 12 }}>
              Bergabung sejak {new Date(user.created_at).toLocaleDateString("id-ID")}
            </Text>
          )}
        </Card>

        <View style={{ marginTop: 16, gap: 8 }}>
          <ThemeToggle />
          <MenuItem
            icon="key-outline"
            label="Ganti Password"
            onPress={() => router.push("/profil/change-password")}
            color={Colors.info}
          />
          <MenuItem
            icon="information-circle-outline"
            label="Tentang Aplikasi"
            onPress={() => router.push("/profil/tentang")}
            color={Colors.primary}
          />
          <MenuItem
            icon="log-out-outline"
            label="Keluar"
            onPress={() => setShowLogout(true)}
            color={Colors.error}
            testID="logout-btn"
          />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={showLogout}
        title="Keluar?"
        message="Anda yakin ingin keluar dari aplikasi?"
        confirmText="Keluar"
        onCancel={() => setShowLogout(false)}
        onConfirm={doLogout}
      />
    </SafeAreaView>
  );
}

function MenuItem({ icon, label, onPress, color, testID }: { icon: any; label: string; onPress: () => void; color: string; testID?: string }) {
  const Colors = useColors();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} testID={testID}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + "20", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: Colors.text }}>{label}</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function ThemeToggle() {
  const Colors = useColors();
  const { mode, setMode } = useThemeMode();
  const options: { id: "light" | "dark" | "system"; label: string; icon: any }[] = [
    { id: "light", label: "Terang", icon: "sunny-outline" },
    { id: "dark", label: "Gelap", icon: "moon-outline" },
    { id: "system", label: "Sistem", icon: "phone-portrait-outline" },
  ];
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="contrast-outline" size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>Tema Tampilan</Text>
          <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>Pilih mode tampilan aplikasi</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", backgroundColor: Colors.surfaceAlt, borderRadius: 12, padding: 4, gap: 4 }}>
        {options.map((opt) => {
          const active = mode === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setMode(opt.id)}
              testID={`theme-${opt.id}`}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: active ? Colors.surface : "transparent",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Ionicons name={opt.icon} size={18} color={active ? Colors.primary : Colors.textSecondary} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: active ? Colors.primary : Colors.textSecondary }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  title: { fontSize: 26, fontWeight: "800", color: Colors.text, letterSpacing: -0.5 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 36, fontWeight: "800" },
});
