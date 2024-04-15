const fs = require('fs');
const P = require('pino')({ level: 'silent' });
const {
  DisconnectReason,
  useMultiFileAuthState,
  isJidGroup,
  fetchLatestBaileysVersion,
  delay,
  jidNormalizedUser,
  areJidsSameUser,
} = require('@whiskeysockets/baileys');
const makeWASocket = require('@whiskeysockets/baileys').default;

const config = require('./config');
const { spin_text, rl } = require('./utils/utils');
const createOrUpdateEnv = require('./utils/envHandler');

const devMode = process.argv.includes('--dev') || config.devMode;
const useQrCode = process.argv.includes('--qrcode') || config.useQrCode;

let client;
let api;

// Read line interface
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

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

function getMentionedJids(message){
  const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  const ephemeralMentionedJid = message.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  return mentionedJid || ephemeralMentionedJid;
}

function getMessageExpiration(message){
  return (
    message.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.expiration ||// WhatsApp Desktop
    message.message?.extendedTextMessage?.contextInfo?.expiration// WhatsApp Mobile and WhatsApp Web
  );
}

function getPhoneFromJid(jid){
  return jidNormalizedUser(jid).split('@')[0];
}

async function reactMessage(message, reaction){
  const reactionMessage = {
    react: {
        text: reaction, // use an empty string to remove the reaction
        key: message.key
    }
  }
  return await client.sendMessage(message.key.remoteJid, reactionMessage);
}

async function sendMessage(message, response) {
  const expiration = getMessageExpiration(message);
  await delay(response.length * 100); // For example, 100 milliseconds per character
  await client.sendPresenceUpdate('paused', message.key.remoteJid)
  return client.sendMessage(message.key.remoteJid, { text: response }, { quoted: message, ephemeralExpiration: expiration});
}

function shouldResponse(message) {
  const isGroup = isJidGroup(message.key.remoteJid);

  if (!isGroup){
    return true;
  }

  const clientJid = jidNormalizedUser(client.user?.id);
  const mentionedJids = getMentionedJids(message);
  const participant = message.message?.extendedTextMessage?.contextInfo?.participant ||
    message.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.participant;

  // Determine whether the bot should respond based on the message context
  return (
    mentionedJids?.includes(clientJid) ||
    areJidsSameUser(participant, clientJid)
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
    const clientPhone = '@' + getPhoneFromJid(client.user?.id);
    const senderMessage = body.replace(clientPhone, '').trim();
    console.log(message.pushName + ' said: ' + senderMessage);

    let response;

    if(devMode){
      response = 'Developer mode is active!'
      reactMessage(message, spin_text('{🛠|⚙|🔧|⚒|🪚}'));
    } else {
      // Send a presence update
      await client.presenceSubscribe(message.key.remoteJid)
      await delay(500);
      await client.sendPresenceUpdate('composing', message.key.remoteJid)
      response = await getKrzBotResponse(senderMessage);
    }

    if (!response){
      await client.sendPresenceUpdate('paused', message.key.remoteJid)
      return reactMessage(message, '❌');
    }

    console.log('The bot replied: ' + response);
    await sendMessage(message, response);
  }
}

async function connectionLogic() {
  console.log('Starting...')
  api = require('./api');
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  client = makeWASocket({
    version: version,
    logger: P,
    printQRInTerminal: useQrCode,
    mobile: false,
    browser: ['Chrome (Linux)', '', ''],// If you change this then the pairing code will not work!!!
    auth: state,
  });

  // Pairing code for Web clients
  if(!useQrCode && !client.authState.creds.registered) {
    const phoneNumber = await question('Please enter your mobile phone number:\n');
    const code = await client.requestPairingCode(
        phoneNumber.replace(/[^0-9]/g, '')
    );
    console.log(`Pairing code: ${code}`)
  }

  client.ev.on('connection.update', async(update) => {
    const { connection, lastDisconnect, qr } = update || {};

    if (connection){
      console.log(`Connection Status: ${connection}`);
    }

    if (useQrCode && qr) {
      console.log(qr);
    }

    if (connection == 'close') {
      console.log('Connection lost!')
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode != DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log('Reconnecting...')
        connectionLogic();
      }
    }
  });

  client.ev.on('messages.upsert', async(event) => {
    for (const message of event.messages) {
      if (devMode && !config.whitelist.includes(message.key.remoteJid)){
        console.log(`Skipping message, the number ${message.key.remoteJid} is not on the whitelist!`);
        continue;
      } else {
        await handleIncomingMessage(message);
      }
    }
  });

  client.ev.on('creds.update', saveCreds);
}

async function start(){
  if (!fs.existsSync('.env')) {
    await createOrUpdateEnv();
  }
  connectionLogic();
}

start();