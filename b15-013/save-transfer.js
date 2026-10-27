/* B15-013: respaldos portables, compatibles con B15-012. */
(function(){
'use strict';
const FORMAT='guardian-ruinas-b15-013', LIMIT=2*1024*1024;
const byId=id=>document.getElementById(id);
function status(msg){const el=byId('transferStatus');if(el)el.textContent=msg;}
function validSlot(d){
 if(!d||typeof d!=='object'||Array.isArray(d)||!d.profile||!d.state)return false;
 const p=d.profile,s=d.state;
 if(!['knight','archer','ninja'].includes(p.classId)||!p.skills||typeof p.skills!=='object')return false;
 if(!['knight','archer','ninja'].every(k=>{const x=p.skills[k];return x&&Number.isInteger(x.equipped)&&x.equipped>=0&&x.equipped<3&&Array.isArray(x.levels)&&x.levels.length===3&&x.levels.every(v=>Number.isInteger(v)&&v>=1&&v<=3)}))return false;
 if(!Number.isInteger(s.encounter)||s.encounter<1||s.encounter>15||s.routeVersion!==3||!Array.isArray(s.enemies)||s.enemies.length<1||s.enemies.length>2)return false;
 if(!Number.isFinite(s.hp)||!Number.isFinite(s.mp)||typeof s.won!=='boolean'||typeof s.over!=='boolean')return false;
 if(d.levelProgress&&(!Array.isArray(d.levelProgress.completed)||!Array.isArray(d.levelProgress.unlocked)))return false;
 if(d.replayBackup&&!validSlot({profile:d.replayBackup.profile,state:d.replayBackup.state,levelProgress:d.replayBackup.levelProgress}))return false;
 return true;
}
function download(){
 try{
  const slot=Number(byId('transferSlot').value);
  const saved=readSlot(slot);
  if(!saved){status('El espacio '+slot+' está vacío.');return;}
  const data={format:FORMAT,formatVersion:1,exportedAt:new Date().toISOString(),slot,data:saved};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='guardian-b15-013-espacio-'+slot+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  status('Respaldo del espacio '+slot+' generado. Conservá el archivo JSON.');
 }catch(e){status('No se pudo descargar el respaldo: '+e.message)}
}
async function upload(input){
 const file=input.files&&input.files[0];if(!file)return;
 try{
  if(file.size>LIMIT)throw Error('El archivo supera el máximo de 2 MB.');
  const data=JSON.parse(await file.text());
  if(![FORMAT,'guardian-ruinas-b15-012'].includes(data.format)||data.formatVersion!==1||!validSlot(data.data))throw Error('Archivo incompatible o estructura de partida inválida.');
  if(busy)throw Error('No se puede importar durante una acción de combate.');
  const slot=Number(byId('transferSlot').value);
  if(![1,2,3].includes(slot))throw Error('Espacio de destino inválido.');
  const existing=readSlot(slot);
  if(existing&&!confirm('El espacio '+slot+' ya tiene una partida. ¿Reemplazarla con el respaldo? Esta operación no se puede deshacer.')){status('Importación cancelada.');return;}
  const restored=structuredClone(data.data);
  restored.version=1;restored.updatedAt=Date.now();
  // Conservar todos los datos válidos, incluidos progreso y replayBackup.
  localStorage.setItem(slotKey(slot),JSON.stringify(restored));
  if(activeSlot===slot){profile=restored.profile;s=restored.state;render();}
  renderSlots();
  status('Partida importada en el espacio '+slot+' (encuentro '+restored.state.encounter+').');
 }catch(e){status('No se importó ningún dato: '+e.message)}
 finally{input.value='';}
}
window.downloadPortableSave=download;
window.importPortableSave=upload;
})();
