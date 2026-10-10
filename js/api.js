/* ============================================================
   LAPISAN API — komunikasi ke backend Apps Script
   ============================================================ */

const API = {
  /**
   * Kirim permintaan ke backend.
   * Catatan: Content-Type 'text/plain' dipakai agar tidak memicu
   * preflight CORS (Apps Script tidak mendukung OPTIONS).
   */
  async call(action, data) {
    if (!APP_CONFIG.API_URL || APP_CONFIG.API_URL.indexOf('ISI_URL') === 0) {
      throw new Error('API_URL belum diisi di js/config.js');
    }
    const body = Object.assign({ action: action }, data || {});

    const resp = await fetch(APP_CONFIG.API_URL, {
      method: 'POST',
      // text/plain menghindari preflight; body tetap JSON string
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });

    if (!resp.ok) throw new Error('Gagal terhubung ke server (' + resp.status + ')');
    const json = await resp.json();
    if (!json.ok) throw new Error(json.message || 'Terjadi kesalahan pada server');
    return json;
  },

  /* ── Wrapper aksi umum ── */
  login(nip, password, deviceId) {
    return this.call('login', { nip: nip, password: password, deviceId: deviceId });
  },
  profil(token) {
    return this.call('profil', { token: token });
  },
  gantiPassword(token, lama, baru) {
    return this.call('gantiPassword', { token: token, passwordLama: lama, passwordBaru: baru });
  },

  /* ── Absensi ── */
  getSesiAktif(token) {
    return this.call('getSesiAktif', { token: token });
  },
  absen(payload) {
    return this.call('absen', payload);
  }
};

/* ── Penyimpanan lokal (token, user, device) ── */

const Store = {
  getDeviceId() {
    let id = localStorage.getItem(APP_CONFIG.DEVICE_ID_KEY);
    if (!id) {
      id = 'DEV-' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem(APP_CONFIG.DEVICE_ID_KEY, id);
    }
    return id;
  },
  getToken() { return localStorage.getItem(APP_CONFIG.TOKEN_KEY); },
  setToken(t) { localStorage.setItem(APP_CONFIG.TOKEN_KEY, t); },
  getUser() {
    try { return JSON.parse(localStorage.getItem(APP_CONFIG.USER_KEY)); }
    catch (e) { return null; }
  },
  setUser(u) { localStorage.setItem(APP_CONFIG.USER_KEY, JSON.stringify(u)); },
  clear() {
    localStorage.removeItem(APP_CONFIG.TOKEN_KEY);
    localStorage.removeItem(APP_CONFIG.USER_KEY);
  }
};
