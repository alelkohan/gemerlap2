import { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { useColors } from "@/src/lib/theme-context";
import { useAuth } from "@/src/lib/auth-context";
import { apiFetch } from "@/src/lib/api";
import { Card } from "@/src/components/ui";

export default function PersetujuanLemburScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { user } = useAuth();
  const isAuditor = user?.role === "auditor";
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{id: string, action: "approved" | "rejected"} | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/lembur/pending");
      setData(res || []);
    } catch (e: any) {
      Alert.alert("Gagal memuat", e.message || "Gagal mengambil antrean lembur");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const showConfirm = (id: string, action: "approved" | "rejected") => {
    setConfirmAction({ id, action });
    setConfirmModalVisible(true);
  };

  const processAction = async () => {
    if (!confirmAction) return;
    const { id, action } = confirmAction;
    try {
      setProcessing(id);
      setConfirmModalVisible(false);
      await apiFetch(`/lembur/${id}/status`, {
        method: "PUT",
        body: { status: action }
      });
      // Sukses notifikasi menggunakan alert agar simple setelah aksi selesai, atau biarkan load data
      Alert.alert("Sukses", `Pengajuan berhasil di${action === "approved" ? "setujui" : "tolak"}`);
      load();
    } catch (e: any) {
      Alert.alert("Gagal", e.message || "Terjadi kesalahan saat memproses");
    } finally {
      setProcessing(null);
      setConfirmAction(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Persetujuan Lembur</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[Colors.primary]} />}
      >
        {!loading && data.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>Tidak ada antrean pengajuan lembur saat ini.</Text>
          </View>
        )}

        {data.map((item) => (
          <Card key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.petugasName}>{item.nama_petugas}</Text>
                <Text style={styles.tanggal}>{formatDate(item.tanggal)}</Text>
              </View>
              <View style={styles.badgePending}>
                <Text style={styles.badgeTextPending}>MENUNGGU</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.detailText}>Tambahan: <Text style={{ fontWeight: 'bold' }}>{item.durasi_jam} Jam</Text></Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="document-text-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.detailText}>{item.alasan}</Text>
            </View>

            {!isAuditor && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.btnTolak, processing === item.id && { opacity: 0.5 }]}
                  disabled={processing !== null}
                  onPress={() => showConfirm(item.id, "rejected")}
                >
                  {processing === item.id && confirmAction?.action === "rejected" ? (
                    <ActivityIndicator color={Colors.error} size="small" />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
                      <Text style={styles.btnTolakText}>Tolak</Text>
                    </>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.btnSetuju, processing === item.id && { opacity: 0.5 }]}
                  disabled={processing !== null}
                  onPress={() => showConfirm(item.id, "approved")}
                >
                  {processing === item.id && confirmAction?.action === "approved" ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                      <Text style={styles.btnSetujuText}>Setujui</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </Card>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL KONFIRMASI ESTETIK */}
      <Modal
        visible={confirmModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setConfirmModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalIconBox, { backgroundColor: confirmAction?.action === "approved" ? Colors.success + "15" : Colors.error + "15" }]}>
              <Ionicons 
                name={confirmAction?.action === "approved" ? "checkmark-circle" : "close-circle"} 
                size={40} 
                color={confirmAction?.action === "approved" ? Colors.success : Colors.error} 
              />
            </View>
            
            <Text style={styles.modalTitle}>
              Konfirmasi {confirmAction?.action === "approved" ? "Persetujuan" : "Penolakan"}
            </Text>
            <Text style={styles.modalMessage}>
              Apakah Anda yakin ingin {confirmAction?.action === "approved" ? "menyetujui" : "menolak"} pengajuan lembur ini?
            </Text>
            
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalBtnCancel, { borderColor: Colors.border }]}
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={[styles.modalBtnCancelText, { color: Colors.textSecondary }]}>Batal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalBtnConfirm, { backgroundColor: confirmAction?.action === "approved" ? Colors.success : Colors.error }]}
                onPress={processAction}
              >
                <Text style={styles.modalBtnConfirmText}>
                  Ya, {confirmAction?.action === "approved" ? "Setujui" : "Tolak"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(Colors: any) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: Colors.bg,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    backBtn: {
      padding: 8,
      marginLeft: -8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: Colors.text,
    },
    content: {
      padding: 16,
      gap: 12,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
    },
    emptyText: {
      marginTop: 16,
      fontSize: 15,
      color: Colors.textSecondary,
      textAlign: "center",
    },
    card: {
      padding: 16,
      gap: 12,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 4,
    },
    petugasName: {
      fontSize: 16,
      fontWeight: "bold",
      color: Colors.text,
      marginBottom: 2,
    },
    tanggal: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    badgePending: {
      backgroundColor: Colors.warning + "20",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    badgeTextPending: {
      color: Colors.warning,
      fontSize: 10,
      fontWeight: "bold",
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: Colors.surface,
      padding: 8,
      borderRadius: 8,
    },
    detailText: {
      fontSize: 14,
      color: Colors.text,
      flex: 1,
    },
    actionRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
    },
    btnTolak: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: Colors.error,
      paddingVertical: 10,
      borderRadius: 8,
    },
    btnTolakText: {
      color: Colors.error,
      fontWeight: "600",
      fontSize: 14,
    },
    btnSetuju: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: Colors.success,
      paddingVertical: 10,
      borderRadius: 8,
    },
    btnSetujuText: {
      color: "#fff",
      fontWeight: "600",
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalContent: {
      backgroundColor: Colors.bg,
      borderRadius: 24,
      padding: 24,
      width: "100%",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    },
    modalIconBox: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: Colors.text,
      marginBottom: 8,
      textAlign: "center",
    },
    modalMessage: {
      fontSize: 15,
      color: Colors.textSecondary,
      textAlign: "center",
      marginBottom: 28,
      lineHeight: 22,
    },
    modalActionRow: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
    },
    modalBtnCancel: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    modalBtnCancelText: {
      fontSize: 15,
      fontWeight: "600",
    },
    modalBtnConfirm: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    modalBtnConfirmText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },
  });
}
