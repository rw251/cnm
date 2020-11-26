import mapboxgl from 'mapbox-gl';
import { loadGeoData, loadCovidData, getLAGData, getMSOAData, getData, getDate } from './data';
import { initializeSlider, getSliderValue, transformSlider } from './slider';

const mapCanvas = document.getElementById('map');
const mapContext = mapCanvas.getContext('2d');
const highlightCanvas = document.getElementById('highlight');
const highlightContext = highlightCanvas.getContext('2d');

let zoom = 5;
const msoaZoom = 7;
const minZoom = 4;
const maxZoom = 10;
const sqWidth = 512;
var map;
var mapCentreX;
var mapCentreY;
let mapCenterLNG = -2.6416415135265; //-2.5; // longitude
let mapCenterLAT = 53.592328230096889; //54.5; //latitude
var twoFingerCentre;
var initialDistance;

const deg2Rad = (deg) => (deg * Math.PI) / 180;
const rad2Deg = (rad) => (rad * 180) / Math.PI;

const getWebMercator = (lat, lng) => {
  const x = Math.floor(((Math.PI + deg2Rad(lng)) * Math.pow(2, zoom) * sqWidth) / (2 * Math.PI));
  const y = Math.floor(
    ((Math.PI - Math.log(Math.tan(Math.PI / 4 + deg2Rad(lat) / 2))) * Math.pow(2, zoom) * sqWidth) /
      (2 * Math.PI)
  );
  return { x, y };
};

const getMercator = (x, y) => {
  const lng = rad2Deg((x * Math.PI * 2) / (sqWidth * Math.pow(2, zoom)) - Math.PI);
  const lat = rad2Deg(
    2 *
      (Math.atan(Math.pow(Math.E, Math.PI - (y * Math.PI * 2) / (sqWidth * Math.pow(2, zoom)))) -
        Math.PI / 4)
  );
  return { lat, lng };
};

function renderMap(full = false, withData = true, mapHasntMoved = false) {
  if (getMSOAData()) {
    if (full) {
      clearMap();
      createHitRegions();
      drawBoundaries(withData);
      updateHighlight();
    } else if (mapHasntMoved) {
      clearMap();
      drawBoundaries(withData);
    } else {
      updateHighlight();
    }
  }
}

const getCanvasCoords = (lat, lng) => {
  const { x: webX, y: webY } = getWebMercator(lat, lng);
  const x = Math.floor(webX - mapCentreX + mapCanvas.width / 2);
  const y = Math.floor(webY - mapCentreY + mapCanvas.height / 2);
  return { x, y };
};

var hitRegions;
var hitRegionSize = 50;
var regionX;
var regionY;
var region;

const limits = [
  { threshold: 0, colour: '#FFFFFF' },
  { threshold: 30, colour: '#DBF2E0' },
  { threshold: 70, colour: '#7AC99A' },
  { threshold: 120, colour: '#1D9A6C' },
  { threshold: 180, colour: '#177867' },
  { threshold: 260, colour: '#105656' },
  { threshold: 350, colour: '#0A2C34' },
];
const blackLimit = 800;
function hexToRGB(hex) {
  return [
    parseInt(hex[1] + hex[2], 16),
    parseInt(hex[3] + hex[4], 16),
    parseInt(hex[5] + hex[6], 16),
  ];
}

function colourFromRate(rate) {
  // opacity ranges from 0.3 to 0.8
  const opacity = Math.min(0.3 + rate / 1000, 0.8);

  let [red, green, blue] = [255, 255, 255];

  for (let i = 1; i < limits.length; i++) {
    if (rate <= limits[i].threshold) {
      const [redFrom, greenFrom, blueFrom] = hexToRGB(limits[i - 1].colour);
      const [redTo, greenTo, blueTo] = hexToRGB(limits[i].colour);
      const proportion =
        (rate - limits[i - 1].threshold) / (limits[i].threshold - limits[i - 1].threshold);
      red = redFrom + proportion * (redTo - redFrom);
      green = greenFrom + proportion * (greenTo - greenFrom);
      blue = blueFrom + proportion * (blueTo - blueFrom);
      break;
    }
  }
  let last = limits[limits.length - 1];
  if (rate >= blackLimit) {
    red = 0;
    green = 0;
    blue = 0;
  } else if (rate > last.threshold) {
    const [redFrom, greenFrom, blueFrom] = hexToRGB(last.colour);
    const [redTo, greenTo, blueTo] = [0, 0, 0];
    const proportion = (rate - last.threshold) / (blackLimit - last.threshold);
    red = redFrom + proportion * (redTo - redFrom);
    green = greenFrom + proportion * (greenTo - greenFrom);
    blue = blueFrom + proportion * (blueTo - blueFrom);
  }

  return `rgba(${red},${green},${blue},${opacity})`;
}

