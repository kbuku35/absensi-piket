/* ============================================================
   KONFIGURASI FRONTEND
   ============================================================
   >>> WAJIB DIISI: API_URL (URL Web App Apps Script Anda) <<<
   Cara ambil: setelah Deploy Web App di Apps Script,
   copy "Web app URL" (berakhiran /exec).
   ============================================================ */

const APP_CONFIG = {
  // Contoh: 'https://script.google.com/macros/s/AKfycb..../exec'
  API_URL: 'https://script.google.com/macros/s/AKfycbxwACgpD06q9Ce5U4W5FEdPM15R5vlqm8eq3iW4UsuAkHuOqIhHVh7i9M-KbXLdeMoq/exec',

  // Nama aplikasi
  APP_NAME: 'Absensi Piket BPBD',

  // Pengaturan perangkat
  DEVICE_ID_KEY: 'bpbd_device_id',
  TOKEN_KEY: 'bpbd_token',
  USER_KEY: 'bpbd_user',

  // Pengaturan kamera & GPS
  SELFIE_MAX_WIDTH: 640,       // lebar maksimum foto selfie (px)
  SELFIE_QUALITY: 0.7,         // kualitas JPEG (0-1)
  GPS_TIMEOUT_MS: 15000,       // batas waktu ambil GPS
  GPS_HIGH_ACCURACY: true
};
