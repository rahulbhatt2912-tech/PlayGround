(() => {
  'use strict';
  const canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  const W=480,H=270,T=16, WORLD_W=48,WORLD_H=36;
  const $=id=>document.getElementById(id);
  const state={x:12,y:15,level:1,xp:0,hp:100,day:1,hour:8,minute:0,weather:'Clear',season:0,weatherTick:0,wood:4,stone:3,berries:3,seeds:4,fish:0,ore:0,crystals:0,food:4,home:0,rep:0,kills:0,selected:0,dungeon:false,playerDir:'down',attackCd:0,moveCd:0,toastTimer:0,toast:'',log:[],daySeconds:0,plantBeds:[],enemyMemory:0,hasRod:true};
  const seasonNames=['SPRING','SUMMER','AUTUMN','WINTER'], weatherNames=['Clear','Soft rain','Drizzle','Windy','Meteor glow'];
  const toolNames=['PICKAXE','AXE','SEEDS','ROD'];
  const keys={};
  const rnd=(x,y,s=0)=>{let n=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return n-Math.floor(n)};
  const trees=[],rocks=[],plants=[],water=[], monsters=[];
  for(let y=2;y<WORLD_H-2;y++)for(let x=2;x<WORLD_W-2;x++){
    const r=rnd(x,y,3);
    if(r>.945 && !(x>7&&x<20&&y>9&&y<22)) trees.push({x,y,hp:3,regrow:0});
    else if(r>.918 && !(x>7&&x<20&&y>9&&y<22)) rocks.push({x,y,hp:2});
    else if(r>.89 && !(x>8&&x<17&&y>12&&y<20)) plants.push({x,y,type:rnd(x,y,8)>.55?'glow':'snap',ready:true,attack:0});
  }
  // River bends along the eastern edge, with a small pond near the camp.
  for(let y=3;y<31;y++){let x=34+Math.round(Math.sin(y*.27)*2); water.push({x,y}); if(y>4&&y<12) water.push({x:x-1,y});}
  for(let y=24;y<27;y++)for(let x=18;x<22;x++)water.push({x,y});
  const bedSpots=[{x:14,y:17},{x:15,y:17},{x:16,y:17},{x:14,y:18},{x:15,y:18},{x:16,y:18}];
  bedSpots.forEach(b=>state.plantBeds.push({...b,planted:0,ready:false}));
  function log(msg){state.log.unshift({day:state.day,text:msg});state.log=state.log.slice(0,14);}
  function notify(msg){state.toast=msg;state.toastTimer=2.4;const el=$('toast');el.textContent=msg;el.classList.add('show');}
  function save(){try{localStorage.setItem('zigga-save',JSON.stringify({...state,trees,rocks,plants,monsters}));$('saveStatus').textContent='AUTO-SAVED';}catch(e){}}
  function load(){try{const d=JSON.parse(localStorage.getItem('zigga-save'));if(!d)return;Object.assign(state,d);['trees','rocks','plants','monsters'].forEach(k=>{if(Array.isArray(d[k])){const target={trees,rocks,plants,monsters}[k];target.splice(0,target.length,...d[k]);}});if(!Array.isArray(state.plantBeds))state.plantBeds=[];}catch(e){}}
  load();
  if(Array.isArray(state.plantBeds)&&state.plantBeds.length){bedSpots.splice(0,bedSpots.length,...state.plantBeds.map(b=>({...b})));}
  state.plantBeds=bedSpots;
  function addXp(n,why){state.xp+=n;state.rep+=1;let need=levelNeed();while(state.level<75&&state.xp>=need){state.xp-=need;state.level++;state.hp=Math.min(100,state.hp+18);need=levelNeed();notify(`LEVEL UP! You reached level ${state.level}`);log(`Reached level ${state.level}. The wilds are getting stronger.`);}if(why)log(`${why} +${n} XP`);}
  function levelNeed(){return 30+state.level*12;}
  function seasonIndex(){return Math.floor((state.day-1)/28)%4;}
  function monsterLevel(){return Math.max(1,Math.min(70,Math.floor((state.level-1)*.92)+1+Math.min(8,state.kills/8|0)));}
  function nearest(arr,max=1.5){let found=null,best=max;for(const e of arr){if(e.gone||e.hp<=0)continue;const d=Math.hypot(e.x-state.x,e.y-state.y);if(d<best){best=d;found=e;}}return found;}
  function isWater(x,y){return water.some(a=>a.x===x&&a.y===y);}
  function isBlocked(x,y){if(x<1||y<1||x>=WORLD_W-1||y>=WORLD_H-1)return true;if(isWater(x,y))return true;if(trees.some(a=>a.x===x&&a.y===y&&a.hp>0))return true;if(rocks.some(a=>a.x===x&&a.y===y&&a.hp>0))return true;return false;}
  function worldMonsterSpawn(){if(monsters.length>=7)return;let x,y,tries=0;do{x=state.x+Math.round((Math.random()-.5)*18);y=state.y+Math.round((Math.random()-.5)*12);tries++;}while((Math.hypot(x-state.x,y-state.y)<5||isBlocked(x,y)||x<2||y<2||x>=WORLD_W-2||y>=WORLD_H-2)&&tries<20);if(tries<20)monsters.push({x,y,hp:1,level:monsterLevel(),kind:Math.random()>.5?'Mossback':'Thornling',aggro:false,hit:0});}
  function move(dx,dy){if(state.moveCd>0)return;const x=state.x+dx,y=state.y+dy;if(!isBlocked(x,y)){state.x=x;state.y=y;state.playerDir=dx<0?'left':dx>0?'right':dy<0?'up':'down';state.moveCd=.12;updatePositionUI();}if(state.dungeon)for(const m of monsters){if(Math.hypot(m.x-state.x,m.y-state.y)<5)m.aggro=true;}}
  function useTool(){if(state.dungeon){interactDungeon();return;}const tool=state.selected;
    if(tool===1){const tree=nearest(trees,1.8);if(tree){tree.hp--;if(tree.hp<=0){tree.hp=0;tree.regrow=8;state.wood+=3;addXp(6,'Harvested a moonwood tree.');notify('Moonwood +3 · the stump will regrow');save();}else notify('Chop... one more hit');return;}}
    if(tool===0){const rock=nearest(rocks,1.7);if(rock){rock.hp--;if(rock.hp<=0){rock.hp=0;state.stone+=2;if(Math.random()<.25)state.ore++;addXp(5,'Mined a starstone deposit.');notify('Starstone +2');save();}else notify('Crack! Keep mining');return;}const near=nearest(monsters,1.7);if(near){attack(near);return;}}
    if(tool===2){const bed=bedSpots.find(b=>Math.abs(b.x-state.x)<1.2&&Math.abs(b.y-state.y)<1.2);if(bed){if(bed.planted){if(bed.ready){bed.planted=0;bed.ready=false;state.food+=2;state.seeds++;addXp(8,'Harvested a moonmelon.');notify('Moonmelon harvest +2 food');}else notify('Still growing — give it time');}else if(state.seeds>0){state.seeds--;bed.planted=state.day;bed.ready=false;notify('Seed planted. Rain helps it grow!');addXp(2,'Planted a seed.');}else notify('No seeds left — gather wild plants.');save();return;}notify('Find a garden bed by your camp to plant.');return;}
    if(tool===3){if(isWater(state.x,state.y)||water.some(a=>Math.abs(a.x-state.x)+Math.abs(a.y-state.y)<=1)){if(Math.random()<.68){state.fish++;state.food++;addXp(9,'Caught a skyfin.');notify('Skyfin caught! +1 fish, +1 food');}else{notify('A tug on the line... it got away.');addXp(2,'Went fishing.');}save();return;}notify('Move to the river or pond to fish.');return;}
    interact();
  }
  function interact(){if(state.dungeon){interactDungeon();return;}const plant=nearest(plants,1.65);if(plant){if(plant.type==='snap'&&plant.attack>0){state.hp=Math.max(0,state.hp-8);notify('Snapvine struck!');return;}state.berries+=2;state.seeds++;plant.ready=false;plant.regrow=5;addXp(4,'Foraged from a wild plant.');notify(plant.type==='glow'?'Glowfruit +2 · seeds +1':'Snapvine berries +2');save();return;}
    const bed=bedSpots.find(b=>Math.abs(b.x-state.x)<1.1&&Math.abs(b.y-state.y)<1.1);if(bed){state.selected=2;updateUI();useTool();return;}
    if(Math.hypot(state.x-12,state.y-15)<2&&state.home===0){notify('Build a shelter from the homestead panel.');return;}
    const portal=Math.hypot(state.x-27,state.y-10)<2.1;if(portal){state.savedPos={x:state.x,y:state.y};state.dungeon=true;state.x=24;state.y=19;state.dungeonSteps=0;monsters.splice(0,monsters.length);for(let i=0;i<5;i++)monsters.push({x:20+Math.floor(Math.random()*9),y:15+Math.floor(Math.random()*9),hp:1,level:Math.max(1,monsterLevel()+Math.floor(Math.random()*5)-2),kind:i===4?'Vault guardian':'Gloomling',aggro:true,hit:0});notify('Entered the echo vault — mine the crystal seams!');$('location').textContent='ECHO VAULT';log('Entered the Echo Vault.');save();return;}
    if(state.home>0&&Math.hypot(state.x-12,state.y-15)<2){state.hp=Math.min(100,state.hp+35);state.food=Math.max(0,state.food-1);notify('Rested at home · vitality restored');save();return;}
    notify('Nothing nearby to use. Try the axe, pickaxe, seeds or fishing rod.');
  }
  function attack(target){if(state.attackCd>0)return;state.attackCd=.45;const damage=9+state.level*1.3+(state.home?3:0);target.hp-=damage;target.aggro=true;target.hit=.18;if(target.hp<=0){const deadLevel=target.level;state.kills++;state.rep+=2;state.enemyMemory=Math.min(10,state.enemyMemory+1);const xp=12+deadLevel*2;addXp(xp,`Defeated a level ${deadLevel} ${target.kind}.`);if(Math.random()<.65){state.food++;notify(`${target.kind} down · +${xp} XP · ration recovered`);}else notify(`${target.kind} down · +${xp} XP`);if(state.dungeon&&target.kind==='Vault guardian'){state.crystals+=2;state.ore+=3;notify('VAULT GUARDIAN DOWN · rare crystal +2');}target.gone=true;save();}else notify(`Hit ${target.kind} for ${Math.floor(damage)} damage`);}
  function interactDungeon(){if(!state.dungeon)return;const crystal=state.dungeonCrystal;if(crystal&&Math.hypot(crystal.x-state.x,crystal.y-state.y)<2){state.crystals+=1;state.ore+=1;state.dungeonCrystal=null;addXp(14,'Recovered a vault crystal.');notify('Echo crystal +1 · ore +1');save();return;}if(state.x<15||state.y<13||state.x>33||state.y>27){state.dungeon=false;state.x=state.savedPos?.x??12;state.y=state.savedPos?.y??15;monsters.splice(0,monsters.length);updatePositionUI();notify('Returned to the surface.');log('Escaped the Echo Vault.');save();return;}const rock=nearest(rocks,1.6);if(rock){rock.hp=0;state.crystals++;state.ore++;addXp(12,'Mined an echo seam.');notify('Echo crystal +1 · ore +1');save();}else notify('Explore deeper. Interact at the glowing exit to leave.');}
  function buildHome(){if(state.home){notify('Shelter is already built.');return;}if(state.wood<12||state.stone<6){notify(`Need ${Math.max(0,12-state.wood)} wood & ${Math.max(0,6-state.stone)} stone to build.`);return;}state.wood-=12;state.stone-=6;state.home=1;addXp(25,'Built your first shelter.');notify('Shelter built! You can rest here.');log('Built a field shelter at the crash site.');save();updateUI();}
  function dailyUpdate(){const oldSeason=seasonIndex();state.day++;state.hour=6;state.minute=0;const newSeason=seasonIndex();if(oldSeason!==newSeason){notify(`The season shifts to ${seasonNames[newSeason].toLowerCase()}.`);log(`Season changed to ${seasonNames[newSeason]}.`);}state.weather=weatherNames[Math.floor(Math.random()*weatherNames.length)];if(state.day%28===1&&state.day>1){state.weatherTick++;notify('A new 4-week climate cycle begins.');}for(const b of bedSpots)if(b.planted&&state.day-b.planted>=2)b.ready=true;for(const t of trees)if(t.regrow>0){t.regrow--;if(t.regrow===0)t.hp=3;}for(const p of plants)if(p.regrow>0){p.regrow--;if(p.regrow===0)p.ready=true;}state.food=Math.max(0,state.food-1);if(state.food===0){state.hp=Math.max(1,state.hp-8);notify('Low rations! Find food or fish.');}else state.hp=Math.min(100,state.hp+6);for(const m of monsters){if(m.hp<=0)continue;m.level=monsterLevel();if(state.enemyMemory>2&&Math.random()<.3)m.aggro=true;}if(Math.random()<.8)worldMonsterSpawn();log(`Day ${state.day} dawn. ${state.weather} weather.`);save();updateUI();}
  function updateClock(dt){state.daySeconds+=dt;state.hour=6+Math.floor(state.daySeconds/12)%16;state.minute=Math.floor((state.daySeconds%12)/12*60/10)*10;if(state.daySeconds>=192){state.daySeconds=0;dailyUpdate();}}
  function updatePositionUI(){$('location').textContent=state.dungeon?'ECHO VAULT':(state.x>31?'RIVERBANK':state.x<8?'FERNWOOD':state.x>22&&state.y<14?'ECHO GATE':'CRASH SITE');$('coords').textContent=`X ${String(state.x).padStart(2,'0')} · Y ${String(state.y).padStart(2,'0')}`;}
  function updateUI(){const need=levelNeed();$('level').textContent=String(state.level).padStart(2,'0');$('healthFill').style.width=`${state.hp}%`;$('healthText').textContent=Math.ceil(state.hp);$('xpFill').style.width=`${Math.min(100,state.xp/need*100)}%`;$('xpText').textContent=`${state.xp} / ${need}`;$('day').textContent=String(state.day).padStart(2,'0');$('sideDay').textContent=String(state.day).padStart(2,'0');$('clock').textContent=`${String(state.hour).padStart(2,'0')}:${String(state.minute).padStart(2,'0')}`;$('season').textContent=`CYCLE ${String(Math.floor((state.day-1)/28)+1).padStart(2,'0')} · ${seasonNames[seasonIndex()]}`;$('weather').textContent=state.weather.toUpperCase();$('sideWeather').textContent=({Clear:'☀ Clear','Soft rain':'☂ Soft rain',Drizzle:'☂ Drizzle',Windy:'≈ Windy','Meteor glow':'✦ Meteor glow'})[state.weather];$('homeLevel').textContent=state.home?'LEVEL 01':'NO SHELTER';$('homeName').textContent=state.home?'Moonwood shelter':'Crash-site camp';$('homeDesc').textContent=state.home?'Rest here to recover vitality.':'A roof over your head is a good start.';$('buildBtn').textContent=state.home?'BUILT':'BUILD';$('buildBtn').disabled=!!state.home;$('rep').textContent=state.rep;$('threatName').textContent=`${state.dungeon?'Vault stalker':'Mossback scout'} · Lv ${monsterLevel()}`;$('threatStatus').textContent=state.enemyMemory>2?'The pack remembers your last visit.':'A curious shape in the grass.';updatePositionUI();
    const items=[['🪵','WOOD',state.wood],['🪨','STONE',state.stone],['🫐','BERRIES',state.berries],['🌱','SEEDS',state.seeds],['🐟','FISH',state.fish],['⛏️','ORE',state.ore],['💎','CRYSTAL',state.crystals],['🍖','RATIONS',state.food]];$('inventory').innerHTML=items.map(i=>`<div class="item-card"><span class="item-emoji">${i[0]}</span><div><b>${i[2]}</b><small>${i[1]}</small></div></div>`).join('');
    const woodPct=Math.min(100,state.wood/12*100);$('objectiveBar').style.width=state.home?'100%':`${woodPct}%`;$('objective').textContent=state.home?'Explore the Echo Vault':'Gather wood to build shelter';$('rank').textContent=state.level>50?' · ZIGGA WARDEN':state.level>20?' · TRAILBLAZER':' · OFF-WORLDER';
    document.querySelectorAll('.quick-item').forEach((b,i)=>b.classList.toggle('selected',i===state.selected));}
  $('buildBtn').addEventListener('click',buildHome);
  document.querySelectorAll('.quick-item').forEach(b=>b.addEventListener('click',()=>{state.selected=Number(b.dataset.slot);updateUI();notify(`${toolNames[state.selected]} selected`);}));
  document.querySelectorAll('[data-dir]').forEach(b=>{const dir=b.dataset.dir,delta={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[dir];b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys[dir]=true;move(...delta);});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>b.addEventListener(ev,()=>keys[dir]=false));});
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();if(b.dataset.action==='attack'){const m=nearest(monsters,2.4);if(m)attack(m);else useTool();}else useTool();}));
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys[k]=true;if(k===' '||k==='e')useTool();if(k==='f'){const m=nearest(monsters,2.4);if(m)attack(m);else useTool();}if(['1','2','3','4'].includes(k)){state.selected=Number(k)-1;updateUI();}if(k==='escape')closeModal();});window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
  let last=performance.now();
  function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;state.moveCd=Math.max(0,state.moveCd-dt);state.attackCd=Math.max(0,state.attackCd-dt);updateClock(dt);
    if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)$('toast').classList.remove('show');}
    if(state.hp<=0){state.hp=50;state.x=12;state.y=15;state.food=Math.max(0,state.food-1);notify('You were rescued by your beacon. Rations lost.');}
    const dx=(keys.d||keys.arrowright||keys.right?1:0)-(keys.a||keys.arrowleft||keys.left?1:0),dy=(keys.s||keys.arrowdown||keys.down?1:0)-(keys.w||keys.arrowup||keys.up?1:0);if(dx||dy)move(Math.sign(dx),Math.sign(dy));
    if(state.dungeon){state.dungeonSteps=(state.dungeonSteps||0)+dt;if(!state.dungeonCrystal&&state.dungeonSteps>10){state.dungeonCrystal={x:27,y:23};state.dungeonSteps=0;}}
    updateMonsters(dt);render();requestAnimationFrame(loop);}
  function updateMonsters(dt){for(const m of monsters){if(m.gone)continue;m.hit=Math.max(0,(m.hit||0)-dt);const d=Math.hypot(m.x-state.x,m.y-state.y);if(d<5)m.aggro=true;if(m.aggro&&d<7){if(d>1.1){const nx=Math.sign(state.x-m.x),ny=Math.sign(state.y-m.y);if(Math.random()<dt*1.7&&!isBlocked(m.x+nx,m.y+ny)){m.x+=nx;m.y+=ny;}}else if(Math.random()<dt*.55){state.hp=Math.max(0,state.hp-(3+m.level*.12));notify('A Zigga monster hit you!');}}}
    if(!state.dungeon&&Math.random()<dt*.014&&monsters.filter(m=>!m.gone).length<4)worldMonsterSpawn();}
  function closeModal(){$('modal').classList.add('hidden');}
  $('modalClose').addEventListener('click',closeModal);$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal();});
  $('soundBtn').addEventListener('click',()=>notify('Ambient audio is off in this build.'));
  $('inventoryToggle').addEventListener('click',()=>openModal('FIELD KIT','Your field kit',`<div class="modal-body">Wood ${state.wood} · Stone ${state.stone} · Berries ${state.berries} · Seeds ${state.seeds}<br>Fish ${state.fish} · Ore ${state.ore} · Echo crystals ${state.crystals} · Rations ${state.food}<br><br>Tip: Use the pickaxe near rocks, the axe by moonwood, seeds at your garden beds, and the rod beside water.</div>`));
  document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-nav]').forEach(n=>n.classList.remove('nav-active'));b.classList.add('nav-active');const p=b.dataset.nav;if(p==='dungeon'){if(state.dungeon){state.dungeon=false;state.x=state.savedPos?.x??12;state.y=state.savedPos?.y??15;monsters.splice(0,monsters.length);updatePositionUI();notify('Returned to the surface.');save();}else{state.x=26;state.y=11;updatePositionUI();notify('The Echo Gate is near the violet beacon. Press USE there.');save();}}else if(p==='farm')openModal('FARM','A small patch of possibility',`<div class="modal-body">Your garden has ${bedSpots.length} moonsoil beds. Select <b>Seeds</b> (3) and press USE beside an empty bed. Crops mature after two dawns. Rain gives the world a little extra life.<br><br>Harvested moonmelons restore food and grant experience.</div>`);else if(p==='log')openModal('FIELD LOG','The planet remembers',`<div class="modal-body">${state.log.length?state.log.map(a=>`<div class="log-entry"><time>DAY ${String(a.day).padStart(2,'0')}</time><span>${a.text}</span></div>`).join(''):'No field notes yet. Go explore.'}</div>`);else if(p==='map')openMap();}));
  function openModal(eyebrow,title,content){$('modalEyebrow').textContent=eyebrow;$('modalTitle').textContent=title;$('modalContent').innerHTML=content;$('modal').classList.remove('hidden');}
  function openMap(){let cells='';for(let y=0;y<7;y++)for(let x=0;x<7;x++){let e='';if(x===Math.round(state.x/WORLD_W*6)&&y===Math.round(state.y/WORLD_H*6))e='🧑‍🚀';else if(x===4&&y===2)e='✦';else if(x===3&&y===4)e='⌂';else if(y===4&&x>3)e='≈';cells+=`<div class="map-cell ${e==='🧑‍🚀'?'player':''}">${e}</div>`;}openModal('PLANETARY SURVEY','Zigga · north hemisphere',`<div class="modal-body">Mapped from your crash beacon. The Echo Gate is east of camp; the river follows the eastern lowlands.<div class="map-grid">${cells}</div>Current position: ${state.x}, ${state.y} · Surface survey ${Math.min(91,12+state.rep)}%</div>`);}
  function render(){
    const camX=state.x*T+T/2-W/2,camY=state.y*T+T/2-H/2;
    ctx.clearRect(0,0,W,H);
    if(state.dungeon)drawDungeon(camX,camY);else drawSurface(camX,camY);
    // dusk, storms and living weather alter the light over the same world.
    const hour=state.hour;const night=hour<7||hour>19; if(night){ctx.fillStyle=`rgba(18,30,57,${(hour<6||hour>20)?0.42:0.23})`;ctx.fillRect(0,0,W,H);}
    if(state.weather==='Soft rain'||state.weather==='Drizzle'){ctx.strokeStyle='#d5e5e58a';ctx.lineWidth=1;for(let i=0;i<32;i++){const x=(i*67+nowFrame*1.6)%W,y=(i*43+nowFrame*2.7)%H;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-3,y+6);ctx.stroke();}}
    if(state.weather==='Meteor glow'){ctx.fillStyle='#b9e8ff';for(let i=0;i<4;i++){const x=(i*137+nowFrame*.18)%W,y=(i*53+10)%130;ctx.fillRect(x,y,2,2);}}
    if(state.weather==='Windy'){ctx.strokeStyle='#e7e7bd77';for(let i=0;i<8;i++){const x=(i*83+nowFrame*1.3)%W,y=(i*31+20)%H;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+10,y-2);ctx.stroke();}}
    if(state.dungeon){ctx.fillStyle='rgba(82,53,117,.18)';ctx.fillRect(0,0,W,H);}
    if(state.toastTimer>0&&state.toast){$('toast').textContent=state.toast;}
  }
  let nowFrame=0;
  function drawSurface(cx,cy){
    nowFrame++;
    const sx=Math.floor(cx/T)-1,sy=Math.floor(cy/T)-1,ex=sx+Math.ceil(W/T)+3,ey=sy+Math.ceil(H/T)+3;
    // Terrain tiles and little grass pixels.
    for(let ty=sy;ty<=ey;ty++)for(let tx=sx;tx<=ex;tx++){
      const px=Math.floor(tx*T-cx),py=Math.floor(ty*T-cy);
      if(isWater(tx,ty)){ctx.fillStyle=(rnd(tx,ty,5)>.5?'#5c9b9b':'#68a8a0');ctx.fillRect(px,py,T,T);ctx.fillStyle='#99c9b2';ctx.fillRect(px+3+Math.floor(rnd(tx,ty,6)*7),py+4+Math.floor(rnd(ty,tx,4)*8),4,1);ctx.fillStyle='#4b8080';ctx.fillRect(px,py+14,T,2);continue;}
      let base='#78946f';if(rnd(tx,ty,1)>.55)base='#7c9971';if(seasonIndex()===3)base=rnd(tx,ty,1)>.55?'#9b9d76':'#8d9b74';if(seasonIndex()===2)base=rnd(tx,ty,1)>.5?'#92966c':'#86946c';
      ctx.fillStyle=base;ctx.fillRect(px,py,T,T);
      const fleck=rnd(tx,ty,2);ctx.fillStyle=seasonIndex()===1?'#a1ac71':'#91a77a';ctx.fillRect(px+2+Math.floor(fleck*10),py+3+Math.floor(rnd(ty,tx,2)*9),2,1);ctx.fillStyle='#657f64';ctx.fillRect(px+11,py+2+Math.floor(rnd(ty,tx,4)*11),1,2);
    }
    // Environmental trails around the crash site.
    for(let y=13;y<18;y++)for(let x=10;x<15;x++){const px=x*T-cx,py=y*T-cy;ctx.fillStyle='#9a9b70';ctx.fillRect(px,py,16,16);ctx.fillStyle='#a7a47a';ctx.fillRect(px+4,py+5,4,2);}
    // Camp crash pod and shelter.
    const hx=12*T-cx,hy=15*T-cy;drawPod(hx,hy);
    if(state.home)drawCabin(hx+3,hy+1);
    // Garden beds.
    for(const b of bedSpots){const px=b.x*T-cx,py=b.y*T-cy;ctx.fillStyle='#624d3b';ctx.fillRect(px+1,py+3,14,12);ctx.fillStyle='#8c7350';ctx.fillRect(px+2,py+4,12,2);ctx.fillStyle='#382f2a';ctx.fillRect(px+3,py+8,10,5);if(b.planted){ctx.fillStyle=b.ready?'#d0df68':'#78a95e';ctx.fillRect(px+7,py+4,2,b.ready?8:5);ctx.fillRect(px+4,py+6,4,2);if(b.ready){ctx.fillStyle='#f0ca69';ctx.fillRect(px+5,py+3,3,3);}}}
    // Ancient portal beacon near the northern ridge.
    const gx=27*T-cx,gy=10*T-cy;ctx.fillStyle='#443d6c';ctx.fillRect(gx+3,gy+4,10,12);ctx.fillStyle='#9f81d4';ctx.fillRect(gx+5,gy+1,6,13);ctx.fillStyle='#c5b6ec';ctx.fillRect(gx+7,gy+3,2,8);ctx.fillStyle='#e1d7ff';ctx.fillRect(gx+7,gy-1+Math.sin(nowFrame*.12)*2,2,2);
    // Tree canopy, trunk and regrowth stumps.
    for(const t of trees){if(t.x*T-cx<-24||t.x*T-cx>W+24||t.y*T-cy<-30||t.y*T-cy>H+30)continue;const px=t.x*T-cx,py=t.y*T-cy;if(t.hp>0)drawTree(px,py,rnd(t.x,t.y,9));else{ctx.fillStyle='#73533d';ctx.fillRect(px+5,py+9,6,5);ctx.fillStyle='#a77d50';ctx.fillRect(px+6,py+9,4,2);}}
    for(const r of rocks){if(r.hp<=0||r.x*T-cx<-20||r.x*T-cx>W+20||r.y*T-cy<-20||r.y*T-cy>H+20)continue;const px=r.x*T-cx,py=r.y*T-cy;ctx.fillStyle='#687576';ctx.fillRect(px+3,py+7,10,7);ctx.fillStyle='#9aaba0';ctx.fillRect(px+5,py+4,6,6);ctx.fillStyle='#c4cec0';ctx.fillRect(px+6,py+4,3,2);}
    // Forage: glowfruit and reactive snapvines.
    for(const p of plants){if(!p.ready||p.x*T-cx<-20||p.x*T-cx>W+20||p.y*T-cy<-20||p.y*T-cy>H+20)continue;const px=p.x*T-cx,py=p.y*T-cy;if(p.type==='glow'){ctx.fillStyle='#557d51';ctx.fillRect(px+7,py+7,3,7);ctx.fillStyle='#95bb62';ctx.fillRect(px+4,py+7,4,3);ctx.fillRect(px+9,py+6,4,3);ctx.fillStyle='#d1df78';ctx.fillRect(px+7,py+4,4,4);}else{ctx.fillStyle='#4f8058';ctx.fillRect(px+7,py+7,2,7);ctx.fillStyle='#74a95f';ctx.fillRect(px+2,py+8,6,3);ctx.fillRect(px+8,py+6,6,3);ctx.fillStyle='#9fc772';ctx.fillRect(px+6,py+4,4,4);}}
    for(const m of monsters){if(m.gone)continue;const px=m.x*T-cx,py=m.y*T-cy;if(px<-24||px>W+24||py<-24||py>H+24)continue;drawMonster(px,py,m);}
    drawPlayer(W/2-8,H/2-9);
    // Small weather particles and edge vignette.
  }
  function drawDungeon(cx,cy){
    const sx=Math.floor(cx/T)-1,sy=Math.floor(cy/T)-1;for(let ty=sy;ty<sy+21;ty++)for(let tx=sx;tx<sx+33;tx++){const px=tx*T-cx,py=ty*T-cy;const inside=tx>=15&&tx<=33&&ty>=13&&ty<=27;ctx.fillStyle=inside?(rnd(tx,ty,5)>.5?'#46445b':'#4b485f'):'#242c36';ctx.fillRect(px,py,T,T);if(inside){ctx.fillStyle='#65616e';ctx.fillRect(px+1,py+2,14,1);ctx.fillStyle='#393744';ctx.fillRect(px+2,py+13,11,2);}}
    // Crypt walls and pillars
    for(const [x,y] of [[17,15],[31,15],[17,25],[31,25],[24,14],[24,26]]){const px=x*T-cx,py=y*T-cy;ctx.fillStyle='#77707c';ctx.fillRect(px+2,py+1,12,15);ctx.fillStyle='#98919a';ctx.fillRect(px+4,py+1,3,12);ctx.fillStyle='#3c3948';ctx.fillRect(px,py,16,3);}
    if(state.dungeonCrystal){const x=state.dungeonCrystal.x*T-cx,y=state.dungeonCrystal.y*T-cy;ctx.fillStyle='#bb9bdf';ctx.fillRect(x+6,y+3,5,10);ctx.fillStyle='#f0dbff';ctx.fillRect(x+7,y+3,2,5);ctx.fillStyle='#805caf';ctx.fillRect(x+4,y+12,9,2);}
    // Mark the exit doorway on the western wall.
    const ex=15*T-cx,ey=19*T-cy;ctx.fillStyle='#d0b672';ctx.fillRect(ex+4,ey+2,8,14);ctx.fillStyle='#302f3e';ctx.fillRect(ex+6,ey+4,4,12);ctx.fillStyle='#f3d37e';ctx.fillRect(ex+9,ey+9,1,1);
    for(const m of monsters){if(m.gone)continue;drawMonster(m.x*T-cx,m.y*T-cy,m);}
    drawPlayer(W/2-8,H/2-9);
  }
  function drawTree(x,y,variant){
    ctx.fillStyle='#624b38';ctx.fillRect(x+6,y+8,5,9);ctx.fillStyle='#826042';ctx.fillRect(x+7,y+8,2,8);const leaf=seasonIndex()===3?'#82936d':variant>.5?'#426e4f':'#4b7951';ctx.fillStyle='#315b45';ctx.fillRect(x+2,y+5,12,8);ctx.fillRect(x+4,y+2,8,9);ctx.fillStyle=leaf;ctx.fillRect(x+2,y+4,12,6);ctx.fillRect(x+4,y+1,8,8);ctx.fillStyle='#6b9b60';ctx.fillRect(x+5,y+2,4,3);ctx.fillRect(x+1,y+7,4,2);ctx.fillStyle='#2e6147';ctx.fillRect(x+4,y+10,9,2);
  }
  function drawPod(x,y){ctx.fillStyle='#515b58';ctx.fillRect(x+3,y+7,11,8);ctx.fillStyle='#bdc7ae';ctx.fillRect(x+4,y+5,9,8);ctx.fillStyle='#718a83';ctx.fillRect(x+5,y+6,6,3);ctx.fillStyle='#e0c47b';ctx.fillRect(x+4,y+13,3,2);ctx.fillRect(x+12,y+13,3,2);ctx.fillStyle='#d08462';ctx.fillRect(x+7,y+9,3,2);}
  function drawCabin(x,y){ctx.fillStyle='#6f543d';ctx.fillRect(x,y+7,15,9);ctx.fillStyle='#9c7350';ctx.fillRect(x+1,y+6,13,3);ctx.fillStyle='#81583e';ctx.fillRect(x+3,y+2,9,6);ctx.fillStyle='#c18952';ctx.fillRect(x+2,y+5,12,2);ctx.fillStyle='#d1a063';ctx.fillRect(x+4,y+3,7,3);ctx.fillStyle='#263a39';ctx.fillRect(x+9,y+10,3,6);ctx.fillStyle='#abd0a2';ctx.fillRect(x+4,y+9,3,3);}
  function drawPlayer(x,y){
    // Facing changes the tiny visor highlight for readable movement.
    ctx.fillStyle='#26372f';ctx.fillRect(x+3,y+15,4,3);ctx.fillRect(x+9,y+15,4,3);
    ctx.fillStyle='#d7ded1';ctx.fillRect(x+3,y+7,10,9);ctx.fillStyle='#f0eee0';ctx.fillRect(x+4,y+7,8,7);ctx.fillStyle='#71877d';ctx.fillRect(x+1,y+8,3,6);ctx.fillRect(x+12,y+8,3,6);
    ctx.fillStyle='#c6d5bd';ctx.fillRect(x+4,y+1,8,7);ctx.fillStyle='#edf1df';ctx.fillRect(x+5,y,6,7);ctx.fillStyle='#567c82';ctx.fillRect(x+6,y+2,5,3);
    if(state.playerDir==='left')ctx.fillStyle='#e4f2dc';else if(state.playerDir==='right')ctx.fillStyle='#e4f2dc';else ctx.fillStyle='#a6d7ce';ctx.fillRect(state.playerDir==='left'?x+6:state.playerDir==='right'?x+9:x+7,y+3,1,1);
    ctx.fillStyle='#bb6e4a';ctx.fillRect(x+6,y+10,4,3);ctx.fillStyle='#fbcc68';ctx.fillRect(x+12,y+11,2,2);
  }
  function drawMonster(x,y,m){const hurt=m.hit>0;ctx.fillStyle='#28392f';ctx.fillRect(x+2,y+12,12,4);ctx.fillStyle=hurt?'#e98b73':m.kind.includes('Vault')?'#8a6ab1':m.kind==='Thornling'?'#557d54':'#547849';ctx.fillRect(x+3,y+6,10,8);ctx.fillRect(x+5,y+3,7,6);ctx.fillStyle='#82a267';ctx.fillRect(x+5,y+4,4,3);ctx.fillStyle='#f0d788';ctx.fillRect(x+8,y+6,2,2);ctx.fillStyle='#27332e';ctx.fillRect(x+9,y+7,1,1);ctx.fillStyle='#425f43';ctx.fillRect(x+1,y+8,4,4);ctx.fillRect(x+12,y+9,3,3);if(m.aggro){ctx.fillStyle='#e58d73';ctx.fillRect(x+7,y,3,2);} }
  if(!monsters.length){monsters.push({x:17,y:12,hp:1,level:1,kind:'Mossback',aggro:false,hit:0},{x:8,y:22,hp:1,level:1,kind:'Thornling',aggro:false,hit:0});}
  updateUI();
  log('Crash landed on Zigga. Build shelter, learn the wilds, and stay alive.');
  requestAnimationFrame(loop);
})();
