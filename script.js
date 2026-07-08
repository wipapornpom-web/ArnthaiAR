let words = WORDS.map(w => ({...w, answers:[...w.answers], choices:[...w.choices]}));
let index = 0, score = 0;
let selected = null, hoverTarget = null, hoverStart = 0;
let smoothX = window.innerWidth / 2, smoothY = window.innerHeight / 2;
let lastSeenHand = 0;

const DWELL_MS = 360;
const PICK_RADIUS = 100;
const DROP_RADIUS = 108;

const THAI_MARKS = new Set(['ั','ิ','ี','ึ','ื','ุ','ู','ฺ','็','่','้','๊','๋','์']);
const BELOW_MARKS = new Set(['ุ','ู','ฺ']);

const wordBox = document.getElementById('wordBox');
const lettersBox = document.getElementById('lettersBox');
const cursor = document.getElementById('cursor');
const message = document.getElementById('message');
const scoreEl = document.getElementById('score');
const progress = document.getElementById('progress');

function isMark(ch){ return THAI_MARKS.has(ch); }
function isBelow(ch){ return BELOW_MARKS.has(ch); }
function displayChoice(ch){ return isMark(ch) ? '◌' + ch : ch; }
function speak(t){
  try{ speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang='th-TH'; u.rate=.9; speechSynthesis.speak(u); }catch(e){}
}
function shuffle(arr){ return [...arr].sort(() => Math.random() - .5); }

function createCell(){
  const cell = document.createElement('div');
  cell.className = 'thai-cell';
  return cell;
}
function addBase(cell, ch, isSlot=false, answer=''){
  const base = document.createElement('div');
  base.className = isSlot ? 'base drop-slot base-slot' : 'base fixed';
  if(isSlot){
    base.dataset.answer = answer;
    base.dataset.current = '';
    base.dataset.filled = '0';
    base.dataset.kind = 'base';
  }else{
    base.textContent = ch;
  }
  cell.appendChild(base);
  return base;
}
function addMark(cell, ch, isSlot=false, answer=''){
  const mark = document.createElement('div');
  const pos = isBelow(isSlot ? answer : ch) ? 'mark-below' : 'mark-above';
  const aboveCount = cell.querySelectorAll('.mark-above').length;
  mark.className = (isSlot ? 'mark-slot drop-slot ' : 'mark-fixed ') + pos + (pos === 'mark-above' && aboveCount ? ' level2' : '');
  if(isSlot){
    mark.dataset.answer = answer;
    mark.dataset.current = '';
    mark.dataset.filled = '0';
    mark.dataset.kind = 'mark';
    mark.title = 'ช่องสระ/วรรณยุกต์';
  }else{
    mark.textContent = ch;
  }
  cell.appendChild(mark);
  return mark;
}

function loadWord(){
  selected = null; hoverTarget = null; hoverStart = 0;
  wordBox.innerHTML = ''; lettersBox.innerHTML = '';
  if(index >= words.length){
    progress.textContent = 'จบเกม';
    message.textContent = 'จบเกมแล้ว คะแนนรวม ' + score + ' คะแนน';
    speak('เก่งมาก จบเกมแล้ว'); return;
  }
  const item = words[index];
  const ans = [...item.answers];
  progress.textContent = `คำที่ ${index + 1}/${words.length}`;
  let lastCell = null;

  item.show.forEach(ch => {
    if(ch === '_'){
      const a = ans.shift();
      if(isMark(a) && lastCell){ addMark(lastCell, '', true, a); }
      else { const cell = createCell(); addBase(cell, '', true, a); wordBox.appendChild(cell); lastCell = cell; }
    }else if(isMark(ch) && lastCell){
      addMark(lastCell, ch, false);
    }else{
      const cell = createCell(); addBase(cell, ch, false); wordBox.appendChild(cell); lastCell = cell;
    }
  });

  shuffle(item.choices).forEach(ch => lettersBox.appendChild(makeLetter(ch)));
  message.textContent = 'ชี้ค้างเพื่อหยิบ แล้ววางให้ตรงตำแหน่ง';
}

function makeLetter(ch){
  const div = document.createElement('div');
  div.className = 'letter' + (isMark(ch) ? ' mark-choice' : '');
  div.dataset.value = ch;
  div.textContent = displayChoice(ch);
  return div;
}
function slotValue(slot){ return slot.dataset.current || ''; }
function fillSlot(slot, value){
  slot.dataset.current = value;
  slot.dataset.filled = '1';
  slot.textContent = slot.dataset.kind === 'mark' ? value : value;
  slot.classList.add('filled','celebrate');
  if(value === slot.dataset.answer){ slot.classList.add('correct'); slot.classList.remove('wrong'); }
  else { slot.classList.add('wrong'); slot.classList.remove('correct'); }
}
function clearSlot(slot){
  slot.dataset.current = ''; slot.dataset.filled = '0'; slot.textContent = '';
  slot.classList.remove('filled','correct','wrong','celebrate','target');
}

