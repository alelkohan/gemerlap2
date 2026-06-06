import { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/lib/auth-context";
import { Button, Input } from "@/src/components/ui";
import { LOGO_IMG, ORG, Colors } from "@/src/lib/theme";
import { useColors } from "@/src/lib/theme-context";

export default function LoginScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const router = useRouter();
  const { login } = useAuth();
  const [noHp, setNoHp] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!noHp.trim() || !password) {
      setError("Nomor HP dan password wajib diisi");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(noHp.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Gagal masuk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>
          <View style={styles.logoWrap}>
            <Image source={LOGO_IMG} style={styles.logo} resizeMode="contain" />
          </View>

          <Text style={styles.appName}>TPS Manager</Text>
          <Text style={styles.appSub}>{ORG.name}</Text>
          <Text style={styles.org}>{ORG.org}</Text>

          <View style={styles.card}>
            <Text style={styles.welcome}>Selamat Datang</Text>
            <Text style={styles.welcomeSub}>Masuk untuk mulai mengelola TPS</Text>

            <Input
              testID="login-no-hp"
              label="Nomor HP"
              placeholder="08xxxxxxxxxx"
              value={noHp}
              onChangeText={setNoHp}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            <View>
              <Text style={styles.label}>Password</Text>
              <View style={{ position: "relative" }}>
                <Input
                  testID="login-password"
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  containerStyle={{ marginBottom: 0 }}
                />
                <TouchableOpacity
                  onPress={() => setShowPass((v) => !v)}
                  style={{ position: "absolute", right: 12, top: 14 }}
                >
                  <Ionicons name={showPass ? "eye-off" : "eye"} size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={{ color: Colors.error, fontSize: 13, flex: 1 }}>{error}</Text>
              </View>
            )}

            <View style={{ marginTop: 18 }}>
              <Button title="Masuk" onPress={handleLogin} loading={loading} testID="login-submit" />
            </View>
          </View>

          <Text style={styles.footer}>
            © 2026 Gemerlap • Gerakan Melestarikan Lingkungan Pesantren
          </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 32,
    flexGrow: 1,
    alignItems: "center",
  },
  inner: {
    width: "100%",
    maxWidth: 440,
  },
  logoWrap: {
    alignSelf: "center",
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  logo: { width: 100, height: 100 },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  appSub: {
    fontSize: 14,
    color: Colors.text,
    textAlign: "center",
    marginTop: 4,
    fontWeight: "600",
  },
  org: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 2,
    marginBottom: 28,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  welcome: { fontSize: 22, fontWeight: "700", color: Colors.text },
  welcomeSub: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 6 },
  errorBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: Colors.errorBg,
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  footer: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: "center",
    marginTop: 28,
  },
});
