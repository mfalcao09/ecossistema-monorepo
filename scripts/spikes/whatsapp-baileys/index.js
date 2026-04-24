import baileys, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';

const makeWASocket = baileys.default ?? baileys;
const logger = pino({ level: 'silent' });

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Baileys WA v${version.join('.')} (latest: ${isLatest})`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger,
    version,
    browser: ['Spike Ecossistema', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 Escaneie este QR no seu WhatsApp secundário:');
      console.log('   WhatsApp → Dispositivos conectados → Conectar um dispositivo\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      const me = sock.user?.id?.split(':')[0] ?? '(desconhecido)';
      console.log(`\n✅ CONECTADO — número ${me}`);
      console.log('👂 Escutando mensagens. Ctrl+C pra sair.\n');
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = reason === DisconnectReason.loggedOut;
      console.log(`❌ Desconectado (code ${reason}). ${loggedOut ? 'Sessão revogada — rode `pnpm reset` e escaneie de novo.' : 'Reconectando...'}`);
      if (!loggedOut) setTimeout(connect, 2000);
    }
  });

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const from = msg.key.remoteJid ?? '?';
      const m = msg.message ?? {};
      const text =
        m.conversation ??
        m.extendedTextMessage?.text ??
        (m.imageMessage && '[imagem]') ??
        (m.audioMessage && '[áudio]') ??
        (m.videoMessage && '[vídeo]') ??
        (m.documentMessage && '[documento]') ??
        (m.stickerMessage && '[sticker]') ??
        '[outro tipo]';
      const ts = new Date((msg.messageTimestamp ?? 0) * 1000).toISOString().slice(11, 19);
      console.log(`[${ts}] 📨 ${from}: ${text}`);
    }
  });
}

connect().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
