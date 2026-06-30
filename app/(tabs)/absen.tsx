import { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";

import { apiFetch } from "@/src/lib/api";
import { useColors } from "@/src/lib/theme-context";
import { todayISO } from "@/src/lib/format";
import { Card, EmptyState, ConfirmDialog } from "@/src/components/ui";
import { DatePickerField } from "@/src/components/date-picker";
import { startBackgroundTracking, stopBackgroundTracking } from "@/src/lib/location-task";

// ─── Result Modal (sukses / gagal / info) ────────────────────────────────────
type ResultType = "success" | "error" | "info" | "warning";

function ResultModal({
  visible,
  type,
  title,
  message,
  onClose,
  Colors,
}: {
  visible: boolean;
  type: ResultType;
  title: string;
  message: string;
  onClose: () => void;
  Colors: any;
}) {
  const cfg = {
    success: {
      bg: Colors.successBg,
      color: Colors.success,
      icon: "checkmark-circle" as const,
      btnColor: Colors.success,
    },
    error: {
      bg: Colors.errorBg,
      color: Colors.error,
      icon: "close-circle" as const,
      btnColor: Colors.error,
    },
    info: {
      bg: Colors.infoBg,
      color: Colors.info,
      icon: "information-circle" as const,
      btnColor: Colors.info,
    },
    warning: {
      bg: Colors.warningBg,
      color: Colors.warning,
      icon: "warning" as const,
      btnColor: Colors.warning,
    },
  }[type];

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={sharedModal.overlay} onPress={onClose}>
        <Pressable style={[sharedModal.sheet, { backgroundColor: Colors.surface }]} onPress={() => {}}>
          <View style={[sharedModal.iconWrap, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={38} color={cfg.color} />
          </View>
          <Text style={[sharedModal.title, { color: Colors.text }]}>{title}</Text>
          {!!message && (
            <Text style={[sharedModal.body, { color: Colors.textSecondary }]}>{message}</Text>
          )}
          <TouchableOpacity
            style={[sharedModal.singleBtn, { backgroundColor: cfg.btnColor }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={sharedModal.singleBtnText}>OK</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Confirm Modal (mulai sesi) ───────────────────────────────────────────────
function ConfirmModal({
  visible,
  onCancel,
  onConfirm,
  loading,
  Colors,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  Colors: any;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={sharedModal.overlay} onPress={onCancel}>
        <Pressable style={[sharedModal.sheet, { backgroundColor: Colors.surface }]} onPress={() => {}}>
          <View style={[sharedModal.iconWrap, { backgroundColor: Colors.successBg }]}>
            <Ionicons name="log-in" size={34} color={Colors.success} />
          </View>

          <Text style={[sharedModal.title, { color: Colors.text }]}>Mulai Sesi?</Text>
          <Text style={[sharedModal.body, { color: Colors.textSecondary }]}>
            Anda akan memulai sesi kerja sekarang.
          </Text>

          <View style={[sharedModal.noteBox, { backgroundColor: Colors.warningBg, borderColor: Colors.warning + "50" }]}>
            <Ionicons name="information-circle" size={16} color={Colors.warning} />
            <Text style={[sharedModal.noteText, { color: Colors.warning }]}>
              Minimal sesi <Text style={{ fontWeight: "800" }}>30 menit</Text>. Tidak bisa check-out sebelum 30 menit.
            </Text>
          </View>

          <View style={sharedModal.btnRow}>
            <TouchableOpacity
              style={[sharedModal.btn, { backgroundColor: Colors.borderLight }]}
              onPress={onCancel}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={[sharedModal.btnText, { color: Colors.textSecondary }]}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[sharedModal.btn, { backgroundColor: Colors.success, flex: 1.4 }]}
              onPress={onConfirm}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <Text style={[sharedModal.btnText, { color: "#fff" }]}>Memproses...</Text>
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={[sharedModal.btnText, { color: "#fff" }]}>Ya, Mulai</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Shared modal styles ──────────────────────────────────────────────────────
const sharedModal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  sheet: {
    width: "100%",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    width: "100%",
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
    fontWeight: "600",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "800",
  },
  singleBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  singleBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function webAlert(
  title: string,
  message: string,
  buttons?: { text: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }[]
) {
  if (buttons && buttons.length > 1) {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) {
      const btn = buttons.find((b) => b.style !== "cancel") || buttons[1];
      if (btn?.onPress) btn.onPress();
    } else {
      const btn = buttons.find((b) => b.style === "cancel") || buttons[0];
      if (btn?.onPress) btn.onPress();
    }
  } else {
    window.alert(`${title}\n\n${message}`);
    if (buttons?.[0]?.onPress) buttons[0].onPress();
  }
}

function formatJam(isoString: string | null) {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m} WIB`;
  } catch {
    return "-";
  }
}

let lastOutsideAlertTime = 0;

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AbsenScreen() {
  const Colors = useColors();
  const styles = useMemo(() => absenStyles(Colors), [Colors]);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [status, setStatus] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [selectedSelfStatus, setSelectedSelfStatus] = useState<"hadir" | "izin" | "sakit" | null>(null);
  const [selfKeterangan, setSelfKeterangan] = useState("");
  const [showDeleteStatus, setShowDeleteStatus] = useState(false);

  // Lembur states
  const [lemburModalVisible, setLemburModalVisible] = useState(false);
  const [lemburJam, setLemburJam] = useState("");
  const [lemburAlasan, setLemburAlasan] = useState("");
  const [lemburHistory, setLemburHistory] = useState<any[]>([]);
  const [loadingLembur, setLoadingLembur] = useState(false);

  // Modal states
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [result, setResult] = useState<{
    visible: boolean;
    type: ResultType;
    title: string;
    message: string;
    onClose?: () => void;
  }>({ visible: false, type: "success", title: "", message: "" });

  const showResult = (
    type: ResultType,
    title: string,
    message: string,
    onClose?: () => void
  ) => {
    setResult({ visible: true, type, title, message, onClose });
  };

  const closeResult = () => {
    const cb = result.onClose;
    setResult((r) => ({ ...r, visible: false }));
    cb?.();
  };

  const loadStatus = useCallback(async () => {
    try {
      const s = await apiFetch("/absensi/status");
      setStatus(s);
      if (s.has_active_session) {
        startBackgroundTracking().catch((err) => console.warn("Sync tracking failed:", err));
      } else {
        stopBackgroundTracking().catch((err) => console.warn("Sync stop tracking failed:", err));
      }
    } catch (e) {
      console.warn("Load status failed:", e);
    }
  }, []);

  const loadSessions = useCallback(async (dateStr: string) => {
    try {
      const list = await apiFetch(`/absensi/sessions?tanggal=${dateStr}`);
      setSessions(list);
    } catch (e) {
      console.warn("Load sessions failed:", e);
    }
  }, []);

  const loadLembur = useCallback(async () => {
    try {
      const list = await apiFetch("/lembur/my");
      setLemburHistory(list || []);
    } catch (e) {
      console.warn("Load lembur failed:", e);
    }
  }, []);

  const loadAll = useCallback(async (dateStr: string) => {
    await Promise.all([loadStatus(), loadSessions(dateStr), loadLembur()]);
  }, [loadStatus, loadSessions, loadLembur]);

  useFocusEffect(
    useCallback(() => {
      loadAll(selectedDate);
    }, [loadAll, selectedDate])
  );

  const handleCheckOut = useCallback(async () => {
    setLoadingAction(true);
    try {
      let coords = { latitude: 0, longitude: 0 };
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      } catch {}

      const res = await apiFetch("/absensi/check-out", { method: "POST", body: coords });
      await stopBackgroundTracking();

      if (Platform.OS === "web") {
        webAlert("Check-out Berhasil", res.message || "Sesi kerja telah diakhiri.");
        await loadAll(selectedDate);
      } else {
        showResult("success", "Check-out Berhasil", res.message || "Sesi kerja telah diakhiri.", () =>
          loadAll(selectedDate)
        );
      }
    } catch (e: any) {
      if (Platform.OS === "web") {
        webAlert("Gagal Check-out", e.message);
      } else {
        showResult("error", "Gagal Check-out", e.message || "Terjadi kesalahan saat check-out.");
      }
    } finally {
      setLoadingAction(false);
    }
  }, [loadAll, selectedDate]);

  const handleDeleteStatus = async () => {
    setShowDeleteStatus(false);
    setLoadingAction(true);
    try {
      await apiFetch("/absensi/self", { method: "DELETE" });
      setStatus((prev: any) => prev ? { ...prev, daily_record: null } : prev);
      showResult("success", "Berhasil", "Status absensi telah dihapus.");
      await loadAll(selectedDate);
    } catch (e: any) {
      showResult("error", "Gagal", e.message || "Gagal menghapus status.");
    } finally {
      setLoadingAction(false);
    }
  };

  useEffect(() => {
    if (!status?.has_active_session) return;

    const sendForegroundHeartbeat = async () => {
      try {
        const hasPermission = await Location.getForegroundPermissionsAsync();
        if (hasPermission.granted) {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const res = await apiFetch("/absensi/heartbeat", {
            method: "POST",
            body: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
          });

          if (res.status === "outside") {
            const now = Date.now();
            if (now - lastOutsideAlertTime > 60000) {
              lastOutsideAlertTime = now;
              Alert.alert(
                "Di Luar Area TPS",
                "Anda terdeteksi di luar area TPS. Sesi akan otomatis diakhiri dalam 1 menit jika Anda tidak kembali.",
                [
                  { text: "Akhiri Sesi", style: "destructive", onPress: () => handleCheckOut() },
                  { text: "Kembali ke Lokasi", style: "cancel" },
                ]
              );
            }
          } else if (res.status === "auto_checked_out") {
            if (Platform.OS === "web") {
              webAlert("Sesi Berakhir", "Sesi Anda otomatis diakhiri karena berada di luar area TPS lebih dari 1 menit.");
              await loadAll(selectedDate);
            } else {
              showResult(
                "warning",
                "Sesi Berakhir",
                "Sesi Anda otomatis diakhiri karena berada di luar area TPS lebih dari 1 menit.",
                () => loadAll(selectedDate)
              );
            }
          }
        }
      } catch (err) {
        console.warn("Foreground heartbeat failed:", err);
      }
    };

    sendForegroundHeartbeat();
    const t = setInterval(() => {
      loadStatus();
      loadSessions(selectedDate);
      sendForegroundHeartbeat();
    }, 30000);

    return () => clearInterval(t);
  }, [status?.has_active_session, selectedDate, loadStatus, loadSessions, handleCheckOut, loadAll]);

  const handleSubmitLembur = async () => {
    if (!lemburJam || isNaN(Number(lemburJam)) || Number(lemburJam) <= 0) {
      Alert.alert("Error", "Mohon isi durasi lembur dengan angka yang valid");
      return;
    }
    if (!lemburAlasan.trim()) {
      Alert.alert("Error", "Mohon isi alasan lembur");
      return;
    }
    setLoadingLembur(true);
    try {
      await apiFetch("/lembur", {
        method: "POST",
        body: JSON.stringify({
          durasi_jam: Number(lemburJam),
          alasan: lemburAlasan
        })
      });
      setLemburModalVisible(false);
      setLemburJam("");
      setLemburAlasan("");
      showResult("success", "Berhasil", "Pengajuan lembur telah dikirim dan menunggu persetujuan.");
      loadLembur();
    } catch (e: any) {
      Alert.alert("Gagal", e.message || "Gagal mengirim pengajuan");
    } finally {
      setLoadingLembur(false);
    }
  };

  const handleCheckIn = () => setConfirmVisible(true);

  const doCheckIn = async () => {
    setLoadingAction(true);
    try {
      await startBackgroundTracking();
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const res = await apiFetch("/absensi/check-in", { method: "POST", body: { latitude, longitude } });

      setConfirmVisible(false);
      if (Platform.OS === "web") {
        webAlert("Check-in Berhasil", res.message || "Sesi kerja telah dimulai.");
        await loadAll(selectedDate);
      } else {
        showResult("success", "Check-in Berhasil", res.message || "Sesi kerja telah dimulai.", () =>
          loadAll(selectedDate)
        );
      }
    } catch (e: any) {
      setConfirmVisible(false);
      if (Platform.OS === "web") {
        webAlert("Gagal Check-in", e.message || "Pastikan GPS aktif dan berada di dalam radius TPS");
      } else {
        showResult("error", "Gagal Check-in", e.message || "Pastikan GPS aktif dan berada di dalam radius TPS.");
      }
      await stopBackgroundTracking().catch(() => {});
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSubmitSelf = useCallback(async (selfStatus: "izin" | "sakit") => {
    setLoadingAction(true);
    try {
      const res = await apiFetch("/absensi/self", {
        method: "POST",
        body: { status: selfStatus, keterangan: selfKeterangan },
      });
      setSelfKeterangan("");
      setSelectedSelfStatus(null);

      if (Platform.OS === "web") {
        webAlert("Berhasil", res.message || "Absensi berhasil dicatat!");
        await loadAll(selectedDate);
      } else {
        const label = selfStatus === "izin" ? "Izin" : "Sakit";
        showResult(
          "success",
          `${label} Dicatat`,
          res.message || `Absensi ${label.toLowerCase()} Anda berhasil dicatat.`,
          () => loadAll(selectedDate)
        );
      }
    } catch (e: any) {
      if (Platform.OS === "web") {
        webAlert("Gagal", e.message || "Gagal mencatat absensi");
      } else {
        showResult("error", "Gagal Mengirim", e.message || "Gagal mencatat absensi.");
      }
    } finally {
      setLoadingAction(false);
    }
  }, [selfKeterangan, loadAll, selectedDate]);

  const formatDurasi = (detik: number | null) => {
    if (detik === null || detik === undefined) return "-";
    const h = Math.floor(detik / 3600);
    const m = Math.floor((detik % 3600) / 60);
    return `${h} jam ${m} menit`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <ResultModal
        visible={result.visible}
        type={result.type}
        title={result.title}
        message={result.message}
        onClose={closeResult}
        Colors={Colors}
      />

      <ConfirmDialog
        visible={showDeleteStatus}
        title="Hapus Status Absensi"
        message="Apakah Anda yakin ingin menghapus status absensi Anda hari ini? Jika dihapus, Anda bisa melakukan check-in seperti biasa."
        onConfirm={handleDeleteStatus}
        onCancel={() => setShowDeleteStatus(false)}
        confirmText="Ya, Hapus"
        confirmColor={Colors.error}
      />

      <ConfirmModal
        visible={confirmVisible}
        onCancel={() => { if (!loadingAction) setConfirmVisible(false); }}
        onConfirm={doCheckIn}
        loading={loadingAction}
        Colors={Colors}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadAll(selectedDate);
              setRefreshing(false);
            }}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={{ padding: 16, paddingBottom: 8 }}>
          <Text style={styles.title}>Absensi</Text>
          <Text style={styles.subtitle}>Sesi & jam kerja Anda</Text>
        </View>

        {status && (
          <View style={styles.statsWrap}>
            <View style={styles.statsCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>Total Jam Kerja Hari Ini</Text>
                <Text style={styles.statsValue}>{status.total_hours_today?.toFixed(2)} / {(status.target_jam_kerja || 8).toFixed(2)} Jam</Text>
                {status.total_hours_today > (status.target_jam_kerja || 8) && (
                  <Text style={styles.cappedWarning}>(Maks. {status.target_jam_kerja || 8} jam yang dihitung untuk gaji)</Text>
                )}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: status.has_active_session ? Colors.successBg : Colors.borderLight }]}>
                <View style={[styles.statusDot, { backgroundColor: status.has_active_session ? Colors.success : Colors.textTertiary }]} />
                <Text style={[styles.statusText, { color: status.has_active_session ? Colors.success : Colors.textSecondary }]}>
                  {status.has_active_session ? "Aktif Kerja" : "Selesai/Idle"}
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: Colors.warning, marginTop: 12, paddingVertical: 12 }]}
              onPress={() => setLemburModalVisible(true)}
            >
              <Ionicons name="time" size={18} color="#fff" />
              <Text style={[styles.btnText, { color: "#fff", fontSize: 14 }]}>Ajukan Lembur</Text>
            </TouchableOpacity>

            {lemburHistory.length > 0 && (
              <View style={{ marginTop: 12, gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "bold", color: Colors.textSecondary }}>Pengajuan Lembur Terakhir:</Text>
                {lemburHistory.slice(0, 2).map((l, i) => (
                  <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: Colors.surface, padding: 10, borderRadius: 8 }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: "bold", color: Colors.text }}>{l.durasi_jam} Jam</Text>
                      <Text style={{ fontSize: 11, color: Colors.textSecondary }}>{l.tanggal}</Text>
                    </View>
                    <View style={{ justifyContent: "center" }}>
                      <Text style={{ 
                        fontSize: 11, fontWeight: "bold",
                        color: l.status === "approved" ? Colors.success : (l.status === "rejected" ? Colors.error : Colors.warning) 
                      }}>
                        {l.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Daily Status Selection Gate */}
        {status && !status.daily_record && !status.has_active_session && (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <Card style={{ padding: 20 }}>
              <Text style={styles.actionTitle}>Status Hari Ini</Text>
              <Text style={[styles.actionDesc, { textAlign: "left", paddingHorizontal: 0, marginBottom: 16 }]}>
                Pilih keterangan kehadiran Anda hari ini:
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                {(["hadir", "izin", "sakit"] as const).map((s) => {
                  const cfg = {
                    hadir: { label: "Hadir", icon: "checkmark-circle" as const, color: Colors.success, bg: Colors.successBg },
                    izin: { label: "Izin", icon: "information-circle" as const, color: Colors.warning, bg: Colors.warningBg },
                    sakit: { label: "Sakit", icon: "medkit" as const, color: Colors.info, bg: Colors.infoBg },
                  }[s];
                  const isSelected = selectedSelfStatus === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.statusChoiceBtn,
                        { borderColor: isSelected ? cfg.color : Colors.borderLight, backgroundColor: isSelected ? cfg.bg : Colors.surface }
                      ]}
                      onPress={() => setSelectedSelfStatus(s)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={cfg.icon} size={22} color={isSelected ? cfg.color : Colors.textSecondary} />
                      <Text style={[styles.statusChoiceLabel, { color: isSelected ? cfg.color : Colors.textSecondary }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedSelfStatus === "hadir" && (
                <TouchableOpacity
                  onPress={handleCheckIn}
                  disabled={loadingAction}
                  style={[styles.btn, { backgroundColor: Colors.success }]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="log-in" size={20} color="#fff" />
                  <Text style={styles.btnText}>
                    {loadingAction ? "Memproses..." : "Mulai Kerja (Check-in)"}
                  </Text>
                </TouchableOpacity>
              )}

              {(selectedSelfStatus === "izin" || selectedSelfStatus === "sakit") && (
                <>
                  <View style={{ marginBottom: 8 }}>
                    <Text style={styles.inputLabel}>Keterangan (Opsional)</Text>
                    <View style={styles.textInput}>
                      <Ionicons name="create-outline" size={16} color={Colors.textSecondary} />
                      <TextInput
                        style={{ flex: 1, color: Colors.text, fontSize: 14 }}
                        placeholder="Contoh: Izin keluarga, demam, dll."
                        placeholderTextColor={Colors.textTertiary}
                        value={selfKeterangan}
                        onChangeText={setSelfKeterangan}
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleSubmitSelf(selectedSelfStatus)}
                    disabled={loadingAction}
                    style={[styles.btn, { backgroundColor: selectedSelfStatus === "izin" ? Colors.warning : Colors.info }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.btnText}>
                      {loadingAction ? "Mengirim..." : `Kirim ${selectedSelfStatus === "izin" ? "Izin" : "Sakit"}`}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </Card>
          </View>
        )}

        {/* Check-in/Check-out Card */}
        {status && (status.has_active_session || status.daily_record?.status === "hadir") && (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <Card style={{ padding: 20, alignItems: "center" }}>
              {status?.has_active_session ? (
                <>
                  <View style={styles.activePulse}>
                    <Ionicons name="time" size={48} color={Colors.primary} />
                  </View>
                  <Text style={styles.actionTitle}>Sesi Kerja Berjalan</Text>
                  <Text style={styles.actionDesc}>
                    Check-in sejak: {formatJam(status.active_session?.check_in)}
                  </Text>

                  {status.active_session?.outside_since && (
                    <View style={styles.warningBox}>
                      <Ionicons name="warning" size={16} color={Colors.error} />
                      <Text style={styles.warningText}>
                        Peringatan: Anda di luar area TPS! Sesi akan otomatis berakhir.
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={handleCheckOut}
                    disabled={loadingAction}
                    style={[styles.btn, { backgroundColor: Colors.error }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="log-out" size={20} color="#fff" />
                    <Text style={styles.btnText}>
                      {loadingAction ? "Memproses..." : "Akhiri Kerja (Check-out)"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.activePulse, { backgroundColor: Colors.successBg }]}>
                    <Ionicons name="log-in" size={48} color={Colors.success} />
                  </View>
                  <Text style={styles.actionTitle}>Mulai Sesi Kerja Baru</Text>
                  <Text style={styles.actionDesc}>
                    Sesi sebelumnya telah selesai.{sessions.filter((s: any) => s.status === 'completed' || s.status === 'auto_checked_out').length > 0
                      ? ` (${sessions.filter((s: any) => s.status === 'completed' || s.status === 'auto_checked_out').length} sesi selesai hari ini)`
                      : ''} Pastikan Anda berada di area TPS untuk check-in kembali.
                  </Text>

                  <TouchableOpacity
                    onPress={handleCheckIn}
                    disabled={loadingAction}
                    style={[styles.btn, { backgroundColor: Colors.success }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="log-in" size={20} color="#fff" />
                    <Text style={styles.btnText}>
                      {loadingAction ? "Memproses..." : "Mulai Sesi Baru (Check-in)"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </Card>
          </View>
        )}

        {/* Status Banner for Izin/Sakit */}
        {status?.daily_record && status.daily_record.status !== "hadir" && !status.has_active_session && (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <Card style={{ padding: 20, alignItems: "center" }}>
              {(() => {
                const dr = status.daily_record;
                const cfg = dr.status === "izin"
                  ? { icon: "information-circle" as const, color: Colors.warning, bg: Colors.warningBg, label: "Izin" }
                  : dr.status === "sakit"
                  ? { icon: "medkit" as const, color: Colors.info, bg: Colors.infoBg, label: "Sakit" }
                  : { icon: "close-circle" as const, color: Colors.error, bg: Colors.errorBg, label: "Absen" };
                return (
                  <>
                    <View style={[styles.activePulse, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon} size={48} color={cfg.color} />
                    </View>
                    <Text style={[styles.actionTitle, { color: cfg.color }]}>{cfg.label} Hari Ini</Text>
                    {dr.keterangan ? (
                      <Text style={styles.actionDesc}>{dr.keterangan}</Text>
                    ) : null}
                    {!dr.manual && sessions.filter((s: any) => s.status === 'completed' || s.status === 'auto_checked_out').length === 0 && (
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedSelfStatus(null);
                            setStatus((prev: any) => prev ? { ...prev, daily_record: null } : prev);
                          }}
                          style={[styles.btn, { backgroundColor: Colors.borderLight, flex: 1 }]}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="refresh" size={18} color={Colors.textSecondary} />
                          <Text style={[styles.btnText, { color: Colors.textSecondary }]}>Ubah Status</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          onPress={() => setShowDeleteStatus(true)}
                          style={[styles.btn, { backgroundColor: Colors.errorBg, flex: 1 }]}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="trash-outline" size={18} color={Colors.error} />
                          <Text style={[styles.btnText, { color: Colors.error }]}>Hapus</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                );
              })()}
            </Card>
          </View>
        )}

        <View style={{ paddingHorizontal: 16 }}>
          <Text style={styles.sectionTitle}>Riwayat Sesi Kerja</Text>
          <DatePickerField
            label="Pilih Tanggal"
            value={selectedDate}
            onChange={(date) => {
              setSelectedDate(date);
              loadSessions(date);
            }}
          />

          {sessions.length === 0 ? (
            <EmptyState
              icon="time-outline"
              title="Tidak ada sesi kerja"
              subtitle="Silakan check-in untuk mencatat jam kerja"
            />
          ) : (
            sessions.map((s, idx) => {
              const isActive = s.status === "active";
              const isAutoOut = s.status === "auto_checked_out";
              return (
                <Card key={s.id || idx} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                    <View style={[styles.sessionIcon, { backgroundColor: isActive ? Colors.successBg : isAutoOut ? Colors.errorBg : Colors.borderLight }]}>
                      <Ionicons
                        name={isActive ? "play" : isAutoOut ? "close" : "checkmark"}
                        size={18}
                        color={isActive ? Colors.success : isAutoOut ? Colors.error : Colors.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontWeight: "700", color: Colors.text, fontSize: 14 }}>
                          Sesi {idx + 1}
                        </Text>
                        <View style={[styles.badge, { backgroundColor: isActive ? Colors.successBg : isAutoOut ? Colors.errorBg : Colors.borderLight }]}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: isActive ? Colors.success : isAutoOut ? Colors.error : Colors.textSecondary }}>
                            {isActive ? "Berjalan" : isAutoOut ? "Auto-Checkout" : "Selesai"}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 4 }}>
                        Masuk: {formatJam(s.check_in)}
                      </Text>
                      <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>
                        Keluar: {formatJam(s.check_out)}
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.textTertiary, marginTop: 6, fontWeight: "600" }}>
                        Durasi: {isActive ? "Sedang berjalan..." : formatDurasi(s.durasi_detik)}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Lembur Modal */}
      <Modal transparent animationType="fade" visible={lemburModalVisible} onRequestClose={() => setLemburModalVisible(false)} statusBarTranslucent>
        <View style={sharedModal.overlay}>
          <View style={[sharedModal.modal, { backgroundColor: Colors.surface }]}>
            <Text style={[sharedModal.title, { color: Colors.text }]}>Ajukan Lembur</Text>
            <Text style={[sharedModal.subtitle, { color: Colors.textSecondary, marginBottom: 16 }]}>
              Berapa jam tambahan yang Anda butuhkan hari ini?
            </Text>

            <View style={{ marginBottom: 12 }}>
              <Text style={styles.inputLabel}>Durasi (Jam)</Text>
              <View style={styles.textInput}>
                <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                <TextInput
                  placeholder="Misal: 2"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="numeric"
                  value={lemburJam}
                  onChangeText={setLemburJam}
                  style={{ flex: 1, fontSize: 14, color: Colors.text }}
                />
              </View>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={styles.inputLabel}>Alasan / Pekerjaan</Text>
              <View style={styles.textInput}>
                <Ionicons name="create-outline" size={16} color={Colors.textSecondary} />
                <TextInput
                  placeholder="Misal: Membersihkan sisa acara"
                  placeholderTextColor={Colors.textTertiary}
                  value={lemburAlasan}
                  onChangeText={setLemburAlasan}
                  style={{ flex: 1, fontSize: 14, color: Colors.text }}
                  multiline
                />
              </View>
            </View>

            <View style={sharedModal.btnRow}>
              <TouchableOpacity
                style={[sharedModal.btn, { backgroundColor: Colors.borderLight }]}
                onPress={() => setLemburModalVisible(false)}
                activeOpacity={0.8}
                disabled={loadingLembur}
              >
                <Text style={[sharedModal.btnText, { color: Colors.textSecondary }]}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sharedModal.btn, { backgroundColor: Colors.warning, flex: 1.4 }]}
                onPress={handleSubmitLembur}
                activeOpacity={0.8}
                disabled={loadingLembur}
              >
                {loadingLembur ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={[sharedModal.btnText, { color: "#fff" }]}>Kirim Pengajuan</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const absenStyles = (Colors: any) => StyleSheet.create({
  title: { fontSize: 26, fontWeight: "800", color: Colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  statsWrap: { paddingHorizontal: 16, marginBottom: 16 },
  statsCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.borderLight,
    borderWidth: 1,
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statsLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  statsValue: { color: Colors.text, fontSize: 22, fontWeight: "800", marginTop: 4 },
  cappedWarning: { color: Colors.warning, fontSize: 10, marginTop: 2, fontWeight: "500" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  activePulse: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryBg, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  actionTitle: { fontSize: 18, fontWeight: "800", color: Colors.text },
  actionDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, textAlign: "center", paddingHorizontal: 20 },
  warningBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.errorBg, padding: 10, borderRadius: 8, marginTop: 12, width: "100%" },
  warningText: { fontSize: 11, color: Colors.error, fontWeight: "600", flex: 1 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, width: "100%", marginTop: 20 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: Colors.text, marginBottom: 10 },
  sessionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusChoiceBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  statusChoiceLabel: { fontSize: 12, fontWeight: "700" },
  inputLabel: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 6 },
  textInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
