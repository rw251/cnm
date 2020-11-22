const fs = require('fs');
const { join } = require('path');

const dataFile = join(__dirname, 'data-ltla.json');
const dataMsoaFile = join(__dirname, 'data-msoa.json');

const getMsoaData = () => {
  const x = JSON.parse(fs.readFileSync('msoa_data_latest.geojson', 'utf8'));

  const obj = {};
  x.features.forEach((feature) => {
    const { code, ...rest } = feature.properties;
    if (!obj[code]) {
      obj[code] = { dt: [] };
    }
    obj[code].dt.push(rest);
  });
  return obj;
};

const getLtlaData = () => {
  const x = JSON.parse(fs.readFileSync('ltla_data_latest.geojson', 'utf8'));

  const obj = {};
  x.features.forEach((feature) => {
    const { code, ...rest } = feature.properties;
    if (!obj[code]) {
      obj[code] = { dt: [] };
    }
    obj[code].dt.push(rest);
  });
  const dateObj = {};
  Object.keys(obj).forEach((key) => {
    obj[key].dt.forEach((x) => {
      dateObj[x.date] = true;
    });
  });
  return obj;
};

const processData = ({ ltlaData, msoaData }) => {
  const dateObj = {};
  Object.keys(ltlaData).forEach((key) => {
    ltlaData[key].dt.forEach((x) => {
      dateObj[x.date] = true;
    });
  });
  Object.keys(msoaData).forEach((key) => {
    msoaData[key].dt.forEach((x) => {
      dateObj[x.date] = true;
    });
  });
  const dates = Object.keys(dateObj).sort();
  Object.keys(ltlaData).forEach((key) => {
    ltlaData[key].d = dates.map(() => 0);
    ltlaData[key].dt.forEach((x) => {
      ltlaData[key].d[dates.indexOf(x.date)] = x.value;
    });
    delete ltlaData[key].dt;
  });
  ltlaData.dates = dates;
  Object.keys(msoaData).forEach((key) => {
    msoaData[key].d = dates.map(() => 0);
    msoaData[key].dt.forEach((x) => {
      msoaData[key].d[dates.indexOf(x.date)] = x.value;
    });
    delete msoaData[key].dt;
  });
  msoaData.dates = dates;

  return { ltlaProcessedData: ltlaData, msoaProcessedData: msoaData };
};

const ltlaData = getLtlaData();
const msoaData = getMsoaData();

const { ltlaProcessedData, msoaProcessedData } = processData({ ltlaData, msoaData });

ltlaProcessedData.latestUpdate = fs.readFileSync('website_timestamp', 'utf8');
console.log('Writing data file');
fs.writeFileSync(dataFile, JSON.stringify(ltlaProcessedData, null, 2).replace(/ {2}/g, '\t'));
console.log('Writing msoa data file');
fs.writeFileSync(dataMsoaFile, JSON.stringify(msoaProcessedData, null, 2).replace(/ {2}/g, '\t'));
