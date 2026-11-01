// B15-003: modal compartido por PC y celular; no cambia el estado del juego.
const skillsDialog=document.getElementById('skillsDialog');
let skillsOpener=null;
let skillsScroll={x:0,y:0};
function openSkillsPanel(){
  if(!activeSlot||skillsDialog.open)return;
  skillsOpener=document.activeElement;
  skillsScroll={x:window.scrollX,y:window.scrollY};
  document.body.classList.add('skills-open');
  skillsDialog.showModal();
}
function closeSkillsPanel(){if(skillsDialog.open)skillsDialog.close();}
// El cierre nativo con Escape también recorre esta restauración.
skillsDialog.addEventListener('close',()=>{
  document.body.classList.remove('skills-open');
  skillsOpener?.focus({preventScroll:true});
  window.scrollTo({left:skillsScroll.x,top:skillsScroll.y,behavior:'instant'});
});
function partyCardState(k){
 const c=classes[k],active=k===profile.classId,st=active?{hp:s.hp,mp:s.mp,poison:s.poison}:s.party?.[k];
 const dead=(s.fallen||[]).includes(k)||(st?.hp===0);
 const hp=dead?0:(st?.hp??c.hp),mp=st?.mp??c.mp,poison=st?.poison||0;
 return {active,dead,hp,mp,poison,health:dead?'Muerto':hp<=c.hp*.3?'Herido grave':hp<c.hp?'Herido':'Sin heridas',disabled:busy||dead||active||(s.over&&!s.won)};
}
function renderPartyCards(){
 document.getElementById('partyCards').innerHTML=Object.entries(classes).map(([k,c])=>{
 const t=partyCardState(k);
 return `<button class="party-card ${t.dead?'party-dead':''} ${t.active?'party-active':''}" onclick="selectPartyCharacter('${k}')" ${t.disabled?'disabled':''} aria-label="${c.short}: ${t.health}, ${t.hp} de ${c.hp} vida"><img src="${k==='ninja'?'ninja-seleccion.webp':`selection-${k}.png`}" alt="${c.short} en pose de selección"><div class="party-info"><h3>${c.short}</h3><p>${t.dead?'NO DISPONIBLE':t.active?'ACTIVO':'EN RESERVA'} · ${t.health}</p><label>Vida ${t.hp} / ${c.hp}</label><div class="party-meter"><i style="width:${t.hp/c.hp*100}%"></i></div><label>Maná ${t.mp} / ${c.mp}</label><div class="party-meter party-mana"><i style="width:${t.mp/c.mp*100}%"></i></div>${t.poison?'<p class="poison-label">Envenenado · '+t.poison+' turnos</p>':''}<span>${t.dead?'Personaje muerto':t.active?'Personaje actual':busy?'Esperá tu turno':s.over&&!s.won?'Partida terminada':'Seleccionar →'}</span></div></button>`;
 }).join('');
}
function openPartyPanel(){if(!activeSlot)return;renderPartyCards();document.getElementById('partyDialog').showModal();}
function closePartyPanel(){document.getElementById('partyDialog').close();}
function selectPartyCharacter(k){if(!classes[k]||partyCardState(k).disabled)return;changeClass(k);closePartyPanel();}
