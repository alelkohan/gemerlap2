import re

with open('server.py', 'r') as f:
    content = f.read()

# 1. Add Pydantic Models for Kasbon
models = """
class KasbonCreate(BaseModel):
    petugas_id: str
    nominal: float
    keterangan: Optional[str] = ""

"""
content = content.replace("class GajiCreate(BaseModel):", models + "class GajiCreate(BaseModel):\n    kasbon_ids: Optional[List[str]] = []\n")

# 2. Add Endpoints
endpoints = """
# ============== KASBON ==============
@api_router.get('/kasbon')
async def get_all_kasbon(current=Depends(admin_required)):
    docs = await db.kasbon.find({}, {'_id': 0}).sort('tanggal', -1).to_list(1000)
    # enrich with petugas name
    for doc in docs:
        petugas = await db.petugas.find_one({'id': doc['petugas_id']})
        doc['nama_petugas'] = petugas['nama'] if petugas else 'Unknown'
    return docs

@api_router.get('/kasbon/pending/{petugas_id}')
async def get_pending_kasbon(petugas_id: str, current=Depends(admin_required)):
    docs = await db.kasbon.find({'petugas_id': petugas_id, 'status': 'pending'}, {'_id': 0}).to_list(100)
    return docs

@api_router.post('/kasbon')
async def create_kasbon(req: KasbonCreate, current=Depends(admin_required)):
    if req.nominal <= 0:
        raise HTTPException(status_code=400, detail='Nominal kasbon harus lebih dari 0')
    
    # Validasi Saldo
    pipeline_saldo = [{'$group': {'_id': '$tipe', 'total': {'$sum': '$total'}}}]
    rsaldo = await db.keuangan.aggregate(pipeline_saldo).to_list(10)
    masuk = sum(r['total'] for r in rsaldo if r['_id'] in ('penjualan', 'sumber lain', 'retribusi'))
    keluar = sum(r['total'] for r in rsaldo if r['_id'] == 'pengeluaran')
    saldo_saat_ini = masuk - keluar
    
    if req.nominal > saldo_saat_ini:
        raise HTTPException(status_code=400, detail=f'Saldo kas tidak mencukupi untuk memberikan kasbon. Saldo: Rp {saldo_saat_ini:,.0f}')
        
    tanggal = datetime.now().strftime('%Y-%m-%d')
    no_invoice = await generate_invoice_no(tanggal)
    
    petugas = await db.petugas.find_one({'id': req.petugas_id}, {'_id': 0, 'nama': 1})
    nama_petugas = petugas['nama'] if petugas else 'Petugas'
    
    keterangan_kas = f"Pinjaman/Kasbon: {nama_petugas}"
    if req.keterangan:
        keterangan_kas += f" ({req.keterangan})"
        
    keuangan_id = new_id()
    transaksi_doc = {
        'id': keuangan_id,
        'tanggal': tanggal,
        'tipe': 'pengeluaran',
        'kategori': 'Kasbon',
        'nama_pihak': nama_petugas,
        'total': req.nominal,
        'keterangan': keterangan_kas,
        'no_invoice': no_invoice,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.keuangan.insert_one(transaksi_doc)
    
    kasbon_doc = {
        'id': new_id(),
        'petugas_id': req.petugas_id,
        'tanggal': tanggal,
        'nominal': req.nominal,
        'keterangan': req.keterangan,
        'status': 'pending',
        'keuangan_id': keuangan_id,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.kasbon.insert_one(kasbon_doc)
    
    return {'message': 'Kasbon berhasil dicatat'}

@api_router.delete('/kasbon/{id}')
async def delete_kasbon(id: str, current=Depends(admin_required)):
    kasbon = await db.kasbon.find_one({'id': id})
    if not kasbon:
        raise HTTPException(status_code=404, detail='Kasbon tidak ditemukan')
    if kasbon['status'] == 'lunas':
        raise HTTPException(status_code=400, detail='Kasbon yang sudah lunas tidak dapat dihapus')
        
    await db.keuangan.delete_one({'id': kasbon['keuangan_id']})
    await db.kasbon.delete_one({'id': id})
    return {'message': 'Kasbon berhasil dihapus'}

"""
content = content.replace("# ============== SLIP GAJI ==============", endpoints + "\n# ============== SLIP GAJI ==============")

# 3. Update create_gaji to process kasbon_ids
update_gaji = """
    # 3. Update Kasbon (jika ada)
    if getattr(req, 'kasbon_ids', None):
        await db.kasbon.update_many(
            {'id': {'$in': req.kasbon_ids}},
            {'$set': {'status': 'lunas', 'slip_gaji_id': req.periode}}
        )
"""
content = content.replace("    return {'message': 'Gaji berhasil disimpan', 'id': gaji_id}", update_gaji + "\n    return {'message': 'Gaji berhasil disimpan', 'id': gaji_id}")

with open('server.py', 'w') as f:
    f.write(content)
