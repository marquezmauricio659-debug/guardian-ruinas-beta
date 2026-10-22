// B15-004: catálogo extensible; solo el primer nivel tiene contenido jugable.
const LEVEL_CATALOG=[
 {id:1,name:'Las ruinas del lago',description:'Cinco encuentros: ruinas, bosque, montaña, fortaleza y Varkhul.',implemented:true,x:15,y:72},
 {id:2,name:'El bosque de los ecos',description:'Desbloqueado al completar el nivel 1. Contenido en desarrollo.',implemented:false,x:33,y:48},
 {id:3,name:'Las cumbres antiguas',description:'Una ruta todavía sellada.',implemented:false,x:52,y:29},
 {id:4,name:'La ciudad olvidada',description:'Sus puertas permanecen cerradas.',implemented:false,x:72,y:45},
 {id:5,name:'El último santuario',description:'El destino aguarda más allá de la niebla.',implemented:false,x:87,y:20}
];
let mapSlot=0;
function levelBossWon(state){return !!(Number.isInteger(state?.encounter)&&state.encounter>=5&&state.encounter%5===0&&state.over&&state.won&&state.enemies?.some(e=>e.role==='boss')&&state.enemies.every(e=>e.hp<=0));}
function levelProgressFor(save){
 const old=save?.levelProgress||{};
 const completed=new Set((old.completed||[]).filter(Number.isInteger));
 // Las rutas antiguas posteriores al jefe acreditan una victoria anterior, sin reiniciarlas.
 if(levelBossWon(save?.state)||(save?.state?.routeVersion===2&&save.state.encounter>5))completed.add(1);
 const unlocked=new Set([1,...(old.unlocked||[]).filter(Number.isInteger)]);
 if(completed.has(1))unlocked.add(2);
 return {...old,version:1,completed:[...completed].sort((a,b)=>a-b),unlocked:[...unlocked].sort((a,b)=>a-b)};
}
function recordLevelVictory(){
 if(!activeSlot||!levelBossWon(s))return;
 const saved=readSlot(activeSlot);if(!saved)return;
 const progress=levelProgressFor({...saved,state:s});
 localStorage.setItem(slotKey(activeSlot),JSON.stringify({...saved,levelProgress:progress}));
}
function showLevelVictory(){
 if(!levelBossWon(s))return;
 if($('modal').open)$('modal').close();
 if(!$('levelVictory').open)$('levelVictory').showModal();
}
function victoryToMap(){if(busy||!levelBossWon(s))return;const id=activeSlot;$('levelVictory').close();if(readSlot(id)?.replayBackup)restoreLevelReplay();else persist();openLevelMap(id);}
function openLevelMap(id){
 if(busy||![1,2,3].includes(id))return;
 let saved=readSlot(id);if(!saved)return;
 const progress=levelProgressFor(saved);
 if(JSON.stringify(saved.levelProgress)!==JSON.stringify(progress)){saved={...saved,levelProgress:progress};localStorage.setItem(slotKey(id),JSON.stringify(saved));}
 if($('modal').open)$('modal').close();
 mapSlot=id;$('mainMenu').hidden=true;$('appSurface').hidden=true;$('levelMap').hidden=false;renderLevelMap();window.scrollTo(0,0);
}
function renderLevelMap(){
 const saved=readSlot(mapSlot);if(!saved)return;
 const progress=levelProgressFor(saved);
 $('mapSaveName').textContent='ESPACIO '+mapSlot+' · '+saved.label;
 $('levelNodes').innerHTML=LEVEL_CATALOG.map(level=>{
  const completed=progress.completed.includes(level.id),unlocked=progress.unlocked.includes(level.id);
  const status=completed?'completed':!unlocked?'locked':level.implemented?'available':'unbuilt';
  const labels={completed:'Completado',locked:'Bloqueado',available:'Disponible',unbuilt:'Desbloqueado · Próximamente'};
  return '<div class="level-stop '+status+'" style="--x:'+level.x+'%;--y:'+level.y+'%"><button data-level="'+level.id+'" '+(!unlocked||!level.implemented?'disabled':'')+' onclick="selectMapLevel('+level.id+')" aria-label="Nivel '+level.id+': '+labels[status]+'"><strong>'+level.id+'</strong><span aria-hidden="true">'+(completed?'✓':!unlocked?'🔒':!level.implemented?'⌛':'◆')+'</span></button><span class="level-label">Nivel '+level.id+'<small>'+labels[status]+'</small></span></div>';
 }).join('');
 $('mapAction').textContent=saved.replayBackup?'Continuar repetición':progress.completed.includes(1)?'Repetir nivel 1':'Continuar nivel 1';
 $('mapDescription').textContent=saved.replayBackup?'Hay una repetición de práctica en curso. Tu partida original sigue respaldada.':progress.completed.includes(1)?'Nivel 1 completado. El nivel 2 está desbloqueado, pero todavía no tiene contenido jugable. Podés repetir el nivel 1 en modo práctica sin reemplazar tu partida.':LEVEL_CATALOG[0].description+' Tu partida actual se conserva al abrir este mapa.';
 if(saved.state.encounter>5&&!saved.replayBackup)$('mapDescription').textContent+=' Tu partida histórica está en el encuentro '+saved.state.encounter+'. Podés retomarla desde Continuar partida; este mapa no la reinicia.';
 $('restoreReplay').hidden=!saved.replayBackup;
}
function selectMapLevel(id){const level=LEVEL_CATALOG.find(l=>l.id===id),saved=readSlot(mapSlot);if(!level?.implemented||!levelProgressFor(saved).unlocked.includes(id))return;$('mapAction').focus({preventScroll:true});}
function playMapLevel(){
 if(busy)return;const saved=readSlot(mapSlot);if(!saved)return;
 const progress=levelProgressFor(saved);
 if(!progress.unlocked.includes(1)||!LEVEL_CATALOG.find(l=>l.id===1)?.implemented)return;
 if(progress.completed.includes(1)&&!saved.replayBackup){
  $('replayNotice').textContent='Se conserva una copia completa de la partida del espacio '+mapSlot+'. La repetición no acumula monedas, objetos ni mejoras en la partida original. Podés volver a ella en cualquier momento desde el mapa.';
  $('repeatConfirm').showModal();return;
 }
 $('levelMap').hidden=true;continueSlot(mapSlot);
}
function startLevelReplay(){
 const id=mapSlot,saved=readSlot(id);if(busy||!saved||saved.replayBackup||!levelProgressFor(saved).completed.includes(1))return;
 $('repeatConfirm').close();
 localStorage.setItem(slotKey(id),JSON.stringify({...saved,replayBackup:{profile:structuredClone(saved.profile),state:structuredClone(saved.state)},levelProgress:levelProgressFor(saved)}));
 activeSlot=id;profile=structuredClone(saved.profile);s=structuredClone(saved.state);encounter(1);$('levelMap').hidden=true;showGame();
}
function restoreLevelReplay(){
 const id=activeSlot||mapSlot,saved=readSlot(id);if(!saved?.replayBackup||busy)return;
 const restored={...saved,profile:saved.replayBackup.profile,state:saved.replayBackup.state};delete restored.replayBackup;
 localStorage.setItem(slotKey(id),JSON.stringify(restored));
 if(activeSlot===id){profile=structuredClone(restored.profile);s=structuredClone(restored.state);}
}
function restoreReplayFromMap(){restoreLevelReplay();renderLevelMap();}
function leaveLevelMap(){
 $('levelMap').hidden=true;$('mainMenu').hidden=false;$('appSurface').hidden=true;activeSlot=0;selectedSlot=0;menuHome();window.scrollTo(0,0);
}
