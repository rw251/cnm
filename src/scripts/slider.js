const slider = document.getElementById('myRange');
const sliderWrapper = document.getElementById('mySlider');

// const doSliderThing = (val) => {
//   if (!sliderMax) return;
//   renderMap(false, true, true);
//   document.getElementById('date').innerText = getDate(+val);
// };

function initializeSlider(callbackFn) {
  slider.addEventListener('input', (e) => {
    e.preventDefault();
    callbackFn(e.target.value);
  });

  const downBtn = document.getElementById('downButton');
  const upBtn = document.getElementById('upButton');

  downBtn.addEventListener('click', () => {
    slider.value = +slider.value - 1;
    callbackFn(slider.value);
  });
  upBtn.addEventListener('click', () => {
    slider.value = +slider.value + 1;
    callbackFn(slider.value);
  });
}

function getSliderValue() {
  return +slider.value;
}

function transformSlider(distanceX, distanceY) {
  sliderWrapper.style.transform = `translate(calc(-50% - ${distanceX}px), ${-distanceY}px)`;
}
export { initializeSlider, getSliderValue, transformSlider };
