import { useState, useCallback, useMemo } from "react";
import { ScrollView, View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button, Input, ConfirmDialog, PickerModal, FAB } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth-context";
import { useColors } from "@/src/lib/theme-context";
import { rupiah, formatRupiahInput, formatTanggalID, currentBulan, bulanLabel, addMonths } from "@/src/lib/format";

export default function KasbonScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [data, setData] = useState<any[]>([]);
  const [petugasList, setPetugasList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [petugasId, setPetugasId] = useState("");
  const [nominal, setNominal] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [showPetugasModal, setShowPetugasModal] = useState(false);
  
  const [bulan, setBulan] = useState(currentBulan());

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [res, pList] = await Promise.all([
        apiFetch(`/kasbon?bulan=${bulan}`),
        apiFetch("/users")
      ]);
      setData(res || []);
      // Exclude auditors from dropdown
      setPetugasList((pList || []).filter((u: any) => u.role !== "auditor"));
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [bulan]));

  const openNew = () => {
    if (!isAdmin) return;
    setPetugasId("");
    setNominal("");
    setKeterangan("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!petugasId) return Alert.alert("Error", "Pilih petugas terlebih dahulu");
    
    const num = Number(nominal.replace(/[^0-9]/g, ""));
    if (num <= 0) return Alert.alert("Error", "Nominal kasbon harus lebih dari 0");

    try {
      await apiFetch("/kasbon", {
        method: "POST",
        body: {
          petugas_id: petugasId,
          nominal: num,
          keterangan: keterangan
        }
      });
      setShowForm(false);
      await load();
    } catch (e: any) {
      Alert.alert("Gagal", e.message);
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/kasbon/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await load();
    } catch (e: any) {
      Alert.alert("Gagal Menghapus", e.message);
      setDeleteId(null);
    }
  };

  return (
    <ScreenContainer title="Pinjaman / Kasbon">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>


        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <TouchableOpacity onPress={() => setBulan(addMonths(bulan, -1))} style={[styles.navBtn, { backgroundColor: Colors.surface, borderColor: Colors.borderLight }]}>
            <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.text }}>{bulanLabel(bulan)}</Text>
          <TouchableOpacity onPress={() => setBulan(addMonths(bulan, 1))} style={[styles.navBtn, { backgroundColor: Colors.surface, borderColor: Colors.borderLight }]}>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : data.length === 0 ? (
          <Card style={{ alignItems: "center", padding: 32 }}>
            <Ionicons name="wallet-outline" size={48} color={Colors.borderLight} />
            <Text style={{ color: Colors.textSecondary, marginTop: 16 }}>Belum ada data kasbon</Text>
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {data.map((item) => {
              const isLunas = item.status === "lunas";
              return (
                <Card key={item.id} style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.petugasName}>{item.nama_petugas}</Text>
                      <Text style={styles.dateText}>{formatTanggalID(item.tanggal)}</Text>
                      <Text style={styles.nominalText}>{rupiah(item.nominal)}</Text>
                      
                      {item.keterangan ? (
                        <Text style={styles.keterangan}>{item.keterangan}</Text>
                      ) : null}
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <View style={[
                        styles.statusBadge, 
                        { backgroundColor: isLunas ? Colors.successBg : Colors.warningBg }
                      ]}>
                        <Text style={[
                          styles.statusText, 
                          { color: isLunas ? Colors.success : Colors.warning }
                        ]}>
                          {isLunas ? "LUNAS" : "BELUM LUNAS"}
                        </Text>
                      </View>

                      {!isLunas && isAdmin && (
                        <TouchableOpacity 
                          onPress={() => setDeleteId(item.id)} 
                          style={{ marginTop: 16, padding: 8 }}
                        >
                          <Ionicons name="trash-outline" size={20} color={Colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={!!deleteId}
        title="Hapus Kasbon"
        message="Yakin ingin menghapus catatan kasbon ini? Saldo keuangan juga akan disesuaikan kembali."
        confirmText="Hapus"
        onConfirm={remove}
        onCancel={() => setDeleteId(null)}
      />

      {/* ABSOLUTE POSITIONED FORM (Looks like a Modal, works with PickerModal) */}
      {showForm && (
        <View style={StyleSheet.absoluteFillObject}>
          <TouchableOpacity 
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} 
            activeOpacity={1} 
            onPress={() => setShowForm(false)} 
          />
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined} 
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: Colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
          >
            <View style={{ padding: 24 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text }}>Tambah Kasbon Baru</Text>
                <TouchableOpacity onPress={() => setShowForm(false)} style={{ padding: 8 }}>
                  <Ionicons name="close" size={24} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Pilih Petugas</Text>
              <TouchableOpacity onPress={() => setShowPetugasModal(true)} style={[styles.pickerBtn, { borderColor: Colors.borderLight, backgroundColor: Colors.surface }]}>
                <Text style={{ color: petugasId ? Colors.text : Colors.textSecondary }}>
                  {petugasList.find(p => p.id === petugasId)?.nama || "-- Pilih Petugas --"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>

              <Input
                label="Nominal Kasbon"
                placeholder="0"
                keyboardType="number-pad"
                value={nominal}
                onChangeText={(val) => setNominal(formatRupiahInput(val))}
                style={{ marginBottom: 12 }}
              />

              <Input
                label="Keterangan (Opsional)"
                placeholder="Misal: Biaya sekolah anak"
                value={keterangan}
                onChangeText={setKeterangan}
                style={{ marginBottom: 24 }}
              />

              <Button title="Simpan Kasbon" onPress={handleSave} />
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {isAdmin && !showForm && <FAB onPress={openNew} icon="add" />}

      <PickerModal
        visible={showPetugasModal}
        title="Pilih Petugas"
        items={petugasList}
        selectedId={petugasId}
        onSelect={(p) => setPetugasId(p.id)}
        onClose={() => setShowPetugasModal(false)}
      />
    </ScreenContainer>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  headerTitle: { fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  petugasName: { fontSize: 16, fontWeight: "700", color: Colors.text, marginBottom: 4 },
  dateText: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  nominalText: { fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 4 },
  keterangan: { fontSize: 13, color: Colors.textSecondary, fontStyle: "italic", marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: "800" },
  label: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary, marginBottom: 8 },
  pickerBtn: { borderWidth: 1, borderRadius: 12, marginBottom: 16, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  navBtn: { padding: 8, borderWidth: 1, borderRadius: 10 },
});
