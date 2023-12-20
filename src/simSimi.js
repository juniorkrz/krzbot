require('dotenv').config();
const axios = require('axios');
const apiKey = process.env.SIMI_API_TOKEN;// Grab one at https://workshop.simsimi.com

if (!apiKey) {
  console.error('SimSimi API Key not found. Make sure to set the SIMI_API_TOKEN environment variable, Grab one at https://workshop.simsimi.com');
  process.exit(1);
}

async function simSimiConversation(utext) {
  const url = 'https://wsapi.simsimi.com/190410/talk';

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey
  };

  const data = {
    utext,
    lang: 'pt'
  };

  try {
    const response = await axios.post(url, data, { headers });

    if (response.status === 200) {
      const result = response.data;
      return result.atext;
    } else {
      console.error(`Error in SimSimi's response: ${response.status}`);
    }
  } catch (error) {
    console.error('Request error:', error.message);
  }
  return null;
}

module.exports = simSimiConversation;