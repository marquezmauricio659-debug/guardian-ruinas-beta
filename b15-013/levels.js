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
 $('mainMenu').hidden=true;$('appSurface').hidden=true;$('cityView').hidden=true;$('levelMap').hidden=false;renderLevelMap();window.scrollTo(0,0);
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
 const citySelected=selectedMapLevel===6;
 const castle=$('castleEntry');castle.classList.toggle('selected',citySelected);castle.classList.toggle('locked',mapSlot!==4&&!progress.cityUnlocked);castle.setAttribute('aria-pressed',String(citySelected));
 const level=LEVEL_CATALOG[citySelected?4:selectedMapLevel-1];
 const completed=progress.completed.includes(selectedMapLevel);
 $('mapAction').disabled=citySelected?(mapSlot!==4&&!progress.cityUnlocked):(mapSlot!==4&&!progress.unlocked.includes(selectedMapLevel));
 $('mapAction').textContent=citySelected?'Entrar a la ciudad':mapSlot===4?'Probar nivel '+selectedMapLevel:completed?'Repetir nivel '+selectedMapLevel:'Jugar nivel '+selectedMapLevel;
 $('mapDescription').textContent=citySelected?(mapSlot===4?'Entrada de prueba a la ciudad.':'La ciudad se desbloquea al superar el nivel 5.'):(level.description+(selectedMapLevel===5?' Las heridas, el maná y los personajes caídos persisten hasta terminar el nivel.':''));
 const victory=$('levelMap').querySelector('.map-details small');
 if(victory)victory.textContent=citySelected?'CASTILLO · CIUDAD DEL REINO':(progress.cityUnlocked?'CIUDAD DESBLOQUEADA · ':'')+'NIVEL '+selectedMapLevel+' · '+level.name.toUpperCase();
 $('restoreReplay').hidden=mapSlot===4||!saved.replayBackup;
}
function selectMapLevel(id){
 const saved=readSlot(mapSlot);
 if(!saved||(mapSlot!==4&&!levelProgressFor(saved).unlocked.includes(id)))return;
 selectedMapLevel=id;renderLevelMap();
}
function selectMapCity(){if(busy)return;selectedMapLevel=6;renderLevelMap();const details=$('levelMap').querySelector('.map-details');if(details)details.scrollIntoView({behavior:'smooth',block:'center'});}
function activateMapSelection(){if(selectedMapLevel===6){enterMapCity();return;}playMapLevel();}

