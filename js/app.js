/* ============================================================
   APLIKASI ABSEN PIKET — logika utama
   ============================================================ */

/* ── Status global ── */
const State = {
  token: null,
  user: null,
  sesiAktif: null,
  jenisAbsen: null,       // 'masuk' | 'keluar'
  qrToken: null,
  gps: null,              // { lat, lng, akurasi }
  fotoDataUrl: null,
  fakeGps: false,
  qrScanner: null,
  stream: null
};

/* ============================ BOOT ============================ */
document.addEventListener('DOMContentLoaded', function () {
  bindEvents();
  // Sembunyikan splash setelah jeda singkat
  setTimeout(function () {
    document.getElementById('splash').classList.add('hidden');
    const token = Store.getToken();
    if (token) {
      State.token = token;
      State.user = Store.getUser();
      masukHome();
    } else {
      tampilkan('page-login');
    }
  }, 900);
});

/* ============================ EVENT =========================== */
function bindEvents() {
  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('inp-pass').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('btn-logout').addEventListener('click', doLogout);

  document.getElementById('btn-absen-masuk').addEventListener('click', function () { mulaiAbsen('masuk'); });
  document.getElementById('btn-absen-keluar').addEventListener('click', function () { mulaiAbsen('keluar'); });

  document.getElementById('modal-close').addEventListener('click', tutupModalAbsen);
  document.getElementById('btn-manual-qr').addEventListener('click', inputManualQr);
  document.getElementById('btn-capture').addEventListener('click', ambilFoto);
  document.getElementById('btn-retake').addEventListener('click', ambilUlangFoto);
  document.getElementById('btn-lanjut-foto').addEventListener('click', lanjutKeKonfirmasi);
  document.getElementById('btn-kirim').addEventListener('click', kirimAbsen);
  document.getElementById('btn-sukses-tutup').addEventListener('click', function () {
    document.getElementById('modal-sukses').classList.add('hidden');
  });
}

/* ============================ NAVIGASI ========================= */
function tampilkan(id) {
  ['page-login', 'page-home'].forEach(function (p) {
    document.getElementById(p).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
}

function toast(pesan, tipe) {
  const el = document.getElementById('toast');
  el.textContent = pesan;
  el.className = 'toast ' + (tipe || '');
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.add('hidden'); }, 3200);
}

