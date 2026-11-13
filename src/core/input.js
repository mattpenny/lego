/* Extracted verbatim from src/game.js by scripts/migrate.mjs.
   FIDELITY NOTE: this is the game's real binding code, lifted as-is. It is
   NOT imported by src/main.js in phase 1 — game.js still runs its own inline
   copy. It references game-scope collaborators that live in game.js
   ($, UI, Audio, INPUT_LOG, ATK_BUFFER), and importing it executes the
   bindings, so wire it in only when those are injected/passed (phase 2).
   The btnMagic binding in game.js is an anonymous IIFE (it adds
   BTN_PTR.btnMagic) and is therefore not part of this extract. */
const BTN_PTR={btnAttack:new Set(),btnRoll:new Set()};
function bindButton(id,isRoll){
  const el=$(id),set=BTN_PTR[id];
  el.addEventListener('pointerdown',e=>{
    e.preventDefault();
    // Register the press FIRST, before any cosmetic work, so a dropped audio
    // context or a slow frame can never swallow the input.
    set.add(e.pointerId);el.classList.add('press');
    if(isRoll){UI.rollLatch=true;INPUT_LOG.rollPress++;}
    else{UI.attack=true;UI.atkBuf=ATK_BUFFER;INPUT_LOG.attackPress++;}
    if(e.pointerType==='touch')INPUT_LOG.touch++;
    INPUT_LOG.pointerdown++;
    Audio.init();
  });
  const up=e=>{e.preventDefault();INPUT_LOG.pointerup++;buttonRelease(id,e.pointerId);};
  el.addEventListener('pointerup',up);
  el.addEventListener('pointercancel',up);
}
function buttonRelease(id,pid){
  const set=BTN_PTR[id];if(!set)return;
  set.delete(pid);
  if(!set.size){$(id).classList.remove('press');if(id==='btnAttack')UI.attack=false;}
}
addEventListener('pointerup',e=>{buttonRelease('btnAttack',e.pointerId);buttonRelease('btnRoll',e.pointerId);});
addEventListener('pointercancel',e=>{buttonRelease('btnAttack',e.pointerId);buttonRelease('btnRoll',e.pointerId);});
bindButton('btnAttack',false); bindButton('btnRoll',true);

export { BTN_PTR, bindButton, buttonRelease };
