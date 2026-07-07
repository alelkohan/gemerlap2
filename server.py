from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import requests
import threading

def _send_push(expo_push_token: str, title: str, body: str, data: dict = None):
    try:
        requests.post(
            'https://exp.host/--/api/v2/push/send',
            json={
                "to": expo_push_token,
                "sound": "default",
                "title": title,
                "body": body,
                "data": data or {}
            }
        )
    except Exception as e:
        logging.error(f"Failed to send push notification: {e}")

async def send_push_notification(expo_push_token: str, title: str, body: str, data: dict = None):
    threading.Thread(target=_send_push, args=(expo_push_token, title, body, data)).start()

from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timedelta, timezone, date
import bcrypt
import jwt
import math
import cloudinary
import cloudinary.uploader
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT config
SECRET_KEY = os.environ.get('JWT_SECRET', 'tps-manager-secret-key-change-in-prod-gemerlap-2026')
ALGORITHM = 'HS256'
TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days for mobile

# Cloudinary config
cloudinary.config(
  cloud_name = os.environ.get('CLOUDINARY_CLOUD_NAME', ''),
  api_key = os.environ.get('CLOUDINARY_API_KEY', ''),
  api_secret = os.environ.get('CLOUDINARY_API_SECRET', '')
)

app = FastAPI(
    title="TPS Manager API",
    docs_url=None,
    redoc_url=None,
)
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