/* ============================ LOGIN =========================== */
async function doLogin() {
  const nip = document.getElementById('inp-nip').value.trim();
  const pass = document.getElementById('inp-pass').value;
  const msg = document.getElementById('login-msg');
  msg.textContent = '';
  msg.className = 'msg';

  if (!nip || !pass) {
    msg.textContent = 'NIP dan password wajib diisi';
    msg.classList.add('error');
    return;
  }

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Memproses…';

  try {
    const res = await API.login(nip, pass, Store.getDeviceId());
    Store.setToken(res.token);
    Store.setUser(res.pegawai);
    State.token = res.token;
    State.user = res.pegawai;
    masukHome();
  } catch (e) {
    msg.textContent = e.message;
    msg.classList.add('error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Masuk';
  }
}

function doLogout() {
  if (!confirm('Keluar dari aplikasi?')) return;
  Store.clear();
  State.token = null;
  State.user = null;
  document.getElementById('inp-pass').value = '';
  tampilkan('page-login');
}

/* ============================ HOME ============================ */
function masukHome() {
  tampilkan('page-home');
  const u = State.user || {};
  document.getElementById('user-info').textContent =
    (u.nama || '') + (u.jabatan ? ' — ' + u.jabatan : '');
  muatSesi();
}

async function muatSesi() {
  const card = document.getElementById('card-sesi');
  card.innerHTML = '<div class="card-loading">Memuat sesi piket…</div>';
  try {
    const res = await API.getSesiAktif(State.token);
    if (!res.data.adaSesi) {
      card.innerHTML = '<div class="empty">📭<br>Tidak ada jadwal piket untuk Anda saat ini.<br><span class="muted small">Hubungi admin bila ini keliru.</span></div>';
      document.getElementById('aksi-absen').classList.add('hidden');
      document.getElementById('riwayat').classList.add('hidden');
      return;
    }
    State.sesiAktif = res.data;
    renderSesi(res.data);
  } catch (e) {
    card.innerHTML = '<div class="empty">⚠️ ' + e.message + '</div>';
    if (e.message.indexOf('Sesi tidak valid') >= 0) doLogout();
  }
}

function renderSesi(d) {
  const card = document.getElementById('card-sesi');
  const j = d.jadwal;
  const badgeSiaga = j.status_siaga ? '<span class="badge badge-siaga">' + j.status_siaga + '</span>' : '';
  card.innerHTML =
    '<div class="card-title">Sesi Piket Anda</div>' +
    '<div class="sesi-row"><span class="sesi-regu">' + (d.sesi.id_regu || '-') + '</span>' + badgeSiaga + '</div>' +
    '<div class="sesi-jam">' + (j.jam_mulai || '07:00') + ' &rarr; ' + (j.jam_selesai || '07:00') + ' <span class="muted small">(' + (j.shift || '24 Jam') + ')</span></div>' +
    '<div class="muted small">Tanggal: ' + (j.tanggal || '-') + '</div>' +
    '<div class="sesi-status ' + (d.sudahMasuk ? 'ok' : 'warn') + '">' +
      (d.sudahMasuk ? (d.sudahKeluar ? '✅ Piket selesai (sudah serah terima)' : '✅ Sudah absen masuk') : '⏳ Belum absen masuk') +
    '</div>';

  // Tombol absen
  const aksi = document.getElementById('aksi-absen');
  const btnMasuk = document.getElementById('btn-absen-masuk');
  const btnKeluar = document.getElementById('btn-absen-keluar');
  aksi.classList.remove('hidden');
  if (!d.sudahMasuk) {
    btnMasuk.classList.remove('hidden');
    btnKeluar.classList.add('hidden');
  } else if (!d.sudahKeluar) {
    btnMasuk.classList.add('hidden');
    btnKeluar.classList.remove('hidden');
  } else {
    aksi.classList.add('hidden');
  }

  // Riwayat
  if (d.absensi && d.absensi.length) {
    const wrap = document.getElementById('riwayat');
    wrap.classList.remove('hidden');
    const list = document.getElementById('riwayat-list');
    list.innerHTML = d.absensi.map(function (a) {
      const ikon = a.jenis === 'masuk' ? '📥' : '📤';
      const warna = a.status === 'hadir' ? 'ok' : (a.status === 'terlambat' ? 'warn' : (a.status === 'pending' ? 'warn' : 'err'));
      return '<div class="riwayat-item ' + warna + '">' +
        '<span>' + ikon + ' ' + a.jenis.toUpperCase() + '</span>' +
        '<span>' + a.waktu_server + '</span>' +
        '<span class="badge badge-' + warna + '">' + a.status + '</span>' +
        '</div>';
    }).join('');
  }
}

/* ============================ MULAI ABSEN ============================ */
async function mulaiAbsen(jenis) {
  State.jenisAbsen = jenis;
  State.qrToken = null;
  State.fotoDataUrl = null;
  State.gps = null;

  document.getElementById('modal-title').textContent = 'Absen ' + (jenis === 'masuk' ? 'Masuk' : 'Keluar');
  document.getElementById('modal-msg').textContent = '';
  document.getElementById('modal-absen').classList.remove('hidden');

  // Ambil GPS lebih dulu (di latar)
  ambilGps();

  // Tampilkan langkah QR
  tampilStep('step-qr');
  mulaiScanQr();
}

function tampilStep(id) {
  ['step-qr', 'step-selfie', 'step-konfirmasi'].forEach(function (s) {
    document.getElementById(s).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
}

/* ── Langkah 1: QR ── */
function mulaiScanQr() {
  const reader = document.getElementById('qr-reader');
  reader.innerHTML = '';
  if (State.qrScanner) {
    try { State.qrScanner.clear(); } catch (e) {}
  }
  State.qrScanner = new Html5Qrcode('qr-reader');
  State.qrScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 220, height: 220 } },
    function (teks) {
      // Berhasil scan
      try { State.qrScanner.stop(); } catch (e) {}
      prosesQr(teks);
    },
    function () { /* abaikan error per frame */ }
  ).catch(function (err) {
    reader.innerHTML = '<div class="empty">Kamera tidak dapat diakses: ' + err + '<br>Gunakan tombol "Input Token Manual".</div>';
  });
}

function prosesQr(teks) {
  State.qrToken = String(teks).trim();
  toast('QR terbaca', 'ok');
  lanjutKeSelfie();
}

function inputManualQr() {
  const t = prompt('Masukkan token QR posko:');
  if (t && t.trim()) {
    try { if (State.qrScanner) State.qrScanner.stop(); } catch (e) {}
    prosesQr(t);
  }
}

/* ── Langkah 2: Selfie ── */
function lanjutKeSelfie() {
  tampilStep('step-selfie');
  document.getElementById('foto-preview').classList.add('hidden');
  document.getElementById('video').classList.remove('hidden');
  document.getElementById('btn-capture').classList.remove('hidden');
  document.getElementById('btn-retake').classList.add('hidden');
  mulaiKamera();
}

async function mulaiKamera() {
  try {
    State.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 },
      audio: false
    });
    document.getElementById('video').srcObject = State.stream;
  } catch (e) {
    document.getElementById('modal-msg').textContent = 'Kamera tidak dapat diakses: ' + e.message;
  }
}

function ambilFoto() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const maxW = APP_CONFIG.SELFIE_MAX_WIDTH;
  const skala = Math.min(1, maxW / video.videoWidth);
  canvas.width = video.videoWidth * skala;
  canvas.height = video.videoHeight * skala;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  State.fotoDataUrl = canvas.toDataURL('image/jpeg', APP_CONFIG.SELFIE_QUALITY);

  const prev = document.getElementById('foto-preview');
  prev.src = State.fotoDataUrl;
  prev.classList.remove('hidden');
  video.classList.add('hidden');
  document.getElementById('btn-capture').classList.add('hidden');
  document.getElementById('btn-retake').classList.remove('hidden');
  document.getElementById('btn-lanjut-foto').classList.remove('hidden');
  hentikanKamera();
}

