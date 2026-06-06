import { useState } from "react";
import { ScrollView, View, Alert } from "react-native";

import { ScreenContainer } from "@/src/components/screen-header";
import { Button, Input } from "@/src/components/ui";
import { authApi } from "@/src/lib/api";
import { useRouter } from "expo-router";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!oldPass) return Alert.alert("Error", "Password lama wajib diisi");
    if (newPass.length < 6) return Alert.alert("Error", "Password baru minimal 6 karakter");
    if (newPass !== confirm) return Alert.alert("Error", "Konfirmasi password tidak cocok");
    setLoading(true);
    try {
      await authApi.changePassword(oldPass, newPass);
      Alert.alert("Sukses", "Password berhasil diubah", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer title="Ganti Password">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Input label="Password Lama" value={oldPass} onChangeText={setOldPass} secureTextEntry placeholder="Masukkan password lama" />
        <Input label="Password Baru" value={newPass} onChangeText={setNewPass} secureTextEntry placeholder="Min 6 karakter" />
        <Input label="Konfirmasi Password Baru" value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Ulangi password baru" />
        <View style={{ marginTop: 12 }}>
          <Button title="Simpan" onPress={submit} loading={loading} icon="save-outline" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
