/* ============================================================
   DASHBOARD ADMIN — logika utama
   ============================================================ */

const AState = {
  user: null,
  tab: 'monitoring',
  cachePegawai: [],
  cacheRegu: [],
  cacheLokasi: [],
  cacheJadwal: []
};

/* ============================ BOOT ============================ */
document.addEventListener('DOMContentLoaded', function () {
  bindEvents();
  const token = AdminStore.getToken();
  if (token) {
    AState.user = AdminStore.getUser();
    bukaApp();
  }
});

function bindEvents() {
  document.getElementById('a-login').addEventListener('click', doLoginAdmin);
  document.getElementById('a-pass').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLoginAdmin();
  });
  document.getElementById('a-logout').addEventListener('click', doLogoutAdmin);
  document.getElementById('modal-close').addEventListener('click', tutupModal);
  document.getElementById('btn-refresh').addEventListener('click', function () { muatTab(AState.tab); });

  document.querySelectorAll('.nav-item').forEach(function (el) {
    el.addEventListener('click', function () {
      document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
      el.classList.add('active');
      AState.tab = el.getAttribute('data-tab');
      document.getElementById('tab-title').textContent = el.textContent.replace(/^[^ ]+ /, '');
      muatTab(AState.tab);
    });
  });
}

/* ============================ AUTH ============================ */
async function doLoginAdmin() {
  const nip = document.getElementById('a-nip').value.trim();
  const pass = document.getElementById('a-pass').value;
  const msg = document.getElementById('a-msg');
  msg.textContent = '';
  if (!nip || !pass) { msg.textContent = 'NIP dan password wajib diisi'; msg.classList.add('error'); return; }

  const btn = document.getElementById('a-login');
  btn.disabled = true; btn.textContent = 'Memproses…';
  try {
    const res = await AdminAPI.login(nip, pass);
    if (res.pegawai.role !== 'admin') {
      throw new Error('Akun ini bukan admin. Gunakan akun admin.');
    }
    AdminStore.setToken(res.token);
    AdminStore.setUser(res.pegawai);
    AState.user = res.pegawai;
    bukaApp();
  } catch (e) {
    msg.textContent = e.message; msg.classList.add('error');
  } finally {
    btn.disabled = false; btn.textContent = 'Masuk';
  }
}

function doLogoutAdmin() {
  AdminStore.clear();
  document.getElementById('admin-app').classList.add('hidden');
  document.getElementById('admin-login').classList.remove('hidden');
  document.getElementById('a-pass').value = '';
}

function bukaApp() {
  document.getElementById('admin-login').classList.add('hidden');
  document.getElementById('admin-app').classList.remove('hidden');
  document.getElementById('admin-user').textContent =
    (AState.user.nama || '') + (AState.user.jabatan ? ' — ' + AState.user.jabatan : '');
  muatTab('monitoring');
}

/* ============================ TAB ROUTER ============================ */
async function muatTab(tab) {
  const c = document.getElementById('content');
  c.innerHTML = '<div class="loading">Memuat data…</div>';
  try {
    if (tab === 'monitoring') await tabMonitoring();
    else if (tab === 'jadwal') await tabJadwal();
    else if (tab === 'regu') await tabRegu();
    else if (tab === 'pegawai') await tabPegawai();
    else if (tab === 'lokasi') await tabLokasi();
    else if (tab === 'rekap') await tabRekap();
    else if (tab === 'verifikasi') await tabVerifikasi();
  } catch (e) {
    c.innerHTML = '<div class="empty">⚠️ ' + e.message + '</div>';
    if (e.message.indexOf('Sesi tidak valid') >= 0) doLogoutAdmin();
  }
}

