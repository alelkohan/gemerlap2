import { useCallback, useState, useMemo, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Platform, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, router } from "expo-router";

import { ScreenContainer } from "@/src/components/screen-header";
import { Card, Button, EmptyState } from "@/src/components/ui";
import { DatePickerField } from "@/src/components/date-picker";
import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth-context";
import { useColors } from "@/src/lib/theme-context";
import { currentBulan, bulanLabel, addMonths, todayISO } from "@/src/lib/format";
import { generateLaporanAbsensiPdf } from "@/src/lib/pdf";

// ─── Confirm Absen Modal ──────────────────────────────────────────────────────
function ConfirmAbsenModal({
  visible,
  nama,
  onCancel,
  onConfirm,
  loading,
  Colors,
}: {
  visible: boolean;
  nama: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  Colors: any;
}) {
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}>
      <Pressable style={customModalStyles.overlay} onPress={onCancel}>
        <Pressable style={[customModalStyles.sheet, { backgroundColor: Colors.surface }]} onPress={() => {}}>
          <View style={[customModalStyles.iconWrap, { backgroundColor: Colors.errorBg }]}>
            <Ionicons name="close-circle" size={38} color={Colors.error} />
          </View>
          <Text style={[customModalStyles.title, { color: Colors.text }]}>Tandai Absen?</Text>
          <Text style={[customModalStyles.body, { color: Colors.textSecondary }]}>
            Petugas <Text style={{ fontWeight: "800", color: Colors.text }}>{nama}</Text> akan ditandai sebagai{" "}
            <Text style={{ fontWeight: "800", color: Colors.error }}>Absen</Text> pada tanggal ini.
          </Text>
          <View style={customModalStyles.btnRow}>
            <TouchableOpacity
              style={[customModalStyles.btn, { backgroundColor: Colors.borderLight }]}
              onPress={onCancel}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={[customModalStyles.btnText, { color: Colors.textSecondary }]}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[customModalStyles.btn, { backgroundColor: Colors.error, flex: 1.4 }]}
              onPress={onConfirm}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <Text style={[customModalStyles.btnText, { color: "#fff" }]}>Menyimpan...</Text>
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={[customModalStyles.btnText, { color: "#fff" }]}>Ya, Absen</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </View>
  );
}

// ─── Result Modal (error/info) ────────────────────────────────────────────────
function ResultModal({
  visible,
  title,
  message,
  onClose,
  Colors,
}: {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  Colors: any;
}) {
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}>
      <Pressable style={customModalStyles.overlay} onPress={onClose}>
        <Pressable style={[customModalStyles.sheet, { backgroundColor: Colors.surface }]} onPress={() => {}}>
          <View style={[customModalStyles.iconWrap, { backgroundColor: Colors.errorBg }]}>
            <Ionicons name="close-circle" size={38} color={Colors.error} />
          </View>
          <Text style={[customModalStyles.title, { color: Colors.text }]}>{title}</Text>
          {!!message && (
            <Text style={[customModalStyles.body, { color: Colors.textSecondary }]}>{message}</Text>
          )}
          <TouchableOpacity
            style={[customModalStyles.singleBtn, { backgroundColor: Colors.error }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={customModalStyles.singleBtnText}>OK</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </View>
  );
}

