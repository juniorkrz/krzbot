const fs = require('fs');
const { rl } = require('./utils');

function questionAsync(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createOrUpdateEnv() {
  // Ask the user for their SIMI_API_TOKEN using a promise
  const simiApiToken = await questionAsync('Enter your SIMI_API_TOKEN: ');

  // Create the content for the .env file
  const envContent = `SIMI_API_TOKEN=${simiApiToken}\n`;

  // Write the content to the .env file
  fs.writeFileSync('.env', envContent, { flag: 'w' });

  console.log('.env file created successfully!');

  // Close the readline interface
  rl.close();
}

module.exports = createOrUpdateEnv;