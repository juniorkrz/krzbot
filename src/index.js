const config = require('./config');
const readline = require('readline');
const simSimiConversation = require('./simSimi');
const spin_text = require('./utils/utils');
const {
  DisconnectReason,
  useMultiFileAuthState,
  isJidGroup,
  fetchLatestBaileysVersion,
  WA_DEFAULT_EPHEMERAL
} = require("@whiskeysockets/baileys");
const makeWASocket = require("@whiskeysockets/baileys").default;

const P = require("pino")({
  level: "silent",
});

let sock;

const devMode = process.argv.includes('--dev') || config.devMode;
const useQrCode = process.argv.includes('--qrcode')

// Read line interface
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function reactMessage(message, reaction){
  const reactionMessage = {
    react: {
        text: reaction, // use an empty string to remove the reaction
        key: message.key
    }
  }
  return await sock.sendMessage(message.key.remoteJid, reactionMessage, { ephemeralExpiration: WA_DEFAULT_EPHEMERAL });
}

async function sendMessage(message, response) {
  // Calculate the delay relative to the length of the response
  const delay = response.length * 100; // For example, 100 milliseconds per character
  await new Promise(resolve => setTimeout(resolve, delay));
  await sock.sendPresenceUpdate('paused', jid)
  return sock.sendMessage(message.key.remoteJid, { text: response }, { quoted: message, ephemeralExpiration: WA_DEFAULT_EPHEMERAL });
}

function shouldResponse(message) {
  const isGroup = isJidGroup(message.key.remoteJid);
  const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  const ephemeralMentionedJid = message.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.mentionedJid;

  // Determine whether the bot should respond based on the message context
  return (
    !isGroup ||
    (mentionedJid?.includes(config.myJid) || ephemeralMentionedJid?.includes(config.myJid) ||
      message.message?.extendedTextMessage?.contextInfo?.participant == config.myJid ||
      message.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.participant == config.myJid)
  );
}

function getBody(message) {
  // Extract the message body from different possible locations
  return (
    message.message.extendedTextMessage?.text ||
    message.message.conversation ||
    message.message.ephemeralMessage?.message?.extendedTextMessage?.text ||
    message.message.ephemeralMessage?.message?.conversation ||
    ''
  );
}

async function handleIncomingMessage(message) {
  if (message.key.fromMe ||
    !message.message ||
    !message.key.remoteJid ||
    message.key.remoteJid === 'status@broadcast' ||
    message.message.reactionMessage) {
    return;
  }

  // Get the message body and check if the bot should respond
  const body = getBody(message);
  if (body && shouldResponse(message)) {
    const jid = "@" + config.myJid.split("@")[0];
    const senderMessage = body.replace(jid, "").trim();
    console.log(message.pushName + " said: " + senderMessage);
    let response;

    if(devMode){
      response = "Modo desenvolvedor está ativo!"
      reactMessage(message, spin_text("{🛠|⚙|🔧|⚒|🪚}"));
    } else {
      // Send a presence update
      await sock.presenceSubscribe(message.key.remoteJid)
      await delay(500)
      await sock.sendPresenceUpdate('composing', message.key.remoteJid)
      response = await simSimiConversation(senderMessage);
    }

    if (!response){
      return reactMessage(message, "❌");
    }

    console.log("The bot replied: " + response);
    await sendMessage(message, response);
  }
}

async function connectionLogic() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version, isLatest } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    version: version,
    logger: P,
    printQRInTerminal: useQrCode,
    mobile: false,
    browser: ['Chrome (Linux)', '', ''],// If you change this then the pairing code will not work!!!
    auth: state,
  });

  // Pairing code for Web clients
  if(!useQrCode && !sock.authState.creds.registered) {
    const phoneNumber = await question('Please enter your mobile phone number:\n');
    const code = await sock.requestPairingCode(
        phoneNumber.replace(/[^0-9]/g, "")
    );
    console.log(`Pairing code: ${code}`)
  }

  sock.ev.on("connection.update", async(update) => {
    const { connection, lastDisconnect, qr } = update || {};

    if (useQrCode && qr) {
      console.log(qr);
    }

    if (connection == "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode != DisconnectReason.loggedOut;

      if (shouldReconnect) {
        connectionLogic();
      }
    }
  });

  sock.ev.on("messages.upsert", async(event) => {
    for (const message of event.messages) {
      if (devMode && !config.whitelist.includes(message.key.remoteJid)){
        console.log("Pulando mensagem, o número não está na whitelist!");
        continue;
      } else {
        await handleIncomingMessage(message);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

connectionLogic();