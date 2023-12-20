const axios = require('axios');
const { apiKey } = require('./config');

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
      return result.atext; // Retorna a resposta do SimSimi
    } else {
      console.error(`Erro na resposta do SimSimi: ${response.status}`);
      return null; // Ou você pode lançar uma exceção, dependendo do seu caso
    }
  } catch (error) {
    console.error('Erro na requisição:', error.message);
    return null; // Ou você pode lançar uma exceção, dependendo do seu caso
  }
}

module.exports = simSimiConversation;