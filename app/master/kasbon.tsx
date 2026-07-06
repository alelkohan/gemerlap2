import { useState, useCallback, useMemo } from "react";
import { ScrollView, View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Pressable } from "react-native";
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

      {/* Form Modal */}
      {showForm && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowForm(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, width: "100%" }}>
              <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Pressable style={[styles.modalSheet, { backgroundColor: Colors.surface }]} onPress={() => {}}>
                  <Text style={[styles.modalTitle, { color: Colors.text }]}>Tambah Kasbon Baru</Text>
                  <Text style={styles.modalBody}>
                    Masukkan detail pinjaman kasbon untuk petugas.
                  </Text>

                  <View style={{ width: "100%", gap: 12 }}>
                    <Text style={styles.label}>Pilih Petugas</Text>
                    <TouchableOpacity onPress={() => setShowPetugasModal(!showPetugasModal)} style={[styles.pickerBtn, { borderColor: Colors.borderLight, backgroundColor: Colors.surface, marginBottom: showPetugasModal ? 4 : 16 }]}>
                      <Text style={{ color: petugasId ? Colors.text : Colors.textSecondary }}>
                        {petugasList.find(p => p.id === petugasId)?.nama || "-- Pilih Petugas --"}
                      </Text>
                      <Ionicons name={showPetugasModal ? "chevron-up" : "chevron-down"} size={16} color={Colors.textSecondary} />
                    </TouchableOpacity>

                    {showPetugasModal && (
                      <View style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 12, marginBottom: 16, maxHeight: 180, overflow: "hidden" }}>
                        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true}>
                          {petugasList.map((p, idx, arr) => {
                            const isSelected = p.id === petugasId;
                            return (
                              <TouchableOpacity
                                key={p.id}
                                style={{
                                  paddingHorizontal: 16,
                                  paddingVertical: 12,
                                  borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                                  borderBottomColor: Colors.borderLight,
                                  backgroundColor: isSelected ? Colors.primary + "12" : Colors.surface,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between"
                                }}
                                onPress={() => {
                                  setPetugasId(p.id);
                                  setShowPetugasModal(false);
                                }}
                              >
                                <Text style={{ fontSize: 14, color: Colors.text, fontWeight: isSelected ? "700" : "400" }}>{p.nama}</Text>
                                {isSelected && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}

                    <Input
                      label="Nominal Kasbon"
                      placeholder="0"
                      keyboardType="number-pad"
                      value={nominal}
                      onChangeText={(val) => setNominal(formatRupiahInput(val))}
                    />

                    <Input
                      label="Keterangan (Opsional)"
                      placeholder="Misal: Biaya sekolah anak"
                      value={keterangan}
                      onChangeText={setKeterangan}
                    />
                  </View>

                  <View style={styles.modalBtnRow}>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: Colors.borderLight }]}
                      onPress={() => setShowForm(false)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.modalBtnText, { color: Colors.textSecondary }]}>Batal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: Colors.primary, flex: 1.4 }]}
                      onPress={handleSave}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.modalBtnText, { color: Colors.textOnPrimary }]}>Simpan</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </ScrollView>
            </KeyboardAvoidingView>
          </Pressable>
        </View>
      )}

      {isAdmin && <FAB onPress={openNew} icon="add" />}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)"
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 28,
    paddingVertical: 40
  },
  modalSheet: {
    width: "100%",
    backgroundColor: Colors.surface,
    padding: 28,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
    alignItems: "center"
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.3
  },
  modalBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 16
  },
  modalBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "800"
  },
});