function centerOf(el){ const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,rect:r}; }
function distanceToElement(el,x,y){ const c=centerOf(el); return Math.hypot(c.x-x,c.y-y); }
function nearestElement(selector,x,y,radius){
  let best=null, bestDist=Infinity;
  document.querySelectorAll(selector).forEach(el=>{
    if(el.classList.contains('holding')) return;
    const d=distanceToElement(el,x,y);
    if(d<bestDist){best=el; bestDist=d;}
  });
  return bestDist <= radius ? best : null;
}
function nearestPickTarget(x,y){ return nearestElement('.letter',x,y,PICK_RADIUS) || nearestElement('.drop-slot.filled',x,y,PICK_RADIUS); }
function clearTargets(){ document.querySelectorAll('.target').forEach(el=>el.classList.remove('target')); }

function holdLetter(el){
  el.classList.add('holding');
  el.style.position='fixed'; el.style.zIndex='100';
  selected=el;
}
function updateSelected(x,y){ if(selected){ selected.style.left=(x-selected.offsetWidth/2)+'px'; selected.style.top=(y-selected.offsetHeight/2)+'px'; } }
function pickFromSlot(slot){
  const value = slotValue(slot);
  clearSlot(slot);
  const div = makeLetter(value);
  document.body.appendChild(div);
  holdLetter(div);
  message.textContent = 'ย้าย: ' + displayChoice(value);
  speak(value);
}
function wordAllCorrect(){ return [...document.querySelectorAll('.drop-slot')].every(s => s.dataset.filled==='1' && slotValue(s)===s.dataset.answer); }
function goNextAutomatically(){
  const full = words[index].full;
  message.textContent = 'ถูกต้อง: ' + full + ' ⭐';
  speak(full);
  setTimeout(()=>{ index++; loadWord(); }, 1150);
}
function placeOnSlot(slot){
  if(!selected || !slot) return;
  const value = selected.dataset.value;
  if(slot.dataset.filled === '1'){
    lettersBox.appendChild(makeLetter(slotValue(slot)));
    clearSlot(slot);
  }
  fillSlot(slot, value);
  selected.remove(); selected=null; hoverTarget=null; hoverStart=Date.now();
  if(value === slot.dataset.answer){ message.textContent = 'วางถูกตำแหน่งค่ะ ⭐'; speak('ถูกต้อง'); }
  else { message.textContent = 'ยังไม่ตรงตำแหน่ง ย้ายไปวางใหม่ได้'; speak('ลองย้ายใหม่'); }
  if(wordAllCorrect()){
    score++; scoreEl.textContent = score;
    setTimeout(goNextAutomatically, 520);
  }
}
function pickOrDrop(x,y){
  const target = selected ? nearestElement('.drop-slot',x,y,DROP_RADIUS) : nearestPickTarget(x,y);
  clearTargets(); if(target) target.classList.add('target');
  if(!target){ hoverTarget=null; hoverStart=0; cursor.classList.remove('hold'); return; }
  if(target !== hoverTarget){ hoverTarget=target; hoverStart=Date.now(); cursor.classList.add('hold'); return; }
  if(Date.now() - hoverStart < DWELL_MS){ cursor.classList.add('hold'); return; }
  cursor.classList.remove('hold');
  if(!selected && target.classList.contains('letter')){ holdLetter(target); message.textContent='ถือ: '+displayChoice(selected.dataset.value); speak(selected.dataset.value); hoverTarget=null; hoverStart=Date.now(); return; }
  if(!selected && target.classList.contains('drop-slot') && target.dataset.filled==='1'){ pickFromSlot(target); hoverTarget=null; hoverStart=Date.now(); return; }
  if(selected && target.classList.contains('drop-slot')) placeOnSlot(target);
}

loadWord();
const videoElement = document.getElementById('video');
const hands = new Hands({locateFile:file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({maxNumHands:1,modelComplexity:1,minDetectionConfidence:.74,minTrackingConfidence:.74});
hands.onResults(results=>{
  if(results.multiHandLandmarks && results.multiHandLandmarks.length){
    lastSeenHand=Date.now(); const tip=results.multiHandLandmarks[0][8];
    const x=(1-tip.x)*window.innerWidth, y=tip.y*window.innerHeight;
    smoothX=smoothX*.68+x*.32; smoothY=smoothY*.68+y*.32;
    cursor.style.left=smoothX+'px'; cursor.style.top=smoothY+'px';
    updateSelected(smoothX,smoothY); pickOrDrop(smoothX,smoothY);
  }else{
    cursor.classList.remove('hold'); clearTargets(); hoverTarget=null;
    if(Date.now()-lastSeenHand>500) message.textContent='ยกมือให้อยู่ในกล้องชัด ๆ';
  }
});
const camera = new Camera(videoElement,{onFrame:async()=>{await hands.send({image:videoElement});},width:1280,height:720});
camera.start().catch(()=>{message.textContent='กรุณาอนุญาตใช้กล้องก่อน';});