function resizeCanvas() {
  mapCanvas.width = window.innerWidth;
  mapCanvas.height = window.innerHeight;
  highlightCanvas.width = window.innerWidth;
  highlightCanvas.height = window.innerHeight;
  renderMap(true);
}

let isDragging = false;
let isZoomDragging = false;
let isSliding = false;
let startX;
let startY;
function startDrag(e) {
  if (e.target.tagName.toLowerCase() === 'input') {
    isSliding = true;
    return;
  }
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;

  mapCanvas.classList.add('dragging');
}

function isPointInPolygon(pointX, pointY, polygonCoords, regionId) {
  if (polygonCoords[0].length === 0) return false;
  let intersections = 0;
  polygonCoords.forEach((coords) => {
    coords.forEach((z, i) => {
      if (typeof z === 'number') {
        console.log(regionId);
        return;
      }
      const [x, y] = z;

      const { x: cx, y: cy } = getCanvasCoords(y, x);

      let [nextX, nextY] = i + 1 < coords.length ? coords[i + 1] : coords[0];

      const { x: nextcx, y: nextcy } = getCanvasCoords(nextY, nextX);

      if (
        ((cy + 0.01 >= pointY && nextcy + 0.01 <= pointY) ||
          (cy + 0.01 <= pointY && nextcy + 0.01 >= pointY)) &&
        ((pointY - cy - 0.01) * (cx - nextcx)) / (cy - nextcy - 0.01) + cx <= pointX
      ) {
        intersections += 1;
      }
    });
  });
  // console.log(regionId, intersections);
  return intersections % 2 === 1;
}

var needForRAF = true;
var distanceX;
var distanceY;
function dragUpdate() {
  needForRAF = true; // animation frame is happening now, so let another one queue up
  if (isDragging) {
    document.body.style.transform = `translate(${distanceX}px, ${distanceY}px)`;
    transformSlider(distanceX, distanceY);
  }
}

function drag(e) {
  console.log('D');
  if (isSliding) return;
  if (isDragging) {
    if (needForRAF) {
      distanceX = e.clientX - startX;
      distanceY = e.clientY - startY;
      needForRAF = false;
      requestAnimationFrame(dragUpdate);
    }
  } else {
    // maybe highlight
    regionX = Math.floor(e.clientX / hitRegionSize);
    regionY = Math.floor(e.clientY / hitRegionSize);

    let foundRegion = false;
    // ray tracing
    const cachedGeoData = zoom > msoaZoom ? getMSOAData() : getLAGData();
    if (
      hitRegions &&
      hitRegions[regionX] &&
      hitRegions[regionX][regionY] &&
      hitRegions[regionX][regionY].length > 0
    )
      hitRegions[regionX][regionY].forEach((regionId) => {
        if (foundRegion) return;
        if (cachedGeoData[regionId].type === 'MultiPolygon') {
          //multipoly
          cachedGeoData[regionId].coordinates.forEach((coords) => {
            if (isPointInPolygon(e.clientX, e.clientY, coords, regionId)) {
              foundRegion = regionId;
            }
          });
        } else {
          if (
            isPointInPolygon(e.clientX, e.clientY, cachedGeoData[regionId].coordinates, regionId)
          ) {
            foundRegion = regionId;
          }
        }
      });
    if (foundRegion !== region) {
      region = foundRegion;
      renderMap();
    }
  }
}

function endDrag(e) {
  console.log('endD');
  if (isSliding) {
    isSliding = false;
    return;
  }
  if (!isDragging) return;
  // console.log('Drag end');
  isDragging = false;
  mapCanvas.classList.remove('dragging');

  const { lat, lng } = getMercator(
    mapCentreX - e.clientX + startX,
    mapCentreY - e.clientY + startY
  );

  mapCenterLNG = lng; //mapCenterLNG - (e.clientX - startX) / scale;
  mapCenterLAT = lat; //mapCenterLAT + (e.clientY - startY) / scale;
  updateMapCentre();

  map.setCenter([mapCenterLNG, mapCenterLAT]);

  document.body.style.transform = `translate(0, 0)`;
  transformSlider(0, 0);

  renderMap(true);
}

const getCanvasCoordsForList = (latlngs) => latlngs.map((x) => getCanvasCoords(x[1], x[0]));

const isOnCanvas = (x, y) => x >= 0 && x <= mapCanvas.width && y >= 0 && y <= mapCanvas.height;

function clearHighlight() {
  highlightContext.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
}

