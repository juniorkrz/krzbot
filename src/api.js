require('dotenv').config();
const axios = require('axios');
const apiToken = process.env.KRZBOT_API_TOKEN;

if (!apiToken) {
  console.error('KrzBot API Key not found. Make sure to set the KRZBOT_API_TOKEN environment variable.');
  process.exit(1);
}

const KRZBOT_API_URL = "http://stickerbot.duckdns.org:5000/get_response";

async function getKrzBotResponse(question) {
  const url = `${KRZBOT_API_URL}/${encodeURIComponent(question)}`;
  const headers = {
    'Authorization': `Bearer ${apiToken}`
  };


  try {
    const response = await axios.get(url, { headers });

    if (response.status !== 200) {
      return false;
    }

    return response.data.response;
  } catch (error) {
    console.error("Request error:", error);
    return false;
  }
}

module.exports = getKrzBotResponse;