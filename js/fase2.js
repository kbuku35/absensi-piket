/* ============================================================
   LOG BOOK PIKET & LAPORAN — logika frontend (Fase 2)
   ============================================================ */

const LogState = {
  stream: null,
  fotoDataUrl: null,
  koordinat: ''
};

/* ── Buka modal log book ── */
async function bukaLogBook() {
  LogState.fotoDataUrl = null;
  document.getElementById('log-uraian').value = '';
  document.getElementById('log-lokasi').value = '';
  document.getElementById('log-msg').textContent = '';
  document.getElementById('log-foto-preview').classList.add('hidden');
  document.getElementById('log-video').classList.remove('hidden');
  document.getElementById('log-capture').classList.remove('hidden');
  document.getElementById('log-retake').classList.add('hidden');
  document.getElementById('modal-log').classList.remove('hidden');

  // Ambil koordinat saat ini (opsional, untuk log)
  if (State.gps) {
    LogState.koordinat = State.gps.lat.toFixed(6) + ',' + State.gps.lng.toFixed(6);
  }

  // Muat kategori bila belum ada
  const sel = document.getElementById('log-kategori');
  if (sel.options.length === 0) {
    try {
      const res = await API.getKategoriLog(State.token);
      sel.innerHTML = res.data.map(function (k) {
        return '<option value="' + k + '">' + k + '</option>';
      }).join('');
    } catch (e) {
      sel.innerHTML = '<option>Lain-lain</option>';
    }
  }

  // Muat daftar log sesi ini
  muatDaftarLog();

  // Nyalakan kamera
  mulaiKameraLog();
}

function tutupLogBook() {
  document.getElementById('modal-log').classList.add('hidden');
  hentikanKameraLog();
}

/* ── Kamera log book ── */
async function mulaiKameraLog() {
  try {
    LogState.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: 640, height: 480 },
      audio: false
    });
    document.getElementById('log-video').srcObject = LogState.stream;
  } catch (e) {
    document.getElementById('log-msg').textContent = 'Kamera tidak dapat diakses: ' + e.message;
  }
}

function ambilFotoLog() {
  const video = document.getElementById('log-video');
  const canvas = document.getElementById('log-canvas');
  const skala = Math.min(1, APP_CONFIG.SELFIE_MAX_WIDTH / video.videoWidth);
  canvas.width = video.videoWidth * skala;
  canvas.height = video.videoHeight * skala;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  LogState.fotoDataUrl = canvas.toDataURL('image/jpeg', APP_CONFIG.SELFIE_QUALITY);

  const prev = document.getElementById('log-foto-preview');
  prev.src = LogState.fotoDataUrl;
  prev.classList.remove('hidden');
  video.classList.add('hidden');
  document.getElementById('log-capture').classList.add('hidden');
  document.getElementById('log-retake').classList.remove('hidden');
  hentikanKameraLog();
}

function ulangiFotoLog() {
  LogState.fotoDataUrl = null;
  document.getElementById('log-foto-preview').classList.add('hidden');
  document.getElementById('log-video').classList.remove('hidden');
  document.getElementById('log-capture').classList.remove('hidden');
  document.getElementById('log-retake').classList.add('hidden');
  mulaiKameraLog();
}

function hentikanKameraLog() {
  if (LogState.stream) {
    LogState.stream.getTracks().forEach(function (t) { t.stop(); });
    LogState.stream = null;
  }
}

/* ── Simpan log ── */
async function simpanLog() {
  const uraian = document.getElementById('log-uraian').value.trim();
  const msg = document.getElementById('log-msg');
  msg.textContent = '';
  if (uraian.length < 3) {
    msg.textContent = 'Uraian wajib diisi minimal 3 karakter';
    msg.classList.add('error');
    return;
  }

  const btn = document.getElementById('log-simpan');
  btn.disabled = true; btn.textContent = 'Menyimpan…';
  try {
    await API.tambahLogBook({
      token: State.token,
      kategori: document.getElementById('log-kategori').value,
      uraian: uraian,
      lokasi: document.getElementById('log-lokasi').value,
      koordinat: LogState.koordinat,
      prioritas: document.getElementById('log-prioritas').value,
      foto: LogState.fotoDataUrl
    });
    toast('Catatan tersimpan', 'ok');
    // Reset form
    document.getElementById('log-uraian').value = '';
    document.getElementById('log-lokasi').value = '';
    LogState.fotoDataUrl = null;
    document.getElementById('log-foto-preview').classList.add('hidden');
    document.getElementById('log-video').classList.remove('hidden');
    document.getElementById('log-capture').classList.remove('hidden');
    document.getElementById('log-retake').classList.add('hidden');
    mulaiKameraLog();
    muatDaftarLog();
  } catch (e) {
    msg.textContent = e.message;
    msg.classList.add('error');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Simpan Catatan';
  }
}