async def admin_or_auditor_required(current=Depends(get_current_user)):
    if current.get('role') not in ['admin', 'auditor']:
        raise HTTPException(status_code=403, detail='Admin or Auditor only')
    return current


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance in meters between two points 
    on the earth (specified in decimal degrees)
    """
    # convert decimal degrees to radians 
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # haversine formula 
    dlat = lat2 - lat1 
    dlon = lon2 - lon1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371000 # Radius of earth in meters
    return c * r


def delete_cloudinary_image(url: str):
    try:
        if not url or "res.cloudinary.com" not in url: return
        import cloudinary.uploader
        parts = url.split('/')
        if len(parts) >= 2:
            public_id = parts[-2] + '/' + parts[-1].split('.')[0]
            cloudinary.uploader.destroy(public_id)
    except Exception as e:
        print("Failed to delete cloudinary image", e)


async def get_petugas_for_user(user_id: str, ignore_auditors: bool = False) -> Optional[dict]:
    petugas = await db.petugas.find_one({'user_id': user_id})
    if not petugas:
        user = await db.users.find_one({'id': user_id})
        if user and user.get('role') != 'auditor':
            petugas = {
                'id': user_id,
                'nama': user['nama'],
                'no_hp': user['no_hp'],
                'jabatan': 'Admin' if user['role'] == 'admin' else 'Petugas',
                'tgl_bergabung': datetime.now().strftime('%Y-%m-%d'),
                'status': True,
                'user_id': user_id,
                'created_at': now_iso()
            }
            await db.petugas.insert_one(petugas)
    return petugas


async def update_daily_attendance(petugas_id: str, tanggal: str, user_id: str):
    # Check if there is an existing absensi record for this date and if it is manual
    existing = await db.absensi.find_one({'petugas_id': petugas_id, 'tanggal': tanggal})
    if existing and existing.get('manual'):
        # Do not overwrite manual attendance set by admin
        return

    # Find all completed or auto-checked-out sessions for this petugas and tanggal
    sessions = await db.attendance_sessions.find({
        'petugas_id': petugas_id,
        'tanggal': tanggal,
        'status': {'$in': ['completed', 'auto_checked_out']}
    }).to_list(100)
    
    total_seconds = 0.0
    for s in sessions:
        if s.get('durasi_detik'):
            total_seconds += s['durasi_detik']
            
    total_hours = total_seconds / 3600.0
    
    # Capped at target_jam_kerja and rounded to 2 decimal places
    user = await db.users.find_one({'id': user_id}, {'_id': 0})
    target_obj = user.get('target_jam_kerja', {}) if user else {}
    wib_today = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=7))).strftime('%Y-%m-%d')
    target_jam = target_obj.get('jam', 8.0) if target_obj.get('tanggal') == wib_today else 8.0
    
    # Apply 5-minute tolerance (5/60 hours)
    if total_hours < target_jam and (target_jam - total_hours) <= (5.0 / 60.0):
        total_hours = target_jam
        
    capped_hours = round(min(total_hours, target_jam), 2)
    
    if existing:
        await db.absensi.update_one(
            {'id': existing['id']},
            {'$set': {
                'status': 'hadir',
                'jam': capped_hours,
                'keterangan': f"Akumulasi check-in ({len(sessions)} sesi)",
                'dicatat_oleh': user_id,
                'updated_at': now_iso()
            }}
        )
    else:
        await db.absensi.insert_one({
            'id': new_id(),
            'petugas_id': petugas_id,
            'tanggal': tanggal,
            'status': 'hadir',
            'jam': capped_hours,
            'keterangan': f"Akumulasi check-in ({len(sessions)} sesi)",
            'dicatat_oleh': user_id,
            'created_at': now_iso()
        })


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
    role: Literal['admin', 'petugas', 'auditor']
    tanggal_bergabung: Optional[str] = None
    tanggal_keluar: Optional[str] = None


class UserUpdate(BaseModel):
    nama: Optional[str] = None
    no_hp: Optional[str] = None
    role: Optional[Literal['admin', 'petugas', 'auditor']] = None
    password: Optional[str] = None
    tanggal_bergabung: Optional[str] = None
    tanggal_keluar: Optional[str] = None


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
    tgl_keluar: Optional[str] = None
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
    tipe: Literal['penjualan', 'sumber lain', 'pengeluaran', 'retribusi']
    jenis_sampah_id: Optional[str] = None
    nama_pihak: Optional[str] = None
    bobot_kg: Optional[float] = None
    harga_per_kg: Optional[float] = None
    total: float
    keterangan: Optional[str] = None
    kategori: Optional[str] = None
    bukti_url: Optional[str] = None


class KeuanganBulkItem(BaseModel):
    jenis_sampah_id: str
    bobot_kg: float
    harga_per_kg: float
    total: float


class KeuanganBulkCreate(BaseModel):
    tanggal: str
    tipe: Literal['penjualan']
    nama_pihak: str
    keterangan: Optional[str] = None
    bukti_url: Optional[str] = None
    items: List[KeuanganBulkItem]


class AbsensiItem(BaseModel):
    petugas_id: str
    status: Literal['hadir', 'absen', 'izin', 'sakit']
    keterangan: Optional[str] = ''
    jam: Optional[float] = 0


class AbsensiSave(BaseModel):
    tanggal: str
    items: List[AbsensiItem]


class AbsensiSingleSave(BaseModel):
    petugas_id: str
    tanggal: str
    status: Literal['hadir', 'absen', 'izin', 'sakit']
    keterangan: Optional[str] = ''
    jam: Optional[float] = 0


class AbsensiSelfSave(BaseModel):
    status: Literal['hadir', 'izin', 'sakit']
    keterangan: Optional[str] = ''


class TPSLocationSettings(BaseModel):
    nama_tps: str
    latitude: float
    longitude: float
    radius_meter: float = 100.0


class TPSLocationCreate(BaseModel):
    nama: str
    latitude: float
    longitude: float
    radius_meter: float = 100.0


class CheckInRequest(BaseModel):
    latitude: float
    longitude: float


class CheckOutRequest(BaseModel):
    latitude: float
    longitude: float


class HeartbeatRequest(BaseModel):
    latitude: float
    longitude: float


class GajiCreate(BaseModel):
    petugas_id: str
    periode: str # YYYY-MM
    gaji_pokok: float
    tunjangan: float
    potongan: float
    total_bersih: float
    keterangan: Optional[str] = ""
    bukti_url: Optional[str] = ""
    kasbon_ids: Optional[List[str]] = []

class KasbonCreate(BaseModel):
    petugas_id: str
    nominal: float
    keterangan: Optional[str] = None



class OperasionalStatus(BaseModel):
    status: Literal['aktif', 'libur']

class LemburRequestCreate(BaseModel):
    durasi_jam: float
    alasan: str

class LemburStatusUpdate(BaseModel):
    status: str

class UploadImageReq(BaseModel):
    base64_image: str

@api_router.post('/upload-image')
async def upload_image(req: UploadImageReq, current=Depends(get_current_user)):
    try:
        res = cloudinary.uploader.upload(req.base64_image, folder="gemerlap")
        return {"url": res.get("secure_url")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail='Password baru minimal 8 karakter')
    await db.users.update_one({'id': current['id']}, {'$set': {'password_hash': hash_password(req.new_password)}})
    return {'message': 'Password berhasil diubah'}


# ============== USERS (admin) ==============
@api_router.get('/users')
async def list_users(current=Depends(admin_or_auditor_required)):
    users = await db.users.find({}, {'_id': 0, 'password_hash': 0}).to_list(1000)
    
    user_ids = [u['id'] for u in users]
    petugas_list = await db.petugas.find({'id': {'$in': user_ids}}, {'_id': 0, 'id': 1, 'tgl_bergabung': 1, 'tgl_keluar': 1}).to_list(1000)
    petugas_map = {p['id']: p for p in petugas_list}
    
    for u in users:
        p_data = petugas_map.get(u['id'], {})
        if not u.get('tanggal_bergabung'):
            u['tanggal_bergabung'] = p_data.get('tgl_bergabung') or (u.get('created_at', '')[:10] if u.get('created_at') else '')
        if not u.get('tanggal_keluar'):
            u['tanggal_keluar'] = p_data.get('tgl_keluar')
            
    return users


@api_router.post('/users')
async def create_user(req: UserCreate, current=Depends(admin_required)):
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail='Password minimal 8 karakter')
    existing = await db.users.find_one({'no_hp': req.no_hp})
    if existing:
        raise HTTPException(status_code=400, detail='Nomor HP sudah terdaftar')
    user_doc = {
        'id': new_id(),
        'nama': req.nama,
        'no_hp': req.no_hp,
        'password_hash': hash_password(req.password),
        'role': req.role,
        'tanggal_bergabung': req.tanggal_bergabung,
        'tanggal_keluar': req.tanggal_keluar,
        'created_at': now_iso(),
    }
    await db.users.insert_one(user_doc)
    
    # Sinkronisasi: Otomatis daftarkan sebagai petugas
    petugas_doc = {
        'id': user_doc['id'],
        'nama': user_doc['nama'],
        'no_hp': user_doc['no_hp'],
        'jabatan': 'Admin' if user_doc['role'] == 'admin' else 'Petugas',
        'tgl_bergabung': req.tanggal_bergabung or datetime.now().strftime('%Y-%m-%d'),
        'tgl_keluar': req.tanggal_keluar,
        'status': not bool(req.tanggal_keluar),
        'user_id': user_doc['id'],
        'created_at': now_iso()
    }
    await db.petugas.insert_one(petugas_doc)
    
    return {k: v for k, v in user_doc.items() if k not in ('password_hash', '_id')}



class PushTokenReq(BaseModel):
    push_token: str

@api_router.put('/users/push-token')
async def update_push_token(req: PushTokenReq, current=Depends(get_current_user)):
    res = await db.users.update_one({'id': current['id']}, {'$set': {'push_token': req.push_token}})
    return {'success': True}

@api_router.put('/users/{user_id}')
async def update_user(user_id: str, req: UserUpdate, current=Depends(admin_required)):
    upd = {}
    petugas_upd = {}
    update_data = req.dict(exclude_unset=True)
    if 'nama' in update_data:
        upd['nama'] = req.nama
        petugas_upd['nama'] = req.nama
    if 'no_hp' in update_data:
        upd['no_hp'] = req.no_hp
        petugas_upd['no_hp'] = req.no_hp
    if 'role' in update_data:
        upd['role'] = req.role
        petugas_upd['jabatan'] = 'Admin' if req.role == 'admin' else 'Petugas'
    if req.password:
        upd['password_hash'] = hash_password(req.password)
    if 'tanggal_bergabung' in update_data:
        upd['tanggal_bergabung'] = req.tanggal_bergabung
        petugas_upd['tgl_bergabung'] = req.tanggal_bergabung
    if 'tanggal_keluar' in update_data:
        upd['tanggal_keluar'] = req.tanggal_keluar
        petugas_upd['tgl_keluar'] = req.tanggal_keluar
        petugas_upd['status'] = not bool(req.tanggal_keluar)

    if not upd:
        raise HTTPException(status_code=400, detail='Nothing to update')
    res = await db.users.update_one({'id': user_id}, {'$set': upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail='User tidak ditemukan')
        
    # Sinkronisasi ke tabel petugas
    if petugas_upd:
        await db.petugas.update_one({'id': user_id}, {'$set': petugas_upd})
        
    return {'message': 'updated'}


@api_router.delete('/users/{user_id}')
async def delete_user(user_id: str, current=Depends(admin_required)):
    if user_id == current['id']:
        raise HTTPException(status_code=400, detail='Tidak bisa menghapus akun sendiri')
    
    res = await db.users.delete_one({'id': user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail='User tidak ditemukan')
    
    # Sinkronisasi: Hapus juga profil petugas terkait
    await db.petugas.delete_one({'id': user_id})
    
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
    raw = await db.petugas.find({}, {'_id': 0}).sort('nama', 1).to_list(1000)
    # Get all auditor user_ids so we can exclude them from petugas list
    auditor_users = await db.users.find({'role': 'auditor'}, {'_id': 0, 'id': 1}).to_list(1000)
    auditor_ids = {u['id'] for u in auditor_users}
    seen = set()
    result = []
    for p in raw:
        pid = p.get('id')
        # Exclude auditors (matched by id or user_id)
        if pid in auditor_ids or p.get('user_id') in auditor_ids:
            continue
        if pid not in seen:
            seen.add(pid)
            result.append(p)
    return result


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
    if 'total_pilahan' not in item:
        pilahan_docs = await db.pilahan.find({'timbangan_id': item['id']}, {'_id': 0, 'bobot': 1}).to_list(None)
        total_p = sum(p.get('bobot', 0) for p in pilahan_docs)
        item['total_pilahan'] = total_p
        await db.timbangan.update_one({'id': item['id']}, {'$set': {'total_pilahan': total_p}})
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
        'total_pilahan': 0,
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
    timb = await db.timbangan.find_one({'id': tid})
    total_pilahan = timb.get('total_pilahan', 0) if timb else 0
    status_pilah = total_pilahan >= req.bobot_total - 0.001
    update_data = req.dict()
    update_data['status_pilah'] = status_pilah
    await db.timbangan.update_one({'id': tid}, {'$set': update_data})
    return {'message': 'updated'}


@api_router.delete('/timbangan/{tid}')
async def delete_timbangan(tid: str, current=Depends(get_current_user)):
    await db.timbangan.delete_one({'id': tid})
    await db.pilahan.delete_many({'timbangan_id': tid})
    return {'message': 'deleted'}


@api_router.get('/timbangan/pilahan-summary')
async def pilahan_summary(bulan: str, current=Depends(get_current_user)):
    """Total kg per tipe (recycle/residu/lain) for a given month (YYYY-MM)."""
    timbangan_ids = await db.timbangan.find(
        {'tanggal': {'$regex': f'^{bulan}'}},
        {'_id': 0, 'id': 1}
    ).to_list(5000)
    tid_set = {t['id'] for t in timbangan_ids}
    if not tid_set:
        return {'reuse': 0.0, 'reduce': 0.0, 'recycle': 0.0}
    pilahan = await db.pilahan.find(
        {'timbangan_id': {'$in': list(tid_set)}},
        {'_id': 0}
    ).to_list(10000)
    totals = {'reuse': 0.0, 'reduce': 0.0, 'recycle': 0.0}
    for p in pilahan:
        jid = p.get('jenis_sampah_id', '')
        bobot = p.get('bobot', 0) or 0
        if jid == 'Komoditas':
            totals['reuse'] += bobot
        elif jid == 'Bakar' or jid == 'Lain-lain':
            totals['reduce'] += bobot
        elif jid == 'Kompos':
            totals['recycle'] += bobot
    return {k: round(v, 2) for k, v in totals.items()}


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
    await db.timbangan.update_one({'id': tid}, {'$set': {'status_pilah': status_pilah, 'total_pilahan': total_pilahan}})
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
async def list_keuangan(
    bulan: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current=Depends(get_current_user)
):
    query = {}
    if start_date and end_date:
        query['tanggal'] = {'$gte': start_date, '$lte': end_date}
    elif bulan:
        query['tanggal'] = {'$regex': f'^{bulan}'}

    items = await db.keuangan.find(query, {'_id': 0}).sort([('tanggal', -1), ('created_at', -1)]).to_list(2000)
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
    masuk = sum(r['total'] for r in res if r['_id'] in ('penjualan', 'sumber lain', 'retribusi'))
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


@api_router.post('/keuangan/bulk_penjualan')
async def create_keuangan_bulk(req: KeuanganBulkCreate, current=Depends(get_current_user)):
    no_invoice = await generate_invoice_no(req.tanggal)
    docs = []
    for item in req.items:
        docs.append({
            'id': new_id(),
            'no_invoice': no_invoice,
            'tanggal': req.tanggal,
            'tipe': req.tipe,
            'nama_pihak': req.nama_pihak,
            'keterangan': req.keterangan,
            'bukti_url': req.bukti_url,
            'jenis_sampah_id': item.jenis_sampah_id,
            'bobot_kg': item.bobot_kg,
            'harga_per_kg': item.harga_per_kg,
            'total': item.total,
            'user_id': current['id'],
            'user_nama': current.get('nama'),
            'created_at': now_iso(),
        })
    if docs:
        await db.keuangan.insert_many(docs)
    return {'message': 'bulk insert success', 'no_invoice': no_invoice, 'count': len(docs)}


@api_router.put('/keuangan/{kid}')
async def update_keuangan(kid: str, req: KeuanganCreate, current=Depends(get_current_user)):
    await db.keuangan.update_one({'id': kid}, {'$set': req.dict()})
    return {'message': 'updated'}


@api_router.delete('/keuangan/{kid}')
async def delete_keuangan(kid: str, current=Depends(get_current_user)):
    doc = await db.keuangan.find_one({'id': kid})
    if doc and doc.get('bukti_url'):
        delete_cloudinary_image(doc['bukti_url'])
    await db.keuangan.delete_one({'id': kid})
    return {'message': 'deleted'}


@api_router.delete('/keuangan/invoice/{no_invoice:path}')
async def delete_keuangan_invoice(no_invoice: str, current=Depends(get_current_user)):
    docs = await db.keuangan.find({'no_invoice': no_invoice}).to_list(100)
    for doc in docs:
        if doc.get('bukti_url'):
            delete_cloudinary_image(doc['bukti_url'])
    await db.keuangan.delete_many({'no_invoice': no_invoice})
    return {'message': f'deleted invoice {no_invoice}'}



@api_router.get('/keuangan/invoice/{no_invoice:path}')
async def get_keuangan_invoice(no_invoice: str, current=Depends(get_current_user)):
    docs = await db.keuangan.find({'no_invoice': no_invoice}, {'_id': 0}).to_list(100)
    if not docs:
        raise HTTPException(status_code=404, detail='Not found')
    
    # Enrich with jenis sampah name
    for doc in docs:
        if doc.get('jenis_sampah_id'):
            jenis = await db.jenis_sampah.find_one({'id': doc['jenis_sampah_id']}, {'_id': 0, 'nama': 1})
            doc['jenis_sampah_nama'] = jenis['nama'] if jenis else '-'
    
    base_doc = docs[0]
    return {
        'no_invoice': no_invoice,
        'tanggal': base_doc['tanggal'],
        'tipe': base_doc['tipe'],
        'nama_pihak': base_doc.get('nama_pihak'),
        'kategori': base_doc.get('kategori'),
        'keterangan': base_doc.get('keterangan'),
        'bukti_url': base_doc.get('bukti_url'),
        'total': sum(d.get('total', 0) for d in docs),
        'items': docs
    }


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


@api_router.get('/penjualan')
async def list_penjualan(bulan: str, current=Depends(get_current_user)):
    """List penjualan transactions for a given month (YYYY-MM), enriched with jenis_sampah_nama."""
    query = {'tipe': 'penjualan', 'tanggal': {'$regex': f'^{bulan}'}}
    items = await db.keuangan.find(query, {'_id': 0}).sort([('tanggal', -1), ('created_at', -1)]).to_list(2000)
    jenis_map = {}
    for it in items:
        jid = it.get('jenis_sampah_id')
        if jid and jid not in jenis_map:
            jenis = await db.jenis_sampah.find_one({'id': jid}, {'_id': 0, 'nama': 1})
            jenis_map[jid] = jenis['nama'] if jenis else '-'
        it['jenis_sampah_nama'] = jenis_map.get(jid, '-')
    return items


# ============== ABSENSI ==============
@api_router.get('/absensi')
async def get_absensi_by_date(tanggal: str, current=Depends(get_current_user)):
    return await db.absensi.find({'tanggal': tanggal}, {'_id': 0}).to_list(1000)


@api_router.get('/absensi/detail/{petugas_id}')
async def get_absensi_detail(petugas_id: str, bulan: str, current=Depends(get_current_user)):
    """Return all daily absensi records for a petugas in a given month (YYYY-MM)."""
    records = await db.absensi.find(
        {'petugas_id': petugas_id, 'tanggal': {'$regex': f'^{bulan}'}},
        {'_id': 0}
    ).sort('tanggal', 1).to_list(1000)
    return records


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
            'keterangan': it.keterangan.strip() if it.keterangan and it.keterangan.strip() else 'Tidak ada keterangan',
            'jam': it.jam or 0,
            'dicatat_oleh': current['id'],
            'created_at': now_iso(),
        })
    if docs:
        await db.absensi.insert_many(docs)
    return {'message': 'saved', 'count': len(docs)}


@api_router.post('/absensi/single')
async def save_single_absensi(req: AbsensiSingleSave, current=Depends(admin_required)):
    # Delete any existing record for this petugas and date
    await db.absensi.delete_many({'petugas_id': req.petugas_id, 'tanggal': req.tanggal})
    
    # Store jam only if status is 'hadir'
    jam = round(req.jam or 0.0, 2) if req.status == 'hadir' else 0.0
    
    doc = {
        'id': new_id(),
        'petugas_id': req.petugas_id,
        'tanggal': req.tanggal,
        'status': req.status,
        'keterangan': req.keterangan.strip() if req.keterangan and req.keterangan.strip() else 'Tidak ada keterangan',
        'jam': jam,
        'manual': True,
        'dicatat_oleh': current['id'],
        'created_at': now_iso(),
    }
    await db.absensi.insert_one(doc)
    return {'message': 'saved', 'id': doc['id']}


@api_router.post('/absensi/self')
async def save_self_absensi(req: AbsensiSelfSave, current=Depends(get_current_user)):
    petugas = await get_petugas_for_user(current['id'], ignore_auditors=True)
    if not petugas:
        raise HTTPException(status_code=400, detail='User tidak terdaftar sebagai petugas')

    petugas_id = petugas['id']
    tanggal_str = (datetime.now(timezone.utc) + timedelta(hours=7)).strftime('%Y-%m-%d')

    # Do not overwrite a manually-set (admin) record
    existing = await db.absensi.find_one({'petugas_id': petugas_id, 'tanggal': tanggal_str})
    if existing and existing.get('manual'):
        raise HTTPException(status_code=409, detail='Absensi hari ini sudah diatur oleh admin dan tidak dapat diubah.')

    # Remove any existing self-submitted record for today
    await db.absensi.delete_many({'petugas_id': petugas_id, 'tanggal': tanggal_str})

    doc = {
        'id': new_id(),
        'petugas_id': petugas_id,
        'tanggal': tanggal_str,
        'status': req.status,
        'keterangan': req.keterangan.strip() if req.keterangan and req.keterangan.strip() else 'Tidak ada keterangan',
        'jam': 0.0,
        'manual': False,
        'created_at': now_iso(),
    }
    await db.absensi.insert_one(doc)
    return {'message': 'Absensi berhasil dicatat', 'status': req.status}


@api_router.delete('/absensi/self')
async def delete_self_absensi(current=Depends(get_current_user)):
    petugas = await get_petugas_for_user(current['id'], ignore_auditors=True)
    if not petugas:
        raise HTTPException(status_code=400, detail='User tidak terdaftar sebagai petugas')

    tanggal_str = (datetime.now(timezone.utc) + timedelta(hours=7)).strftime('%Y-%m-%d')
    
    existing = await db.absensi.find_one({'petugas_id': petugas['id'], 'tanggal': tanggal_str})
    if existing and existing.get('manual'):
        raise HTTPException(status_code=409, detail='Absensi hari ini sudah diatur oleh admin dan tidak dapat dihapus.')

    res = await db.absensi.delete_many({'petugas_id': petugas['id'], 'tanggal': tanggal_str})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Tidak ada status absensi yang bisa dihapus.')
        
    return {'message': 'Status absensi berhasil dihapus'}


@api_router.get('/absensi/unmarked')
async def get_unmarked_officers(tanggal: str = None, current=Depends(admin_or_auditor_required)):
    """Return list of active officers who have no attendance record for the given date."""
    date_str = tanggal or (datetime.now(timezone.utc) + timedelta(hours=7)).strftime('%Y-%m-%d')
    # Exclude auditors
    auditor_users = await db.users.find({'role': 'auditor'}, {'_id': 0, 'id': 1}).to_list(1000)
    auditor_ids = {u['id'] for u in auditor_users}
    # Get all active petugas (excluding auditors)
    all_petugas_raw = await db.petugas.find({'status': True}, {'_id': 0, 'id': 1, 'nama': 1, 'user_id': 1}).to_list(1000)
    all_petugas = [p for p in all_petugas_raw if p['id'] not in auditor_ids and p.get('user_id') not in auditor_ids]
    if not all_petugas:
        return []
    # Get petugas_ids that already have a daily record for this date
    existing_records = await db.absensi.find(
        {'tanggal': date_str},
        {'_id': 0, 'petugas_id': 1}
    ).to_list(1000)
    recorded_ids = {r['petugas_id'] for r in existing_records}

    # Also exclude petugas who have an ACTIVE session (check-in but not yet check-out)
    # They are clearly working, just haven't checked out yet
    active_sessions = await db.attendance_sessions.find(
        {'tanggal': date_str, 'status': 'active'},
        {'_id': 0, 'petugas_id': 1}
    ).to_list(1000)
    active_ids = {s['petugas_id'] for s in active_sessions}

    # Also exclude petugas who have completed sessions today (checked in at least once)
    completed_sessions = await db.attendance_sessions.find(
        {'tanggal': date_str, 'status': {'$in': ['completed', 'auto_checked_out']}},
        {'_id': 0, 'petugas_id': 1}
    ).to_list(1000)
    completed_ids = {s['petugas_id'] for s in completed_sessions}

    # Combine all IDs that should be excluded
    exclude_ids = recorded_ids | active_ids | completed_ids

    # Deduplicate by id (guard against duplicate petugas docs in DB)
    seen_ids = set()
    unmarked = []
    for p in all_petugas:
        pid = p['id']
        if pid not in exclude_ids and pid not in seen_ids:
            seen_ids.add(pid)
            unmarked.append({'id': pid, 'nama': p['nama']})
    return sorted(unmarked, key=lambda x: x['nama'])


@api_router.get('/settings/tps')
async def get_tps_settings(current=Depends(get_current_user)):
    tps = await db.settings.find_one({'key': 'tps_location'}, {'_id': 0})
    if not tps:
        # Fallback to default
        tps = {
            'key': 'tps_location',
            'nama_tps': 'TPS Utama Gemerlap',
            'latitude': -6.20084,
            'longitude': 106.81666,
            'radius_meter': 100.0
        }
    return tps


@api_router.post('/settings/tps')
async def save_tps_settings(req: TPSLocationSettings, current=Depends(admin_required)):
    await db.settings.update_one(
        {'key': 'tps_location'},
        {'$set': {
            'nama_tps': req.nama_tps,
            'latitude': req.latitude,
            'longitude': req.longitude,
            'radius_meter': req.radius_meter,
            'updated_at': now_iso()
        }},
        upsert=True
    )
    return {'message': 'Lokasi TPS berhasil diperbarui', 'data': req.dict()}



@api_router.get('/settings/operasional')
async def get_operasional_status(current=Depends(get_current_user)):
    setting = await db.settings.find_one({'key': 'operasional_status'}, {'_id': 0})
    if not setting:
        return {'status': 'aktif'}
    return {'status': setting.get('status', 'aktif')}

@api_router.post('/settings/operasional')
async def set_operasional_status(req: OperasionalStatus, current=Depends(admin_required)):
    await db.settings.update_one(
        {'key': 'operasional_status'},
        {'$set': {'status': req.status, 'updated_at': now_iso()}},
        upsert=True
    )
    return {'message': 'Status operasional berhasil diubah', 'status': req.status}


@api_router.get('/tps-locations')
async def list_tps_locations(current=Depends(get_current_user)):
    raw = await db.tps_locations.find({}, {'_id': 0}).sort('nama', 1).to_list(1000)
    # Deduplicate by id in case of duplicate documents
    seen = set()
    result = []
    for loc in raw:
        if loc.get('id') not in seen:
            seen.add(loc['id'])
            result.append(loc)
    return result


@api_router.get('/tps-locations/{id}')
async def get_tps_location(id: str, current=Depends(get_current_user)):
    loc = await db.tps_locations.find_one({'id': id}, {'_id': 0})
    if not loc:
        raise HTTPException(status_code=404, detail='Lokasi TPS tidak ditemukan')
    return loc


@api_router.post('/tps-locations')
async def create_tps_location(req: TPSLocationCreate, current=Depends(admin_required)):
    doc = {
        'id': new_id(),
        **req.dict(),
        'created_at': now_iso()
    }
    await db.tps_locations.insert_one(doc)
    return {k: v for k, v in doc.items() if k != '_id'}


@api_router.put('/tps-locations/{id}')
async def update_tps_location(id: str, req: TPSLocationCreate, current=Depends(admin_required)):
    res = await db.tps_locations.update_one({'id': id}, {'$set': req.dict()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail='Lokasi TPS tidak ditemukan')
    return {'message': 'updated'}


@api_router.delete('/tps-locations/{id}')
async def delete_tps_location(id: str, current=Depends(admin_required)):
    # Check if this location is used in active sessions
    used = await db.attendance_sessions.find_one({'tps_location_id': id, 'status': 'active'})
    if used:
        raise HTTPException(status_code=400, detail='Lokasi TPS tidak bisa dihapus karena masih ada petugas yang sedang bekerja di sini')
        
    res = await db.tps_locations.delete_one({'id': id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Lokasi TPS tidak ditemukan')
    return {'message': 'deleted'}


@api_router.get('/absensi/status')
async def get_attendance_status(current=Depends(get_current_user)):
    petugas = await get_petugas_for_user(current['id'], ignore_auditors=True)
    if not petugas:
        return {'role': current['role'], 'message': 'Admin tidak memiliki status absensi check-in'}
        
    petugas_id = petugas['id']
    
    # Find active session
    active_session = await db.attendance_sessions.find_one({
        'petugas_id': petugas_id,
        'status': 'active'
    }, {'_id': 0})
    
    # Calculate accumulated hours today
    wib_now = datetime.now(timezone.utc) + timedelta(hours=7)
    tanggal_str = wib_now.strftime('%Y-%m-%d')
    
    # Get completed sessions today
    sessions = await db.attendance_sessions.find({
        'petugas_id': petugas_id,
        'tanggal': tanggal_str,
        'status': {'$in': ['completed', 'auto_checked_out']}
    }, {'_id': 0}).to_list(100)
    
    accumulated_seconds = sum(s.get('durasi_detik', 0.0) for s in sessions)
    
    # Add active session's running duration if exists
    running_seconds = 0.0
    if active_session:
        check_in_time = datetime.fromisoformat(active_session['check_in'].replace('Z', '+00:00'))
        running_seconds = (datetime.now(timezone.utc) - check_in_time).total_seconds()
        
    total_today_hours = (accumulated_seconds + running_seconds) / 3600.0
    
    daily_record = await db.absensi.find_one({'petugas_id': petugas_id, 'tanggal': tanggal_str}, {'_id': 0})
    
    user = await db.users.find_one({'id': current['id']})
    wib_today = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=7))).strftime('%Y-%m-%d')
    
    target_jam = 8.0
    if user and user.get('target_jam_kerja'):
        user_target = user['target_jam_kerja']
        if user_target.get('tanggal') == wib_today:
            target_jam = user_target.get('jam', 8.0)
    
    return {
        'petugas_id': petugas_id,
        'nama_petugas': petugas['nama'],
        'has_active_session': active_session is not None,
        'active_session': active_session,
        'accumulated_hours_today': round(accumulated_seconds / 3600.0, 2),
        'running_hours': round(running_seconds / 3600.0, 2),
        'total_hours_today': round(total_today_hours, 2),
        'capped_hours_today': round(min(total_today_hours, target_jam), 2),
        'target_jam_kerja': target_jam,
        'tanggal': tanggal_str,
        'daily_record': daily_record
    }


@api_router.post('/absensi/check-in')
async def check_in(req: CheckInRequest, current=Depends(get_current_user)):
    petugas = await get_petugas_for_user(current['id'], ignore_auditors=True)
    if not petugas:
        raise HTTPException(status_code=400, detail='User tidak terdaftar sebagai petugas')
        
    petugas_id = petugas['id']
    
    # Check for active session
    active_session = await db.attendance_sessions.find_one({
        'petugas_id': petugas_id,
        'status': 'active'
    })
    if active_session:
        raise HTTPException(status_code=400, detail='Anda masih memiliki sesi check-in aktif')
        
    # Validate location against all active TPS locations
    tps_locations = await db.tps_locations.find({}).to_list(100)
    if not tps_locations:
        raise HTTPException(status_code=500, detail='Belum ada wilayah lokasi TPS yang ditentukan oleh admin')
        
    closest_tps = None
    min_distance = float('inf')
    
    for tps in tps_locations:
        dist = calculate_distance(
            req.latitude, req.longitude,
            tps['latitude'], tps['longitude']
        )
        if dist <= tps['radius_meter'] and dist < min_distance:
            min_distance = dist
            closest_tps = tps
            
    if not closest_tps:
        # Find closest one to display in error details
        closest_any = min(tps_locations, key=lambda t: calculate_distance(req.latitude, req.longitude, t['latitude'], t['longitude']))
        any_dist = calculate_distance(req.latitude, req.longitude, closest_any['latitude'], closest_any['longitude'])
        raise HTTPException(
            status_code=400,
            detail=f"Gagal check-in. Anda berada di luar radius TPS. Terdekat: {closest_any['nama']} ({int(any_dist)} meter)"
        )
        
    wib_now = datetime.now(timezone.utc) + timedelta(hours=7)
    tanggal_str = wib_now.strftime('%Y-%m-%d')
    
    session_doc = {
        'id': new_id(),
        'petugas_id': petugas_id,
        'tanggal': tanggal_str,
        'check_in': now_iso(),
        'check_out': None,
        'check_in_lat': req.latitude,
        'check_in_lon': req.longitude,
        'check_out_lat': None,
        'check_out_lon': None,
        'durasi_detik': None,
        'outside_since': None,
        'status': 'active',
        'tps_location_id': closest_tps['id'],
        'created_at': now_iso()
    }
    await db.attendance_sessions.insert_one(session_doc)
    
    return {
        'message': 'Check-in berhasil',
        'session_id': session_doc['id'],
        'check_in': session_doc['check_in']
    }


@api_router.post('/absensi/check-out')
async def check_out(req: CheckOutRequest, request: Request, current=Depends(get_current_user)):
    petugas = await get_petugas_for_user(current['id'], ignore_auditors=True)
    if not petugas:
        raise HTTPException(status_code=400, detail='User tidak terdaftar sebagai petugas')
        
    petugas_id = petugas['id']
    
    active_session = await db.attendance_sessions.find_one({
        'petugas_id': petugas_id,
        'status': 'active'
    })
    if not active_session:
        raise HTTPException(status_code=400, detail='Tidak ada sesi check-in aktif yang ditemukan')
        
    check_in_time = datetime.fromisoformat(active_session['check_in'].replace('Z', '+00:00'))
    check_out_time = datetime.now(timezone.utc)
    durasi_seconds = (check_out_time - check_in_time).total_seconds()
    
    # Enforce minimum 30 minutes (1800 seconds) for manual check-out
    # Bypass if X-Test-Bypass: true is set (for testing purposes)
    is_test_bypass = request.headers.get("x-test-bypass") == "true"

    if durasi_seconds < 1800.0 and not is_test_bypass:
        sisa_menit = math.ceil((1800.0 - durasi_seconds) / 60.0)
        raise HTTPException(
            status_code=400,
            detail=f'Tidak dapat melakukan check-out. Minimal durasi sesi adalah 30 menit. Silakan tunggu {sisa_menit} menit lagi.'
        )

    upd = {
        'check_out': check_out_time.isoformat(),
        'check_out_lat': req.latitude,
        'check_out_lon': req.longitude,
        'durasi_detik': durasi_seconds,
        'status': 'completed',
        'updated_at': now_iso()
    }
    await db.attendance_sessions.update_one({'id': active_session['id']}, {'$set': upd})
    
    # Update rekap harian absensi
    await update_daily_attendance(petugas_id, active_session['tanggal'], current['id'])
    
    return {
        'message': 'Check-out berhasil',
        'session_id': active_session['id'],
        'duration_minutes': round(durasi_seconds / 60.0, 2),
        'is_valid': True
    }


@api_router.post('/absensi/heartbeat')
async def heartbeat(req: HeartbeatRequest, current=Depends(get_current_user)):
    petugas = await get_petugas_for_user(current['id'], ignore_auditors=True)
    if not petugas:
        raise HTTPException(status_code=400, detail='User tidak terdaftar sebagai petugas')
        
    petugas_id = petugas['id']
    
    active_session = await db.attendance_sessions.find_one({
        'petugas_id': petugas_id,
        'status': 'active'
    })
    if not active_session:
        return {'status': 'inactive', 'message': 'Tidak ada sesi aktif'}
        
    tps_id = active_session.get('tps_location_id')
    tps_settings = None
    if tps_id:
        tps_settings = await db.tps_locations.find_one({'id': tps_id})
        
    if not tps_settings:
        tps_locations = await db.tps_locations.find({}).to_list(100)
        if not tps_locations:
            raise HTTPException(status_code=500, detail='Pengaturan lokasi TPS belum dibuat oleh admin')
        tps_settings = min(tps_locations, key=lambda t: calculate_distance(req.latitude, req.longitude, t['latitude'], t['longitude']))
        
    distance = calculate_distance(
        req.latitude, req.longitude,
        tps_settings['latitude'], tps_settings['longitude']
    )
    
    is_inside = distance <= tps_settings['radius_meter']
    now = datetime.now(timezone.utc)
    
    if is_inside:
        if active_session.get('outside_since'):
            await db.attendance_sessions.update_one(
                {'id': active_session['id']},
                {'$set': {'outside_since': None}}
            )
        return {
            'status': 'inside',
            'distance_meter': round(distance, 2),
            'message': 'Petugas berada di dalam radius TPS'
        }
    else:
        outside_since_str = active_session.get('outside_since')
        if not outside_since_str:
            outside_since = now
            await db.attendance_sessions.update_one(
                {'id': active_session['id']},
                {'$set': {'outside_since': outside_since.isoformat()}}
            )
            seconds_left = 60.0
        else:
            outside_since = datetime.fromisoformat(outside_since_str.replace('Z', '+00:00'))
            elapsed = (now - outside_since).total_seconds()
            seconds_left = max(0.0, 60.0 - elapsed)
            
        if seconds_left <= 0:
            check_in_time = datetime.fromisoformat(active_session['check_in'].replace('Z', '+00:00'))
            durasi_seconds = (outside_since - check_in_time).total_seconds()
            is_valid_duration = durasi_seconds >= 1800.0
            
            upd = {
                'check_out': outside_since.isoformat(),
                'check_out_lat': req.latitude,
                'check_out_lon': req.longitude,
                'durasi_detik': durasi_seconds if is_valid_duration else 0.0,
                'status': 'auto_checked_out',
                'updated_at': now_iso()
            }
            await db.attendance_sessions.update_one({'id': active_session['id']}, {'$set': upd})
            await update_daily_attendance(petugas_id, active_session['tanggal'], current['id'])
            
            return {
                'status': 'auto_checked_out',
                'distance_meter': round(distance, 2),
                'message': 'Sesi otomatis diakhiri karena petugas keluar area TPS lebih dari 1 menit'
            }
            
        return {
            'status': 'outside',
            'distance_meter': round(distance, 2),
            'seconds_left': int(seconds_left),
            'message': 'Petugas terdeteksi di luar area TPS. Sesi akan diakhiri otomatis jika tidak kembali.'
        }


@api_router.get('/absensi/sessions')
async def get_attendance_sessions_by_date(tanggal: str, petugas_id: Optional[str] = None, current=Depends(get_current_user)):
    if not petugas_id:
        petugas = await get_petugas_for_user(current['id'], ignore_auditors=True)
        if not petugas:
            raise HTTPException(status_code=400, detail='User tidak terdaftar sebagai petugas')
        petugas_id = petugas['id']
        
    return await db.attendance_sessions.find({
        'petugas_id': petugas_id,
        'tanggal': tanggal
    }, {'_id': 0}).sort('check_in', 1).to_list(100)


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
    # Exclude auditors from rekap
    auditor_users = await db.users.find({'role': 'auditor'}, {'_id': 0, 'id': 1}).to_list(1000)
    auditor_ids = {u['id'] for u in auditor_users}
    # Group by petugas_id
    petugas_list = await db.petugas.find({'status': True}, {'_id': 0}).to_list(1000)
    rekap = {}
    for p in petugas_list:
        pid = p['id']
        # Skip auditors
        if pid in auditor_ids or p.get('user_id') in auditor_ids:
            continue
        rekap[pid] = {'petugas_id': pid, 'nama': p['nama'], 'hadir': 0, 'absen': 0, 'izin': 0, 'sakit': 0, 'total_jam': 0}
    for r in res:
        pid = r['_id']['petugas_id']
        st = r['_id']['status']
        if pid in rekap:
            rekap[pid][st] = r['count']
            if st == 'hadir':
                rekap[pid]['total_jam'] += r.get('total_jam', 0)
    
    # Round total_jam for each officer to 2 decimal places
    for pid in rekap:
        rekap[pid]['total_jam'] = round(rekap[pid]['total_jam'], 2)
        
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
    masuk = sum(r['total'] for r in rsaldo if r['_id'] in ('penjualan', 'sumber lain', 'retribusi'))
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


# ============== KASBON ==============
@api_router.get('/kasbon')
async def get_all_kasbon(bulan: Optional[str] = None, current=Depends(admin_or_auditor_required)):
    query = {}
    if bulan:
        query['tanggal'] = {'$regex': f'^{bulan}'}
    docs = await db.kasbon.find(query, {'_id': 0}).sort('tanggal', -1).to_list(1000)
    for doc in docs:
        petugas = await db.petugas.find_one({'id': doc['petugas_id']})
        doc['nama_petugas'] = petugas['nama'] if petugas else 'Unknown'
    return docs

@api_router.get('/kasbon/pending/{petugas_id}')
async def get_pending_kasbon(petugas_id: str, current=Depends(admin_or_auditor_required)):
    docs = await db.kasbon.find({'petugas_id': petugas_id, 'status': {'$in': ['belum_lunas', 'pending']}}, {'_id': 0}).to_list(100)
    return docs

@api_router.post('/kasbon')
async def create_kasbon(req: KasbonCreate, current=Depends(admin_required)):
    if req.nominal <= 0:
        raise HTTPException(status_code=400, detail='Nominal kasbon harus lebih dari 0')
    
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
        'status': 'belum_lunas',
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


# ============== LEMBUR ==============
@api_router.post('/lembur')
async def create_lembur(req: LemburRequestCreate, current=Depends(get_current_user)):
    petugas = await get_petugas_for_user(current['id'])
    if not petugas:
        raise HTTPException(status_code=403, detail="Hanya petugas yang bisa mengajukan lembur")
        
    wib_today = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=7))).strftime('%Y-%m-%d')
    
    lembur_doc = {
        'id': new_id(),
        'petugas_id': petugas['id'],
        'nama_petugas': petugas['nama'],
        'tanggal': wib_today,
        'durasi_jam': req.durasi_jam,
        'alasan': req.alasan,
        'status': 'pending', # pending, approved, rejected
        'created_at': now_iso()
    }
    await db.lembur.insert_one(lembur_doc)
    lembur_doc.pop('_id', None)

    # Send push notification to all admins
    try:
        admins = await db.users.find({'role': 'admin', 'push_token': {'$exists': True, '$ne': None}}).to_list(100)
        for admin in admins:
            token = admin.get('push_token')
            if token:
                await send_push_notification(
                    expo_push_token=token,
                    title="📋 Pengajuan Lembur Baru",
                    body=f"{petugas['nama']} mengajukan lembur {req.durasi_jam} jam — {req.alasan}",
                    data={"type": "lembur", "id": lembur_doc['id']}
                )
    except Exception as e:
        logging.error(f"Failed to notify admins about new lembur: {e}")

    return {'message': 'Pengajuan lembur berhasil dikirim', 'data': lembur_doc}

@api_router.get('/lembur/pending')
async def get_pending_lembur(current=Depends(admin_or_auditor_required)):
    wib_today = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=7))).strftime('%Y-%m-%d')
    # Can also fetch older pending if needed, but usually we just fetch all pending
    requests = await db.lembur.find({'status': 'pending'}).sort('created_at', -1).to_list(1000)
    for r in requests:
        r.pop('_id', None)
    return requests

@api_router.get('/lembur/my')
async def get_my_lembur(tanggal: Optional[str] = None, current=Depends(get_current_user)):
    petugas = await get_petugas_for_user(current['id'])
    if not petugas:
        return []
    query = {'petugas_id': petugas['id']}
    if tanggal:
        query['tanggal'] = tanggal
    requests = await db.lembur.find(query).sort('created_at', -1).limit(20).to_list(100)
    for r in requests:
        r.pop('_id', None)
    return requests

@api_router.delete('/lembur/{id}')
async def delete_lembur(id: str, current=Depends(get_current_user)):
    petugas = await get_petugas_for_user(current['id'], ignore_auditors=True)
    if not petugas:
        raise HTTPException(status_code=400, detail="User tidak terdaftar sebagai petugas")
        
    lembur = await db.lembur.find_one({'id': id})
    if not lembur:
        raise HTTPException(status_code=404, detail="Data lembur tidak ditemukan")
        
    if lembur['petugas_id'] != petugas['id'] and current['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")
        
    if lembur['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Hanya pengajuan berstatus pending yang dapat dihapus")
        
    await db.lembur.delete_one({'id': id})
    return {"status": "ok", "message": "Pengajuan lembur dihapus"}


@api_router.put('/lembur/{id}/status')
async def update_lembur_status(id: str, req: LemburStatusUpdate, current=Depends(admin_required)):
    if req.status not in ['approved', 'rejected']:
        raise HTTPException(status_code=400, detail="Status tidak valid")
        
    lembur = await db.lembur.find_one({'id': id})
    if not lembur:
        raise HTTPException(status_code=404, detail="Data lembur tidak ditemukan")
        
    await db.lembur.update_one(
        {'id': id},
        {'$set': {'status': req.status, 'updated_at': now_iso(), 'decided_by': current['id']}}
    )
    
    if req.status == 'approved':
        # Update target_jam_kerja di users
        user_id = current['id'] # Wait, user_id is the user who requested it!
        # lembur has petugas_id. We need the user_id of that petugas.
        petugas = await db.petugas.find_one({'id': lembur['petugas_id']})
        if petugas and petugas.get('user_id'):
            # Calculate total approved lembur for this petugas today
            approved_lemburs = await db.lembur.find({
                'petugas_id': lembur['petugas_id'],
                'tanggal': lembur['tanggal'],
                'status': 'approved'
            }).to_list(100)
            
            total_lembur_jam = sum([l.get('durasi_jam', 0) for l in approved_lemburs])
            target_jam = 8.0 + total_lembur_jam
            
            await db.users.update_one(
                {'id': petugas['user_id']},
                {'$set': {
                    'target_jam_kerja': {
                        'jam': target_jam,
                        'tanggal': lembur['tanggal']
                    }
                }}
            )
            
            # Recalculate if there is already an absensi record for today
            absensi = await db.absensi.find_one({'petugas_id': lembur['petugas_id'], 'tanggal': lembur['tanggal']})
            if absensi and not absensi.get('manual'):
                sessions = await db.attendance_sessions.find({
                    'petugas_id': lembur['petugas_id'],
                    'tanggal': lembur['tanggal'],
                    'status': {'$in': ['completed', 'auto_checked_out']}
                }).to_list(100)
                
                total_seconds = sum([s.get('durasi_detik', 0) for s in sessions])
                total_hours = total_seconds / 3600.0
                
                # Apply 5-minute tolerance
                if total_hours < target_jam and (target_jam - total_hours) <= (5.0 / 60.0):
                    total_hours = target_jam
                    
                capped_hours = round(min(total_hours, target_jam), 2)
                await db.absensi.update_one(
                    {'id': absensi['id']},
                    {'$set': {'jam': capped_hours}}
                )

    return {'message': f'Pengajuan lembur {req.status}'}

# ============== GAJI & SLIP GAJI ==============
@api_router.get('/gaji/{petugas_id}')
async def get_gaji(petugas_id: str, periode: str, current=Depends(admin_or_auditor_required)):
    gaji = await db.gaji.find_one({'petugas_id': petugas_id, 'periode': periode}, {'_id': 0})
    if not gaji:
        raise HTTPException(status_code=404, detail='Gaji not found')
    return gaji


@api_router.delete('/gaji/{gid}')
async def delete_gaji(gid: str, current=Depends(admin_required)):
    gaji = await db.gaji.find_one({'id': gid})
    if not gaji:
        raise HTTPException(status_code=404, detail='Slip gaji tidak ditemukan')
    
    if gaji.get('bukti_url'):
        delete_cloudinary_image(gaji['bukti_url'])
    
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
    masuk = sum(r['total'] for r in rsaldo if r['_id'] in ('penjualan', 'sumber lain', 'retribusi'))
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
        'bukti_url': req.bukti_url,
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
    
    # 3. Update Kasbon (jika ada)
    if req.kasbon_ids and len(req.kasbon_ids) > 0:
        await db.kasbon.update_many(
            {'id': {'$in': req.kasbon_ids}},
            {'$set': {'status': 'lunas', 'slip_gaji_id': req.periode}}
        )

    return {k: v for k, v in gaji_doc.items() if k != '_id'}


# ============== LAPORAN ==============
@api_router.get('/laporan/neraca-massa')
async def laporan_neraca_massa(start: str, end: str, current=Depends(admin_or_auditor_required)):
    items = await db.timbangan.find(
        {'tanggal': {'$gte': start, '$lte': end}}, {'_id': 0}
    ).to_list(50000)
    
    timbangan_ids = [it['id'] for it in items]
    pilahan = await db.pilahan.find(
        {'timbangan_id': {'$in': timbangan_ids}}, {'_id': 0}
    ).to_list(50000)
    
    jenis = await db.jenis_sampah.find({}, {'_id': 0}).to_list(100)
    jenis_map = {j['id']: j for j in jenis}
    
    monthly = {}
    for it in items:
        bulan = it['tanggal'][:7]
        if bulan not in monthly:
            monthly[bulan] = {
                'bulan': bulan,
                'sampah_masuk': 0.0,
                'dikomposkan': 0.0,
                'dijual': 0.0,
                'residu': 0.0,
                'lain': 0.0
            }
        monthly[bulan]['sampah_masuk'] += it.get('bobot_total', 0)
        
    for p in pilahan:
        t_id = p['timbangan_id']
        t_it = next((x for x in items if x['id'] == t_id), None)
        if not t_it: continue
        bulan = t_it['tanggal'][:7]
        jid = p.get('jenis_sampah_id')
        bobot = p.get('bobot', 0) or 0
        if jid == 'Kompos':
            monthly[bulan]['dikomposkan'] += bobot
        elif jid == 'Komoditas':
            monthly[bulan]['dijual'] += bobot
        elif jid == 'Bakar' or jid == 'Lain-lain':
            monthly[bulan]['residu'] += bobot
            
    result = []
    for k in sorted(monthly.keys()):
        d = monthly[k]
        masuk = d['sampah_masuk']
        dikomposkan = d['dikomposkan']
        dijual = d['dijual']
        rf = ((dikomposkan + dijual) / masuk * 100) if masuk > 0 else 0
        d['recovery_factor'] = round(rf, 2)
        result.append(d)
        
    return result

@api_router.get('/laporan/neraca-keuangan')
async def laporan_neraca_keuangan(start: str, end: str, current=Depends(admin_or_auditor_required)):
    items = await db.keuangan.find(
        {'tanggal': {'$gte': start, '$lte': end}}, {'_id': 0}
    ).to_list(50000)
    
    monthly = {}
    for it in items:
        bulan = it['tanggal'][:7]
        if bulan not in monthly:
            monthly[bulan] = {
                'bulan': bulan,
                'iuran': 0.0,
                'penjualan': 0.0,
                'distribusi_residu': 0.0,
                'upah': 0.0,
                'lain_masuk': 0.0,
                'lain_keluar': 0.0,
            }
        
        tipe = it['tipe']
        total = it.get('total', 0)
        kat = (it.get('kategori') or '').lower()
        nama_pihak = (it.get('nama_pihak') or '').lower()
        
        if tipe == 'retribusi' or 'iuran' in kat or 'iuran' in nama_pihak:
            monthly[bulan]['iuran'] += total
        elif tipe == 'penjualan':
            monthly[bulan]['penjualan'] += total
        elif tipe == 'sumber lain':
            monthly[bulan]['lain_masuk'] += total
        elif tipe == 'pengeluaran':
            if 'residu' in kat or 'tpa' in kat or 'distribusi' in kat:
                monthly[bulan]['distribusi_residu'] += total
            elif 'gaji' in kat or 'upah' in kat or 'honor' in kat:
                monthly[bulan]['upah'] += total
            else:
                monthly[bulan]['lain_keluar'] += total
                
    result = []
    for k in sorted(monthly.keys()):
        d = monthly[k]
        d['pemasukan_total'] = d['iuran'] + d['penjualan'] + d['lain_masuk']
        d['pengeluaran_total'] = d['distribusi_residu'] + d['upah'] + d['lain_keluar']
        d['sisa'] = d['pemasukan_total'] - d['pengeluaran_total']
        result.append(d)
    return result

@api_router.get('/laporan/timbangan')
async def laporan_timbangan(start: str, end: str, current=Depends(admin_or_auditor_required)):
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
async def laporan_keuangan(start: str, end: str, current=Depends(admin_or_auditor_required)):
    items = await db.keuangan.find(
        {'tanggal': {'$gte': start, '$lte': end}}, {'_id': 0}
    ).sort('tanggal', 1).to_list(5000)
    return items


@api_router.get('/laporan/absensi')
async def laporan_absensi(bulan: str, current=Depends(admin_or_auditor_required)):
    return await rekap_absensi(bulan, current)

@api_router.get('/laporan/absensi-detail')
async def laporan_absensi_detail(bulan: str, petugas_ids: str, current=Depends(admin_or_auditor_required)):
    """Fetches detailed daily attendance and session data for specific officers."""
    id_list = [pid.strip() for pid in petugas_ids.split(',') if pid.strip()]
    if not id_list:
        return []

    # Get officers details
    petugas_list = await db.petugas.find({'id': {'$in': id_list}}, {'_id': 0, 'id': 1, 'nama': 1}).to_list(1000)
    petugas_map = {p['id']: p['nama'] for p in petugas_list}

    # Get all absensi records for the month and selected officers
    absensi_records = await db.absensi.find({
        'petugas_id': {'$in': id_list},
        'tanggal': {'$regex': f'^{bulan}'}
    }, {'_id': 0}).sort('tanggal', 1).to_list(5000)

    # Get all attendance sessions for the month and selected officers
    sessions = await db.attendance_sessions.find({
        'petugas_id': {'$in': id_list},
        'tanggal': {'$regex': f'^{bulan}'}
    }, {'_id': 0}).sort('check_in', 1).to_list(10000)

    # Group by petugas
    report = []
    for pid in id_list:
        nama = petugas_map.get(pid, 'Unknown')
        p_records = [r for r in absensi_records if r['petugas_id'] == pid]
        p_sessions = [s for s in sessions if s['petugas_id'] == pid]
        
        detail_harian = []
        for r in p_records:
            tanggal = r['tanggal']
            day_sessions = [s for s in p_sessions if s['tanggal'] == tanggal]
            detail_harian.append({
                'tanggal': tanggal,
                'status': r['status'],
                'jam': r.get('jam', 0),
                'alasan': r.get('alasan', ''),
                'sessions': day_sessions
            })
            
        if detail_harian:
            report.append({
                'petugas_id': pid,
                'nama': nama,
                'kehadiran': detail_harian
            })
            
    return report


@api_router.get('/laporan/penjualan')
async def laporan_penjualan(start: str, end: str, jenis_ids: str = None, current=Depends(admin_or_auditor_required)):
    """Penjualan komoditas report for a date range. Returns items enriched with jenis_sampah_nama + summary per jenis.
    Optional: jenis_ids = comma-separated list of jenis_sampah_id to filter."""
    query = {'tipe': 'penjualan', 'tanggal': {'$gte': start, '$lte': end}}
    if jenis_ids:
        id_list = [j.strip() for j in jenis_ids.split(',') if j.strip()]
        if id_list:
            query['jenis_sampah_id'] = {'$in': id_list}
    items = await db.keuangan.find(query, {'_id': 0}).sort('tanggal', 1).to_list(5000)
    jenis_map = {}
    for it in items:
        jid = it.get('jenis_sampah_id')
        if jid and jid not in jenis_map:
            jenis = await db.jenis_sampah.find_one({'id': jid}, {'_id': 0, 'nama': 1})
            jenis_map[jid] = jenis['nama'] if jenis else '-'
        it['jenis_sampah_nama'] = jenis_map.get(jid, '-')
    # Summary per jenis
    summary: dict = {}
    for it in items:
        jid = it.get('jenis_sampah_id', '')
        if jid not in summary:
            summary[jid] = {'nama': jenis_map.get(jid, '-'), 'total_kg': 0.0, 'total_rp': 0.0, 'transaksi': 0}
        summary[jid]['total_kg'] += it.get('bobot_kg', 0) or 0
        summary[jid]['total_rp'] += it.get('total', 0) or 0
        summary[jid]['transaksi'] += 1
    return {'items': items, 'summary': list(summary.values())}


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

    # Default TPS Location in settings
    tps = await db.settings.find_one({'key': 'tps_location'})
    if not tps:
        await db.settings.insert_one({
            'key': 'tps_location',
            'nama_tps': 'TPS Utama Gemerlap',
            'latitude': -6.20084,
            'longitude': 106.81666,
            'radius_meter': 100.0
        })
        logging.info('Seeded default TPS location')

    # Default TPS Location in tps_locations
    tps_locations_count = await db.tps_locations.count_documents({})
    if tps_locations_count == 0:
        await db.tps_locations.insert_one({
            'id': new_id(),
            'nama': 'TPS Utama Gemerlap',
            'latitude': -6.20084,
            'longitude': 106.81666,
            'radius_meter': 100.0,
            'created_at': now_iso()
        })
        logging.info('Seeded default TPS location in tps_locations')

    # Indexes
    await db.users.create_index('no_hp', unique=True)
    await db.users.create_index('id', unique=True)
    await db.settings.create_index('key', unique=True)
    await db.attendance_sessions.create_index('id', unique=True)
    await db.attendance_sessions.create_index([('petugas_id', 1), ('tanggal', 1)])
    await db.tps_locations.create_index('id', unique=True)


async def check_daily_alpha():
    while True:
        now = datetime.now(timezone.utc) + timedelta(hours=7) # WIB
        # Menjalankan pengecekan tepat di jam 23:59
        if now.hour == 23 and now.minute == 59:
            setting = await db.settings.find_one({'key': 'operasional_status'})
            status = setting.get('status', 'aktif') if setting else 'aktif'
            
            if status == 'aktif':
                tanggal_str = now.strftime('%Y-%m-%d')
                
                # Get all users with role 'petugas' or 'admin'
                users = await db.users.find({'role': {'$in': ['petugas', 'admin']}}).to_list(1000)
                user_ids = [u['id'] for u in users]
                
                # Verify they are active in the petugas collection
                active_petugas = await db.petugas.find({'id': {'$in': user_ids}, 'status': True}).to_list(1000)
                
                for p in active_petugas:
                    # Check if they have an absensi record for today
                    existing = await db.absensi.find_one({
                        'petugas_id': p['id'],
                        'tanggal': tanggal_str
                    })
                    if not existing:
                        # Insert Alpha
                        doc = {
                            'id': new_id(),
                            'petugas_id': p['id'],
                            'tanggal': tanggal_str,
                            'status': 'absen',
                            'jam': 0.0,
                            'alasan': 'Sistem Otomatis (Alpha)',
                            'manual': False,
                            'created_at': now_iso()
                        }
                        await db.absensi.insert_one(doc)
                logging.info(f"Daily alpha process completed for {tanggal_str}")
            else:
                logging.info(f"Skipped daily alpha process because status is libur")
                
            # Sleep 60 seconds to avoid running multiple times in the same minute
            await asyncio.sleep(60)
        else:
            # Check every minute
            await asyncio.sleep(60)


# ================= ASET, HUTANG & PIUTANG MODELS =================
class AsetCreate(BaseModel):
    nama_aset: str
    tanggal_perolehan: str
    harga_perolehan: float
    keterangan: Optional[str] = None

class HutangCreate(BaseModel):
    nama_kreditor: str
    tanggal_pinjam: str
    jumlah_hutang: float
    keterangan: Optional[str] = None

class HutangBayar(BaseModel):
    tanggal: str
    nominal: float
    keterangan: Optional[str] = None

class PiutangCreate(BaseModel):
    nama_debitur: str
    tanggal_piutang: str
    jumlah_piutang: float
    keterangan: Optional[str] = None

class PiutangBayar(BaseModel):
    tanggal: str
    nominal: float
    keterangan: Optional[str] = None


# ================= ASET, HUTANG & PIUTANG ENDPOINTS =================

# ─── ASET ENDPOINTS ────────────────────────────────────────────────────────────
@api_router.get('/aset')
async def list_aset(current=Depends(admin_or_auditor_required)):
    return await db.aset.find({}, {'_id': 0}).sort('tanggal_perolehan', -1).to_list(1000)

@api_router.post('/aset')
async def create_aset(req: AsetCreate, current=Depends(admin_required)):
    aset_id = str(uuid.uuid4())
    aset_doc = {
        'id': aset_id,
        'nama_aset': req.nama_aset,
        'tanggal_perolehan': req.tanggal_perolehan,
        'harga_perolehan': req.harga_perolehan,
        'keterangan': req.keterangan
    }
    await db.aset.insert_one(aset_doc)
    
    # Auto-sync to keuangan
    keuangan_doc = {
        'id': str(uuid.uuid4()),
        'tanggal': req.tanggal_perolehan,
        'tipe': 'pengeluaran',
        'total': req.harga_perolehan,
        'kategori': 'Peralatan',
        'keterangan': f"Pembelian Aset: {req.nama_aset}. {req.keterangan or ''}".strip(),
        'reference_id': aset_id,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.keuangan.insert_one(keuangan_doc)
    return {k: v for k, v in aset_doc.items() if k != '_id'}

@api_router.delete('/aset/{id}')
async def delete_aset(id: str, current=Depends(admin_required)):
    res = await db.aset.delete_one({'id': id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Aset tidak ditemukan")
    await db.keuangan.delete_many({'reference_id': id})
    return {'status': 'success', 'message': 'Aset berhasil dihapus'}


# ─── HUTANG ENDPOINTS ──────────────────────────────────────────────────────────
@api_router.get('/hutang')
async def list_hutang(current=Depends(admin_or_auditor_required)):
    return await db.utang.find({}, {'_id': 0}).sort('tanggal_pinjam', -1).to_list(1000)

@api_router.post('/hutang')
async def create_hutang(req: HutangCreate, current=Depends(admin_required)):
    hutang_id = str(uuid.uuid4())
    hutang_doc = {
        'id': hutang_id,
        'nama_kreditor': req.nama_kreditor,
        'tanggal_pinjam': req.tanggal_pinjam,
        'jumlah_hutang': req.jumlah_hutang,
        'sisa_hutang': req.jumlah_hutang,
        'keterangan': req.keterangan,
        'status': 'belum_lunas',
        'riwayat_cicilan': []
    }
    await db.utang.insert_one(hutang_doc)
    
    # Auto-sync to keuangan
    keuangan_doc = {
        'id': str(uuid.uuid4()),
        'tanggal': req.tanggal_pinjam,
        'tipe': 'sumber lain',
        'nama_pihak': req.nama_kreditor,
        'total': req.jumlah_hutang,
        'keterangan': f"Penerimaan Hutang dari {req.nama_kreditor}. {req.keterangan or ''}".strip(),
        'reference_id': hutang_id,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.keuangan.insert_one(keuangan_doc)
    return {k: v for k, v in hutang_doc.items() if k != '_id'}

@api_router.post('/hutang/{id}/bayar')
async def bayar_hutang(id: str, req: HutangBayar, current=Depends(admin_required)):
    hutang = await db.utang.find_one({'id': id})
    if not hutang:
        raise HTTPException(status_code=404, detail="Data hutang tidak ditemukan")
        
    if hutang['status'] == 'lunas':
        raise HTTPException(status_code=400, detail="Hutang sudah lunas")
        
    next_sisa = hutang['sisa_hutang'] - req.nominal
    if next_sisa < 0:
        raise HTTPException(status_code=400, detail="Nominal pembayaran melebihi sisa hutang")
        
    next_status = 'lunas' if next_sisa == 0 else 'belum_lunas'
    
    cicilan_item = {
        'id': str(uuid.uuid4()),
        'tanggal': req.tanggal,
        'nominal': req.nominal,
        'keterangan': req.keterangan or ''
    }
    
    await db.utang.update_one(
        {'id': id},
        {
            '$set': {'sisa_hutang': next_sisa, 'status': next_status},
            '$push': {'riwayat_cicilan': cicilan_item}
        }
    )
    
    # Auto-sync to keuangan
    keuangan_doc = {
        'id': str(uuid.uuid4()),
        'tanggal': req.tanggal,
        'tipe': 'pengeluaran',
        'total': req.nominal,
        'kategori': 'Lain-lain',
        'keterangan': f"Pembayaran Cicilan Hutang ke {hutang['nama_kreditor']}. {req.keterangan or ''}".strip(),
        'reference_id': id,
        'cicilan_id': cicilan_item['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.keuangan.insert_one(keuangan_doc)
    return {'status': 'success', 'sisa_hutang': next_sisa, 'status_hutang': next_status}

@api_router.delete('/hutang/{id}')
async def delete_hutang(id: str, current=Depends(admin_required)):
    res = await db.utang.delete_one({'id': id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Hutang tidak ditemukan")
    await db.keuangan.delete_many({'reference_id': id})
    return {'status': 'success', 'message': 'Hutang berhasil dihapus'}


# ─── PIUTANG ENDPOINTS ─────────────────────────────────────────────────────────
@api_router.get('/piutang')
async def list_piutang(current=Depends(admin_or_auditor_required)):
    return await db.piutang.find({}, {'_id': 0}).sort('tanggal_piutang', -1).to_list(1000)

@api_router.post('/piutang')
async def create_piutang(req: PiutangCreate, current=Depends(admin_required)):
    piutang_id = str(uuid.uuid4())
    piutang_doc = {
        'id': piutang_id,
        'nama_debitur': req.nama_debitur,
        'tanggal_piutang': req.tanggal_piutang,
        'jumlah_piutang': req.jumlah_piutang,
        'sisa_piutang': req.jumlah_piutang,
        'keterangan': req.keterangan,
        'status': 'belum_lunas',
        'riwayat_cicilan': []
    }
    await db.piutang.insert_one(piutang_doc)
    return {k: v for k, v in piutang_doc.items() if k != '_id'}

@api_router.post('/piutang/{id}/bayar')
async def bayar_piutang(id: str, req: PiutangBayar, current=Depends(admin_required)):
    piutang = await db.piutang.find_one({'id': id})
    if not piutang:
        raise HTTPException(status_code=404, detail="Data piutang tidak ditemukan")
        
    if piutang['status'] == 'lunas':
        raise HTTPException(status_code=400, detail="Piutang sudah lunas")
        
    next_sisa = piutang['sisa_piutang'] - req.nominal
    if next_sisa < 0:
        raise HTTPException(status_code=400, detail="Nominal pembayaran melebihi sisa piutang")
        
    next_status = 'lunas' if next_sisa == 0 else 'belum_lunas'
    
    cicilan_item = {
        'id': str(uuid.uuid4()),
        'tanggal': req.tanggal,
        'nominal': req.nominal,
        'keterangan': req.keterangan or ''
    }
    
    await db.piutang.update_one(
        {'id': id},
        {
            '$set': {'sisa_piutang': next_sisa, 'status': next_status},
            '$push': {'riwayat_cicilan': cicilan_item}
        }
    )
    
    # Auto-sync to keuangan
    keuangan_doc = {
        'id': str(uuid.uuid4()),
        'tanggal': req.tanggal,
        'tipe': 'sumber lain',
        'nama_pihak': piutang['nama_debitur'],
        'total': req.nominal,
        'keterangan': f"Pelunasan Piutang dari {piutang['nama_debitur']}. {req.keterangan or ''}".strip(),
        'reference_id': id,
        'cicilan_id': cicilan_item['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.keuangan.insert_one(keuangan_doc)
    return {'status': 'success', 'sisa_piutang': next_sisa, 'status_piutang': next_status}

@api_router.delete('/piutang/{id}')
async def delete_piutang(id: str, current=Depends(admin_required)):
    res = await db.piutang.delete_one({'id': id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Piutang tidak ditemukan")
    await db.keuangan.delete_many({'reference_id': id})
    return {'status': 'success', 'message': 'Piutang berhasil dihapus'}


# ─── NERACA SKONTRO ENDPOINT ───────────────────────────────────────────────────
@api_router.get('/laporan/neraca-skontro')
async def laporan_neraca_skontro(bulan: str, current=Depends(admin_or_auditor_required)):
    # bulan format: YYYY-MM
    parts = bulan.split("-")
    year = int(parts[0])
    month = int(parts[1])
    if month == 12:
        next_month = datetime(year + 1, 1, 1)
    else:
        next_month = datetime(year, month + 1, 1)
    last_day_dt = next_month - timedelta(days=1)
    end_date = last_day_dt.strftime('%Y-%m-%d')
    
    # 1. Kas
    incomes = await db.keuangan.find({
        'tanggal': {'$lte': end_date},
        'tipe': {'$in': ['penjualan', 'sumber lain', 'retribusi']}
    }).to_list(100000)
    total_in = sum(it.get('total', 0) for it in incomes)
    
    expenses = await db.keuangan.find({
        'tanggal': {'$lte': end_date},
        'tipe': 'pengeluaran'
    }).to_list(100000)
    total_out = sum(it.get('total', 0) for it in expenses)
    
    kas = total_in - total_out
    
    # 2. Piutang
    piutangs_raw = await db.piutang.find({'tanggal_piutang': {'$lte': end_date}}).to_list(10000)
    piutang_total_sisa = 0.0
    for p in piutangs_raw:
        initial = p.get('jumlah_piutang', 0)
        paid = sum(c.get('nominal', 0) for c in p.get('riwayat_cicilan', []) if c.get('tanggal', '') <= end_date)
        piutang_total_sisa += max(0.0, initial - paid)
        
    kasbons = await db.kasbon.find({'tanggal': {'$lte': end_date}}).to_list(10000)
    kasbon_total_sisa = 0.0
    for k in kasbons:
        is_repaid = False
        if k.get('status') == 'lunas':
            repay_period = k.get('slip_gaji_id', '')
            if repay_period and repay_period <= bulan:
                is_repaid = True
        if not is_repaid:
            kasbon_total_sisa += k.get('nominal', 0)
            
    total_piutang = piutang_total_sisa + kasbon_total_sisa
    
    # 3. Aset
    assets_raw = await db.aset.find({'tanggal_perolehan': {'$lte': end_date}}).to_list(10000)
    total_aset = sum(a.get('harga_perolehan', 0) for a in assets_raw)
    
    # 4. Hutang
    hutangs_raw = await db.utang.find({'tanggal_pinjam': {'$lte': end_date}}).to_list(10000)
    total_hutang = 0.0
    for h in hutangs_raw:
        initial = h.get('jumlah_hutang', 0)
        paid = sum(c.get('nominal', 0) for c in h.get('riwayat_cicilan', []) if c.get('tanggal', '') <= end_date)
        total_hutang += max(0.0, initial - paid)
        
    # 5. Modal
    total_modal = 0.0
    for it in incomes:
        tipe = it.get('tipe')
        kat = (it.get('kategori') or '').lower()
        desc = (it.get('keterangan') or '').lower()
        pihak = (it.get('nama_pihak') or '').lower()
        
        is_modal = False
        if tipe == 'retribusi':
            is_modal = True
        elif tipe == 'sumber lain':
            if 'subsidi' in pihak or 'subsidi' in desc or 'retribusi' in pihak or 'retribusi' in desc or 'retribusi' in kat:
                is_modal = True
                
        if is_modal:
            total_modal += it.get('total', 0)
            
    # 6. Laba Ditahan
    laba_ditahan = kas + total_piutang + total_aset - total_hutang - total_modal
    
    return {
        'bulan': bulan,
        'kas': round(kas, 2),
        'piutang': round(total_piutang, 2),
        'piutang_umum': round(piutang_total_sisa, 2),
        'piutang_kasbon': round(kasbon_total_sisa, 2),
        'aset': round(total_aset, 2),
        'hutang': round(total_hutang, 2),
        'modal': round(total_modal, 2),
        'laba_ditahan': round(laba_ditahan, 2),
        'total_aktiva': round(kas + total_piutang + total_aset, 2),
        'total_pasiva': round(total_hutang + total_modal + laba_ditahan, 2)
    }


@app.on_event('startup')
async def startup_event():
    await seed_data()
    asyncio.create_task(check_daily_alpha())


app.include_router(api_router)

ALLOWED_ORIGINS = [
    "https://tps.griyabakpia.com",
    "http://tps.griyabakpia.com",
    "https://129-226-195-175.nip.io",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:19006",
    "http://localhost:19000",
    "http://127.0.0.1:8081",
]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
