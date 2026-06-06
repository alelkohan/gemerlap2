"""TPS Manager backend API tests - covers auth, master data, timbangan, keuangan, absensi, dashboard, laporan."""
import os
import pytest
import requests
from datetime import datetime

BASE_URL = (os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('EXPO_BACKEND_URL') or '').rstrip('/')


# ===================== AUTH =====================
class TestAuth:
    def test_login_admin_success(self, api, base_url):
        r = api.post(f'{base_url}/api/auth/login', json={'no_hp': '08000000000', 'password': 'admin123'})
        assert r.status_code == 200
        d = r.json()
        assert 'access_token' in d and d['token_type'] == 'bearer'
        assert d['user']['role'] == 'admin'
        assert 'password_hash' not in d['user']
        assert '_id' not in d['user']

    def test_login_wrong_password(self, api, base_url):
        r = api.post(f'{base_url}/api/auth/login', json={'no_hp': '08000000000', 'password': 'wrong'})
        assert r.status_code == 401

    def test_me_returns_user(self, api, base_url, admin_headers):
        r = api.get(f'{base_url}/api/auth/me', headers=admin_headers)
        assert r.status_code == 200
        u = r.json()
        assert u['no_hp'] == '08000000000'
        assert 'password_hash' not in u
        assert '_id' not in u

    def test_me_no_token_401(self, api, base_url):
        r = api.get(f'{base_url}/api/auth/me')
        assert r.status_code in (401, 403)

    def test_change_password_wrong_current(self, api, base_url, admin_headers):
        r = api.post(f'{base_url}/api/auth/change-password',
                     json={'current_password': 'wrong', 'new_password': 'newpass123'},
                     headers=admin_headers)
        assert r.status_code == 400

    def test_change_password_then_revert(self, api, base_url, admin_headers):
        # change to new, then back
        r1 = api.post(f'{base_url}/api/auth/change-password',
                      json={'current_password': 'admin123', 'new_password': 'admin999'},
                      headers=admin_headers)
        assert r1.status_code == 200
        # revert
        # need to re-login because token still valid (same key), revert
        r2 = api.post(f'{base_url}/api/auth/change-password',
                      json={'current_password': 'admin999', 'new_password': 'admin123'},
                      headers=admin_headers)
        assert r2.status_code == 200


# ===================== MASTER (units, jenis-sampah) =====================
class TestMasterData:
    def test_seeded_units(self, api, base_url, admin_headers):
        r = api.get(f'{base_url}/api/units', headers=admin_headers)
        assert r.status_code == 200
        names = [u['nama'] for u in r.json()]
        for x in ['Umum', 'Asrama', 'Sekolah']:
            assert x in names

    def test_seeded_jenis(self, api, base_url, admin_headers):
        r = api.get(f'{base_url}/api/jenis-sampah', headers=admin_headers)
        assert r.status_code == 200
        names = [u['nama'] for u in r.json()]
        for x in ['Plastik', 'Kardus', 'Logam', 'Bakar', 'Lain-lain']:
            assert x in names

    def test_units_crud(self, api, base_url, admin_headers):
        r = api.post(f'{base_url}/api/units', json={'nama': 'TEST_Unit', 'aktif': True}, headers=admin_headers)
        assert r.status_code == 200
        uid = r.json()['id']
        # update
        r2 = api.put(f'{base_url}/api/units/{uid}', json={'nama': 'TEST_Unit2', 'aktif': False}, headers=admin_headers)
        assert r2.status_code == 200
        # verify via list
        lst = api.get(f'{base_url}/api/units', headers=admin_headers).json()
        found = [u for u in lst if u['id'] == uid]
        assert found and found[0]['nama'] == 'TEST_Unit2' and found[0]['aktif'] is False
        # delete
        r3 = api.delete(f'{base_url}/api/units/{uid}', headers=admin_headers)
        assert r3.status_code == 200
        lst2 = api.get(f'{base_url}/api/units', headers=admin_headers).json()
        assert not [u for u in lst2 if u['id'] == uid]

    def test_jenis_crud(self, api, base_url, admin_headers):
        r = api.post(f'{base_url}/api/jenis-sampah', json={'nama': 'TEST_Botol', 'tipe': 'komoditas'}, headers=admin_headers)
        assert r.status_code == 200
        jid = r.json()['id']
        api.put(f'{base_url}/api/jenis-sampah/{jid}', json={'nama': 'TEST_Botol2', 'tipe': 'lain'}, headers=admin_headers)
        lst = api.get(f'{base_url}/api/jenis-sampah', headers=admin_headers).json()
        found = [u for u in lst if u['id'] == jid]
        assert found and found[0]['nama'] == 'TEST_Botol2' and found[0]['tipe'] == 'lain'
        api.delete(f'{base_url}/api/jenis-sampah/{jid}', headers=admin_headers)


