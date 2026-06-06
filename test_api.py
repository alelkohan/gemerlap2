import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv("/Users/farrelhafizh/Sites/gemerlap2/backend/.env")
db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]

async def test():
    bulan = '2026-06'
    pipeline = [
        {'$match': {'tanggal': {'$regex': f'^{bulan}'}}},
        {'$group': {
            '_id': {'petugas_id': '$petugas_id', 'status': '$status'},
            'count': {'$sum': 1},
            'total_jam': {'$sum': {'$ifNull': ['$jam', 0]}},
        }},
    ]
    res = await db.absensi.aggregate(pipeline).to_list(10000)
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
    print("SUCCESS")
    print(list(rekap.values()))

asyncio.run(test())
