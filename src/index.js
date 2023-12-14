const config = require('./config');
const simSimiConversation = require('./simSimi');
const spin_text = require('./utils/utils');
const {
  DisconnectReason,
  useMultiFileAuthState,
  isJidGroup
} = require("@whiskeysockets/baileys");
const makeWASocket = require("@whiskeysockets/baileys").default;

let sock;

const args = process.argv.slice(2);
const devMode = args.indexOf('--dev') == 0 || config.devMode;

async function reactMessage(message, reaction){
  const reactionMessage = {
    react: {
        text: reaction, // use an empty string to remove the reaction
        key: message.key
    }
  }
  return await sock.sendMessage(message.key.remoteJid, reactionMessage);
}

async function sendMessage(message, response) {
  // Send a presence update
  sock.sendPresenceUpdate("composing", message.key.remoteJid);

  // Calculate the delay relative to the length of the response
  const delay = response.length * 50; // For example, 50 milliseconds per character

  // Wait for the calculated delay
  await new Promise(resolve => setTimeout(resolve, delay));

  // Send the actual message
  return sock.sendMessage(message.key.remoteJid, { text: response }, { quoted: message });
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
      response = await simSimiConversation(senderMessage);
    }

    if (!response){
      reactMessage(message, "❌");
    }

    console.log("The bot replied: " + response);
    await sendMessage(message, response);
  }
}

async function connectionLogic() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
  });

  sock.ev.on("connection.update", async(update) => {
    const { connection, lastDisconnect, qr } = update || {};

    if (qr) {
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
      if (config.devMode && !config.whitelist.includes(message.key.remoteJid)){
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