function ambilUlangFoto() {
  State.fotoDataUrl = null;
  document.getElementById('foto-preview').classList.add('hidden');
  document.getElementById('video').classList.remove('hidden');
  document.getElementById('btn-capture').classList.remove('hidden');
  document.getElementById('btn-retake').classList.add('hidden');
  document.getElementById('btn-lanjut-foto').classList.add('hidden');
  mulaiKamera();
}

function hentikanKamera() {
  if (State.stream) {
    State.stream.getTracks().forEach(function (t) { t.stop(); });
    State.stream = null;
  }
}

/* ── GPS ── */
function ambilGps() {
  const statusEl = document.getElementById('gps-status');
  if (!navigator.geolocation) {
    statusEl.textContent = 'GPS tidak didukung perangkat ini';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      State.gps = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        akurasi: pos.coords.accuracy
      };
      // Deteksi sederhana mock location (akurasi 0 atau tidak wajar)
      if (pos.coords.accuracy === 0) State.fakeGps = true;
      statusEl.textContent = '📍 ' + State.gps.lat.toFixed(6) + ', ' + State.gps.lng.toFixed(6) +
        ' (±' + Math.round(State.gps.akurasi) + 'm)';
    },
    function (err) {
      statusEl.textContent = 'Gagal ambil GPS: ' + err.message;
    },
    { enableHighAccuracy: APP_CONFIG.GPS_HIGH_ACCURACY, timeout: APP_CONFIG.GPS_TIMEOUT_MS }
  );
}

/* ── Lanjut ke konfirmasi ── */
function lanjutKeKonfirmasi() {
  tampilStep('step-konfirmasi');
  const gpsTeks = State.gps
    ? State.gps.lat.toFixed(6) + ', ' + State.gps.lng.toFixed(6) + ' (±' + Math.round(State.gps.akurasi) + 'm)'
    : '⚠️ Belum terdeteksi';
  document.getElementById('konfirmasi-info').innerHTML =
    '<div class="konf-row"><span>Jenis</span><b>Absen ' + State.jenisAbsen.toUpperCase() + '</b></div>' +
    '<div class="konf-row"><span>QR</span><b>' + (State.qrToken ? '✅ Terbaca' : '❌ Belum') + '</b></div>' +
    '<div class="konf-row"><span>Lokasi</span><b>' + gpsTeks + '</b></div>' +
    '<div class="konf-row"><span>Selfie</span><b>' + (State.fotoDataUrl ? '✅ Siap' : '❌ Belum') + '</b></div>';
}

/* ── Kirim absen ── */
async function kirimAbsen() {
  if (!State.fotoDataUrl) { toast('Ambil selfie dulu', 'error'); return; }
  if (!State.gps) { toast('Tunggu GPS terdeteksi', 'error'); return; }

  const btn = document.getElementById('btn-kirim');
  btn.disabled = true;
  btn.textContent = 'Mengirim…';
  const msg = document.getElementById('modal-msg');
  msg.textContent = '';

  try {
    const res = await API.absen({
      token: State.token,
      jenis: State.jenisAbsen,
      qrToken: State.qrToken,
      lat: State.gps.lat,
      lng: State.gps.lng,
      akurasi: State.gps.akurasi,
      foto: State.fotoDataUrl,
      deviceId: Store.getDeviceId(),
      fakeGps: State.fakeGps
    });

    tutupModalAbsen();
    tampilSukses(res.data, res.message);
    muatSesi();
  } catch (e) {
    msg.textContent = e.message;
    msg.classList.add('error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ Kirim Absen';
  }
}

function tampilSukses(data, pesan) {
  const ikon = document.getElementById('sukses-ikon');
  const judul = document.getElementById('sukses-judul');
  if (data.status === 'hadir') { ikon.textContent = '✅'; judul.textContent = 'Absen Berhasil'; }
  else if (data.status === 'terlambat') { ikon.textContent = '⏰'; judul.textContent = 'Absen Tercatat (Terlambat)'; }
  else if (data.status === 'pending') { ikon.textContent = '⏳'; judul.textContent = 'Menunggu Verifikasi'; }

  let teks = pesan + '<br>' + data.waktu;
  if (data.jarak_m !== null && data.jarak_m !== undefined) {
    teks += '<br>Jarak ke posko: ' + data.jarak_m + ' m';
  }
  if (data.status === 'pending') {
    teks += '<br><span class="muted small">Anda di luar radius posko. Admin akan memverifikasi.</span>';
  }
  document.getElementById('sukses-pesan').innerHTML = teks;
  document.getElementById('modal-sukses').classList.remove('hidden');
}

function tutupModalAbsen() {
  document.getElementById('modal-absen').classList.add('hidden');
  hentikanKamera();
  if (State.qrScanner) {
    try { State.qrScanner.stop(); } catch (e) {}
    State.qrScanner = null;
  }
  document.getElementById('modal-msg').textContent = '';
}