# ===================== USERS / PETUGAS =====================
class TestUsersPetugas:
    def test_create_user_admin_only(self, api, base_url, admin_headers, petugas_user):
        # petugas trying to create user should fail
        _, ph = petugas_user
        r = api.post(f'{base_url}/api/users',
                     json={'nama': 'X', 'no_hp': '08999999999', 'password': 'pwd123', 'role': 'petugas'},
                     headers=ph)
        assert r.status_code == 403

    def test_delete_user_admin_only(self, api, base_url, petugas_user):
        u, ph = petugas_user
        r = api.delete(f'{base_url}/api/users/{u["id"]}', headers=ph)
        assert r.status_code == 403

    def test_petugas_create_admin_only(self, api, base_url, admin_headers, petugas_user):
        _, ph = petugas_user
        r = api.post(f'{base_url}/api/petugas',
                     json={'nama': 'TEST_P', 'no_hp': '0812', 'jabatan': 'Petugas', 'status': True},
                     headers=ph)
        assert r.status_code == 403
        # admin can create
        r2 = api.post(f'{base_url}/api/petugas',
                      json={'nama': 'TEST_P', 'no_hp': '0812', 'jabatan': 'Petugas', 'status': True},
                      headers=admin_headers)
        assert r2.status_code == 200
        pid = r2.json()['id']
        # cleanup
        api.delete(f'{base_url}/api/petugas/{pid}', headers=admin_headers)

    def test_no_password_hash_in_users_list(self, api, base_url, admin_headers):
        r = api.get(f'{base_url}/api/users', headers=admin_headers)
        assert r.status_code == 200
        for u in r.json():
            assert 'password_hash' not in u
            assert '_id' not in u


# ===================== TIMBANGAN + PILAHAN =====================
@pytest.fixture
def unit_id(api, base_url, admin_headers):
    units = api.get(f'{base_url}/api/units', headers=admin_headers).json()
    for u in units:
        if u['nama'] == 'Umum':
            return u['id']
    return units[0]['id']


@pytest.fixture
def jenis_ids(api, base_url, admin_headers):
    js = api.get(f'{base_url}/api/jenis-sampah', headers=admin_headers).json()
    return {j['nama']: j['id'] for j in js}


