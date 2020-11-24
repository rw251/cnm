import mapboxgl from 'mapbox-gl';
let zoom = 5;
const minZoom = 4;
const maxZoom = 10;
const msoaZoom = 7;
const mapCanvas = document.getElementById('map');
const mapContext = mapCanvas.getContext('2d');
const highlightCanvas = document.getElementById('highlight');
const highlightContext = highlightCanvas.getContext('2d');
const slider = document.getElementById('myRange');
const sliderWrapper = document.getElementById('mySlider');
let mapCenterLNG = -2.6416415135265; //-2.5; // longitude
let mapCenterLAT = 53.592328230096889; //54.5; //latitude
let sliderMax;

// Global vars to cache event state
// used for pinch zooming
var evCache = new Array();
var prevDiff = -1;

mapboxgl.accessToken =
  'pk.eyJ1IjoiMTIzNHJpY2hhcmR3aWxsaWFtcyIsImEiOiJja2Q3ZW1majkwMjFhMnRxcmhseDVpdWphIn0.-7Q7C7_uLQJgJqmPkgy-qw';
var map = new mapboxgl.Map({
  container: 'mapbox',
  style: 'mapbox://styles/mapbox/light-v10?optimize=true',
  center: [mapCenterLNG, mapCenterLAT],
  zoom,
});

highlightContext.fillRect(0, 0, 100, 100);

// allow dragging
window.addEventListener('mousedown', startDrag);
window.addEventListener('mousemove', drag);
window.addEventListener('mouseup', endDrag);

var scaling = false;
var lastDist;
var twoFingerStart;
window.ontouchstart = (e) => {
  console.log('t start');
  if (e.touches.length === 1) {
    startDrag({
      target: {
        tagName: '',
      },
      clientX: e.touches[0].pageX,
      clientY: e.touches[0].pageY,
    });
  } else if (e.touches.length === 2) {
    scaling = true;
    lastDist = Math.hypot(
      e.touches[0].pageX - e.touches[1].pageX,
      e.touches[0].pageY - e.touches[1].pageY
    );

    twoFingerStart = [
      e.touches[0].pageX,
      e.touches[0].pageY,
      e.touches[1].pageX,
      e.touches[1].pageY,
    ];
  }
};
window.ontouchmove = (e) => {
  if (scaling) {
    var dist = Math.hypot(
      e.touches[0].pageX - e.touches[1].pageX,
      e.touches[0].pageY - e.touches[1].pageY
    );
    // console.log(dist);
    // if (dist > lastDist) zoomIn(centre[0], centre[1]);
    // else zoomOut(centre[0], centre[1]);
    lastDist = dist;
  } else if (e.touches.length === 1) {
    drag({
      clientX: e.touches[0].pageX,
      clientY: e.touches[0].pageY,
    });
  }
};
window.ontouchend = (e) => {
  if (scaling) {
    // pinchEnd(e);
    scaling = false;
  } else if (e.changedTouches.length === 1 && e.touches.length === 0) {
    endDrag({
      clientX: e.changedTouches[0].pageX,
      clientY: e.changedTouches[0].pageY,
    });
  }
};

// allow zooming
window.addEventListener('dblclick', (e) => {
  if (e.target.tagName.toLowerCase() === 'input') return;
  return zoomIn(e.clientX, e.clientY);
});
window.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.deltaY < 0) zoomIn(e.clientX, e.clientY);
  else zoomOut(e.clientX, e.clientY);
});

// suppress the right-click menu
window.addEventListener('contextmenu', function (evt) {
  evt.preventDefault();
});

let inDblRightClickWindow = false;
window.addEventListener('mouseup', (evt) => {
  if (evt.button === 2) {
    // right-click button
    if (inDblRightClickWindow) {
      // double right click
      zoomOut(evt.clientX, evt.clientY);
    } else {
      inDblRightClickWindow = true;
      // first right click
      setTimeout(() => {
        inDblRightClickWindow = false;
      }, 300);
    }
  }
});

// resize the canvas to fill browser window dynamically
window.addEventListener('resize', resizeCanvas, false);
resizeCanvas();

var hasCovidDataLoaded = false;
var hasGeoDataLoaded = false;

loadGeoData().then(() => {
  renderMap(true);
});

loadCovidData().then(() => {
  if (hasGeoDataLoaded) renderMap(true);
});

const deg2Rad = (deg) => (deg * Math.PI) / 180;
const rad2Deg = (rad) => (rad * 180) / Math.PI;

const sqWidth = 512; //Math.min(mapCanvas.width, mapCanvas.height);

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

var mapCentreX;
var mapCentreY;
const updateMapCentre = () => {
  const centre = getWebMercator(mapCenterLAT, mapCenterLNG);
  mapCentreX = centre.x;
  mapCentreY = centre.y;
};

updateMapCentre();

const getCanvasCoords = (lat, lng) => {
  const { x: webX, y: webY } = getWebMercator(lat, lng);
  const x = Math.floor(webX - mapCentreX + mapCanvas.width / 2);
  const y = Math.floor(webY - mapCentreY + mapCanvas.height / 2);
  return { x, y };
};

const getCanvasCoordsForList = (latlngs) => latlngs.map((x) => getCanvasCoords(x[1], x[0]));

const isOnCanvas = (x, y) => x >= 0 && x <= mapCanvas.width && y >= 0 && y <= mapCanvas.height;

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
  hasCovidDataLoaded = true;
}

const doSliderThing = (val) => {
  if (!sliderMax) return;
  renderMap(false, hasGeoDataLoaded, true);
  document.getElementById('date').innerText = cachedData.dates[+val];
};

