import re

with open('app/keuangan/form.tsx', 'r') as f:
    content = f.read()

# 1. Add cartItems state
content = content.replace(
    'const [tipe, setTipe] = useState<Tipe>("penjualan");',
    'const [tipe, setTipe] = useState<Tipe>("penjualan");\n  const [cartItems, setCartItems] = useState<any[]>([]);'
)

# 2. Add handleAddToCart
cart_logic = """
  const handleAddToCart = () => {
    const b = parseFloat(bobot.replace(",", "."));
    const h = parseFloat(harga.replace(/[^0-9]/g, ""));
    if (!jenisId) return Alert.alert("Error", "Pilih jenis komoditas");
    if (!b || b <= 0) return Alert.alert("Error", "Berat tidak valid");
    if (!h || h <= 0) return Alert.alert("Error", "Harga tidak valid");
    
    setCartItems([...cartItems, {
      jenis_sampah_id: jenisId,
      jenis_sampah_nama: jenisName,
      bobot_kg: b,
      harga_per_kg: h,
      total: b * h
    }]);
    
    setJenisId("");
    setJenisName("");
    setBobot("");
    setHarga("");
  };

  const removeCartItem = (index: number) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };
"""
content = content.replace(
    'const handleSave = async () => {',
    cart_logic + '\n  const handleSave = async () => {'
)

# 3. Change handleSave for bulk insert
old_save_logic = """    let body: any = { tanggal, tipe };
    if (tipe === "penjualan") {
      const b = parseFloat(bobot.replace(",", "."));
      const h = parseFloat(harga.replace(/[^0-9]/g, ""));
      if (!jenisId) return Alert.alert("Error", "Pilih jenis komoditas");
      if (!namaPihak.trim()) return Alert.alert("Error", "Nama pembeli wajib diisi");
      if (!b || b <= 0) return Alert.alert("Error", "Berat tidak valid");
      if (!h || h <= 0) return Alert.alert("Error", "Harga tidak valid");
      body = { ...body, jenis_sampah_id: jenisId, nama_pihak: namaPihak, bobot_kg: b, harga_per_kg: h, total: b * h, keterangan, bukti_url: buktiUrl };
    } else if (tipe === "sumber lain") {"""

new_save_logic = """    let body: any = { tanggal, tipe };
    if (tipe === "penjualan") {
      if (!namaPihak.trim()) return Alert.alert("Error", "Nama pembeli wajib diisi");
      if (!editing && cartItems.length === 0) {
        // Automatically add to cart if filled, or alert
        const b = parseFloat(bobot.replace(",", "."));
        const h = parseFloat(harga.replace(/[^0-9]/g, ""));
        if (jenisId && b > 0 && h > 0) {
           cartItems.push({ jenis_sampah_id: jenisId, jenis_sampah_nama: jenisName, bobot_kg: b, harga_per_kg: h, total: b*h });
        } else {
           return Alert.alert("Error", "Keranjang komoditas masih kosong. Tambahkan minimal 1 komoditas.");
        }
      }
      
      if (editing) {
        const b = parseFloat(bobot.replace(",", "."));
        const h = parseFloat(harga.replace(/[^0-9]/g, ""));
        if (!b || b <= 0) return Alert.alert("Error", "Berat tidak valid");
        if (!h || h <= 0) return Alert.alert("Error", "Harga tidak valid");
        body = { ...body, jenis_sampah_id: jenisId, nama_pihak: namaPihak, bobot_kg: b, harga_per_kg: h, total: b * h, keterangan, bukti_url: buktiUrl };
      } else {
        body = { ...body, nama_pihak: namaPihak, keterangan, bukti_url: buktiUrl, items: cartItems };
      }
    } else if (tipe === "sumber lain") {"""
content = content.replace(old_save_logic, new_save_logic)

# 4. Change post route in handleSave
post_route = """      if (editing) {
        await apiFetch(`/keuangan/${id}`, { method: "PUT", body });
      } else {
        if (tipe === "penjualan") {
            await apiFetch(`/keuangan/bulk_penjualan`, { method: "POST", body });
        } else {
            await apiFetch(`/keuangan`, { method: "POST", body });
        }
      }"""
content = content.replace("""      if (editing) {
        await apiFetch(`/keuangan/${id}`, { method: "PUT", body });
      } else {
        await apiFetch(`/keuangan`, { method: "POST", body });
      }""", post_route)