/* B15-013: mapa de ciudad y servicios compartidos con la campaña. */
const CITY_LOCATIONS=[
 {id:'castillo',name:'Castillo',x:73,y:9,w:12.0,h:6.4,description:'Sede del gobierno. Las misiones principales llegarán más adelante.'},
 {id:'gremio',name:'Gremio',x:88,y:26,w:12.3,h:6.3,description:'Encargos y recompensas. Próximamente.'},
 {id:'posada',name:'Posada',x:55,y:34,w:12.4,h:6.1,description:'Descanso y alojamiento. Próximamente.'},
 {id:'herreria',name:'Herrería',x:83,y:51,w:13.1,h:6.1,description:'Mejoras de armas y armaduras. Próximamente.'},
 {id:'mercado',name:'Mercado',x:45,y:43,w:12.3,h:6.1,description:'Compra pociones con tus monedas de cobre.'},
 {id:'enfermeria',name:'Enfermería',x:73,y:65,w:13.6,h:6.1,description:'Atención a personajes heridos. Próximamente.'},
 {id:'puerto',name:'Puerto',x:19,y:51,w:12.0,h:6.1,description:'Comercio marítimo y expediciones. Próximamente.'}
];
let selectedCityLocation=null;
function renderCityLocations(){
 $('cityHotspots').innerHTML=CITY_LOCATIONS.map(loc=>'<button type="button" class="city-hotspot '+(selectedCityLocation===loc.id?'selected':'')+'" style="--cx:'+loc.x+'%;--cy:'+loc.y+'%;--cw:'+loc.w+'%;--ch:'+loc.h+'%" onclick="openCityLocation(\''+loc.id+'\')" aria-pressed="'+(selectedCityLocation===loc.id)+'" aria-label="Seleccionar '+loc.name+'" title="Seleccionar '+loc.name+'"><span class="sr-only">'+loc.name+'</span></button>').join('');
 const loc=CITY_LOCATIONS.find(x=>x.id===selectedCityLocation);
 $('citySelectionTitle').textContent=loc?loc.name:'Elegí un establecimiento';
 $('citySelectionDescription').textContent=loc?loc.description:'Seleccioná una ubicación del mapa para conocer sus servicios.';
 $('cityEnter').disabled=!loc;
}
function selectCityLocation(id){if(!CITY_LOCATIONS.some(x=>x.id===id))return;selectedCityLocation=id;renderCityLocations();$('citySelectionTitle').scrollIntoView({behavior:'smooth',block:'nearest'});}
function openCityLocation(id){
 if(!CITY_LOCATIONS.some(loc=>loc.id===id))return;
 selectedCityLocation=id;
 renderCityLocations();
 enterSelectedCityBuilding();
}
function renderCityAccessList(){
 const area=$('cityAccessList');if(!area)return;
 area.innerHTML=CITY_LOCATIONS.map(loc=>'<button type="button" onclick="openCityLocation(\''+loc.id+'\')" aria-label="Entrar a '+loc.name+'">'+loc.name+'</button>').join('');
}
function enterSelectedCityBuilding(){
 const loc=CITY_LOCATIONS.find(x=>x.id===selectedCityLocation);if(!loc)return;
 $('cityBuildingTitle').textContent=loc.name;$('cityBuildingDescription').textContent=loc.description;
 $('cityBuilding').hidden=false;$('citySelection').hidden=true;$('cityBuildingServices').innerHTML='';
 if(loc.id==='mercado')renderCityShop();
 else $('cityBuildingServices').textContent='Este establecimiento todavía no ofrece servicios.';
 $('cityBuilding').scrollIntoView({behavior:'smooth',block:'start'});
}
function closeCityBuilding(){$('cityBuilding').hidden=true;$('citySelection').hidden=false;}
// B15-013: una sola unidad contable en cobre. La representación 10:1 no altera guardados.
function copperBalance(value){
 const n=Number(value);
 return Number.isSafeInteger(n)&&n>0?n:0;
}
function formatKingdomCoins(value){
 let balance=copperBalance(value);
 const diamond=Math.floor(balance/1000); balance%=1000;
 const gold=Math.floor(balance/100); balance%=100;
 const silver=Math.floor(balance/10); const copper=balance%10;
 return diamond+' diamantes · '+gold+' oros · '+silver+' platas · '+copper+' cobres';
}
function citySavedProfile(){const saved=readSlot(mapSlot);return saved?.profile||null;}
function renderCityShop(message=''){
 const p=citySavedProfile();
 if(!p){$('cityBuildingServices').textContent='No se encontró una partida para operar el Mercado.';return;}
 const stock=p.potionStock||{medium:0,large:0};
 const balance=copperBalance(p.coins);
 $('cityBuildingServices').innerHTML='<p>Saldo: <strong>'+formatKingdomCoins(balance)+'</strong> ('+balance+' cobres equivalentes)</p><p>Inventario: '+(Number(stock.medium)||0)+' medianas · '+(Number(stock.large)||0)+' grandes</p><button type="button" onclick="buyCityPotion(\'medium\')">Comprar poción mediana · 2 platas</button> <button type="button" onclick="buyCityPotion(\'large\')">Comprar poción grande · 3 platas y 5 cobres</button><p id="cityShopMessage" role="status"></p>';
 $('cityShopMessage').textContent=message;
}
function buyCityPotion(type){
 if(type!=='medium'&&type!=='large')return;
 const saved=readSlot(mapSlot);
 if(!saved||!saved.profile){$('cityShopMessage').textContent='No se encontró una partida válida.';return;}
 const price=type==='medium'?20:35,p=saved.profile;
 const balance=copperBalance(p.coins);
 if(balance<price){$('cityShopMessage').textContent='No tenés suficientes monedas.';return;}
 const stock=p.potionStock||{medium:0,large:0};
 const count=Number(stock[type])||0;
 if(!Number.isSafeInteger(count)||count<0||count>=Number.MAX_SAFE_INTEGER){$('cityShopMessage').textContent='Inventario inválido; no se realizó la compra.';return;}
 p.potionStock={...stock,[type]:count+1};
 p.coins=balance-price;
 try{
  localStorage.setItem(slotKey(mapSlot),JSON.stringify({...saved,profile:p,updatedAt:Date.now()}));
  // Sincronizar el perfil activo: persist() no debe sobrescribir una compra ya guardada.
  if(typeof activeSlot!=='undefined'&&activeSlot===mapSlot&&typeof profile!=='undefined'){
   profile.coins=p.coins;
   profile.potionStock={...p.potionStock};
  }
  renderCityShop('Compra realizada y guardada.');
 }catch(error){
  $('cityShopMessage').textContent='No se pudo guardar la compra; comprobá el almacenamiento de este dispositivo.';
 }
}

function enterMapCity(){if(busy)return;const saved=readSlot(mapSlot);if(!saved)return;if(mapSlot!==4&&!levelProgressFor(saved).cityUnlocked)return;$('levelMap').hidden=true;$('cityView').hidden=false;selectedCityLocation=null;$('cityBuilding').hidden=true;$('citySelection').hidden=false;renderCityLocations();renderCityAccessList();window.scrollTo(0,0);}
function backToCityMap(){$('cityView').hidden=true;$('levelMap').hidden=false;renderLevelMap();}
function playMapLevel(){
 if(busy||selectedMapLevel===6)return;
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
 $('cityView').hidden=true;$('levelMap').hidden=true;$('mainMenu').hidden=false;$('appSurface').hidden=true;activeSlot=0;selectedSlot=0;menuHome();window.scrollTo(0,0);
}
