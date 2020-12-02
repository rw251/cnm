const slider = document.getElementById('myRange');
var cachedMSOAGeoData = {};
var cachedLAGeoData = {};
let sliderMax;
function getLAGData() {
  return cachedLAGeoData;
}
function getMSOAData() {
  return cachedMSOAGeoData;
}
function loadGeoData() {
  return Promise.all([
    fetch('msoa.json').then((resp) => resp.json()),
    fetch('msoa-names.json').then((resp) => resp.json()),
    fetch('lad.json').then((resp) => resp.json()),
  ]).then(([msoaData, msoaNames, ladData]) => {
    msoaData.features.forEach((feature) => {
      cachedMSOAGeoData[feature.properties.MSOA11CD] = {
        type: feature.geometry.type,
        coordinates: feature.geometry.coordinates,
        name: msoaNames[feature.properties.MSOA11CD],
      };
    });
    ladData.features.forEach((feature) => {
      cachedLAGeoData[feature.properties.LAD19CD] = {
        type: feature.geometry.type,
        coordinates: feature.geometry.coordinates,
        name: feature.properties.LAD19NM,
      };
    });
  });
}

var cachedData;
async function loadCovidData() {
  const [l, m] = await Promise.all([
    fetch('data-ltla.min.json').then((x) => x.json()),
    fetch('data-msoa.min.json').then((x) => x.json()),
  ]);
  cachedData = { ...l, ...m };
  sliderMax = l.dates.length - 1;
  slider.max = sliderMax;
  slider.value = sliderMax;
  document.getElementById('date').innerText = l.dates[+slider.max];
}
function getData() {
  return cachedData;
}

function getDate(val) {
  return cachedData.dates[+val];
}
export { loadGeoData, loadCovidData, getDate, getLAGData, getMSOAData, getData };