class TestTimbangan:
    def test_create_timbangan_invalid_bobot(self, api, base_url, admin_headers, unit_id):
        r = api.post(f'{base_url}/api/timbangan',
                     json={'tanggal': '2026-01-15', 'jam': '09:00', 'unit_id': unit_id, 'bobot_total': 0},
                     headers=admin_headers)
        assert r.status_code == 400

    def test_timbangan_full_flow(self, api, base_url, admin_headers, unit_id, jenis_ids):
        # Create
        r = api.post(f'{base_url}/api/timbangan',
                     json={'tanggal': '2026-01-15', 'jam': '10:00', 'unit_id': unit_id, 'bobot_total': 50.0},
                     headers=admin_headers)
        assert r.status_code == 200, r.text
        tid = r.json()['id']
        assert r.json()['status_pilah'] is False
        assert r.json().get('unit_nama')

        # Pilahan exceeding bobot -> 400
        items = [{'jenis_sampah_id': jenis_ids['Plastik'], 'bobot': 30},
                 {'jenis_sampah_id': jenis_ids['Kardus'], 'bobot': 30}]
        r2 = api.post(f'{base_url}/api/timbangan/{tid}/pilahan', json={'items': items}, headers=admin_headers)
        assert r2.status_code == 400

        # Partial pilahan
        items = [{'jenis_sampah_id': jenis_ids['Plastik'], 'bobot': 20}]
        r3 = api.post(f'{base_url}/api/timbangan/{tid}/pilahan', json={'items': items}, headers=admin_headers)
        assert r3.status_code == 200
        assert r3.json()['status_pilah'] is False

        # Full pilahan
        items = [{'jenis_sampah_id': jenis_ids['Plastik'], 'bobot': 30},
                 {'jenis_sampah_id': jenis_ids['Kardus'], 'bobot': 20}]
        r4 = api.post(f'{base_url}/api/timbangan/{tid}/pilahan', json={'items': items}, headers=admin_headers)
        assert r4.status_code == 200
        assert r4.json()['status_pilah'] is True

        # GET pilahan
        r5 = api.get(f'{base_url}/api/timbangan/{tid}/pilahan', headers=admin_headers)
        assert r5.status_code == 200
        assert len(r5.json()) == 2

        # Update
        r6 = api.put(f'{base_url}/api/timbangan/{tid}',
                     json={'tanggal': '2026-01-15', 'jam': '11:00', 'unit_id': unit_id, 'bobot_total': 60.0},
                     headers=admin_headers)
        assert r6.status_code == 200

        # Delete (cascade pilahan)
        r7 = api.delete(f'{base_url}/api/timbangan/{tid}', headers=admin_headers)
        assert r7.status_code == 200
        # verify pilahan gone
        r8 = api.get(f'{base_url}/api/timbangan/{tid}/pilahan', headers=admin_headers)
        assert r8.status_code == 200 and r8.json() == []


