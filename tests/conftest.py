import os
import pytest
import requests

BASE_URL = (os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('EXPO_BACKEND_URL') or '').rstrip('/')

ADMIN_NO_HP = '08000000000'
ADMIN_PASSWORD = 'admin123'


@pytest.fixture(scope='session')
def base_url():
    assert BASE_URL, 'EXPO_PUBLIC_BACKEND_URL not set'
    return BASE_URL


@pytest.fixture(scope='session')
def api():
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    return s


@pytest.fixture(scope='session')
def admin_token(api, base_url):
    r = api.post(f'{base_url}/api/auth/login', json={'no_hp': ADMIN_NO_HP, 'password': ADMIN_PASSWORD})
    assert r.status_code == 200, f'Admin login failed: {r.status_code} {r.text}'
    data = r.json()
    return data['access_token']


@pytest.fixture(scope='session')
def admin_headers(admin_token):
    return {'Authorization': f'Bearer {admin_token}', 'Content-Type': 'application/json'}


@pytest.fixture(scope='session')
def petugas_user(api, base_url, admin_headers):
    """Create a petugas test user, returns (user_dict, headers)."""
    no_hp = 'TEST_08911111111'[-15:]  # phone-like
    # ensure unique
    payload = {'nama': 'TEST Petugas', 'no_hp': '08911111111', 'password': 'petugas123', 'role': 'petugas'}
    r = api.post(f'{base_url}/api/users', json=payload, headers=admin_headers)
    if r.status_code == 400:
        # already exists - delete via admin
        ulist = api.get(f'{base_url}/api/users', headers=admin_headers).json()
        for u in ulist:
            if u['no_hp'] == '08911111111':
                api.delete(f'{base_url}/api/users/{u["id"]}', headers=admin_headers)
        r = api.post(f'{base_url}/api/users', json=payload, headers=admin_headers)
    assert r.status_code == 200, f'Create petugas failed: {r.text}'
    user = r.json()
    # login
    lr = api.post(f'{base_url}/api/auth/login', json={'no_hp': '08911111111', 'password': 'petugas123'})
    assert lr.status_code == 200, f'Petugas login failed: {lr.text}'
    token = lr.json()['access_token']
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    yield user, headers
    # teardown
    try:
        api.delete(f'{base_url}/api/users/{user["id"]}', headers=admin_headers)
    except Exception:
        pass
