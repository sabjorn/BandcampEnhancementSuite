export function mousedownCallback(e) {
  const elementOffset = e.offsetX;
  const elementWidth = e.path[1].offsetWidth;
  const scaleDuration = elementOffset / elementWidth;

  let audio = document.querySelector("audio");
  let audioDuration = audio.duration;
  audio.currentTime = scaleDuration * audioDuration;
}