/* ============================ TAB: MONITORING ============================ */
async function tabMonitoring() {
  const c = document.getElementById('content');
  const hariIni = new Date().toISOString().substring(0, 10);
  c.innerHTML =
    '<div class="toolbar">' +
      '<label>Tanggal: <input type="date" id="m-tanggal" value="' + hariIni + '" /></label>' +
      '<button id="m-muat" class="btn btn-primary">Tampilkan</button>' +
    '</div>' +
    '<div id="m-hasil"></div>';

  document.getElementById('m-muat').addEventListener('click', muatMonitoring);
  await muatMonitoring();
}

async function muatMonitoring() {
  const tgl = document.getElementById('m-tanggal').value;
  const res = await AdminAPI.monitoring(tgl);
  const box = document.getElementById('m-hasil');
  const sesi = res.data.sesi;

  if (!sesi.length) {
    box.innerHTML = '<div class="empty">Tidak ada jadwal piket pada ' + tgl + '</div>';
    return;
  }

  box.innerHTML = sesi.map(function (s) {
    const persen = s.jumlahAnggota ? Math.round(s.jumlahHadir / s.jumlahAnggota * 100) : 0;
    const baris = s.anggota.map(function (a) {
      const st = a.sudahMasuk
        ? '<span class="badge badge-' + (a.statusMasuk === 'hadir' ? 'ok' : 'warn') + '">' + a.statusMasuk + '</span>'
        : '<span class="badge badge-err">belum absen</span>';
      return '<tr>' +
        '<td>' + a.nama + '</td>' +
        '<td>' + (a.waktuMasuk || '—') + '</td>' +
        '<td>' + st + '</td>' +
        '<td>' + (a.jarakMasuk !== '' && a.jarakMasuk !== null ? a.jarakMasuk + ' m' : '—') + '</td>' +
        '<td>' + (a.sudahKeluar ? '✅ ' + a.waktuKeluar : '—') + '</td>' +
        '</tr>';
    }).join('');

    return '<div class="panel">' +
      '<div class="panel-head">' +
        '<div><b>' + s.regu + '</b> <span class="muted small">(' + s.jadwal.jam_mulai + ' → ' + s.jadwal.jam_selesai + ')</span></div>' +
        '<div class="badge badge-siaga">' + (s.jadwal.status_siaga || 'Normal') + '</div>' +
      '</div>' +
      '<div class="progress"><div class="progress-bar" style="width:' + persen + '%"></div></div>' +
      '<div class="muted small">Hadir ' + s.jumlahHadir + '/' + s.jumlahAnggota + ' (' + persen + '%)</div>' +
      '<table class="tabel"><thead><tr><th>Nama</th><th>Masuk</th><th>Status</th><th>Jarak</th><th>Keluar</th></tr></thead>' +
      '<tbody>' + baris + '</tbody></table>' +
      '</div>';
  }).join('');
}

/* ============================ TAB: JADWAL ============================ */
async function tabJadwal() {
  const c = document.getElementById('content');
  const bulanIni = new Date().toISOString().substring(0, 7);
  c.innerHTML =
    '<div class="toolbar">' +
      '<label>Bulan: <input type="month" id="j-bulan" value="' + bulanIni + '" /></label>' +
      '<button id="j-muat" class="btn btn-outline">Filter</button>' +
      '<button id="j-tambah" class="btn btn-primary">+ Tambah Jadwal</button>' +
    '</div>' +
    '<div id="j-hasil"></div>';

  document.getElementById('j-muat').addEventListener('click', muatJadwal);
  document.getElementById('j-tambah').addEventListener('click', function () { formJadwal(null); });
  await muatJadwal();
}

