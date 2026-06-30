import re

with open('app/master/slip-gaji.tsx', 'r') as f:
    content = f.read()

# 1. Add state for kasbon
content = content.replace(
    'const [gajiId, setGajiId] = useState<string | null>(null);',
    'const [gajiId, setGajiId] = useState<string | null>(null);\n  const [kasbonIds, setKasbonIds] = useState<string[]>([]);\n  const [kasbonDetails, setKasbonDetails] = useState<any[]>([]);'
)

# 2. Modify load function
load_original = """    async function load() {
      try {
        const gaji = await apiFetch(`/gaji/${petugas_id}?periode=${bulan}`);
        if (gaji) {
          setGajiId(gaji.id);
          setGajiPokok(formatRupiahInput(gaji.gaji_pokok.toString()));
          setTunjangan(formatRupiahInput(gaji.tunjangan.toString()));
          setPotongan(formatRupiahInput(gaji.potongan.toString()));
          setKeterangan(gaji.keterangan || "");
          setBuktiUrl(gaji.bukti_url || "");
          setIsLunas(true);
        }
      } catch (e) {
        // Not found, normal flow
      } finally {
        setInitLoading(false);
      }
    }"""

load_new = """    async function load() {
      try {
        let kasbons = [];
        try {
          kasbons = await apiFetch(`/kasbon/pending/${petugas_id}`);
        } catch(e) {}
        
        let pot = initPotongan;
        let ketList = [];
        if (dendaAlpha > 0) ketList.push(`Potongan Alpha (${absen} hari)`);
        if (dendaTelat > 0) ketList.push(`Potongan Keterlambatan (${deficitJam.toFixed(2)} jam)`);
        if (uangLembur > 0) ketList.push(`Termasuk lembur (${extraJam.toFixed(2)} jam)`);

        let kIds: string[] = [];
        if (kasbons && kasbons.length > 0) {
           setKasbonDetails(kasbons);
           const sumKasbon = kasbons.reduce((acc: number, k: any) => acc + k.nominal, 0);
           pot += sumKasbon;
           kasbons.forEach((k: any) => kIds.push(k.id));
           ketList.push(`Potongan Kasbon (Rp ${sumKasbon.toLocaleString("id-ID")})`);
        }

        const gaji = await apiFetch(`/gaji/${petugas_id}?periode=${bulan}`);
        if (gaji) {
          setGajiId(gaji.id);
          setGajiPokok(formatRupiahInput(gaji.gaji_pokok.toString()));
          setTunjangan(formatRupiahInput(gaji.tunjangan.toString()));
          setPotongan(formatRupiahInput(gaji.potongan.toString()));
          setKeterangan(gaji.keterangan || "");
          setBuktiUrl(gaji.bukti_url || "");
          setIsLunas(true);
        } else {
           if (kasbons && kasbons.length > 0) {
               setPotongan(formatRupiahInput(Math.round(pot).toString()));
               setKeterangan(ketList.join(", "));
               setKasbonIds(kIds);
           }
        }
      } catch (e) {
        // Not found, normal flow
      } finally {
        setInitLoading(false);
      }
    }"""
content = content.replace(load_original, load_new)

# 3. Add kasbon_ids to POST /gaji
post_original = """          total_bersih: totalBersih,
          keterangan,
          bukti_url: buktiUrl"""

post_new = """          total_bersih: totalBersih,
          keterangan,
          bukti_url: buktiUrl,
          kasbon_ids: kasbonIds"""
content = content.replace(post_original, post_new)

# 4. Show kasbon info in UI (after Tunjangan input)
potongan_ui_original = """            <Input
              label="Potongan (Rp)"
              placeholder="0"
              keyboardType="number-pad"
              value={potongan}
              onChangeText={(val) => {
                if (!isLunas) setPotongan(formatRupiahInput(val));
              }}
              editable={!isLunas}
            />"""

potongan_ui_new = """            <View>
              <Input
                label="Potongan (Rp)"
                placeholder="0"
                keyboardType="number-pad"
                value={potongan}
                onChangeText={(val) => {
                  if (!isLunas) setPotongan(formatRupiahInput(val));
                }}
                editable={!isLunas}
              />
              {!isLunas && kasbonDetails.length > 0 && (
                <View style={{ backgroundColor: Colors.warningBg, padding: 12, borderRadius: 8, marginTop: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.warning, marginBottom: 4 }}>
                    Peringatan Kasbon
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.warning }}>
                    Petugas ini memiliki {kasbonDetails.length} kasbon yang belum lunas (total Rp {kasbonDetails.reduce((a, b) => a + b.nominal, 0).toLocaleString('id-ID')}). Nilai ini sudah otomatis ditambahkan ke kolom Potongan. Saat slip gaji disimpan, kasbon akan otomatis Lunas.
                  </Text>
                </View>
              )}
            </View>"""
content = content.replace(potongan_ui_original, potongan_ui_new)

with open('app/master/slip-gaji.tsx', 'w') as f:
    f.write(content)
