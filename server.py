from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timedelta, timezone, date
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT config
SECRET_KEY = os.environ.get('JWT_SECRET', 'tps-manager-secret-key-change-in-prod-gemerlap-2026')
ALGORITHM = 'HS256'
TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days for mobile

app = FastAPI(title="TPS Manager API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()


# ============== HELPERS ==============
def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        'sub': user_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail='Invalid token')
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail='Invalid token')

    user = await db.users.find_one({'id': user_id}, {'_id': 0})
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    return user


async def admin_required(current=Depends(get_current_user)):
    if current.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin only')
    return current


# ============== MODELS ==============
class LoginRequest(BaseModel):
    no_hp: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    user: dict


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserCreate(BaseModel):
    nama: str
    no_hp: str
    password: str
    role: Literal['admin', 'petugas']


class UserUpdate(BaseModel):
    nama: Optional[str] = None
    role: Optional[Literal['admin', 'petugas']] = None
    password: Optional[str] = None


class UnitModel(BaseModel):
    nama: str
    aktif: bool = True


class JenisSampahModel(BaseModel):
    nama: str
    tipe: Literal['komoditas', 'bakar', 'lain']


class PetugasModel(BaseModel):
    nama: str
    no_hp: Optional[str] = ''
    jabatan: Optional[str] = 'Petugas'
    tgl_bergabung: Optional[str] = None
    foto_base64: Optional[str] = None
    status: bool = True
    user_id: Optional[str] = None


class TimbanganCreate(BaseModel):
    tanggal: str  # YYYY-MM-DD
    jam: str  # HH:MM
    unit_id: str
    bobot_total: float


class PilahanItem(BaseModel):
    jenis_sampah_id: str
    bobot: float


class PilahanSave(BaseModel):
    items: List[PilahanItem]


class KeuanganCreate(BaseModel):
    tanggal: str
    tipe: Literal['penjualan', 'sumber lain', 'pengeluaran']
    jenis_sampah_id: Optional[str] = None
    nama_pihak: Optional[str] = None
    bobot_kg: Optional[float] = None
    harga_per_kg: Optional[float] = None
    total: float
    keterangan: Optional[str] = None
    kategori: Optional[str] = None


class AbsensiItem(BaseModel):
    petugas_id: str
    status: Literal['hadir', 'absen', 'izin', 'sakit']
    keterangan: Optional[str] = ''
    jam: Optional[float] = 0


class AbsensiSave(BaseModel):
    tanggal: str
    items: List[AbsensiItem]


class GajiCreate(BaseModel):
    petugas_id: str
    periode: str
    gaji_pokok: float
    tunjangan: Optional[float] = 0
    potongan: Optional[float] = 0
    total_bersih: float
    keterangan: Optional[str] = ''