async function muatJadwal() {
  const bulan = document.getElementById('j-bulan').value;
  const [jadwal, regu] = await Promise.all([AdminAPI.listJadwal({ bulan: bulan }), AdminAPI.listRegu()]);
  AState.cacheRegu = regu.data;
  AState.cacheJadwal = jadwal.data;

  const box = document.getElementById('j-hasil');
  if (!jadwal.data.length) { box.innerHTML = '<div class="empty">Belum ada jadwal bulan ini</div>'; return; }

  const namaRegu = {};
  regu.data.forEach(function (r) { namaRegu[r.id_regu] = r.nama_regu; });

  const baris = jadwal.data.map(function (j) {
    return '<tr>' +
      '<td>' + j.tanggal + '</td>' +
      '<td>' + (namaRegu[j.id_regu] || j.id_regu) + '</td>' +
      '<td>' + j.jam_mulai + ' → ' + j.jam_selesai + '</td>' +
      '<td>' + (j.status_siaga || '-') + '</td>' +
      '<td class="aksi-col">' +
        '<button class="btn-mini" onclick="formJadwal(\'' + j.id_jadwal + '\')">✏️</button>' +
        '<button class="btn-mini danger" onclick="konfirmasiHapusJadwal(\'' + j.id_jadwal + '\')">🗑️</button>' +
      '</td>' +
      '</tr>';
  }).join('');

  box.innerHTML = '<div class="panel"><table class="tabel">' +
    '<thead><tr><th>Tanggal</th><th>Regu</th><th>Jam</th><th>Status Siaga</th><th>Aksi</th></tr></thead>' +
    '<tbody>' + baris + '</tbody></table></div>';
}

function formJadwal(id) {
  const j = id ? AState.cacheJadwal.filter(function (x) { return x.id_jadwal === id; })[0] : {};
  const opsiRegu = AState.cacheRegu.map(function (r) {
    const sel = j.id_regu === r.id_regu ? 'selected' : '';
    return '<option value="' + r.id_regu + '" ' + sel + '>' + r.nama_regu + '</option>';
  }).join('');

  bukaModal(id ? 'Edit Jadwal' : 'Tambah Jadwal',
    '<label>Tanggal</label><input type="date" id="f-tanggal" value="' + (j.tanggal || '') + '" />' +
    '<label>Regu</label><select id="f-regu">' + opsiRegu + '</select>' +
    '<label>Shift</label><input id="f-shift" value="' + (j.shift || '24Jam') + '" />' +
    '<div class="row">' +
      '<div style="flex:1"><label>Jam Mulai</label><input type="time" id="f-mulai" value="' + (j.jam_mulai || '07:00') + '" /></div>' +
      '<div style="flex:1"><label>Jam Selesai</label><input type="time" id="f-selesai" value="' + (j.jam_selesai || '07:00') + '" /></div>' +
    '</div>' +
    '<label>Status Siaga</label><input id="f-siaga" value="' + (j.status_siaga || 'Siaga Karhutla') + '" />' +
    '<button class="btn btn-primary btn-block" onclick="simpanJadwal(\'' + (id || '') + '\')">Simpan</button>'
  );
}

async function simpanJadwal(id) {
  try {
    await AdminAPI.simpanJadwal({
      id_jadwal: id || undefined,
      tanggal: document.getElementById('f-tanggal').value,
      id_regu: document.getElementById('f-regu').value,
      shift: document.getElementById('f-shift').value,
      jam_mulai: document.getElementById('f-mulai').value,
      jam_selesai: document.getElementById('f-selesai').value,
      status_siaga: document.getElementById('f-siaga').value
    });
    tutupModal(); toast('Jadwal disimpan', 'ok'); muatJadwal();
  } catch (e) { toast(e.message, 'error'); }
}

function konfirmasiHapusJadwal(id) {
  if (!confirm('Hapus jadwal ini?')) return;
  AdminAPI.hapusJadwal(id).then(function () { toast('Jadwal dihapus', 'ok'); muatJadwal(); })
    .catch(function (e) { toast(e.message, 'error'); });
}

/* ============================ TAB: REGU ============================ */
async function tabRegu() {
  const c = document.getElementById('content');
  c.innerHTML = '<div class="toolbar"><button id="r-tambah" class="btn btn-primary">+ Tambah Regu</button></div><div id="r-hasil"></div>';
  document.getElementById('r-tambah').addEventListener('click', function () { formRegu(null); });
  await muatRegu();
}