slider.addEventListener('input', (e) => {
  e.preventDefault();
  doSliderThing(e.target.value);
});

const downBtn = document.getElementById('downButton');
const upBtn = document.getElementById('upButton');

downBtn.addEventListener('click', () => {
  slider.value = +slider.value - 1;
  doSliderThing(slider.value);
});
upBtn.addEventListener('click', () => {
  slider.value = +slider.value + 1;
  doSliderThing(slider.value);
});

var cachedMSOAGeoData = {};
var cachedLAGeoData = {};
var cachedGeoData;
function loadGeoData() {
  return Promise.all([
    fetch('msoa.json').then((resp) => resp.json()),
    fetch('lad.json').then((resp) => resp.json()),
  ]).then(([msoaData, ladData]) => {
    msoaData.features.forEach((feature) => {
      cachedMSOAGeoData[feature.properties.MSOA11CD] = {
        type: feature.geometry.type,
        coordinates: feature.geometry.coordinates,
      };
    });
    ladData.features.forEach((feature) => {
      cachedLAGeoData[feature.properties.LAD19CD] = {
        type: feature.geometry.type,
        coordinates: feature.geometry.coordinates,
      };
    });
    cachedGeoData = cachedLAGeoData;
    hasGeoDataLoaded = true;
  });
}

function renderMap(full = false, withData = hasCovidDataLoaded, mapHasntMoved = false) {
  if (cachedMSOAGeoData) {
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

var hitRegions;
var hitRegionSize = 50;
var regionX;
var regionY;
var region;
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

function updateHighlight() {
  if (!hitRegions) return;
  clearHighlight();

  if (cachedGeoData[region]) {
    if (cachedGeoData[region].type === 'MultiPolygon') {
      cachedGeoData[region].coordinates.forEach((coords) => {
        drawArea(coords, region, true, 'rgba(255,0,0,0.5)');
      });
    } else {
      drawArea(cachedGeoData[region].coordinates, region, true, 'rgba(255,0,0,0.5)');
    }
    document.getElementById('rate').innerText = cachedData[region].d[+slider.value];
  } else {
    document.getElementById('rate').innerText = '';
  }
}

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

function drawBoundaries(withData) {
  Object.keys(cachedGeoData).forEach((msoaid) => {
    if (cachedGeoData[msoaid].type === 'MultiPolygon') {
      cachedGeoData[msoaid].coordinates.forEach((coords) => {
        drawArea(
          coords,
          msoaid,
          false,
          withData && cachedData[msoaid] && colourFromRate(cachedData[msoaid].d[+slider.value])
        );
      });
    } else if (cachedGeoData[msoaid].type === 'Polygon') {
      drawArea(
        cachedGeoData[msoaid].coordinates,
        msoaid,
        false,
        withData && cachedData[msoaid] && colourFromRate(cachedData[msoaid].d[+slider.value])
      );
    }
  });
}

function resizeCanvas() {
  mapCanvas.width = window.innerWidth;
  mapCanvas.height = window.innerHeight;
  highlightCanvas.width = window.innerWidth;
  highlightCanvas.height = window.innerHeight;
  renderMap(true);
}

let isDragging = false;
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
    sliderWrapper.style.transform = `translate(calc(-50% - ${distanceX}px), ${-distanceY}px)`;
  }
}

function zoomDrag(e) {
  if (isZoomDragging) {
    if (needForRAF) {
      distanceX = e.clientX - startX;
      distanceY = e.clientY - startY;
      needForRAF = false;
      requestAnimationFrame(zoomDragUpdate);
    }
  }
}

function drag(e) {
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
  sliderWrapper.style.transform = `translate(-50%, 0)`;

  renderMap(true);
}

function zoomIn(mouseX, mouseY) {
  if (zoom > maxZoom) return;

  // get point under mouse in lat lng
  const { lat, lng } = getMercator(
    mapCentreX - mapCanvas.width / 2 + mouseX,
    mapCentreY - mapCanvas.height / 2 + mouseY
  );

  zoom += 1;

  // get x.y of mouse lat lng in new zoom
  const { x, y } = getWebMercator(lat, lng);

  // update new map centre so that place under mouse
  // doesn't move
  mapCentreX = x - mouseX + mapCanvas.width / 2;
  mapCentreY = y - mouseY + mapCanvas.height / 2;

  if (zoom > msoaZoom) cachedGeoData = cachedMSOAGeoData;

  map.setZoom(zoom);
  const { lat: newMapCentreLat, lng: newMapCentreLng } = getMercator(mapCentreX, mapCentreY);
  map.setCenter([newMapCentreLng, newMapCentreLat]);

  renderMap(true);
}

function zoomOut(mouseX, mouseY) {
  if (zoom <= minZoom) return;

  // get point under mouse in lat lng
  const { lat, lng } = getMercator(
    mapCentreX - mapCanvas.width / 2 + mouseX,
    mapCentreY - mapCanvas.height / 2 + mouseY
  );

  zoom -= 1;

  // get x.y of mouse lat lng in new zoom
  const { x, y } = getWebMercator(lat, lng);

  // update new map centre so that place under mouse
  // doesn't move
  mapCentreX = x - mouseX + mapCanvas.width / 2;
  mapCentreY = y - mouseY + mapCanvas.height / 2;

  if (zoom <= msoaZoom) cachedGeoData = cachedLAGeoData;

  map.setZoom(zoom);

  const { lat: newMapCentreLat, lng: newMapCentreLng } = getMercator(mapCentreX, mapCentreY);
  map.setCenter([newMapCentreLng, newMapCentreLat]);

  renderMap(true);
}
