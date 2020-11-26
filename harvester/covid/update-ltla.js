const fs = require('fs');
const { join } = require('path');

const dataFile = join(__dirname, 'temp', 'data-ltla.json');

const getLtlaData = () => {
  const x = JSON.parse(
    fs.readFileSync(join(__dirname, 'temp', 'ltla_data_latest.geojson'), 'utf8')
  );

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

const processData = ({ ltlaData }) => {
  const dateObj = {};
  Object.keys(ltlaData).forEach((key) => {
    ltlaData[key].dt.forEach((x) => {
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

  return { ltlaProcessedData: ltlaData };
};

const ltlaData = getLtlaData();

const { ltlaProcessedData } = processData({ ltlaData });

ltlaProcessedData.latestUpdate = fs.readFileSync(
  join(__dirname, 'temp', 'ltla_last_updated'),
  'utf8'
);
console.log('Writing data file');
fs.writeFileSync(dataFile, JSON.stringify(ltlaProcessedData, null, 2).replace(/ {2}/g, '\t'));