async function muatRegu() {
  const [regu, pegawai] = await Promise.all([AdminAPI.listRegu(), AdminAPI.listPegawai()]);
  AState.cacheRegu = regu.data;
  AState.cachePegawai = pegawai.data;
  const namaPegawai = {};
  pegawai.data.forEach(function (p) { namaPegawai[p.id] = p.nama; });

  const box = document.getElementById('r-hasil');
  if (!regu.data.length) { box.innerHTML = '<div class="empty">Belum ada regu</div>'; return; }

  const baris = regu.data.map(function (r) {
    const anggota = String(r.anggota_id || '').split(';').filter(Boolean)
      .map(function (id) { return namaPegawai[id.trim()] || id; }).join(', ');
    return '<tr>' +
      '<td>' + r.nama_regu + '</td>' +
      '<td>' + (namaPegawai[r.koordinator_id] || r.koordinator_id || '—') + '</td>' +
      '<td class="small">' + (anggota || '—') + '</td>' +
      '<td>' + (r.aktif === 'ya' ? '<span class="badge badge-ok">aktif</span>' : '<span class="badge badge-err">nonaktif</span>') + '</td>' +
      '<td class="aksi-col">' +
        '<button class="btn-mini" onclick="formRegu(\'' + r.id_regu + '\')">✏️</button>' +
        '<button class="btn-mini danger" onclick="nonaktifkanRegu(\'' + r.id_regu + '\')">🗑️</button>' +
      '</td>' +
      '</tr>';
  }).join('');

  box.innerHTML = '<div class="panel"><table class="tabel">' +
    '<thead><tr><th>Nama Regu</th><th>Koordinator</th><th>Anggota</th><th>Status</th><th>Aksi</th></tr></thead>' +
    '<tbody>' + baris + '</tbody></table></div>';
}

function formRegu(id) {
  const r = id ? AState.cacheRegu.filter(function (x) { return x.id_regu === id; })[0] : {};
  const anggotaTerpilih = String(r.anggota_id || '').split(';').map(function (s) { return s.trim(); });

  const opsiPegawai = AState.cachePegawai.map(function (p) {
    const cek = anggotaTerpilih.indexOf(p.id) >= 0 ? 'checked' : '';
    const koord = r.koordinator_id === p.id ? 'selected' : '';
    return { p: p, cek: cek, koord: koord };
  });

  const ceklis = opsiPegawai.map(function (o) {
    return '<label class="cek"><input type="checkbox" class="anggota-cb" value="' + o.p.id + '" ' + o.cek + ' /> ' +
      o.p.nama + ' <span class="muted small">(' + (o.p.jabatan || '-') + ')</span></label>';
  }).join('');

  const opsiKoord = opsiPegawai.map(function (o) {
    return '<option value="' + o.p.id + '" ' + o.koord + '>' + o.p.nama + '</option>';
  }).join('');

  bukaModal(id ? 'Edit Regu' : 'Tambah Regu',
    '<label>Nama Regu</label><input id="rf-nama" value="' + (r.nama_regu || '') + '" />' +
    '<label>Koordinator</label><select id="rf-koord"><option value="">— pilih —</option>' + opsiKoord + '</select>' +
    '<label>Anggota</label><div class="ceklis">' + ceklis + '</div>' +
    '<label>Status</label><select id="rf-aktif"><option value="ya" ' + (r.aktif !== 'tidak' ? 'selected' : '') + '>Aktif</option><option value="tidak" ' + (r.aktif === 'tidak' ? 'selected' : '') + '>Nonaktif</option></select>' +
    '<button class="btn btn-primary btn-block" onclick="simpanRegu(\'' + (id || '') + '\')">Simpan</button>'
  );
}

