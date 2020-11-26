const fs = require('fs');
const { join } = require('path');

const ltlaFile = join(__dirname, 'temp', 'data-ltla.json');
const msoaFile = join(__dirname, 'temp', 'data-msoa.json');

let existingLtla = {};
let existingMsoa = {};
try {
  existingLtla = JSON.parse(fs.readFileSync(ltlaFile));
  existingMsoa = JSON.parse(fs.readFileSync(msoaFile));
} catch (e) {
  console.log('Data file not found. Proceeding...');
}

const latestWebLtla = fs.readFileSync(join(__dirname, 'temp', 'ltla_last_updated'), 'utf8');
const latestWebMsoa = fs.readFileSync(join(__dirname, 'temp', 'msoa_last_updated'), 'utf8');
console.log('We have ltla data up to', existingLtla.latestUpdate);
console.log('The latest ltla online is', latestWebLtla);
if (latestWebLtla !== existingLtla.latestUpdate) {
  console.log('Writing ltla data update flag');
  fs.writeFileSync(join(__dirname, 'temp', 'DO_LTLA'), 'ltla');
}
console.log('We have msoa data up to', existingMsoa.latestUpdate);
console.log('The latest msoa online is', latestWebMsoa);
if (latestWebMsoa !== existingMsoa.latestUpdate) {
  console.log('Writing msoa data update flag');
  fs.writeFileSync(join(__dirname, 'temp', 'DO_MSOA'), 'msoa');
}