# ============== AUTH ==============
@api_router.post('/auth/login', response_model=TokenResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({'no_hp': req.no_hp}, {'_id': 0})
    if not user or not verify_password(req.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Nomor HP atau password salah')
    token = create_token(user['id'], user['role'])
    safe_user = {k: v for k, v in user.items() if k != 'password_hash'}
    return TokenResponse(access_token=token, user=safe_user)


@api_router.get('/auth/me')
async def me(current=Depends(get_current_user)):
    safe = {k: v for k, v in current.items() if k != 'password_hash'}
    return safe


@api_router.post('/auth/change-password')
async def change_password(req: ChangePasswordRequest, current=Depends(get_current_user)):
    full = await db.users.find_one({'id': current['id']}, {'_id': 0})
    if not verify_password(req.current_password, full['password_hash']):
        raise HTTPException(status_code=400, detail='Password lama salah')
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail='Password baru minimal 6 karakter')
    await db.users.update_one({'id': current['id']}, {'$set': {'password_hash': hash_password(req.new_password)}})
    return {'message': 'Password berhasil diubah'}


# ============== USERS (admin) ==============
@api_router.get('/users')
async def list_users(current=Depends(admin_required)):
    users = await db.users.find({}, {'_id': 0, 'password_hash': 0}).to_list(1000)
    return users


@api_router.post('/users')
async def create_user(req: UserCreate, current=Depends(admin_required)):
    existing = await db.users.find_one({'no_hp': req.no_hp})
    if existing:
        raise HTTPException(status_code=400, detail='Nomor HP sudah terdaftar')
    user_doc = {
        'id': new_id(),
        'nama': req.nama,
        'no_hp': req.no_hp,
        'password_hash': hash_password(req.password),
        'role': req.role,
        'created_at': now_iso(),
    }
    await db.users.insert_one(user_doc)
    return {k: v for k, v in user_doc.items() if k not in ('password_hash', '_id')}


@api_router.put('/users/{user_id}')
async def update_user(user_id: str, req: UserUpdate, current=Depends(admin_required)):
    upd = {}
    if req.nama is not None:
        upd['nama'] = req.nama
    if req.role is not None:
        upd['role'] = req.role
    if req.password:
        upd['password_hash'] = hash_password(req.password)
    if not upd:
        raise HTTPException(status_code=400, detail='Nothing to update')
    res = await db.users.update_one({'id': user_id}, {'$set': upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail='User tidak ditemukan')
    return {'message': 'updated'}


@api_router.delete('/users/{user_id}')
async def delete_user(user_id: str, current=Depends(admin_required)):
    if user_id == current['id']:
        raise HTTPException(status_code=400, detail='Tidak bisa menghapus akun sendiri')
    res = await db.users.delete_one({'id': user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail='User tidak ditemukan')
    return {'message': 'deleted'}


# ============== UNITS ==============
@api_router.get('/units')
async def list_units(current=Depends(get_current_user)):
    return await db.units.find({}, {'_id': 0}).sort('nama', 1).to_list(1000)


@api_router.post('/units')
async def create_unit(req: UnitModel, current=Depends(get_current_user)):
    doc = {'id': new_id(), 'nama': req.nama, 'aktif': req.aktif}
    await db.units.insert_one(doc)
    return {k: v for k, v in doc.items() if k != '_id'}


@api_router.put('/units/{unit_id}')
async def update_unit(unit_id: str, req: UnitModel, current=Depends(get_current_user)):
    await db.units.update_one({'id': unit_id}, {'$set': {'nama': req.nama, 'aktif': req.aktif}})
    return {'message': 'updated'}


@api_router.delete('/units/{unit_id}')
async def delete_unit(unit_id: str, current=Depends(get_current_user)):
    # Cek penggunaan di timbangan
    used = await db.timbangan.find_one({'unit_id': unit_id})
    if used:
        raise HTTPException(status_code=400, detail='Unit tidak bisa dihapus karena sudah memiliki data timbangan')
    
    await db.units.delete_one({'id': unit_id})
    return {'message': 'deleted'}


# ============== JENIS SAMPAH ==============
@api_router.get('/jenis-sampah')
async def list_jenis(current=Depends(get_current_user)):
    return await db.jenis_sampah.find({}, {'_id': 0}).sort('nama', 1).to_list(1000)


@api_router.post('/jenis-sampah')
async def create_jenis(req: JenisSampahModel, current=Depends(get_current_user)):
    doc = {'id': new_id(), 'nama': req.nama, 'tipe': req.tipe}
    await db.jenis_sampah.insert_one(doc)
    return {k: v for k, v in doc.items() if k != '_id'}


@api_router.put('/jenis-sampah/{jid}')
async def update_jenis(jid: str, req: JenisSampahModel, current=Depends(get_current_user)):
    await db.jenis_sampah.update_one({'id': jid}, {'$set': {'nama': req.nama, 'tipe': req.tipe}})
    return {'message': 'updated'}


@api_router.delete('/jenis-sampah/{jid}')
async def delete_jenis(jid: str, current=Depends(get_current_user)):
    # Cek penggunaan di pilahan
    used_pilah = await db.pilahan.find_one({'jenis_sampah_id': jid})
    if used_pilah:
        raise HTTPException(status_code=400, detail='Jenis sampah tidak bisa dihapus karena sudah digunakan di data pilahan')
    
    # Cek penggunaan di keuangan
    used_keuangan = await db.keuangan.find_one({'jenis_sampah_id': jid})
    if used_keuangan:
        raise HTTPException(status_code=400, detail='Jenis sampah tidak bisa dihapus karena sudah tercatat di histori keuangan')

    await db.jenis_sampah.delete_one({'id': jid})
    return {'message': 'deleted'}


# ============== PETUGAS ==============
@api_router.get('/petugas')
async def list_petugas(current=Depends(get_current_user)):
    return await db.petugas.find({}, {'_id': 0}).sort('nama', 1).to_list(1000)


@api_router.post('/petugas')
async def create_petugas(req: PetugasModel, current=Depends(admin_required)):
    doc = {'id': new_id(), **req.dict(), 'created_at': now_iso()}
    await db.petugas.insert_one(doc)
    return {k: v for k, v in doc.items() if k != '_id'}


@api_router.put('/petugas/{pid}')
async def update_petugas(pid: str, req: PetugasModel, current=Depends(admin_required)):
    await db.petugas.update_one({'id': pid}, {'$set': req.dict()})
    return {'message': 'updated'}


@api_router.delete('/petugas/{pid}')
async def delete_petugas(pid: str, current=Depends(admin_required)):
    await db.petugas.delete_one({'id': pid})
    return {'message': 'deleted'}


# ============== TIMBANGAN ==============
async def enrich_timbangan(item):
    """Add unit name and pilahan info"""
    unit = await db.units.find_one({'id': item.get('unit_id')}, {'_id': 0, 'nama': 1})
    item['unit_nama'] = unit['nama'] if unit else '-'
    return item


@api_router.get('/timbangan')
async def list_timbangan(current=Depends(get_current_user)):
    items = await db.timbangan.find({}, {'_id': 0}).sort([('tanggal', -1), ('jam', -1)]).to_list(2000)
    for it in items:
        await enrich_timbangan(it)
    return items


@api_router.post('/timbangan')
async def create_timbangan(req: TimbanganCreate, current=Depends(get_current_user)):
    if req.bobot_total <= 0:
        raise HTTPException(status_code=400, detail='Bobot harus > 0')
    doc = {
        'id': new_id(),
        'tanggal': req.tanggal,
        'jam': req.jam,
        'unit_id': req.unit_id,
        'bobot_total': req.bobot_total,
        'status_pilah': False,
        'user_id': current['id'],
        'created_at': now_iso(),
    }
    await db.timbangan.insert_one(doc)
    enriched = await enrich_timbangan(doc)
    return {k: v for k, v in enriched.items() if k != '_id'}


@api_router.put('/timbangan/{tid}')
async def update_timbangan(tid: str, req: TimbanganCreate, current=Depends(get_current_user)):
    if req.bobot_total <= 0:
        raise HTTPException(status_code=400, detail='Bobot harus > 0')
    await db.timbangan.update_one({'id': tid}, {'$set': req.dict()})
    return {'message': 'updated'}


@api_router.delete('/timbangan/{tid}')
async def delete_timbangan(tid: str, current=Depends(get_current_user)):
    await db.timbangan.delete_one({'id': tid})
    await db.pilahan.delete_many({'timbangan_id': tid})
    return {'message': 'deleted'}


@api_router.get('/timbangan/{tid}/pilahan')
async def get_pilahan(tid: str, current=Depends(get_current_user)):
    return await db.pilahan.find({'timbangan_id': tid}, {'_id': 0}).to_list(100)


@api_router.post('/timbangan/{tid}/pilahan')
async def save_pilahan(tid: str, req: PilahanSave, current=Depends(get_current_user)):
    timb = await db.timbangan.find_one({'id': tid}, {'_id': 0})
    if not timb:
        raise HTTPException(status_code=404, detail='Timbangan tidak ditemukan')
    total_pilahan = sum(i.bobot for i in req.items if i.bobot > 0)
    if total_pilahan > timb['bobot_total'] + 0.001:
        raise HTTPException(status_code=400, detail=f"Total pilahan ({total_pilahan} kg) melebihi bobot timbangan ({timb['bobot_total']} kg)")
    # Replace all pilahan for this timbangan
    await db.pilahan.delete_many({'timbangan_id': tid})
    docs = []
    for it in req.items:
        if it.bobot > 0:
            docs.append({
                'id': new_id(),
                'timbangan_id': tid,
                'jenis_sampah_id': it.jenis_sampah_id,
                'bobot': it.bobot,
            })
    if docs:
        await db.pilahan.insert_many(docs)
    # Update status_pilah
    status_pilah = total_pilahan >= timb['bobot_total'] - 0.001
    await db.timbangan.update_one({'id': tid}, {'$set': {'status_pilah': status_pilah}})
    return {'message': 'saved', 'status_pilah': status_pilah, 'total_pilahan': total_pilahan}


# ============== KEUANGAN ==============
async def generate_invoice_no(tanggal: str) -> str:
    """Format: INV-YYYY/MM/NNN, reset per month"""
    yy = tanggal[0:4]
    mm = tanggal[5:7]
    prefix = f"INV-{yy}/{mm}/"
    # Find last invoice with this prefix
    last = await db.keuangan.find({'no_invoice': {'$regex': f'^{prefix}'}}).sort('no_invoice', -1).limit(1).to_list(1)
    if last:
        last_num = int(last[0]['no_invoice'].split('/')[-1])
        next_num = last_num + 1
    else:
        next_num = 1
    return f"{prefix}{next_num:03d}"


@api_router.get('/keuangan')
async def list_keuangan(current=Depends(get_current_user)):
    items = await db.keuangan.find({}, {'_id': 0}).sort([('tanggal', -1), ('created_at', -1)]).to_list(2000)
    return items


@api_router.get('/keuangan/saldo')
async def get_saldo(current=Depends(get_current_user)):
    pipeline = [
        {'$group': {
            '_id': '$tipe',
            'total': {'$sum': '$total'},
        }}
    ]
    res = await db.keuangan.aggregate(pipeline).to_list(10)
    masuk = sum(r['total'] for r in res if r['_id'] in ('penjualan', 'sumber lain'))
    keluar = sum(r['total'] for r in res if r['_id'] == 'pengeluaran')
    return {'saldo': masuk - keluar, 'pemasukan': masuk, 'pengeluaran': keluar}


@api_router.post('/keuangan')
async def create_keuangan(req: KeuanganCreate, current=Depends(get_current_user)):
    no_invoice = await generate_invoice_no(req.tanggal)
    doc = {
        'id': new_id(),
        'no_invoice': no_invoice,
        **req.dict(),
        'user_id': current['id'],
        'user_nama': current.get('nama'),
        'created_at': now_iso(),
    }
    await db.keuangan.insert_one(doc)
    return {k: v for k, v in doc.items() if k != '_id'}


@api_router.put('/keuangan/{kid}')
async def update_keuangan(kid: str, req: KeuanganCreate, current=Depends(get_current_user)):
    await db.keuangan.update_one({'id': kid}, {'$set': req.dict()})
    return {'message': 'updated'}


@api_router.delete('/keuangan/{kid}')
async def delete_keuangan(kid: str, current=Depends(get_current_user)):
    await db.keuangan.delete_one({'id': kid})
    return {'message': 'deleted'}


@api_router.get('/keuangan/{kid}')
async def get_keuangan(kid: str, current=Depends(get_current_user)):
    doc = await db.keuangan.find_one({'id': kid}, {'_id': 0})
    if not doc:
        raise HTTPException(status_code=404, detail='Not found')
    # Enrich with jenis sampah name
    if doc.get('jenis_sampah_id'):
        jenis = await db.jenis_sampah.find_one({'id': doc['jenis_sampah_id']}, {'_id': 0, 'nama': 1})
        doc['jenis_sampah_nama'] = jenis['nama'] if jenis else '-'
    return doc


# ============== ABSENSI ==============
@api_router.get('/absensi')
async def get_absensi_by_date(tanggal: str, current=Depends(get_current_user)):
    return await db.absensi.find({'tanggal': tanggal}, {'_id': 0}).to_list(1000)


@api_router.post('/absensi')
async def save_absensi(req: AbsensiSave, current=Depends(admin_required)):
    # Delete existing for that date, then insert all
    await db.absensi.delete_many({'tanggal': req.tanggal})
    docs = []
    for it in req.items:
        docs.append({
            'id': new_id(),
            'petugas_id': it.petugas_id,
            'tanggal': req.tanggal,
            'status': it.status,
            'keterangan': it.keterangan or '',
            'jam': it.jam or 0,
            'dicatat_oleh': current['id'],
            'created_at': now_iso(),
        })
    if docs:
        await db.absensi.insert_many(docs)
    return {'message': 'saved', 'count': len(docs)}


@api_router.get('/absensi/rekap')
async def rekap_absensi(bulan: str, current=Depends(get_current_user)):
    """bulan = YYYY-MM"""
    pipeline = [
        {'$match': {'tanggal': {'$regex': f'^{bulan}'}}},
        {'$group': {
            '_id': {'petugas_id': '$petugas_id', 'status': '$status'},
            'count': {'$sum': 1},
            'total_jam': {'$sum': {'$ifNull': ['$jam', 0]}},
        }},
    ]
    res = await db.absensi.aggregate(pipeline).to_list(10000)
    # Group by petugas_id
    petugas_list = await db.petugas.find({'status': True}, {'_id': 0}).to_list(1000)
    rekap = {}
    for p in petugas_list:
        rekap[p['id']] = {'petugas_id': p['id'], 'nama': p['nama'], 'hadir': 0, 'absen': 0, 'izin': 0, 'sakit': 0, 'total_jam': 0}
    for r in res:
        pid = r['_id']['petugas_id']
        st = r['_id']['status']
        if pid in rekap:
            rekap[pid][st] = r['count']
            if st == 'hadir':
                rekap[pid]['total_jam'] += r.get('total_jam', 0)
    return list(rekap.values())


# ============== DASHBOARD ==============
@api_router.get('/dashboard/stats')
async def dashboard_stats(bulan: Optional[str] = None, current=Depends(get_current_user)):
    if not bulan:
        bulan = datetime.now().strftime('%Y-%m')

    # Total berat bulan ini
    pipeline_berat = [
        {'$match': {'tanggal': {'$regex': f'^{bulan}'}}},
        {'$group': {'_id': None, 'total': {'$sum': '$bobot_total'}}},
    ]
    res = await db.timbangan.aggregate(pipeline_berat).to_list(1)
    total_berat = res[0]['total'] if res else 0

    # Saldo
    pipeline_saldo = [{'$group': {'_id': '$tipe', 'total': {'$sum': '$total'}}}]
    rsaldo = await db.keuangan.aggregate(pipeline_saldo).to_list(10)
    masuk = sum(r['total'] for r in rsaldo if r['_id'] in ('penjualan', 'sumber lain'))
    keluar = sum(r['total'] for r in rsaldo if r['_id'] == 'pengeluaran')
    saldo = masuk - keluar

    # Jumlah catatan masuk bulan ini
    catatan_masuk = await db.timbangan.count_documents({'tanggal': {'$regex': f'^{bulan}'}})

    # Belum dipilah (semua)
    belum_dipilah = await db.timbangan.count_documents({'status_pilah': False})

    # Bar chart: berat per hari bulan ini
    pipeline_chart = [
        {'$match': {'tanggal': {'$regex': f'^{bulan}'}}},
        {'$group': {'_id': '$tanggal', 'total': {'$sum': '$bobot_total'}}},
        {'$sort': {'_id': 1}},
    ]
    chart_raw = await db.timbangan.aggregate(pipeline_chart).to_list(40)
    chart = [{'tanggal': r['_id'], 'total': r['total']} for r in chart_raw]

    # 5 aktivitas terbaru
    recent = await db.timbangan.find({}, {'_id': 0}).sort([('tanggal', -1), ('jam', -1)]).limit(5).to_list(5)
    for it in recent:
        await enrich_timbangan(it)

    return {
        'total_berat': total_berat,
        'saldo': saldo,
        'catatan_masuk': catatan_masuk,
        'belum_dipilah': belum_dipilah,
        'chart': chart,
        'recent': recent,
        'bulan': bulan,
    }


# ============== GAJI ==============
@api_router.get('/gaji/{petugas_id}')
async def get_gaji(petugas_id: str, periode: str, current=Depends(admin_required)):
    gaji = await db.gaji.find_one({'petugas_id': petugas_id, 'periode': periode}, {'_id': 0})
    if not gaji:
        raise HTTPException(status_code=404, detail='Gaji not found')
    return gaji


@api_router.delete('/gaji/{gid}')
async def delete_gaji(gid: str, current=Depends(admin_required)):
    gaji = await db.gaji.find_one({'id': gid})
    if not gaji:
        raise HTTPException(status_code=404, detail='Slip gaji tidak ditemukan')
    
    # 1. Hapus transaksi keuangan terkait
    if gaji.get('id_transaksi_keuangan'):
        await db.keuangan.delete_one({'id': gaji['id_transaksi_keuangan']})
    
    # 2. Hapus record gaji
    await db.gaji.delete_one({'id': gid})
    
    return {'message': 'Slip gaji dan transaksi keuangan terkait berhasil dihapus'}


@api_router.post('/gaji')
async def create_gaji(req: GajiCreate, current=Depends(admin_required)):
    # Cek jika sudah ada
    existing = await db.gaji.find_one({'petugas_id': req.petugas_id, 'periode': req.periode})
    if existing:
        raise HTTPException(status_code=400, detail='Gaji untuk periode ini sudah diterbitkan')

    # Validasi Saldo
    pipeline_saldo = [{'$group': {'_id': '$tipe', 'total': {'$sum': '$total'}}}]
    rsaldo = await db.keuangan.aggregate(pipeline_saldo).to_list(10)
    masuk = sum(r['total'] for r in rsaldo if r['_id'] in ('penjualan', 'sumber lain'))
    keluar = sum(r['total'] for r in rsaldo if r['_id'] == 'pengeluaran')
    saldo_saat_ini = masuk - keluar

    if req.total_bersih > saldo_saat_ini:
        raise HTTPException(status_code=400, detail=f'Saldo kas tidak mencukupi. Saldo saat ini: Rp {saldo_saat_ini:,.0f}')

    tanggal = datetime.now().strftime('%Y-%m-%d')
    no_invoice = await generate_invoice_no(tanggal)
    
    # Dapatkan nama petugas
    petugas = await db.petugas.find_one({'id': req.petugas_id}, {'_id': 0, 'nama': 1})
    nama_petugas = petugas['nama'] if petugas else 'Petugas'

    keterangan = f"Gaji {nama_petugas} - {req.periode}"
    if req.keterangan:
        keterangan += f" ({req.keterangan})"

    # 1. Catat ke Keuangan (Pengeluaran)
    transaksi_doc = {
        'id': new_id(),
        'no_invoice': no_invoice,
        'tanggal': tanggal,
        'tipe': 'pengeluaran',
        'jenis_sampah_id': None,
        'nama_pihak': nama_petugas,
        'bobot_kg': None,
        'harga_per_kg': None,
        'total': req.total_bersih,
        'keterangan': keterangan,
        'kategori': 'Slip Gaji',
        'user_id': current['id'],
        'user_nama': current.get('nama'),
        'created_at': now_iso(),
    }
    await db.keuangan.insert_one(transaksi_doc)

    # 2. Simpan record Gaji
    gaji_doc = {
        'id': new_id(),
        'id_transaksi_keuangan': transaksi_doc['id'],
        **req.dict(),
        'dicatat_oleh': current['id'],
        'created_at': now_iso(),
    }
    await db.gaji.insert_one(gaji_doc)

    return {k: v for k, v in gaji_doc.items() if k != '_id'}


# ============== LAPORAN ==============
@api_router.get('/laporan/timbangan')
async def laporan_timbangan(start: str, end: str, current=Depends(admin_required)):
    items = await db.timbangan.find(
        {'tanggal': {'$gte': start, '$lte': end}}, {'_id': 0}
    ).sort('tanggal', 1).to_list(5000)
    units = await db.units.find({}, {'_id': 0}).to_list(100)
    unit_map = {u['id']: u['nama'] for u in units}
    for it in items:
        it['unit_nama'] = unit_map.get(it.get('unit_id'), '-')
        # also fetch pilahan
        pilahan = await db.pilahan.find({'timbangan_id': it['id']}, {'_id': 0}).to_list(50)
        it['pilahan'] = pilahan
    return items


@api_router.get('/laporan/keuangan')
async def laporan_keuangan(start: str, end: str, current=Depends(admin_required)):
    items = await db.keuangan.find(
        {'tanggal': {'$gte': start, '$lte': end}}, {'_id': 0}
    ).sort('tanggal', 1).to_list(5000)
    return items


@api_router.get('/laporan/absensi')
async def laporan_absensi(bulan: str, current=Depends(admin_required)):
    return await rekap_absensi(bulan, current)


# ============== ROOT ==============
@api_router.get('/')
async def root():
    return {'message': 'TPS Manager API', 'org': 'Gemerlap'}


# ============== SEED ==============
async def seed_data():
    # Admin user
    admin = await db.users.find_one({'no_hp': '08000000000'})
    if not admin:
        await db.users.insert_one({
            'id': new_id(),
            'nama': 'Admin TPS',
            'no_hp': '08000000000',
            'password_hash': hash_password('admin123'),
            'role': 'admin',
            'created_at': now_iso(),
        })
        logging.info('Seeded admin user')

    # Units
    count = await db.units.count_documents({})
    if count == 0:
        for nama in ['Umum', 'Asrama', 'Sekolah']:
            await db.units.insert_one({'id': new_id(), 'nama': nama, 'aktif': True})
        logging.info('Seeded units')

    # Jenis sampah
    count = await db.jenis_sampah.count_documents({})
    if count == 0:
        defaults = [
            ('Plastik', 'komoditas'),
            ('Kardus', 'komoditas'),
            ('Logam', 'komoditas'),
            ('Bakar', 'bakar'),
            ('Lain-lain', 'lain'),
        ]
        for nama, tipe in defaults:
            await db.jenis_sampah.insert_one({'id': new_id(), 'nama': nama, 'tipe': tipe})
        logging.info('Seeded jenis sampah')

    # Indexes
    await db.users.create_index('no_hp', unique=True)
    await db.users.create_index('id', unique=True)


@app.on_event('startup')
async def startup_event():
    await seed_data()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