async function simpanRegu(id) {
  const anggota = Array.prototype.slice.call(document.querySelectorAll('.anggota-cb:checked'))
    .map(function (cb) { return cb.value; }).join(';');
  try {
    await AdminAPI.simpanRegu({
      id_regu: id || undefined,
      nama_regu: document.getElementById('rf-nama').value,
      koordinator_id: document.getElementById('rf-koord').value,
      anggota_id: anggota,
      aktif: document.getElementById('rf-aktif').value
    });
    tutupModal(); toast('Regu disimpan', 'ok'); muatRegu();
  } catch (e) { toast(e.message, 'error'); }
}

function nonaktifkanRegu(id) {
  if (!confirm('Nonaktifkan regu ini?')) return;
  AdminAPI.hapusRegu(id).then(function () { toast('Regu dinonaktifkan', 'ok'); muatRegu(); })
    .catch(function (e) { toast(e.message, 'error'); });
}

/* ============================ TAB: PEGAWAI ============================ */
async function tabPegawai() {
  const c = document.getElementById('content');
  c.innerHTML = '<div class="toolbar"><button id="p-tambah" class="btn btn-primary">+ Tambah Pegawai</button></div><div id="p-hasil"></div>';
  document.getElementById('p-tambah').addEventListener('click', function () { formPegawai(null); });
  await muatPegawai();
}

async function muatPegawai() {
  const res = await AdminAPI.listPegawai();
  AState.cachePegawai = res.data;
  const box = document.getElementById('p-hasil');
  if (!res.data.length) { box.innerHTML = '<div class="empty">Belum ada pegawai</div>'; return; }

  const baris = res.data.map(function (p) {
    const badge = p.role === 'admin' ? '<span class="badge badge-siaga">admin</span>'
      : p.role === 'pimpinan' ? '<span class="badge badge-warn">pimpinan</span>'
      : '<span class="badge badge-ok">personel</span>';
    return '<tr>' +
      '<td>' + p.nip + '</td>' +
      '<td>' + p.nama + '</td>' +
      '<td class="small">' + (p.jabatan || '-') + '<br>' + (p.unit || '') + '</td>' +
      '<td>' + badge + '</td>' +
      '<td>' + (p.status === 'aktif' ? '✅' : '⛔') + '</td>' +
      '<td class="aksi-col">' +
        '<button class="btn-mini" onclick="formPegawai(\'' + p.id + '\')">✏️</button>' +
        '<button class="btn-mini" title="Reset perangkat" onclick="resetDevice(\'' + p.id + '\')">📱</button>' +
        '<button class="btn-mini danger" onclick="nonaktifkanPegawai(\'' + p.id + '\')">🗑️</button>' +
      '</td>' +
      '</tr>';
  }).join('');

  box.innerHTML = '<div class="panel"><table class="tabel">' +
    '<thead><tr><th>NIP</th><th>Nama</th><th>Jabatan/Unit</th><th>Role</th><th>Aktif</th><th>Aksi</th></tr></thead>' +
    '<tbody>' + baris + '</tbody></table></div>';
}

