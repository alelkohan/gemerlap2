import asyncio
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)
res = client.post("/api/lembur", json={"durasi_jam": 2, "alasan": "test"})
print(res.status_code)
print(res.json())