# 5. UI changes
ui_old = """        {tipe === "penjualan" && (
          <>
            <Text style={styles.label}>Jenis Komoditas</Text>
            <TouchableOpacity onPress={() => setShowJenis(true)} style={styles.pickerBtn}>
              <Ionicons name="leaf-outline" size={18} color={Colors.textSecondary} />
              <Text style={{ flex: 1, color: jenisName ? Colors.text : Colors.textTertiary, fontSize: 15 }}>
                {jenisName || "Pilih komoditas"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <View style={{ marginTop: 14 }} />
            <Input label="Nama Pembeli" value={namaPihak} onChangeText={setNamaPihak} placeholder="Nama / Instansi pembeli" />
            <Input label="Berat (kg)" value={bobot} onChangeText={setBobot} keyboardType="decimal-pad" placeholder="0.0" />
            <Input label="Harga per kg (Rp)" value={harga} onChangeText={(text) => setHarga(formatRupiahInput(text))} keyboardType="numeric" placeholder="Rp 0" />
            <View style={styles.totalBox}>
              <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: "700", textTransform: "uppercase" }}>Total</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.primary, marginTop: 4 }}>
                {rupiah(totalPenjualan)}
              </Text>
            </View>
            <Input label="Keterangan (opsional)" value={keterangan} onChangeText={setKeterangan} multiline />
          </>
        )}"""

ui_new = """        {tipe === "penjualan" && (
          <>
            <Input label="Nama Pembeli" value={namaPihak} onChangeText={setNamaPihak} placeholder="Nama / Instansi pembeli" />
            <Input label="Keterangan (opsional)" value={keterangan} onChangeText={setKeterangan} multiline />
            
            <View style={{ marginVertical: 16, height: 1, backgroundColor: Colors.borderLight }} />
            
            {!editing && cartItems.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.label}>Keranjang Komoditas</Text>
                {cartItems.map((item, idx) => (
                   <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight }}>
                     <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: Colors.text }}>{item.jenis_sampah_nama}</Text>
                        <Text style={{ fontSize: 12, color: Colors.textSecondary }}>{item.bobot_kg} kg x {rupiah(item.harga_per_kg)}</Text>
                     </View>
                     <Text style={{ fontWeight: '800', color: Colors.text, marginRight: 12 }}>{rupiah(item.total)}</Text>
                     <TouchableOpacity onPress={() => removeCartItem(idx)} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={18} color={Colors.error} />
                     </TouchableOpacity>
                   </View>
                ))}
              </View>
            )}
            
            <Text style={styles.label}>{editing ? "Jenis Komoditas" : "Tambah Komoditas ke Keranjang"}</Text>
            <View style={{ backgroundColor: Colors.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight }}>
                <TouchableOpacity onPress={() => setShowJenis(true)} style={[styles.pickerBtn, { paddingVertical: 10, paddingHorizontal: 12 }]}>
                  <Ionicons name="leaf-outline" size={16} color={Colors.textSecondary} />
                  <Text style={{ flex: 1, color: jenisName ? Colors.text : Colors.textTertiary, fontSize: 14 }}>
                    {jenisName || "Pilih komoditas"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
                <View style={{ marginTop: 10 }} />
                
                <View style={{ flexDirection: 'row', gap: 10 }}>
                   <View style={{ flex: 1 }}>
                     <Input label="Berat (kg)" value={bobot} onChangeText={setBobot} keyboardType="decimal-pad" placeholder="0.0" />
                   </View>
                   <View style={{ flex: 1 }}>
                     <Input label="Harga/kg (Rp)" value={harga} onChangeText={(text) => setHarga(formatRupiahInput(text))} keyboardType="numeric" placeholder="Rp 0" />
                   </View>
                </View>
                
                {!editing && (
                    <Button title="Tambahkan ke Keranjang" onPress={handleAddToCart} variant="outline" style={{ marginTop: 4 }} />
                )}
            </View>

            <View style={[styles.totalBox, { marginTop: 16 }]}>
              <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: "700", textTransform: "uppercase" }}>Total Seluruh Penjualan</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.primary, marginTop: 4 }}>
                {editing ? rupiah(totalPenjualan) : rupiah(cartItems.reduce((acc, it) => acc + it.total, 0) + (totalPenjualan || 0))}
              </Text>
            </View>
          </>
        )}"""

content = content.replace(ui_old, ui_new)

with open('app/keuangan/form.tsx', 'w') as f:
    f.write(content)