function formPegawai(id) {
  const p = id ? AState.cachePegawai.filter(function (x) { return x.id === id; })[0] : {};
  const opsiRole = ['personel', 'koordinator', 'admin', 'pimpinan'].map(function (r) {
    return '<option value="' + r + '" ' + (p.role === r ? 'selected' : '') + '>' + r + '</option>';
  }).join('');

  bukaModal(id ? 'Edit Pegawai' : 'Tambah Pegawai',
    '<label>NIP</label><input id="pf-nip" value="' + (p.nip || '') + '" ' + (id ? 'readonly' : '') + ' />' +
    '<label>Nama</label><input id="pf-nama" value="' + (p.nama || '') + '" />' +
    '<label>Jabatan</label><input id="pf-jabatan" value="' + (p.jabatan || '') + '" />' +
    '<label>Unit</label><input id="pf-unit" value="' + (p.unit || '') + '" />' +
    '<label>No. HP</label><input id="pf-hp" value="' + (p.no_hp || '') + '" />' +
    '<label>Email</label><input id="pf-email" value="' + (p.email || '') + '" />' +
    '<label>Role</label><select id="pf-role">' + opsiRole + '</select>' +
    '<label>Status</label><select id="pf-status"><option value="aktif" ' + (p.status !== 'nonaktif' ? 'selected' : '') + '>Aktif</option><option value="nonaktif" ' + (p.status === 'nonaktif' ? 'selected' : '') + '>Nonaktif</option></select>' +
    '<label>Password ' + (id ? '(kosongkan bila tidak diubah)' : '(default: piket123)') + '</label><input id="pf-pass" type="text" placeholder="' + (id ? '' : 'piket123') + '" />' +
    '<button class="btn btn-primary btn-block" onclick="simpanPegawai(\'' + (id || '') + '\')">Simpan</button>'
  );
}

async function simpanPegawai(id) {
  try {
    await AdminAPI.simpanPegawai({
      nip: document.getElementById('pf-nip').value,
      nama: document.getElementById('pf-nama').value,
      jabatan: document.getElementById('pf-jabatan').value,
      unit: document.getElementById('pf-unit').value,
      no_hp: document.getElementById('pf-hp').value,
      email: document.getElementById('pf-email').value,
      role: document.getElementById('pf-role').value,
      status: document.getElementById('pf-status').value,
      password: document.getElementById('pf-pass').value || undefined
    });
    tutupModal(); toast('Pegawai disimpan', 'ok'); muatPegawai();
  } catch (e) { toast(e.message, 'error'); }
}

function nonaktifkanPegawai(id) {
  if (!confirm('Nonaktifkan pegawai ini?')) return;
  AdminAPI.hapusPegawai(id).then(function () { toast('Pegawai dinonaktifkan', 'ok'); muatPegawai(); })
    .catch(function (e) { toast(e.message, 'error'); });
}

function resetDevice(id) {
  if (!confirm('Reset perangkat pegawai ini? (bisa login dari HP baru)')) return;
  AdminAPI.resetDevice(id).then(function () { toast('Perangkat direset', 'ok'); })
    .catch(function (e) { toast(e.message, 'error'); });
}

/* ============================ TAB: LOKASI & QR ============================ */
async function tabLokasi() {
  const c = document.getElementById('content');
  c.innerHTML = '<div class="toolbar"><button id="l-tambah" class="btn btn-primary">+ Tambah Lokasi</button></div><div id="l-hasil"></div>';
  document.getElementById('l-tambah').addEventListener('click', function () { formLokasi(null); });
  await muatLokasi();
}

async function muatLokasi() {
  const res = await AdminAPI.listLokasi();
  AState.cacheLokasi = res.data;
  const box = document.getElementById('l-hasil');
  if (!res.data.length) { box.innerHTML = '<div class="empty">Belum ada lokasi/posko</div>'; return; }

  const baris = res.data.map(function (l) {
    return '<tr>' +
      '<td>' + l.nama + '</td>' +
      '<td class="small">' + l.lat + ', ' + l.lng + '</td>' +
      '<td>' + l.radius_m + ' m</td>' +
      '<td class="aksi-col">' +
        '<button class="btn-mini" onclick="formLokasi(\'' + l.id_lokasi + '\')">✏️</button>' +
        '<button class="btn-mini" onclick="tampilQr(\'' + l.id_lokasi + '\', \'' + l.nama + '\')">🔳 QR</button>' +
      '</td>' +
      '</tr>';
  }).join('');

  box.innerHTML = '<div class="panel"><table class="tabel">' +
    '<thead><tr><th>Nama Posko</th><th>Koordinat</th><th>Radius</th><th>Aksi</th></tr></thead>' +
    '<tbody>' + baris + '</tbody></table></div>';
}

