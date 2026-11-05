'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const device = process.env.TEST_DEVICE === 'mobile' ? 'mobile' : 'desktop';
const url = process.env.TEST_URL || 'https://marquezmauricio659-debug.github.io/guardian-ruinas-beta/b15-013-caza-real/';
const dir = path.resolve('test-results/b15-013', device);
fs.mkdirSync(dir, { recursive: true });
const checks = [];
const errors = [];
let browser;
let page;
const check = async (name, fn) => {
  try { await fn(); checks.push({ name, status: 'PASS' }); console.log('PASS', name); }
  catch (error) { checks.push({ name, status: 'FAIL', error: String(error) }); console.error('FAIL', name, error); }
};
const ready = async () => {
  await page.waitForFunction(() => typeof openPracticeMap === 'function' && typeof window.__startHuntCombatTest === 'function', null, { timeout: 20000 });
};
const openPractice = async () => {
  await page.evaluate(() => {
    if (document.getElementById('huntLootDialog')?.open) closeHuntLoot();
    if (document.getElementById('cityView') && !document.getElementById('cityView').hidden) backToCityMap();
    openPracticeMap();
  });
  await page.locator('#levelMap').waitFor({ state: 'visible' });
};
(async () => {
 try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: device === 'mobile' ? { width: 390, height: 844 } : { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    isMobile: device === 'mobile',
    hasTouch: device === 'mobile'
  });
  page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.setDefaultTimeout(12000);
  await check('Página experimental y scripts cargan', async () => {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    assert(response && response.ok(), 'HTTP ' + (response && response.status()));
    await ready();
    assert(await page.locator('#mainMenu').isVisible());
  });
  await check('Mapa de práctica abre sin tocar partidas reales', async () => {
    await openPractice();
    assert(await page.locator('#levelMap').isVisible());
    assert.equal(await page.locator('#levelNodes button[data-level]').count(), 5);
  });
  await check('Ciudad usa imagen definitiva, con 7 recuadros y acceso directo', async () => {
    await page.evaluate(() => enterMapCity());
    assert(await page.locator('#cityView').isVisible());
    const image = page.locator('.city-scene img');
    await image.evaluate(img => img.decode());
    const data = await image.evaluate(img => ({ src: img.currentSrc, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }));
    assert(data.naturalWidth > 500 && data.naturalHeight > 300, 'imagen no cargada: ' + JSON.stringify(data));
    assert(data.src.includes('file_00000000cc30820eb3ca15d822e7785a.png'), 'ilustración provisional en ciudad');
    assert.equal(await page.locator('.city-hotspot').count(), 7);
    assert.equal(await page.locator('#cityAccessList button').count(), 7);
    await page.screenshot({ path: path.join(dir, 'ciudad.png'), fullPage: true });
  });
  await check('7 recuadros clicables aun con marcos visibles', async () => {
    await page.locator('#cityShowAllFrames').click();
    for (const name of ['Castillo','Gremio','Posada','Herrería','Mercado','Enfermería','Puerto']) {
      const hotspot = page.locator('.city-hotspot', { has: page.locator('span.sr-only', { hasText: name }) });
      await hotspot.click({ timeout: 12000 });
      assert.equal((await page.locator('#cityBuildingTitle').innerText()).trim(), name);
      await page.locator('#cityBuilding > button').click();
      assert(await page.locator('#citySelection').isVisible());
    }
  });
  await check('7 accesos directos conservados', async () => {
    for (const name of ['Castillo','Gremio','Posada','Herrería','Mercado','Enfermería','Puerto']) {
      await page.locator('#cityAccessList button', { hasText: name }).click();
      assert.equal((await page.locator('#cityBuildingTitle').innerText()).trim(), name);
      await page.locator('#cityBuilding > button').click();
    }
  });
  await check('Mercado muestra precios, inventario y saldo sin errores', async () => {
    await page.locator('#cityAccessList button', { hasText: 'Mercado' }).click();
    assert(await page.locator('#cityBuildingServices').innerText().then(t => t.includes('Saldo:') && t.includes('Inventario:')));
    assert.equal(await page.locator('#cityBuildingServices button').count(), 2);
    await page.screenshot({ path: path.join(dir, 'mercado.png'), fullPage: true });
    await page.locator('#cityBuilding > button').click();
    await page.evaluate(() => backToCityMap());
  });
  await check('Caza inicia con 3 enemigos y permite ataque', async () => {
    await openPractice();
    const started = await page.evaluate(() => window.__startHuntCombatTest());
    assert.equal(started, true);
    assert.equal(await page.locator('#huntThird').count(), 1);
    assert(await page.locator('#appSurface').isVisible());
    const state = await page.evaluate(() => ({ round: s.huntRound, n: s.enemies.length, hunt: s.huntTest, slots: activeSlot }));
    assert.equal(state.round, 1); assert.equal(state.n, 3); assert.equal(state.hunt, true);
    await page.screenshot({ path: path.join(dir, 'caza.png'), fullPage: true });
    await page.locator('#attack').click();
    await page.waitForFunction(() => typeof busy !== 'undefined' && !busy, { timeout: 20000 });
  });
  await check('Cada criatura derrotada otorga material, no cobre', async () => {
    const data = await page.evaluate(() => {
      const before = profile.coins;
      s.enemies.forEach(e => { e.hp = 0; awardKill(e); });
      return { before, after: profile.coins, loot: s.huntLoot };
    });
    assert.equal(data.after, data.before);
    assert.equal(data.loot.wolf, 1); assert.equal(data.loot.fox, 1); assert.equal(data.loot.lynx, 1);
  });
  await check('Retirada muestra botín, imágenes y vuelve al mapa', async () => {
    await page.evaluate(() => { s.over = false; s.won = false; retreatHunt(); });
    assert(await page.locator('#huntLootDialog').isVisible());
    assert.equal(await page.locator('.hunt-loot-card').count(), 3);
    for (const img of await page.locator('.hunt-loot-card img').all()) {
      await img.evaluate(element => element.decode());
      assert((await img.evaluate(element => element.naturalWidth)) > 0);
    }
    await page.screenshot({ path: path.join(dir, 'botin-retirada.png'), fullPage: true });
    await page.locator('#huntLootDialog button').click();
    assert(await page.locator('#levelMap').isVisible());
  });
  await check('Botín permanece entre encuentros y victoria muestra resumen', async () => {
    await openPractice();
    assert(await page.evaluate(() => window.__startHuntCombatTest()));
    const rounds = await page.evaluate(() => {
      s.enemies.forEach(e => { e.hp = 0; awardKill(e); });
      s.won = true; s.over = true;
      nextEncounter();
      const second = { round: s.huntRound, loot: { ...s.huntLoot } };
      s.enemies.forEach(e => { e.hp = 0; awardKill(e); });
      s.won = true; s.over = true;
      nextEncounter();
      const third = { round: s.huntRound, loot: { ...s.huntLoot } };
      s.enemies.forEach(e => { e.hp = 0; awardKill(e); });
      s.won = true; s.over = true;
      nextEncounter();
      return { second, third };
    });
    assert.equal(rounds.second.round, 2);
    assert.equal(rounds.third.round, 3);
    assert.equal(rounds.second.loot.wolf, 1);
    assert.equal(rounds.third.loot.wolf, 2);
    assert(await page.locator('#huntLootDialog').isVisible());
    assert.equal(await page.locator('.hunt-loot-card').count(), 4);
    await page.screenshot({ path: path.join(dir, 'botin-victoria.png'), fullPage: true });
    await page.locator('#huntLootDialog button').click();
    assert(await page.locator('#levelMap').isVisible());
  });
  await check('Catálogos íntegros: 5 niveles, bestiario, 3 héroes y 7 edificios', async () => {
    const data=await page.evaluate(() => ({
      levels: LEVEL_CATALOG.map(x=>({id:x.id,name:x.name})),
      enemies:Object.entries(roster).map(([id,x])=>({id,hp:x.hp,attack:x.attack,name:x.name})),
      heroes:Object.keys(classes),
      cities:CITY_LOCATIONS.map(x=>({id:x.id,name:x.name,x:x.x,y:x.y,w:x.w,h:x.h})),
      hunts:[1,2,3].map(round=>huntEnemies(round).map(x=>x.art)),
      materialKeys:Object.keys(HUNT_LOOT)
    }));
    assert.deepEqual(data.levels.map(x=>x.id),[1,2,3,4,5]);
    assert.deepEqual(data.heroes.sort(),['archer','knight','ninja']);
    assert.equal(data.cities.length,7);
    assert.equal(new Set(data.cities.map(x=>x.id)).size,7);
    for(const city of data.cities) {
      assert(city.name && city.w>0 && city.h>0 && city.x>=0 && city.x<=100 && city.y>=0 && city.y<=100);
    }
    assert(data.enemies.length>=4);
    for(const enemy of data.enemies.filter(x=>x.id!=='empty')) assert(enemy.id&&enemy.name&&Number.isFinite(enemy.hp)&&enemy.hp>0);
    assert(data.enemies.some(x=>x.id==='empty'&&x.hp===0),'Debe conservarse el marcador técnico de encuentro vacío');
    assert.deepEqual(data.hunts.map(x=>x.length),[3,3,3]);
    assert.deepEqual(data.materialKeys.sort(),['boar','fox','lynx','wolf']);
  });
  await check('Habilidades de 3 héroes: equipar, mejorar, modal y cambio', async () => {
    await openPractice();
    await page.evaluate(() => window.__startHuntCombatTest());
    const data=await page.evaluate(() => {
      profile.points=12;
      const before=profile.points;
      openSkillsPanel();
      const opened=document.getElementById('skillsDialog').open;
      improveSkill(0);equipSkill(1);
      const knight={levels:[...profile.skills.knight.levels],equipped:profile.skills.knight.equipped};
      closeSkillsPanel();
      openPartyPanel();
      const partyOpen=document.getElementById('partyDialog').open;
      selectPartyCharacter('archer');
      improveSkill(1);equipSkill(2);
      const archer={levels:[...profile.skills.archer.levels],equipped:profile.skills.archer.equipped};
      changeClass('ninja');improveSkill(2);equipSkill(1);
      const ninja={levels:[...profile.skills.ninja.levels],equipped:profile.skills.ninja.equipped};
      return {opened,partyOpen,before,after:profile.points,knight,archer,ninja,active:profile.classId,partyClosed:!document.getElementById('partyDialog').open};
    });
    assert(data.opened&&data.partyOpen&&data.partyClosed);
    assert.equal(data.after,data.before-3);
    assert.equal(data.knight.equipped,1);assert.equal(data.knight.levels[0],2);
    assert.equal(data.archer.equipped,2);assert.equal(data.archer.levels[1],2);
    assert.equal(data.ninja.equipped,1);assert.equal(data.ninja.levels[2],2);
    assert.equal(data.active,'ninja');
    await page.screenshot({path:path.join(dir,'habilidades-equipo.png'),fullPage:true});
    await page.evaluate(() => retreatHunt());
    await page.locator('#huntLootDialog button').click();
  });
  await check('Compra real: descuenta 20 cobres, suma una poción y persiste', async () => {
    await openPractice();
    const result=await page.evaluate(() => {
      const saved=readSlot(4);
      saved.profile.coins=100;
      saved.profile.potionStock={medium:2,large:1};
      localStorage.setItem(slotKey(4),JSON.stringify(saved));
      enterMapCity();openCityLocation('mercado');
      buyCityPotion('medium');
      const after=readSlot(4).profile;
      const message=document.getElementById('cityShopMessage').textContent;
      return {coins:after.coins,medium:after.potionStock.medium,large:after.potionStock.large,message};
    });
    assert.equal(result.coins,80);
    assert.equal(result.medium,3);
    assert.equal(result.large,1);
    assert.match(result.message,/guardada/i);
    await page.reload({waitUntil:'domcontentloaded'});await ready();
    const persisted=await page.evaluate(() => readSlot(4).profile);
    assert.equal(persisted.coins,80);assert.equal(persisted.potionStock.medium,3);
  });
  await check('Guardar/exportar/importar partida y rechazar JSON inválido', async () => {
    const data=await page.evaluate(() => {
      const p=defaultProfile('knight');
      const saved=readSlot(4);
      localStorage.setItem(slotKey(1),JSON.stringify({...saved,profile:p,label:'Automática',state:{...saved.state,enemies:saved.state.enemies.slice(0,2)}}));
      showSlots('continue');document.getElementById('transferSlot').value='1';
      return readSlot(1).label;
    });
    assert.equal(data,'Automática');
    const [download]=await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(()=>downloadPortableSave())
    ]);
    assert.match(download.suggestedFilename(),/espacio-1\.json/);
    const filename=path.join(dir,'partida-prueba.json');
    await download.saveAs(filename);
    const exported=JSON.parse(fs.readFileSync(filename,'utf8'));
    assert.equal(exported.format,'guardian-ruinas-b15-012');
    assert.equal(exported.data.label,'Automática');
    await page.evaluate(() => {localStorage.removeItem(slotKey(1));});
    await page.locator('input[type=file][accept*="json"]').setInputFiles(filename);
    await page.waitForFunction(()=>document.getElementById('transferStatus').textContent.includes('importada'));
    assert.equal(await page.evaluate(()=>readSlot(1).label),'Automática');
    const bad=path.join(dir,'invalido.json');
    fs.writeFileSync(bad,'{"incorrecto":true}');
    await page.locator('input[type=file][accept*="json"]').setInputFiles(bad);
    await page.waitForFunction(()=>document.getElementById('transferStatus').textContent.includes('No se importó'));
    assert.equal(await page.evaluate(()=>readSlot(1).label),'Automática');
  });
  await check('Derrota total: sin materiales y regreso al mapa', async () => {
    await openPractice();
    assert(await page.evaluate(()=>window.__startHuntCombatTest()));
    await page.evaluate(() => {
      s.huntLoot={wolf:1};
      s.fallen=['knight','archer'];
      profile.classId='ninja';
      s.hp=0;s.over=false;s.won=false;
      outcome();
      finishHuntLoot('defeat');
    });
    assert(await page.locator('#huntLootDialog').isVisible());
    assert.equal(await page.locator('.hunt-loot-card').count(),0);
    await page.locator('#huntLootDialog button').click();
    assert(await page.locator('#levelMap').isVisible());
  });
  await check('Aislamiento de guardado: la caza no modifica la campaña', async () => {
    await openPractice();
    const result=await page.evaluate(()=>{
      const before=localStorage.getItem(slotKey(4));
      window.__startHuntCombatTest();
      awardKill(s.enemies[0]);
      persist();
      const during=localStorage.getItem(slotKey(4));
      retreatHunt();
      const after=localStorage.getItem(slotKey(4));
      return {before,during,after};
    });
    assert.equal(result.during,result.before);
    assert.equal(result.after,result.before);
    await page.locator('#huntLootDialog button').click();
  });
  await check('No hay excepciones JavaScript', async () => assert.deepEqual(errors, []));
 } catch (error) {
  checks.push({ name: 'Infraestructura / ejecución', status: 'FAIL', error: String(error) });
  console.error(error);
 } finally {
  if(page) { try { await page.screenshot({ path: path.join(dir,'estado-final.png'), fullPage: true }); } catch {} }
  if(browser) await browser.close();
  const summary = { date: new Date().toISOString(), device, url, checks, errors, passed: checks.filter(x=>x.status==='PASS').length, failed: checks.filter(x=>x.status==='FAIL').length };
  fs.writeFileSync(path.join(dir,'resultado.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify({ device, passed: summary.passed, failed: summary.failed }));
  if(summary.failed) process.exitCode = 1;
 }
})();
