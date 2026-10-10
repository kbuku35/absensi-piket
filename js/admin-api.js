/* ============================================================
   KONFIGURASI & API — WEB ADMIN
   ============================================================ */

const ADMIN_CONFIG = {
  // >>> WAJIB DIISI: sama dengan API_URL di frontend/js/config.js <<<
  API_URL: 'https://script.google.com/macros/s/AKfycbxwACgpD06q9Ce5U4W5FEdPM15R5vlqm8eq3iW4UsuAkHuOqIhHVh7i9M-KbXLdeMoq/exec',
  TOKEN_KEY: 'bpbd_admin_token',
  USER_KEY: 'bpbd_admin_user'
};

const AdminStore = {
  getToken() { return localStorage.getItem(ADMIN_CONFIG.TOKEN_KEY); },
  setToken(t) { localStorage.setItem(ADMIN_CONFIG.TOKEN_KEY, t); },
  getUser() {
    try { return JSON.parse(localStorage.getItem(ADMIN_CONFIG.USER_KEY)); }
    catch (e) { return null; }
  },
  setUser(u) { localStorage.setItem(ADMIN_CONFIG.USER_KEY, JSON.stringify(u)); },
  clear() {
    localStorage.removeItem(ADMIN_CONFIG.TOKEN_KEY);
    localStorage.removeItem(ADMIN_CONFIG.USER_KEY);
  }
};

const AdminAPI = {
  async call(action, data) {
    if (!ADMIN_CONFIG.API_URL || ADMIN_CONFIG.API_URL.indexOf('ISI_URL') === 0) {
      throw new Error('API_URL belum diisi di admin/js/admin-api.js');
    }
    const body = Object.assign({ action: action, token: AdminStore.getToken() }, data || {});
    const resp = await fetch(ADMIN_CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });
    if (!resp.ok) throw new Error('Gagal terhubung ke server (' + resp.status + ')');
    const json = await resp.json();
    if (!json.ok) throw new Error(json.message || 'Terjadi kesalahan');
    return json;
  },

  login(nip, password) {
    // Login admin memakai device id khusus web (agar tidak bentrok device HP)
    return this.call('login', { nip: nip, password: password, deviceId: '' });
  },
  profil() { return this.call('profil'); },

  // Pegawai
  listPegawai() { return this.call('listPegawai'); },
  simpanPegawai(data) { return this.call('simpanPegawai', { data: data }); },
  hapusPegawai(id) { return this.call('hapusPegawai', { id: id }); },
  resetDevice(id) { return this.call('resetDevice', { id: id }); },

  // Regu
  listRegu() { return this.call('listRegu'); },
  simpanRegu(data) { return this.call('simpanRegu', { data: data }); },
  hapusRegu(id) { return this.call('hapusRegu', { id: id }); },

  // Lokasi
  listLokasi() { return this.call('listLokasi'); },
  simpanLokasi(data) { return this.call('simpanLokasi', { data: data }); },

  // Jadwal
  listJadwal(filter) { return this.call('listJadwal', { filter: filter }); },
  simpanJadwal(data) { return this.call('simpanJadwal', { data: data }); },
  hapusJadwal(id) { return this.call('hapusJadwal', { id: id }); },

  // Monitoring & rekap
  monitoring(tanggal) { return this.call('monitoringHariIni', { tanggal: tanggal }); },
  rekap(filter) { return this.call('rekapAbsensi', { filter: filter }); },
  listPending() { return this.call('listAbsenPending'); },
  verifikasi(idAbsen, status, catatan) {
    return this.call('verifikasiAbsen', { idAbsen: idAbsen, status: status, catatan: catatan });
  }
};
