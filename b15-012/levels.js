/* B15-012: cinco niveles, tres encuentros cada uno; mapa y guardados aislados de B15-011. */
const LEVEL_CATALOG=[
{id:1,name:'Ruinas del lago',description:'Ruinas junto al lago. Tres encuentros introductorios.',implemented:true,x:18.65,y:68.7},
{id:2,name:'Bosque antiguo',description:'El mismo ecosistema con combinaciones más exigentes.',implemented:true,x:35.86,y:45.7},
{id:3,name:'Cascadas de las cumbres',description:'Terreno montañoso; águilas y grandes bestias.',implemented:true,x:53.76,y:35.1},
{id:4,name:'Camino a la fortaleza',description:'Paso rocoso protegido por unidades rápidas y resistentes.',implemented:true,x:70.5,y:41.4},
{id:5,name:'Fortaleza de Varkhul',description:'Asedio final: no se restauran recursos entre encuentros.',implemented:true,x:86,y:22.3}
];
const LEVEL_ENCOUNTERS=[
[['wolf','shroom'],['fox','shroom'],['wolf','lynx']],
[['wolf','fox'],['lynx','shroom'],['wolf','lynx']],
[['bear','eagle'],['eagle','fox'],['bear','boar']],
[['boar','lynx'],['eagle','bear'],['boar','bear']],
[['boar','lynx'],['salamander','bear'],['boss','empty']]
];
function levelIdOf(n){return Math.max(1,Math.min(5,Math.floor((n-1)/3)+1))}
function levelRoundOf(n){return (n-1)%3+1}
function levelStartOf(id){return (id-1)*3+1}
function isEndOfLevel(n){return n%3===0}
let mapSlot=0,selectedMapLevel=1;
function levelBossWon(st){return !!(st?.routeVersion===3&&isEndOfLevel(st.encounter)&&st.over&&st.won&&st.enemies?.every(e=>e.hp<=0))}
function levelProgressFor(save){
 const old=save?.levelProgress||{};
 const completed=new Set((old.version===3?old.completed||[]:[]).filter(id=>Number.isInteger(id)&&id>=1&&id<=5));
 if(levelBossWon(save?.state))completed.add(levelIdOf(save.state.encounter));
 const unlocked=new Set([1]);
 for(let i=1;i<=4;i++)if(completed.has(i))unlocked.add(i+1);
 return {version:3,completed:[...completed].sort((a,b)=>a-b),unlocked:[...unlocked].sort((a,b)=>a-b),cityUnlocked:completed.has(5)};
}
function recordLevelVictory(){
 if(!activeSlot||!levelBossWon(s))return;
 const saved=readSlot(activeSlot);if(!saved)return;
 const progress=levelProgressFor({...saved,state:s});
 localStorage.setItem(slotKey(activeSlot),JSON.stringify({...saved,levelProgress:progress}));
}
function showLevelVictory(){
 if(!levelBossWon(s))return;
 const lv=levelIdOf(s.encounter),title=$('levelVictoryTitle');
 title.textContent=lv===5?'¡Varkhul derrotado! · Ciudad desbloqueada':'¡Nivel '+lv+' completado!';
 const text=$('levelVictory').querySelector('p');
 if(text)text.textContent=lv===5?'El camino a la ciudad está abierto. La recuperación del equipo se definirá más adelante.':'Superaste los tres encuentros. Se ha desbloqueado el siguiente nivel del mapa.';
 if($('modal').open)$('modal').close();
 if(!$('levelVictory').open)$('levelVictory').showModal();
}
function restoreTeamAfterFinalVictory(){
 if(!s||levelIdOf(s.encounter)!==5||!levelBossWon(s))return;
 s.fallen=[];s.party={};
 for(const id of Object.keys(classes))s.party[id]={hp:classes[id].hp,mp:classes[id].mp,poison:0};
 s.hp=klass().hp;s.mp=klass().mp;s.poison=0;s.guard=false;
 s.dead??=[]; /* registros históricos preservados */
 s.cityUnlocked=true;
}
function victoryToMap(){
 if(busy||!levelBossWon(s))return;
 const id=activeSlot;$('levelVictory').close();
 const completed=levelIdOf(s.encounter);
 if(completed===5){s.cityUnlocked=true;/* La recuperación del equipo se decidirá en una actualización posterior. */}
 persist();
 if(readSlot(id)?.replayBackup)restoreLevelReplay();
 openLevelMap(id);
}
function openPracticeMap(){if(busy)return;const id=4;let saved=readSlot(id);if(!saved){const oldSlot=activeSlot,oldProfile=profile,oldState=s;activeSlot=id;profile=defaultProfile('knight');profile.points=20;profile.practiceBudgetInitialized=true;encounter(1,false);activeSlot=oldSlot;profile=oldProfile;s=oldState;}saved=readSlot(id);if(saved&&!saved.profile.practiceBudgetInitialized){saved.profile.points=20;saved.profile.practiceBudgetInitialized=true;localStorage.setItem(slotKey(id),JSON.stringify(saved));}openLevelMap(id);}
function restartPracticeLevel(){if(busy||activeSlot!==4)return;profile.potionStock={medium:2,large:1};encounter(levelStartOf(levelIdOf(s.encounter)),false);showGame();}
function openLevelMap(id){
 if(busy||![1,2,3,4].includes(id))return;
 let saved=readSlot(id);if(!saved)return;
 const progress=levelProgressFor(saved);
 if(JSON.stringify(saved.levelProgress)!==JSON.stringify(progress)){saved={...saved,levelProgress:progress};localStorage.setItem(slotKey(id),JSON.stringify(saved));}
 mapSlot=id;
 selectedMapLevel=id===4?levelIdOf(saved.state.encounter):progress.unlocked.find(n=>!progress.completed.includes(n))||Math.max(...progress.unlocked);
 if($('modal').open)$('modal').close();
 $('mainMenu').hidden=true;$('appSurface').hidden=true;$('levelMap').hidden=false;renderLevelMap();window.scrollTo(0,0);
}
function renderLevelMap(){
 const saved=readSlot(mapSlot);if(!saved)return;
 const progress=levelProgressFor(saved);
 $('mapSaveName').textContent=mapSlot===4?'MODO PRUEBA · SIN LÍMITES':'ESPACIO '+mapSlot+' · '+saved.label;$('mapIntro').textContent=mapSlot===4?'Elegí cualquiera de los cinco niveles. Tenés 20 puntos iniciales para mejorar habilidades del equipo desde el botón Habilidades durante la prueba. Las mejoras se conservan al repetir niveles, sin alterar tus partidas.':'Un viaje entre ruinas, bosques y reinos olvidados.';
 $('levelNodes').innerHTML=LEVEL_CATALOG.map(level=>{
  const completed=progress.completed.includes(level.id),unlocked=mapSlot===4||progress.unlocked.includes(level.id),selected=selectedMapLevel===level.id;
  const status=completed?'completed':!unlocked?'locked':'available';
  const label=completed?'Completado':unlocked?'Disponible':'Bloqueado';
  return '<div class="level-stop '+status+(selected?' selected':'')+'" style="--x:'+level.x+'%;--y:'+level.y+'%"><button data-level="'+level.id+'" '+(!unlocked?'disabled':'')+' onclick="selectMapLevel('+level.id+')" aria-label="Nivel '+level.id+': '+label+'"><strong>'+level.id+'</strong><span aria-hidden="true">'+(completed?'✓':!unlocked?'🔒':'◆')+'</span></button><span class="level-label">'+level.name+'<small>'+label+'</small></span></div>';
 }).join('');
 const level=LEVEL_CATALOG[selectedMapLevel-1];
 const completed=progress.completed.includes(selectedMapLevel);
 $('mapAction').disabled=mapSlot!==4&&!progress.unlocked.includes(selectedMapLevel);
 $('mapAction').textContent=mapSlot===4?'Probar nivel '+selectedMapLevel:completed?'Repetir nivel '+selectedMapLevel:'Jugar nivel '+selectedMapLevel;
 $('mapDescription').textContent=level.description+(selectedMapLevel===5?' Las heridas, el maná y los personajes caídos persisten hasta terminar el nivel.':'');
 const victory=$('levelMap').querySelector('.map-details small');
 if(victory)victory.textContent=(progress.cityUnlocked?'CIUDAD DESBLOQUEADA · ':'')+'NIVEL '+selectedMapLevel+' · '+level.name.toUpperCase();
 $('restoreReplay').hidden=mapSlot===4||!saved.replayBackup;
}
function selectMapLevel(id){
 const saved=readSlot(mapSlot);
 if(!saved||(mapSlot!==4&&!levelProgressFor(saved).unlocked.includes(id)))return;
 selectedMapLevel=id;renderLevelMap();
}
function playMapLevel(){
 if(busy)return;
 const saved=readSlot(mapSlot);if(!saved)return;
 const progress=levelProgressFor(saved),id=selectedMapLevel;
 if(mapSlot===4){activeSlot=4;profile=structuredClone(saved.profile);profile.potionStock={medium:2,large:1};encounter(levelStartOf(id),false);$('levelMap').hidden=true;showGame();return;}if(!progress.unlocked.includes(id))return;
 /* Al cambiar de nivel, conservar una instantánea completa para que el guardado siga siendo recuperable. */
 if(progress.completed.includes(id)&&!saved.replayBackup){
  $('replayNotice').textContent='Se guardará una copia de tu partida actual antes de repetir este nivel. Podés recuperar la partida original desde el mapa.';
  $('repeatConfirm').showModal();return;
 }
 activeSlot=mapSlot;profile=structuredClone(saved.profile);s=structuredClone(saved.state);
 if(!s||s.routeVersion!==3||levelIdOf(s.encounter)!==id||s.over){encounter(levelStartOf(id),false)}
 $('levelMap').hidden=true;showGame();
}
function startLevelReplay(){
 const id=mapSlot,saved=readSlot(id);
 if(busy||!saved||saved.replayBackup||!levelProgressFor(saved).completed.includes(selectedMapLevel))return;
 $('repeatConfirm').close();
 localStorage.setItem(slotKey(id),JSON.stringify({...saved,replayBackup:{profile:structuredClone(saved.profile),state:structuredClone(saved.state),levelProgress:structuredClone(levelProgressFor(saved))},levelProgress:levelProgressFor(saved)}));
 activeSlot=id;profile=structuredClone(saved.profile);s=structuredClone(saved.state);
 encounter(levelStartOf(selectedMapLevel),false);$('levelMap').hidden=true;showGame();
}
function restoreLevelReplay(){
 const id=activeSlot||mapSlot,saved=readSlot(id);if(!saved?.replayBackup||busy)return;
 const restored={...saved,profile:saved.replayBackup.profile,state:saved.replayBackup.state,levelProgress:saved.replayBackup.levelProgress||levelProgressFor({...saved,levelProgress:null,state:saved.replayBackup.state})};
 delete restored.replayBackup;localStorage.setItem(slotKey(id),JSON.stringify(restored));
 if(activeSlot===id){profile=structuredClone(restored.profile);s=structuredClone(restored.state)}
}
function restoreReplayFromMap(){restoreLevelReplay();renderLevelMap()}
function leaveLevelMap(){
 $('levelMap').hidden=true;$('mainMenu').hidden=false;$('appSurface').hidden=true;activeSlot=0;selectedSlot=0;menuHome();window.scrollTo(0,0);
}
