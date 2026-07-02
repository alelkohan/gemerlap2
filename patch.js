const fs = require('fs');
let content = fs.readFileSync('app/(tabs)/absen.tsx', 'utf8');

// 1. Imports
content = content.replace(
  `import { Card, EmptyState, ConfirmDialog } from "@/src/components/ui";`,
  `import { Card, EmptyState, ConfirmDialog } from "@/src/components/ui";` // already there
);

// 2. States
content = content.replace(
  `  const [lemburModalVisible, setLemburModalVisible] = useState(false);\n  const [lemburJam, setLemburJam] = useState("");`,
  `  const [lemburModalVisible, setLemburModalVisible] = useState(false);\n  const [showAlasanPicker, setShowAlasanPicker] = useState(false);\n  const [lemburJam, setLemburJam] = useState("");\n  const [deleteLemburId, setDeleteLemburId] = useState<string | null>(null);`
);

// 3. handleDeleteLembur
content = content.replace(
  `  useEffect(() => {\n    if (!status?.has_active_session) return;`,
  `  const handleDeleteLembur = async () => {\n    if (!deleteLemburId) return;\n    try {\n      await apiFetch(\`/lembur/\${deleteLemburId}\`, { method: "DELETE" });\n      setDeleteLemburId(null);\n      showResult("success", "Sukses", "Pengajuan lembur berhasil dihapus.");\n      loadLembur();\n    } catch (e: any) {\n      showResult("error", "Gagal", e.message || "Gagal membatalkan lembur");\n      setDeleteLemburId(null);\n    }\n  };\n\n  useEffect(() => {\n    if (!status?.has_active_session) return;`
);

// 4. Update the history rendering
content = content.replace(
  `                    <View style={{ justifyContent: "center" }}>
                      <Text style={{ 
                        fontSize: 11, fontWeight: "bold",
                        color: l.status === "approved" ? Colors.success : (l.status === "rejected" ? Colors.error : Colors.warning) 
                      }}>
                        {l.status.toUpperCase()}
                      </Text>
                    </View>`,
  `                    <View style={{ justifyContent: "center", alignItems: "flex-end", gap: 6 }}>
                      <Text style={{ 
                        fontSize: 11, fontWeight: "bold",
                        color: l.status === "approved" ? Colors.success : (l.status === "rejected" ? Colors.error : Colors.warning) 
                      }}>
                        {l.status.toUpperCase()}
                      </Text>
                      {l.status === "pending" && (
                        <TouchableOpacity onPress={() => setDeleteLemburId(l.id)}>
                          <Ionicons name="trash-outline" size={16} color={Colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>`
);

// 5. Replace the TextInput for lemburAlasan with Inline Picker
const oldPicker = `            <View style={{ width: "100%", marginBottom: 20 }}>
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
            </View>`;

const newPicker = `            <View style={{ width: "100%", marginBottom: 20 }}>
              <Text style={styles.inputLabel}>Alasan / Pekerjaan</Text>
              <TouchableOpacity
                style={styles.textInput}
                onPress={() => setShowAlasanPicker(!showAlasanPicker)}
              >
                <Ionicons name="create-outline" size={16} color={Colors.textSecondary} />
                <Text style={{ flex: 1, fontSize: 14, color: lemburAlasan ? Colors.text : Colors.textTertiary, marginLeft: 8 }}>
                  {lemburAlasan || "Pilih Target / Pekerjaan..."}
                </Text>
                <Ionicons name={showAlasanPicker ? "chevron-up" : "chevron-down"} size={16} color={Colors.textSecondary} />
              </TouchableOpacity>

              {showAlasanPicker && (
                <View style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 12, marginTop: 4, maxHeight: 180 }}>
                  <ScrollView nestedScrollEnabled>
                    {[
                      "Target Pemilihan",
                      "Target Finishing",
                      "Target Packing Komoditas",
                      "Target Kompos",
                      "Target Magot",
                      "Target Pembakaran Residu",
                    ].map((opt, idx, arr) => (
                      <TouchableOpacity
                        key={opt}
                        style={{ 
                          padding: 12, 
                          borderBottomWidth: idx === arr.length - 1 ? 0 : 1, 
                          borderBottomColor: Colors.borderLight,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between"
                        }}
                        onPress={() => {
                          setLemburAlasan(opt);
                          setShowAlasanPicker(false);
                        }}
                      >
                        <Text style={{ fontSize: 14, color: Colors.text }}>{opt}</Text>
                        {lemburAlasan === opt && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>`;

content = content.replace(oldPicker, newPicker);

// 6. Add ConfirmDialog at the end of the file
content = content.replace(
  `    </SafeAreaView>
  );
}`,
  `      <ConfirmDialog
        visible={!!deleteLemburId}
        title="Hapus Pengajuan"
        message="Yakin ingin menghapus pengajuan lembur ini?"
        onCancel={() => setDeleteLemburId(null)}
        onConfirm={handleDeleteLembur}
        confirmText="Hapus"
      />
    </SafeAreaView>
  );
}`
);

fs.writeFileSync('app/(tabs)/absen.tsx', content);
console.log("Done");