const customModalStyles = StyleSheet.create({
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

type Rekap = { petugas_id: string; nama: string; hadir: number; absen: number; izin: number; sakit: number; total_jam: number; gaji_status?: string };
type DailyRecord = { tanggal: string; status: string; keterangan?: string; jam?: number; manual?: boolean };

export default function RekapAbsensiScreen() {
  const Colors = useColors();
  const styles = useMemo(() => baseStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [bulan, setBulan] = useState(currentBulan());
  const [rekap, setRekap] = useState<Rekap[]>([]);

  // Kelola absen modal states
  const [showModal, setShowModal] = useState(false);
  const [tanggal, setTanggal] = useState(todayISO());
  const [unmarkedOfficers, setUnmarkedOfficers] = useState<{ id: string; nama: string }[]>([]);
  const [loadingUnmarked, setLoadingUnmarked] = useState(false);
  const [quickAbsenLoading, setQuickAbsenLoading] = useState<string | null>(null);

  // Custom modal states
  const [confirmAbsen, setConfirmAbsen] = useState<{ visible: boolean; id: string; nama: string }>({
    visible: false, id: "", nama: "",
  });
  const [errorModal, setErrorModal] = useState<{ visible: boolean; message: string }>({
    visible: false, message: "",
  });

  // Detail keterangan modal states
  const [showDetail, setShowDetail] = useState(false);
  const [detailPetugas, setDetailPetugas] = useState<{ id: string; nama: string } | null>(null);
  const [detailRecords, setDetailRecords] = useState<DailyRecord[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedDetailDate, setSelectedDetailDate] = useState<string>("");
  const [dateSessions, setDateSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [expandedSession, setExpandedSession] = useState(false);

  const load = useCallback(async () => {
    const data = await apiFetch<Rekap[]>(`/absensi/rekap?bulan=${bulan}`);
    
    // Fetch gaji status for each petugas
    const enrichedData = await Promise.all(data.map(async (r) => {
      try {
        const gaji = await apiFetch(`/gaji/${r.petugas_id}?periode=${bulan}`);
        return { ...r, gaji_status: gaji ? "DIBAYAR" : "BELUM" };
      } catch {
        return { ...r, gaji_status: "BELUM" };
      }
    }));
    
    setRekap(enrichedData);
  }, [bulan]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const loadUnmarked = useCallback(async (dateStr: string) => {
    setLoadingUnmarked(true);
    try {
      const data = await apiFetch<{ id: string; nama: string }[]>(`/absensi/unmarked?tanggal=${dateStr}`);
      setUnmarkedOfficers(data);
    } catch {
      setUnmarkedOfficers([]);
    } finally {
      setLoadingUnmarked(false);
    }
  }, []);

  const handleOpenModal = useCallback(() => {
    setShowModal(true);
    loadUnmarked(tanggal);
  }, [tanggal, loadUnmarked]);

  const handleQuickAbsen = useCallback(async (petugasId: string) => {
    setQuickAbsenLoading(petugasId);
    try {
      await apiFetch("/absensi/single", {
        method: "POST",
        body: {
          petugas_id: petugasId,
          tanggal,
          status: "absen",
          keterangan: "Absen (tidak hadir)",
          jam: 0,
        },
      });
      await loadUnmarked(tanggal);
      load();
    } catch (e: any) {
      setErrorModal({ visible: true, message: e.message || "Gagal menyimpan absensi" });
    } finally {
      setQuickAbsenLoading(null);
    }
  }, [tanggal, loadUnmarked, load]);

  const handleCloseModal = () => {
    setShowModal(false);
    setTanggal(todayISO());
    setUnmarkedOfficers([]);
  };

  const handleOpenDetail = useCallback(async (petugas: { id: string; nama: string }) => {
    setDetailPetugas(petugas);
    setDetailRecords([]);
    setShowDetail(true);
    setLoadingDetail(true);
    setExpandedSession(false);
    setDateSessions([]);

    const today = todayISO();
    if (today.startsWith(bulan)) {
      setSelectedDetailDate(today);
    } else {
      const parts = bulan.split("-");
      const d = new Date(Number(parts[0]), Number(parts[1]), 0);
      setSelectedDetailDate(d.toISOString().split("T")[0]);
    }

    try {
      const data = await apiFetch<DailyRecord[]>(`/absensi/detail?petugas_id=${petugas.id}&bulan=${bulan}`);
      setDetailRecords(data);
    } catch {
      setDetailRecords([]);
    } finally {
      setLoadingDetail(false);
    }
  }, [bulan]);

  useEffect(() => {
    if (showDetail && selectedDetailDate && detailPetugas) {
      const loadSessions = async () => {
        setLoadingSessions(true);
        try {
          const res = await apiFetch(`/absensi/sessions?tanggal=${selectedDetailDate}&petugas_id=${detailPetugas.id}`);
          setDateSessions(res);
        } catch {
          setDateSessions([]);
        } finally {
          setLoadingSessions(false);
        }
      };
      loadSessions();
    }
  }, [selectedDetailDate, showDetail, detailPetugas]);

  const handlePrevDay = () => {
    const [y, m, day] = selectedDetailDate.split("-").map(Number);
    const d = new Date(y, m - 1, day - 1);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const newDateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (newDateStr.startsWith(bulan)) {
      setSelectedDetailDate(newDateStr);
      setExpandedSession(false);
    }
  };

  const handleNextDay = () => {
    const [y, m, day] = selectedDetailDate.split("-").map(Number);
    const d = new Date(y, m - 1, day + 1);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const newDateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = todayISO();
    if (newDateStr.startsWith(bulan) && newDateStr <= today) {
      setSelectedDetailDate(newDateStr);
      setExpandedSession(false);
    }
  };

  return (
    <ScreenContainer title="Rekap Absensi">
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setBulan(addMonths(bulan, -1))} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.text }}>{bulanLabel(bulan)}</Text>
        <TouchableOpacity onPress={() => setBulan(addMonths(bulan, 1))} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {rekap.length === 0 ? (
          <EmptyState icon="stats-chart-outline" title="Belum ada data" />
        ) : (
          rekap.map((r) => (
            <Card key={r.petugas_id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <TouchableOpacity onPress={() => isAdmin && handleOpenDetail({ id: r.petugas_id, nama: r.nama })} activeOpacity={isAdmin ? 0.6 : 1} style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{r.nama}</Text>
                    {isAdmin && <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />}
                  </View>
                </TouchableOpacity>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {r.gaji_status === "DIBAYAR" && (
                    <View style={{ backgroundColor: Colors.successBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 10, color: Colors.success, fontWeight: "800" }}>LUNAS</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: "600" }}>{Number(r.total_jam || 0).toFixed(2)} jam kerja</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <StatPill label="Hadir" value={r.hadir} color={Colors.success} bg={Colors.successBg} />
                <StatPill label="Absen" value={r.absen} color={Colors.error} bg={Colors.errorBg} />
                <StatPill label="Izin" value={r.izin} color={Colors.warning} bg={Colors.warningBg} />
                <StatPill label="Sakit" value={r.sakit} color={Colors.info} bg={Colors.infoBg} />
              </View>
              {isAdmin && (
                <Button 
                  title={r.gaji_status === "DIBAYAR" ? "Lihat Slip Gaji (Sudah Dibayar)" : "Buat Slip Gaji"} 
                  variant={r.gaji_status === "DIBAYAR" ? "ghost" : "outline"} 
                  icon="cash-outline" 
                  onPress={() => router.push(`/master/slip-gaji?petugas_id=${r.petugas_id}&nama=${encodeURIComponent(r.nama)}&bulan=${bulan}&hadir=${r.hadir}&absen=${r.absen}&izin=${r.izin}&sakit=${r.sakit}&total_jam=${Number(r.total_jam || 0).toFixed(2)}`)}
                />
              )}
            </Card>
          ))
        )}
      </ScrollView>

      {rekap.length > 0 && isAdmin && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Kelola Absen"
                icon="calendar-outline"
                variant="outline"
                onPress={handleOpenModal}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Cetak PDF"
                icon="document-text-outline"
                onPress={() => generateLaporanAbsensiPdf(rekap, bulanLabel(bulan), user?.nama || "User")}
              />
            </View>
          </View>
        </View>
      )}

      {/* Detail Keterangan Modal */}
      <Modal visible={showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDetail(false)}>
          <Pressable style={[styles.modalSheet, { maxHeight: "80%" }]} onPress={() => {}}>
            <View style={{ alignItems: "center", paddingTop: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 12 }} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 12, color: Colors.text }}>
              Detail Absensi
            </Text>
            
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 16, backgroundColor: Colors.borderLight, padding: 8, borderRadius: 12 }}>
              <TouchableOpacity onPress={handlePrevDay} style={{ padding: 8 }}>
                <Ionicons name="chevron-back" size={20} color={Colors.text} />
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text }}>{detailPetugas?.nama}</Text>
                <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                  {new Date(selectedDetailDate + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={handleNextDay} 
                style={{ padding: 8 }}
                disabled={selectedDetailDate >= todayISO()}
              >
                <Ionicons name="chevron-forward" size={20} color={selectedDetailDate >= todayISO() ? Colors.textTertiary : Colors.text} />
              </TouchableOpacity>
            </View>

            {loadingDetail ? (
              <Text style={{ color: Colors.textSecondary, fontSize: 13, textAlign: "center", paddingVertical: 20 }}>Memuat data...</Text>
            ) : (() => {
              const rec = detailRecords.find(r => r.tanggal === selectedDetailDate);
              if (!rec) return <EmptyState icon="calendar-outline" title="Tidak ada rekaman absensi hari ini" />;
              
              const cfg = {
                hadir: { icon: "checkmark-circle" as const, color: Colors.success, bg: Colors.successBg, label: "Hadir" },
                absen: { icon: "close-circle" as const, color: Colors.error, bg: Colors.errorBg, label: "Absen" },
                izin: { icon: "information-circle" as const, color: Colors.warning, bg: Colors.warningBg, label: "Izin" },
                sakit: { icon: "medkit" as const, color: Colors.info, bg: Colors.infoBg, label: "Sakit" },
              }[rec.status] ?? { icon: "help-circle" as const, color: Colors.textSecondary, bg: Colors.borderLight, label: rec.status };

              return (
                <View style={{ width: "100%", paddingVertical: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: cfg.bg, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={cfg.icon} size={22} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.text }}>{cfg.label}</Text>
                        {rec.status === "hadir" && (
                          <TouchableOpacity onPress={() => setExpandedSession(!expandedSession)} style={{ padding: 4 }}>
                            <Ionicons name={expandedSession ? "chevron-up" : "chevron-down"} size={20} color={Colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                      </View>
                      {rec.status === "hadir" && rec.jam != null && (
                        <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: "600" }}>
                          Total: {Number(rec.jam).toFixed(2)} jam kerja
                        </Text>
                      )}
                      {rec.keterangan ? (
                        <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 4 }}>
                          Keterangan: {rec.keterangan}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Dropdown Sessions Accordion */}
                  {rec.status === "hadir" && expandedSession && (
                    <View style={{ marginTop: 16, padding: 12, backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight }}>
                      {loadingSessions ? (
                        <Text style={{ fontSize: 12, color: Colors.textSecondary, textAlign: "center" }}>Memuat rincian sesi...</Text>
                      ) : dateSessions.length === 0 ? (
                        <Text style={{ fontSize: 12, color: Colors.textSecondary, textAlign: "center" }}>Tidak ada rincian waktu</Text>
                      ) : (
                        dateSessions.map((s, i) => {
                          const ci = new Date(s.check_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                          const co = s.check_out ? new Date(s.check_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Berjalan...';
                          return (
                            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i < dateSessions.length - 1 ? 1 : 0, borderBottomColor: Colors.borderLight }}>
                              <Text style={{ fontSize: 13, color: Colors.text, fontWeight: '700' }}>Sesi {i + 1}</Text>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text style={{ fontSize: 13, color: Colors.success, fontWeight: "600" }}>{ci}</Text>
                                <Ionicons name="arrow-forward" size={12} color={Colors.textTertiary} />
                                <Text style={{ fontSize: 13, color: s.check_out ? Colors.error : Colors.warning, fontWeight: "600" }}>{co}</Text>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>
              );
            })()}

            <View style={{ marginTop: 16 }}>
              <Button title="Tutup" variant="outline" onPress={() => setShowDetail(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Manual Daily Attendance Override Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={handleCloseModal}>
        <Pressable style={styles.modalBackdrop} onPress={handleCloseModal}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={{ alignItems: "center", paddingTop: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 12 }} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 16, color: Colors.text }}>Kelola Absensi Harian</Text>
            
            <DatePickerField
              label="Tanggal"
              value={tanggal}
              onChange={(d) => { setTanggal(d); loadUnmarked(d); }}
            />

            {/* Section: Unmarked Officers */}
            {unmarkedOfficers.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.label, { marginBottom: 8 }]}>⚠️ Belum ada keterangan hari ini:</Text>
                {unmarkedOfficers.map((p, idx) => (
                  <View
                    key={`${p.id}-${idx}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      backgroundColor: Colors.errorBg,
                      borderRadius: 10,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: Colors.text, fontWeight: "600", flex: 1 }}>{p.nama}</Text>
                    <TouchableOpacity
                      onPress={() => setConfirmAbsen({ visible: true, id: p.id, nama: p.nama })}
                      disabled={quickAbsenLoading === p.id}
                      style={{
                        backgroundColor: Colors.error,
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                        {quickAbsenLoading === p.id ? "..." : "Absen"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {loadingUnmarked && (
              <Text style={{ color: Colors.textSecondary, fontSize: 13, marginTop: 8, textAlign: "center" }}>Memuat data...</Text>
            )}

            {!loadingUnmarked && unmarkedOfficers.length === 0 && (
              <Text style={{ color: Colors.success, fontSize: 13, marginTop: 8 }}>✓ Semua petugas sudah memiliki keterangan.</Text>
            )}

            <View style={{ marginTop: 20 }}>
              <Button title="Tutup" variant="outline" onPress={handleCloseModal} />
            </View>
          </Pressable>
        </Pressable>

        {/* Confirm Absen Modal (Overlay inside Modal) */}
        <ConfirmAbsenModal
          visible={confirmAbsen.visible}
          nama={confirmAbsen.nama}
          onCancel={() => setConfirmAbsen({ visible: false, id: "", nama: "" })}
          onConfirm={() => {
            const id = confirmAbsen.id;
            setConfirmAbsen({ visible: false, id: "", nama: "" });
            handleQuickAbsen(id);
          }}
          loading={quickAbsenLoading !== null}
          Colors={Colors}
        />

        {/* Error Result Modal (Overlay inside Modal) */}
        <ResultModal
          visible={errorModal.visible}
          title="Gagal"
          message={errorModal.message}
          onClose={() => setErrorModal({ visible: false, message: "" })}
          Colors={Colors}
        />
      </Modal>
    </ScreenContainer>
  );
}

function StatPill({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 10, padding: 10, alignItems: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color }}>{value}</Text>
      <Text style={{ fontSize: 10, color, fontWeight: "700", textTransform: "uppercase", marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const baseStyles = (Colors: any) => StyleSheet.create({
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  navBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.borderLight, alignItems: "center", justifyContent: "center" },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  label: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 6 },
  pickerBtn: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    paddingTop: 8,
  },
});
