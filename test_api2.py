import requests
import datetime

base_url = "http://127.0.0.1:8000/api"

# Login
r = requests.post(f"{base_url}/auth/login", json={"no_hp": "08000000000", "password": "admin123"})
token = r.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}

tanggal = datetime.datetime.now().strftime("%Y-%m-%d")

items = [
    {
        "petugas_id": "6f01956f-5a08-459f-a338-304f37a549c7",
        "status": "hadir",
        "keterangan": "",
        "jam": 5.5
    }
]

res = requests.post(f"{base_url}/absensi", json={"tanggal": tanggal, "items": items}, headers=headers)
print("SAVE RES:", res.json())

bulan = tanggal[:7]
rekap_r = requests.get(f"{base_url}/absensi/rekap?bulan={bulan}", headers=headers)
print("REKAP DATA:", rekap_r.json())