function drawArea(coordinates, id, isHighlight, fillStyle = 'rgba(255,240,255,0.5') {
  let context = isHighlight ? highlightContext : mapContext;
  context.beginPath();
  let [minX, maxX, minY, maxY] = [1000, 0, 1000, 0];
  const canvasCoords = getCanvasCoordsForList(coordinates[0]);
  const onCanvas =
    canvasCoords.map((coord) => isOnCanvas(coord.x, coord.y)).filter(Boolean).length > 0;
  if (!onCanvas) return;
  canvasCoords.forEach(({ x, y }, i) => {
    if (!isHighlight) {
      const hrX = Math.floor(x / hitRegionSize);
      const hrY = Math.floor(y / hitRegionSize);
      if (hitRegions[hrX] && hitRegions[hrX][hrY]) {
        minX = Math.min(minX, hrX);
        minY = Math.min(minY, hrY);
        maxX = Math.max(maxX, hrX);
        maxY = Math.max(maxY, hrY);
      }
    }
    if (i === 0) context.moveTo(x, y);
    else {
      context.lineTo(x, y);
    }
  });
  if (!isHighlight) {
    for (let i = minX; i <= maxX; i++) {
      for (let j = minY; j <= maxY; j++) {
        hitRegions[i][j].push(id);
      }
    }
  }
  context.closePath();
  if (coordinates.length > 1) {
    for (let i = 1; i < coordinates.length; i++) {
      coordinates[i].forEach((p, i) => {
        const { x, y } = getCanvasCoords(p[1], p[0]);
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
    }
    context.closePath();
  }
  context.fillStyle = fillStyle;
  context.strokeStyle = fillStyle;
  context.fill('evenodd');
  context.stroke();
}

function createHitRegions() {
  hitRegions = [];
  for (let x = 0; x < mapCanvas.width; x += hitRegionSize) {
    hitRegions.push([]);
    for (let y = 0; y < mapCanvas.height; y += hitRegionSize) {
      hitRegions[x / hitRegionSize].push([]);
    }
  }
}

function clearMap() {
  mapContext.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
}

function updateHighlight() {
  if (!hitRegions) return;
  clearHighlight();

  const cachedGeoData = zoom > msoaZoom ? getMSOAData() : getLAGData();
  const cachedData = getData();

  if (cachedGeoData[region]) {
    if (cachedGeoData[region].type === 'MultiPolygon') {
      cachedGeoData[region].coordinates.forEach((coords) => {
        drawArea(coords, region, true, 'rgba(255,0,0,0.5)');
      });
    } else {
      drawArea(cachedGeoData[region].coordinates, region, true, 'rgba(255,0,0,0.5)');
    }
    document.getElementById('rate').innerText = cachedData[region].d[getSliderValue()];
  } else {
    document.getElementById('rate').innerText = '';
  }
}

function drawBoundaries(withData) {
  const cachedGeoData = zoom > msoaZoom ? getMSOAData() : getLAGData();
  const cachedData = getData();
  Object.keys(cachedGeoData).forEach((msoaid) => {
    if (cachedGeoData[msoaid].type === 'MultiPolygon') {
      cachedGeoData[msoaid].coordinates.forEach((coords) => {
        drawArea(
          coords,
          msoaid,
          false,
          withData && cachedData[msoaid] && colourFromRate(cachedData[msoaid].d[getSliderValue()])
        );
      });
    } else if (cachedGeoData[msoaid].type === 'Polygon') {
      drawArea(
        cachedGeoData[msoaid].coordinates,
        msoaid,
        false,
        withData && cachedData[msoaid] && colourFromRate(cachedData[msoaid].d[getSliderValue()])
      );
    }
  });
}

function zoomIn(pageX, pageY) {
  console.log('ZI');
  if (zoom > maxZoom) return;

  // get point under mouse in lat lng
  const { lat, lng } = getMercator(
    mapCentreX - mapCanvas.width / 2 + pageX,
    mapCentreY - mapCanvas.height / 2 + pageY
  );

  zoom += 1;

  // get x.y of mouse lat lng in new zoom
  const { x, y } = getWebMercator(lat, lng);

  // update new map centre so that place under mouse
  // doesn't move
  mapCentreX = x - pageX + mapCanvas.width / 2;
  mapCentreY = y - pageY + mapCanvas.height / 2;

  map.setZoom(zoom);
  const { lat: newMapCentreLat, lng: newMapCentreLng } = getMercator(mapCentreX, mapCentreY);
  map.setCenter([newMapCentreLng, newMapCentreLat]);

  renderMap(true);
}

function zoomOut(pageX, pageY) {
  console.log('ZO');
  if (zoom <= minZoom) return;

  // get point under mouse in lat lng
  const { lat, lng } = getMercator(
    mapCentreX - mapCanvas.width / 2 + pageX,
    mapCentreY - mapCanvas.height / 2 + pageY
  );

  zoom -= 1;

  // get x.y of mouse lat lng in new zoom
  const { x, y } = getWebMercator(lat, lng);

  // update new map centre so that place under mouse
  // doesn't move
  mapCentreX = x - pageX + mapCanvas.width / 2;
  mapCentreY = y - pageY + mapCanvas.height / 2;

  map.setZoom(zoom);

  const { lat: newMapCentreLat, lng: newMapCentreLng } = getMercator(mapCentreX, mapCentreY);
  map.setCenter([newMapCentreLng, newMapCentreLat]);

  renderMap(true);
}

const updateMapCentre = () => {
  const centre = getWebMercator(mapCenterLAT, mapCenterLNG);
  mapCentreX = centre.x;
  mapCentreY = centre.y;
};

function initializeMap() {
  mapboxgl.accessToken =
    'pk.eyJ1IjoiMTIzNHJpY2hhcmR3aWxsaWFtcyIsImEiOiJja2Q3ZW1majkwMjFhMnRxcmhseDVpdWphIn0.-7Q7C7_uLQJgJqmPkgy-qw';
  map = new mapboxgl.Map({
    container: 'mapbox',
    style: 'mapbox://styles/mapbox/light-v10?optimize=true',
    center: [mapCenterLNG, mapCenterLAT],
    zoom,
  });

  var hasCovidDataLoaded = false;
  var hasGeoDataLoaded = false;

  loadGeoData().then(() => {
    hasGeoDataLoaded = true;
    renderMap(true, hasCovidDataLoaded);
  });

  loadCovidData().then(() => {
    hasCovidDataLoaded = true;
    if (hasGeoDataLoaded) renderMap(true, true);
  });

  initializeSlider((val) => {
    document.getElementById('date').innerText = getDate(+val);
    renderMap(false, true, true);
  });

  highlightContext.fillRect(0, 0, 100, 100);

  // resize the canvas to fill browser window dynamically
  window.addEventListener('resize', resizeCanvas, false);
  resizeCanvas();

  updateMapCentre();
  return map;
}

function startZoomDrag(e) {
  console.log('startZD');
  isZoomDragging = true;
  initialDistance = Math.hypot(
    e.touches[0].pageX - e.touches[1].pageX,
    e.touches[0].pageY - e.touches[1].pageY
  );
  twoFingerCentre = [
    (e.touches[0].pageX + e.touches[1].pageX) / 2,
    (e.touches[0].pageY + e.touches[1].pageY) / 2,
  ];
}
var fingerX;
var fingerY;
var dist;
var scale;
function zoomDragUpdate() {
  console.log('ZDU');
  needForRAF = true; // animation frame is happening now, so let another one queue up

  if (isZoomDragging) {
    document.body.style.transform = `translate(${fingerX - scale * twoFingerCentre[0]}px, ${
      fingerY - scale * twoFingerCentre[1]
    }px) scale(${scale})`;
  }
}

function zoomDrag(x1, y1, x2, y2) {
  console.log('ZD');
  if (needForRAF) {
    dist = Math.hypot(x1 - x2, y1 - y2);
    fingerX = (x1 + x2) / 2;
    fingerY = (y1 + y2) / 2;

    if (
      zoom + Math.log2(dist / initialDistance) <= maxZoom &&
      zoom + Math.log2(dist / initialDistance) >= minZoom
    )
      scale = dist / initialDistance;

    needForRAF = false;
    requestAnimationFrame(zoomDragUpdate);
  }
}

function endZoomDrag() {
  console.log('endZD');
  isZoomDragging = false;

  // get point under mouse in lat lng
  const { lat, lng } = getMercator(
    mapCentreX -
      mapCanvas.width / 2 +
      (mapCanvas.width / 2 + (-fingerX + scale * twoFingerCentre[0])) / scale,
    mapCentreY -
      mapCanvas.height / 2 +
      (mapCanvas.height / 2 + (-fingerY + scale * twoFingerCentre[1])) / scale
  );

  // set new zoom based on scale factor
  zoom = zoom + Math.log2(scale);

  // revert body and slider back to original position
  document.body.style.transform = `translate(0, 0)`;
  transformSlider(0, 0);

  // get x.y of mouse lat lng in new zoom
  const { x, y } = getWebMercator(lat, lng);

  // update new map centre so that place under mouse
  // doesn't move
  mapCentreX = x;
  mapCentreY = y;

  map.setZoom(zoom);

  const { lat: newMapCentreLat, lng: newMapCentreLng } = getMercator(mapCentreX, mapCentreY);
  map.setCenter([newMapCentreLng, newMapCentreLat]);

  renderMap(true);
}

export {
  initializeMap,
  zoomIn,
  zoomOut,
  renderMap,
  startDrag,
  startZoomDrag,
  zoomDrag,
  endZoomDrag,
  endDrag,
  drag,
};
