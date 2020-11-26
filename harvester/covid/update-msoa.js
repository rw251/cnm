const fs = require('fs');
const { join } = require('path');

const dataMsoaFile = join(__dirname, 'temp', 'data-msoa.json');

const getMsoaData = () => {
  console.log('Loading msoa data...');
  const x = fs.readFileSync(join(__dirname, 'temp', 'msoa_data_latest.geojson'), 'utf8');
  console.log('Splitting...');
  const y = x.split('},{"id');
  const features = [];
  features.push(JSON.parse('{"id' + y[0].split('{"id')[1] + '}'));
  for (let i = 1; i < y.length - 2; i++) {
    features.push(JSON.parse('{"id' + y[i] + '}'));
  }

  const obj = {};
  features.forEach((feature) => {
    const { code, ...rest } = feature.properties;
    if (!obj[code]) {
      obj[code] = { dt: [] };
    }
    obj[code].dt.push(rest);
  });
  return obj;
};

const processData = ({ msoaData }) => {
  const dateObj = {};
  Object.keys(msoaData).forEach((key) => {
    msoaData[key].dt.forEach((x) => {
      dateObj[x.date] = true;
    });
  });
  const dates = Object.keys(dateObj).sort();
  Object.keys(msoaData).forEach((key) => {
    msoaData[key].d = dates.map(() => 0);
    msoaData[key].dt.forEach((x) => {
      msoaData[key].d[dates.indexOf(x.date)] = x.value;
    });
    delete msoaData[key].dt;
  });
  msoaData.dates = dates;

  return { msoaProcessedData: msoaData };
};

const msoaData = getMsoaData();

const { msoaProcessedData } = processData({ msoaData });

msoaProcessedData.latestUpdate = fs.readFileSync(
  join(__dirname, 'temp', 'msoa_last_updated'),
  'utf8'
);
console.log('Writing msoa data file');
fs.writeFileSync(dataMsoaFile, JSON.stringify(msoaProcessedData, null, 2).replace(/ {2}/g, '\t'));