/* ── Daftar log sesi ── */
async function muatDaftarLog() {
  const box = document.getElementById('log-list');
  box.innerHTML = '<div class="muted small">Memuat…</div>';
  try {
    const res = await API.getLogBookSesiAktif(State.token);
    const logs = res.data.log || [];
    if (!logs.length) {
      box.innerHTML = '<div class="muted small">Belum ada catatan pada sesi ini.</div>';
      return;
    }
    box.innerHTML = logs.map(function (l) {
      const priorBadge = String(l.prioritas).toLowerCase() === 'tinggi'
        ? ' <span class="badge badge-err">penting</span>' : '';
      const foto = l.foto_url ? '<a href="' + l.foto_url + '" target="_blank">🖼️ foto</a>' : '';
      return '<div class="log-item">' +
        '<div class="log-head"><b>' + String(l.waktu).substring(11, 16) + '</b> ' +
          '<span class="badge badge-ok">' + l.kategori + '</span>' + priorBadge + '</div>' +
        '<div class="log-uraian">' + escapeHtml(l.uraian) + '</div>' +
        '<div class="log-meta muted small">' +
          (l.lokasi ? '📍 ' + escapeHtml(l.lokasi) + ' • ' : '') +
          'oleh ' + escapeHtml(l.nama_pegawai || '') + ' ' + foto +
        '</div>' +
        '</div>';
    }).join('');
  } catch (e) {
    box.innerHTML = '<div class="muted small">Gagal memuat: ' + e.message + '</div>';
  }
}

/* ── Laporan situasi ── */
async function bukaLaporan() {
  document.getElementById('modal-laporan').classList.remove('hidden');
  document.getElementById('lap-konten').textContent = 'Menyusun laporan…';
  document.getElementById('lap-msg').textContent = '';
  try {
    const res = await API.susunLaporanHarian(State.token);
    // Bangun teks dari data (agar tampil rapi)
    document.getElementById('lap-konten').textContent = formatLaporanKlien(res.data);
  } catch (e) {
    document.getElementById('lap-konten').textContent = 'Gagal: ' + e.message;
  }
}

/* Format laporan di sisi klien (agar tidak perlu endpoint terpisah) */
function formatLaporanKlien(d) {
  const b = [];
  b.push('LAPORAN SITUASI PIKET BPBD');
  b.push(d.hari + ', ' + d.tanggal);
  b.push('Status: ' + d.status_siaga);
  b.push('====================================');
  b.push('');
  b.push('RINGKASAN PERSONEL');
  b.push('- Jumlah regu piket : ' + d.ringkasan.jumlah_regu);
  b.push('- Total hadir       : ' + d.ringkasan.total_hadir + '/' + d.ringkasan.total_anggota);
  b.push('- Terlambat         : ' + d.ringkasan.total_terlambat);
  b.push('');
  b.push('PERSONEL PER REGU');
  d.sesi.forEach(function (s) {
    b.push('- ' + s.regu + ' (' + s.jam_mulai + '-' + s.jam_selesai + '): ' +
      s.jumlah_hadir + '/' + s.jumlah_anggota + ' hadir');
    s.personel.forEach(function (p) {
      b.push('    * ' + p.nama + ' [' + p.status + ']' +
        (p.waktu_masuk ? ' masuk ' + String(p.waktu_masuk).substring(11, 16) : ''));
    });
  });
  b.push('');
  b.push('KRONOLOGI KEGIATAN (' + d.log_book.length + ' catatan)');
  if (!d.log_book.length) b.push('- Tidak ada catatan kegiatan.');
  d.log_book.forEach(function (l) {
    b.push('[' + String(l.waktu).substring(11, 16) + '] ' + l.kategori + ' — ' + l.uraian +
      (l.lokasi ? ' (' + l.lokasi + ')' : ''));
  });
  b.push('');
  b.push('====================================');
  b.push('Dibuat otomatis oleh Aplikasi Absensi Piket BPBD');
  return b.join('\n');
}

/* ── Utilitas ── */
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