function formLokasi(id) {
  const l = id ? AState.cacheLokasi.filter(function (x) { return x.id_lokasi === id; })[0] : {};
  bukaModal(id ? 'Edit Lokasi' : 'Tambah Lokasi',
    '<label>Nama Posko</label><input id="lf-nama" value="' + (l.nama || '') + '" />' +
    '<label>Latitude</label><input id="lf-lat" value="' + (l.lat || '') + '" placeholder="-0.502106" />' +
    '<label>Longitude</label><input id="lf-lng" value="' + (l.lng || '') + '" placeholder="101.447720" />' +
    '<label>Radius Geofence (meter)</label><input id="lf-radius" type="number" value="' + (l.radius_m || 150) + '" />' +
    '<p class="muted small">Ambil koordinat dari Google Maps: klik kanan titik lokasi → copy angka.</p>' +
    '<button class="btn btn-primary btn-block" onclick="simpanLokasi(\'' + (id || '') + '\')">Simpan</button>'
  );
}

async function simpanLokasi(id) {
  try {
    await AdminAPI.simpanLokasi({
      id_lokasi: id || undefined,
      nama: document.getElementById('lf-nama').value,
      lat: document.getElementById('lf-lat').value,
      lng: document.getElementById('lf-lng').value,
      radius_m: document.getElementById('lf-radius').value
    });
    tutupModal(); toast('Lokasi disimpan', 'ok'); muatLokasi();
  } catch (e) { toast(e.message, 'error'); }
}

async function tampilQr(idLokasi, nama) {
  try {
    const res = await AdminAPI.generateQr(idLokasi);
    const token = res.data.token;
    const berlaku = res.data.berlaku_sampai;
    bukaModal('QR Posko — ' + nama,
      '<div class="qr-box"><canvas id="qr-canvas"></canvas></div>' +
      '<p class="center"><b>' + token + '</b></p>' +
      '<p class="center muted small">Berlaku sampai: ' + berlaku + '</p>' +
      '<p class="center muted small">Tampilkan QR ini di posko. Personel memindainya saat absen.</p>' +
      '<button class="btn btn-outline btn-block" onclick="window.print()">🖨️ Cetak</button>'
    );
    QRCode.toCanvas(document.getElementById('qr-canvas'), token, { width: 240, margin: 2 }, function (err) {
      if (err) toast('Gagal membuat QR', 'error');
    });
  } catch (e) { toast(e.message, 'error'); }
}

/* ============================ TAB: REKAP ============================ */
async function tabRekap() {
  const c = document.getElementById('content');
  const bulanIni = new Date().toISOString().substring(0, 7);
  c.innerHTML =
    '<div class="toolbar">' +
      '<label>Bulan: <input type="month" id="rk-bulan" value="' + bulanIni + '" /></label>' +
      '<button id="rk-muat" class="btn btn-primary">Tampilkan</button>' +
      '<button id="rk-export" class="btn btn-outline">⬇️ Export CSV</button>' +
    '</div>' +
    '<div id="rk-hasil"></div>';

  document.getElementById('rk-muat').addEventListener('click', muatRekap);
  document.getElementById('rk-export').addEventListener('click', exportRekap);
  await muatRekap();
}

let rekapDataTerakhir = null;

