const fs = require('fs');
const { rl } = require('./utils');

function questionAsync(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createOrUpdateEnv() {
  // Ask the user for their SIMI_API_TOKEN using a promise
  const apiToken = await questionAsync('Enter your KRZBOT_API_TOKEN: ');

  // Create the content for the .env file
  const envContent = `KRZBOT_API_TOKEN=${apiToken}\n`;

  // Write the content to the .env file
  fs.writeFileSync('.env', envContent, { flag: 'w' });

  console.log('.env file created successfully!');
}

module.exports = createOrUpdateEnv;