# ===================== KEUANGAN =====================
class TestKeuangan:
    def test_invoice_generation_and_3_tipes(self, api, base_url, admin_headers, jenis_ids):
        created_ids = []
        # use future month to avoid counter pollution
        tanggal = '2030-03-10'

        # 3 transactions all on same month -> sequential invoice nums
        payloads = [
            {'tanggal': tanggal, 'tipe': 'penjualan', 'jenis_sampah_id': jenis_ids['Plastik'],
             'nama_pihak': 'TEST_Buyer', 'bobot_kg': 10, 'harga_per_kg': 5000, 'total': 50000},
            {'tanggal': tanggal, 'tipe': 'bantuan', 'nama_pihak': 'TEST_Donor', 'total': 100000,
             'keterangan': 'donasi'},
            {'tanggal': tanggal, 'tipe': 'pengeluaran', 'total': 25000, 'kategori': 'operasional'},
        ]
        invoices = []
        for p in payloads:
            r = api.post(f'{base_url}/api/keuangan', json=p, headers=admin_headers)
            assert r.status_code == 200, r.text
            d = r.json()
            assert d['no_invoice'].startswith('INV-2030/03/')
            invoices.append(d['no_invoice'])
            created_ids.append(d['id'])
            assert '_id' not in d
        # sequential
        nums = [int(x.split('/')[-1]) for x in invoices]
        assert nums[1] == nums[0] + 1
        assert nums[2] == nums[1] + 1

        # different month -> counter reset (next month start at 001)
        r = api.post(f'{base_url}/api/keuangan',
                     json={'tanggal': '2030-04-01', 'tipe': 'penjualan', 'total': 1000,
                           'jenis_sampah_id': jenis_ids['Plastik']},
                     headers=admin_headers)
        assert r.status_code == 200
        assert r.json()['no_invoice'] == 'INV-2030/04/001'
        created_ids.append(r.json()['id'])

        # GET single - enriched
        kid = created_ids[0]
        rg = api.get(f'{base_url}/api/keuangan/{kid}', headers=admin_headers)
        assert rg.status_code == 200
        assert rg.json().get('jenis_sampah_nama') == 'Plastik'

        # cleanup
        for cid in created_ids:
            api.delete(f'{base_url}/api/keuangan/{cid}', headers=admin_headers)

    def test_saldo(self, api, base_url, admin_headers):
        r = api.get(f'{base_url}/api/keuangan/saldo', headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert 'saldo' in d and 'pemasukan' in d and 'pengeluaran' in d
        assert d['saldo'] == d['pemasukan'] - d['pengeluaran']


# ===================== ABSENSI =====================
class TestAbsensi:
    def test_absensi_admin_only_and_rekap(self, api, base_url, admin_headers, petugas_user):
        # create a petugas record
        rp = api.post(f'{base_url}/api/petugas',
                      json={'nama': 'TEST_Abs', 'no_hp': '0822', 'status': True},
                      headers=admin_headers)
        pid = rp.json()['id']

        tanggal = '2030-05-15'
        payload = {'tanggal': tanggal, 'items': [{'petugas_id': pid, 'status': 'hadir', 'keterangan': ''}]}

        # petugas role -> 403
        _, ph = petugas_user
        r403 = api.post(f'{base_url}/api/absensi', json=payload, headers=ph)
        assert r403.status_code == 403

        # admin can save
        r = api.post(f'{base_url}/api/absensi', json=payload, headers=admin_headers)
        assert r.status_code == 200 and r.json()['count'] == 1

        # Save again - should delete + reinsert
        payload2 = {'tanggal': tanggal, 'items': [{'petugas_id': pid, 'status': 'sakit', 'keterangan': 'demam'}]}
        api.post(f'{base_url}/api/absensi', json=payload2, headers=admin_headers)

        # GET by date
        rg = api.get(f'{base_url}/api/absensi?tanggal={tanggal}', headers=admin_headers)
        assert rg.status_code == 200
        lst = rg.json()
        assert len(lst) == 1 and lst[0]['status'] == 'sakit'

        # Rekap monthly
        rr = api.get(f'{base_url}/api/absensi/rekap?bulan=2030-05', headers=admin_headers)
        assert rr.status_code == 200
        rec = [x for x in rr.json() if x['petugas_id'] == pid]
        assert rec and rec[0]['sakit'] == 1

        # cleanup
        api.delete(f'{base_url}/api/petugas/{pid}', headers=admin_headers)


# ===================== DASHBOARD =====================
class TestDashboard:
    def test_dashboard_stats(self, api, base_url, admin_headers):
        bulan = datetime.now().strftime('%Y-%m')
        r = api.get(f'{base_url}/api/dashboard/stats?bulan={bulan}', headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ['total_berat', 'saldo', 'catatan_masuk', 'belum_dipilah', 'chart', 'recent']:
            assert k in d
        assert isinstance(d['chart'], list)
        assert isinstance(d['recent'], list)
        # no leak
        for it in d['recent']:
            assert '_id' not in it

    def test_dashboard_no_bulan(self, api, base_url, admin_headers):
        r = api.get(f'{base_url}/api/dashboard/stats', headers=admin_headers)
        assert r.status_code == 200
        assert 'bulan' in r.json()


# ===================== LAPORAN =====================
class TestLaporan:
    def test_laporan_timbangan(self, api, base_url, admin_headers, unit_id, jenis_ids):
        # create timbangan + pilahan
        r = api.post(f'{base_url}/api/timbangan',
                     json={'tanggal': '2030-07-10', 'jam': '08:00', 'unit_id': unit_id, 'bobot_total': 20.0},
                     headers=admin_headers)
        tid = r.json()['id']
        api.post(f'{base_url}/api/timbangan/{tid}/pilahan',
                 json={'items': [{'jenis_sampah_id': jenis_ids['Plastik'], 'bobot': 20}]},
                 headers=admin_headers)

        lr = api.get(f'{base_url}/api/laporan/timbangan?start=2030-07-01&end=2030-07-31', headers=admin_headers)
        assert lr.status_code == 200
        rows = lr.json()
        found = [x for x in rows if x['id'] == tid]
        assert found
        assert 'unit_nama' in found[0]
        assert isinstance(found[0]['pilahan'], list) and len(found[0]['pilahan']) == 1

        api.delete(f'{base_url}/api/timbangan/{tid}', headers=admin_headers)

    def test_laporan_keuangan(self, api, base_url, admin_headers):
        # create one
        r = api.post(f'{base_url}/api/keuangan',
                     json={'tanggal': '2030-08-15', 'tipe': 'bantuan', 'total': 5000},
                     headers=admin_headers)
        kid = r.json()['id']
        lr = api.get(f'{base_url}/api/laporan/keuangan?start=2030-08-01&end=2030-08-31', headers=admin_headers)
        assert lr.status_code == 200
        assert any(x['id'] == kid for x in lr.json())
        api.delete(f'{base_url}/api/keuangan/{kid}', headers=admin_headers)
