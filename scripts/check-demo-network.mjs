import { lookup } from 'node:dns/promises';
import { connect } from 'node:net';

const directHost = new URL(process.env.DEMO_DATABASE_URL ?? '').hostname;
const sessionHost = process.env.DEMO_DB_SESSION_HOST?.trim();
const host = sessionHost || directHost;
if (!/^db\.[a-z0-9-]+\.supabase\.co$/.test(directHost)
  || (sessionHost && !/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(sessionHost))) {
  console.error('Host Supabase tidak valid.');
  process.exitCode = 1;
} else {
  try {
    const addresses = await lookup(host, { all: true });
    console.log(`${sessionHost ? 'Session pooler' : 'Direct'} DNS: ${addresses.map(({ family }) => `IPv${family}`).join(', ')}`);
    await new Promise((resolve, reject) => {
      const socket = connect({ host, port: 5432, timeout: 4000 });
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('timeout', () => { socket.destroy(); reject(new Error('waktu habis')); });
      socket.once('error', (error) => { socket.destroy(); reject(error); });
    });
    console.log('TCP 5432: terhubung; autentikasi tidak dicoba.');
  } catch (error) {
    console.error(`Koneksi jaringan belum tersedia (${error.code ?? error.message}).`);
    process.exitCode = 1;
  }
}
