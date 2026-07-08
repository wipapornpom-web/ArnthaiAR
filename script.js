let words = WORDS.map(w => ({...w, answers:[...w.answers], choices:[...w.choices]}));
let index = 0, score = 0;
let selected = null, hoverTarget = null, hoverStart = 0;
let smoothX = window.innerWidth / 2, smoothY = window.innerHeight / 2;
let lastSeenHand = 0;
const DWELL_MS = 430;          // ชี้ค้างเพื่อหยิบ/วาง
const PICK_RADIUS = 72;        // ระยะดูดตัวอักษร
const DROP_RADIUS = 92;        // ระยะดูดช่องวาง ให้กว้างขึ้น วางง่ายขึ้น

const wordBox = document.getElementById('wordBox');
const lettersBox = document.getElementById('lettersBox');
const cursor = document.getElementById('cursor');
const message = document.getElementById('message');
const scoreEl = document.getElementById('score');
const progress = document.getElementById('progress');

function speak(t){
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'th-TH';
    u.rate = .9;
    speechSynthesis.speak(u);
  }catch(e){}
}

function shuffle(arr){ return [...arr].sort(() => Math.random() - .5); }

function loadWord(){
  selected = null;
  hoverTarget = null;
  hoverStart = 0;
  wordBox.innerHTML = '';
  lettersBox.innerHTML = '';

  if(index >= words.length){
    progress.textContent = 'จบเกม';
    message.textContent = 'จบเกมแล้ว คะแนนรวม ' + score + ' คะแนน';
    speak('เก่งมาก จบเกมแล้ว');
    return;
  }

  const item = words[index];
  const ans = [...item.answers];
  progress.textContent = `คำที่ ${index + 1}/${words.length}`;

  item.show.forEach(ch => {
    const div = document.createElement('div');
    if(ch === '_'){
      div.className = 'slot';
      div.dataset.answer = ans.shift();
      div.dataset.filled = '0';
    }else{
      div.className = 'fixed';
      div.textContent = ch;
    }
    wordBox.appendChild(div);
  });

  shuffle(item.choices).forEach(ch => {
    const div = document.createElement('div');
    div.className = 'letter';
    div.textContent = ch;
    lettersBox.appendChild(div);
  });

  message.textContent = 'ชี้ค้างที่ตัวอักษร แล้วชี้ไปช่องว่าง';
}

function centerOf(el){
  const r = el.getBoundingClientRect();
  return {x:r.left + r.width/2, y:r.top + r.height/2, rect:r};
}

function distanceToElement(el, x, y){
  const c = centerOf(el);
  return Math.hypot(c.x - x, c.y - y);
}

function nearestElement(selector, x, y, radius){
  let best = null, bestDist = Infinity;
  document.querySelectorAll(selector).forEach(el => {
    if(el.classList.contains('holding')) return;
    if(el.classList.contains('slot') && el.dataset.filled === '1') return;
    const d = distanceToElement(el, x, y);
    if(d < bestDist){ best = el; bestDist = d; }
  });
  return bestDist <= radius ? best : null;
}

function clearTargets(){
  document.querySelectorAll('.target').forEach(el => el.classList.remove('target'));
}

function resetLetter(el){
  if(!el) return;
  el.classList.remove('holding','target');
  el.style.left = '';
  el.style.top = '';
  el.style.position = '';
  el.style.zIndex = '';
}

function updateSelected(x,y){
  if(selected){
    selected.style.left = (x - selected.offsetWidth/2) + 'px';
    selected.style.top = (y - selected.offsetHeight/2) + 'px';
  }
}

function wordComplete(){
  return [...document.querySelectorAll('.slot')].every(s => s.dataset.filled === '1');
}

function goNextAutomatically(){
  const full = words[index].full;
  message.textContent = 'ถูกต้อง: ' + full + ' ⭐';
  speak(full);
  setTimeout(() => {
    index++;
    loadWord();
  }, 1100);
}

function wrongAnswer(){
  message.textContent = 'ยังไม่ถูก ลองใหม่อีกครั้งนะ';
  speak('ลองใหม่');
  resetLetter(selected);
  selected = null;
  hoverTarget = null;
  hoverStart = Date.now();
}

function pickOrDrop(x,y){
  let target = selected
    ? nearestElement('.slot', x, y, DROP_RADIUS)
    : nearestElement('.letter', x, y, PICK_RADIUS);

  clearTargets();
  if(target) target.classList.add('target');

  if(!target){
    hoverTarget = null;
    hoverStart = 0;
    cursor.classList.remove('hold');
    return;
  }

  if(target !== hoverTarget){
    hoverTarget = target;
    hoverStart = Date.now();
    cursor.classList.add('hold');
    return;
  }

  if(Date.now() - hoverStart < DWELL_MS){
    cursor.classList.add('hold');
    return;
  }

  cursor.classList.remove('hold');

  if(!selected && target.classList.contains('letter')){
    selected = target;
    selected.classList.add('holding');
    selected.style.position = 'fixed';
    selected.style.zIndex = '100';
    message.textContent = 'ถือ: ' + selected.textContent;
    speak(selected.textContent);
    hoverTarget = null;
    hoverStart = Date.now();
    return;
  }

  if(selected && target.classList.contains('slot')){
    if(selected.textContent === target.dataset.answer){
      target.textContent = selected.textContent;
      target.dataset.filled = '1';
      target.classList.add('filled','celebrate');
      selected.remove();
      selected = null;
      score++;
      scoreEl.textContent = score;
      message.textContent = 'เก่งมากค่ะ ⭐';
      speak('เก่งมากค่ะ');
      hoverTarget = null;
      hoverStart = Date.now();
      if(wordComplete()){
        setTimeout(goNextAutomatically, 450);
      }
    }else{
      wrongAnswer();
    }
  }
}

loadWord();

const videoElement = document.getElementById('video');
const hands = new Hands({locateFile:file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: .72,
  minTrackingConfidence: .72
});

hands.onResults(results => {
  if(results.multiHandLandmarks && results.multiHandLandmarks.length){
    lastSeenHand = Date.now();
    const tip = results.multiHandLandmarks[0][8];
    const x = (1 - tip.x) * window.innerWidth;
    const y = tip.y * window.innerHeight;

    smoothX = smoothX * .68 + x * .32;
    smoothY = smoothY * .68 + y * .32;

    cursor.style.left = smoothX + 'px';
    cursor.style.top = smoothY + 'px';
    updateSelected(smoothX, smoothY);
    pickOrDrop(smoothX, smoothY);
  }else{
    cursor.classList.remove('hold');
    clearTargets();
    hoverTarget = null;
    if(Date.now() - lastSeenHand > 500){
      message.textContent = 'ยกมือให้อยู่ในกล้องชัด ๆ';
    }
  }
});

const camera = new Camera(videoElement, {
  onFrame: async () => { await hands.send({image: videoElement}); },
  width: 1280,
  height: 720
});

camera.start().catch(() => {
  message.textContent = 'กรุณาอนุญาตใช้กล้องก่อน';
});