async function muatRekap() {
  const bulan = document.getElementById('rk-bulan').value;
  const res = await AdminAPI.rekap({ bulan: bulan });
  rekapDataTerakhir = res.data;
  const box = document.getElementById('rk-hasil');

  if (!res.data.pegawai.length) { box.innerHTML = '<div class="empty">Belum ada data absensi bulan ini</div>'; return; }

  const baris = res.data.pegawai.map(function (p) {
    return '<tr>' +
      '<td>' + p.nip + '</td>' +
      '<td>' + p.nama + '</td>' +
      '<td class="small">' + (p.unit || '-') + '</td>' +
      '<td class="center">' + p.jumlah_hadir + '</td>' +
      '<td class="center">' + p.jumlah_terlambat + '</td>' +
      '<td class="center">' + p.jumlah_pending + '</td>' +
      '</tr>';
  }).join('');

  box.innerHTML = '<div class="panel"><div class="panel-head"><b>Rekap ' + bulan + '</b></div>' +
    '<table class="tabel"><thead><tr><th>NIP</th><th>Nama</th><th>Unit</th><th>Hadir</th><th>Terlambat</th><th>Pending</th></tr></thead>' +
    '<tbody>' + baris + '</tbody></table></div>';
}

function exportRekap() {
  if (!rekapDataTerakhir) { toast('Tampilkan rekap dulu', 'error'); return; }
  const rows = [['NIP', 'Nama', 'Unit', 'Jumlah Hadir', 'Terlambat', 'Pending']];
  rekapDataTerakhir.pegawai.forEach(function (p) {
    rows.push([p.nip, p.nama, p.unit, p.jumlah_hadir, p.jumlah_terlambat, p.jumlah_pending]);
  });
  const csv = rows.map(function (r) {
    return r.map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(',');
  }).join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rekap_absensi_' + rekapDataTerakhir.bulan + '.csv';
  a.click();
  toast('Rekap diexport', 'ok');
}

/* ============================ TAB: VERIFIKASI ============================ */
async function tabVerifikasi() {
  const c = document.getElementById('content');
  const res = await AdminAPI.listPending();
  const box = document.createElement('div');
  if (!res.data.length) {
    c.innerHTML = '<div class="empty">Tidak ada absen yang menunggu verifikasi 👍</div>';
    return;
  }

  const baris = res.data.map(function (a) {
    return '<tr>' +
      '<td>' + a.id_pegawai + '</td>' +
      '<td>' + a.jenis + '</td>' +
      '<td class="small">' + a.waktu_server + '</td>' +
      '<td>' + (a.jarak_m ? a.jarak_m + ' m' : '—') + '</td>' +
      '<td class="small">' + (a.catatan || '') + '</td>' +
      '<td class="aksi-col">' +
        '<button class="btn-mini ok" onclick="verifAbsen(\'' + a.id_absen + '\',\'hadir\')">✔️</button>' +
        '<button class="btn-mini danger" onclick="verifAbsen(\'' + a.id_absen + '\',\'ditolak\')">✖️</button>' +
        (a.foto_url ? '<a class="btn-mini" href="' + a.foto_url + '" target="_blank">🖼️</a>' : '') +
      '</td>' +
      '</tr>';
  }).join('');

  c.innerHTML = '<div class="panel"><table class="tabel">' +
    '<thead><tr><th>Pegawai</th><th>Jenis</th><th>Waktu</th><th>Jarak</th><th>Catatan</th><th>Aksi</th></tr></thead>' +
    '<tbody>' + baris + '</tbody></table></div>';
}

function verifAbsen(idAbsen, status) {
  const cat = status === 'ditolak' ? prompt('Alasan penolakan:') : '';
  if (status === 'ditolak' && cat === null) return;
  AdminAPI.verifikasi(idAbsen, status, cat).then(function () {
    toast('Absen diverifikasi', 'ok'); muatTab('verifikasi');
  }).catch(function (e) { toast(e.message, 'error'); });
}

/* ============================ MODAL & TOAST ============================ */
function bukaModal(judul, isi) {
  document.getElementById('modal-title').textContent = judul;
  document.getElementById('modal-body').innerHTML = isi;
  document.getElementById('modal').classList.remove('hidden');
}
function tutupModal() {
  document.getElementById('modal').classList.add('hidden');
}
function toast(pesan, tipe) {
  const el = document.getElementById('toast');
  el.textContent = pesan;
  el.className = 'toast ' + (tipe || '');
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.add('hidden'); }, 3200);
}
