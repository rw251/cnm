const fs = require('fs');
const { join } = require('path');

const dataFile = join(__dirname, 'data-ltla.json');

let existingData = {};
try {
  existingData = JSON.parse(fs.readFileSync(dataFile));
} catch (e) {
  console.log('Data file not found. Proceeding...');
}

const latestWebDate = fs.readFileSync('website_timestamp', 'utf8');
console.log('We have data up to', existingData.latestUpdate);
console.log('The latest online is', latestWebDate);
if (latestWebDate !== existingData.latestUpdate) {
  console.log('Writing data update flag');
  fs.writeFileSync('DO_IT', 'do it');
}
