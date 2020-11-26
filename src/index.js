import {
  initializeMap,
  zoomIn,
  zoomOut,
  startDrag,
  endDrag,
  drag,
  zoomDrag,
  startZoomDrag,
  endZoomDrag,
} from './scripts/map';

initializeMap();

// allow dragging
window.addEventListener('mousedown', startDrag);
window.addEventListener('mousemove', drag);
window.addEventListener('mouseup', endDrag);

var isDragging = false;
var isZoomDragging = false;
window.ontouchstart = (e) => {
  if (e.target.tagName.toLowerCase() === 'input') return;
  if (e.touches.length === 1) {
    isDragging = true;
    startDrag({
      target: {
        tagName: '',
      },
      clientX: e.touches[0].pageX,
      clientY: e.touches[0].pageY,
    });
  } else if (e.touches.length >= 2) {
    isZoomDragging = true;
    isDragging = false;
    startZoomDrag(e);
  }
};
window.ontouchmove = (e) => {
  if (e.touches.length === 1 && isDragging) {
    drag({
      clientX: e.touches[0].pageX,
      clientY: e.touches[0].pageY,
    });
  } else if (e.touches.length >= 2) {
    zoomDrag(e.touches[0].pageX, e.touches[0].pageY, e.touches[1].pageX, e.touches[1].pageY);
  }
};
window.ontouchend = (e) => {
  if (isDragging) {
    isDragging = false;
    endDrag({
      clientX: e.changedTouches[0].pageX,
      clientY: e.changedTouches[0].pageY,
    });
  } else if (isZoomDragging) {
    isZoomDragging = false;
    endZoomDrag();
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
