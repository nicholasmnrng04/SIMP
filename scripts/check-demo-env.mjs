import { readFileSync } from 'node:fs';

const lines = readFileSync('.env.demo', 'utf8').split(/\r?\n/);
const matches = lines.filter((line) => /^DEMO_DATABASE_URL\s*=/.test(line));
if (matches.length !== 1) {
  console.error('DEMO_DATABASE_URL harus muncul tepat satu kali di .env.demo.');
  process.exitCode = 1;
} else {
  const value = matches[0].slice(matches[0].indexOf('=') + 1).trim().replace(/^"|"$/g, '');
  if (!value || /ISI_PASSWORD|PROJECT_REF|\[YOUR-PASSWORD\]/.test(value)) {
    console.error('URL masih kosong atau berisi contoh.');
    process.exitCode = 1;
  } else {
    try {
      const url = new URL(value);
      const issues = [];
      if (!['postgres:', 'postgresql:'].includes(url.protocol)) issues.push('awalan harus postgresql://');
      if (!/^db\.[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) issues.push('host harus Direct connection Supabase');
      if (url.port !== '5432') issues.push('port harus 5432');
      if (url.pathname !== '/postgres') issues.push('nama database harus postgres');
      if (decodeURIComponent(url.username) !== 'postgres') issues.push('pengguna harus postgres');
      if (!url.password) issues.push('password database belum ada');
      if (url.searchParams.get('sslmode') !== 'require') issues.push('tambahkan ?sslmode=require');
      const sessionLine = lines.find((line) => /^DEMO_DB_SESSION_HOST\s*=/.test(line));
      const sessionHost = sessionLine?.slice(sessionLine.indexOf('=') + 1).trim();
      if (sessionHost && !/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(sessionHost)) {
        issues.push('hostname Session pooler tidak valid');
      }
      if (issues.length) {
        console.error(`URL belum siap: ${issues.join('; ')}.`);
        process.exitCode = 1;
      } else {
        console.log(`Format Direct connection Supabase valid${sessionHost ? '; Session pooler disiapkan' : ''}; URL dan password tidak ditampilkan.`);
        if (process.env.DEMO_DATABASE_URL && process.env.DEMO_DATABASE_URL !== value) {
          console.error('Nilai DEMO_DATABASE_URL yang dibaca Node berbeda dari isi .env.demo. Periksa tanda kutip atau karakter khusus.');
          process.exitCode = 1;
        }
        if (/%2540/i.test(url.password)) {
          console.warn('Perhatian: password URL mungkin mengodekan @ dua kali. Masukkan password asli melalui npm.cmd run db:demo:set-password.');
        }
      }
    } catch {
      console.error('URL belum valid. Salin string Direct connection lengkap dan encode karakter khusus pada password.');
      process.exitCode = 1;
    }
  }
}
