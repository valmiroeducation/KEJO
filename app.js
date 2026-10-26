/*
 KENTTÄTYÖASEMA v3.0 — epävirallinen KEJO-tyyppinen käyttöliittymämalli
 Ei viranomaisten käyttöön, ei tuotantotehtäviin, ei ERICA/KEJO/VIRVE-integraatiota.
 Demotiedot kuvitteellisia. Julkiset yksikkötunnusesimerkit eivät kuvaa reaaliaikaista valmiutta.
 Kartan Syke-syvyysaineisto ei ole navigointiin soveltuva virallinen merikartta.
*/
(() => {
'use strict';
const DATA = window.KEJO_DATA;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const STORAGE = 'kenttatyoasema_v3_2026';
const agencies = {pelastus:'Pelastustoimi',ensihoito:'Ensihoito',poliisi:'Poliisi'};
const statuses = {free:'Vapaa',alerted:'Hälytetty',enroute:'Matkalla',onscene:'Kohteessa',busy:'Varattu',unavailable:'Ei käytettävissä'};
const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const formatClock = stamp => new Date(stamp).toLocaleTimeString('fi-FI',{hour:'2-digit',minute:'2-digit'});
const formatDate = stamp => new Date(stamp).toLocaleString('fi-FI');
const timeOffset = minutes => new Date(Date.now() - minutes * 60000).toISOString();
const makeId = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const validPos = (lat,lng) => Number.isFinite(+lat) && Number.isFinite(+lng) && +lat >= -90 && +lat <= 90 && +lng >= -180 && +lng <= 180 && String(lat).trim()!=='' && String(lng).trim()!=='';
const center = [62.6047,29.7597];
const defaults = () => {
  const units = DATA.baseUnits.map((item,index) => ({
    ...structuredClone(item), id:makeId('U'), status:index===1?'onscene':index===0?'enroute':'free',
    taskId:null, createdAt:timeOffset(34-index)
  }));
  const incidents = [
    {id:'T-2026-1001',createdAt:timeOffset(31),agency:'pelastus',code:'402',title:'Rakennuspalo: keskisuuri',priority:'A',address:'Kauppakatu, Joensuu (kuvitteellinen)',lat:62.6018,lng:29.7630,status:'active',description:'Mallitehtävä: savua rakennuksen yläkerroksessa.', commander:'',notes:''},
    {id:'T-2026-1002',createdAt:timeOffset(20),agency:'ensihoito',code:'703',title:'Hengitysvaikeus',priority:'B',address:'Noljakka, Joensuu (kuvitteellinen)',lat:62.6198,lng:29.7197,status:'active',description:'Mallitehtävä ilman todellisia potilastietoja.',commander:'',notes:''},
    {id:'T-2026-1003',createdAt:timeOffset(10),agency:'pelastus',code:'422',title:'Maastopalo: keskisuuri',priority:'B',address:'Reijola, Joensuu (kuvitteellinen)',lat:62.5529,lng:29.8051,status:'active',description:'Mallitehtävä: palo metsän reunassa.',commander:'',notes:''}
  ];
  units[1].taskId = incidents[2].id;
  units[0].taskId = incidents[0].id;
  return {
    incidents, units,
    events:[
      {id:makeId('L'),at:timeOffset(31),target:incidents[0].id,text:'Tehtävä vastaanotettu (mallitieto)'},
      {id:makeId('L'),at:timeOffset(20),target:incidents[1].id,text:'Tehtävä vastaanotettu (mallitieto)'},
      {id:makeId('L'),at:timeOffset(12),target:units[1].call,text:`Yksikkö liitetty tehtävään ${incidents[2].id}`}
    ],
    features:[],
    selected:{kind:'incident',id:incidents[0].id},
    agencyFilter:'all', showClosed:false, freeOnly:false, search:'', logSearch:'',
    detailTab:'general',mainTab:'situation',
    mapSettings:{base:'topo',hillshade:false,contours:true,depthAreas:false,depthLines:false,depthPoints:false,seamarks:false,annotations:true,opacity:75,showTasks:true,showUnits:true},
    mapCenter:center,mapZoom:11
  };
};
function safeLoad(){
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE));
    if(!raw || !Array.isArray(raw.units) || !Array.isArray(raw.incidents) || !Array.isArray(raw.events)) return defaults();
    return {...defaults(),...raw,mapSettings:{...defaults().mapSettings,...(raw.mapSettings||{})}};
  } catch {return defaults();}
}
let S = safeLoad();
let map, baseLayers={}, overlayLayers={}, selectedBase, markers={units:null,incidents:null,features:null};
let modalKind=null, editId=null, pointerMode=null, measurePoints=[], measureObjects=[];
let toastTimer=null, latestPointer=null;
function persist() {
  if(map){const c=map.getCenter();S.mapCenter=[c.lat,c.lng];S.mapZoom=map.getZoom();}
  try {localStorage.setItem(STORAGE,JSON.stringify(S));}
  catch {notify('Tallennus ei onnistunut. Tarkista selaimen tallennustilan asetukset.');}
}
function notify(message) {
  $('#systemStatus').textContent=message;
  const target=$('#toast');target.textContent=message;target.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>target.classList.remove('show'),3100);
}
function record(target,text) {
  S.events.unshift({id:makeId('L'),at:new Date().toISOString(),target,text});
  S.events=S.events.slice(0,1500);
}
function commit(message) {persist();render();if(message)notify(message);}
function getIncident(id) {return S.incidents.find(i=>i.id===id);}
function getUnit(id) {return S.units.find(u=>u.id===id);}
function selectedIncident() {return S.selected?.kind==='incident' ? getIncident(S.selected.id):null;}
function selectedUnit() {return S.selected?.kind==='unit' ? getUnit(S.selected.id):null;}
function taskForUnit(u) {return u.taskId ? getIncident(u.taskId):null;}
function matchSearch(...fields) {return !S.search || fields.some(s=>String(s??'').toLocaleLowerCase('fi').includes(S.search.toLocaleLowerCase('fi')));}
function agencyShort(a) {return ({pelastus:'PEL',ensihoito:'ENS',poliisi:'POL'})[a] || '—';}
function showStatus(st) {return `<span class="status-badge ${esc(st)}">${esc(statuses[st] || st)}</span>`;}
function isSelected(kind,id) {return S.selected?.kind===kind && S.selected.id===id;}
function selectEntity(kind,id,zoom=false) {
  S.selected={kind,id};S.detailTab='general';commit();
  if(zoom)focusSelected();
}
function listIncidents() {
  return S.incidents.filter(i=>
    (S.showClosed || i.status!=='closed') && (S.agencyFilter==='all' || i.agency===S.agencyFilter) &&
    matchSearch(i.id,i.code,i.title,i.address,i.priority,i.agency)
  ).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
}
function listUnits() {
  return S.units.filter(u=>(!S.freeOnly || u.status==='free') &&
    (S.agencyFilter==='all' || u.agency===S.agencyFilter) &&
    matchSearch(u.call,u.station,u.type,u.status,u.crew,u.taskId,...(u.caps||[]))
  ).sort((a,b)=>a.call.localeCompare(b.call,'fi',{numeric:true}));
}
function renderCounts() {
  const active=S.incidents.filter(i=>i.status==='active').length;
  const free=S.units.filter(u=>u.status==='free').length;
  $('#summaryCounts').innerHTML=`Aktiiviset <b>${active}</b> · Resurssit <b>${S.units.length}</b> · Vapaana <b>${free}</b>`;
  $('#incidentBadge').textContent=active;
  $('#unitBadge').textContent=S.units.length;
  $('#logBadge').textContent=S.events.length;
  $('#incidentFooter').textContent=`${listIncidents().length} näytetään · ${active} aktiivista · valitse tehtävä avataksesi tiedot`;
  $('#unitFooter').textContent=`${free} vapaana / ${S.units.length} yksikköä · paikallisesti muokattavat tiedot`;
}
function renderIncidents() {
  $('#incidentRows').innerHTML=listIncidents().map(i=>`
    <tr tabindex="0" class="${isSelected('incident',i.id)?'selected':''} ${i.status==='closed'?'closed':''}" data-select-incident="${esc(i.id)}" title="${esc(i.id)} – ${esc(i.address)}">
      <td class="code-text">${formatClock(i.createdAt)}</td>
      <td><span class="priority ${esc(i.priority)}">${esc(i.priority)}</span></td>
      <td class="code-text">${esc(i.code)}</td>
      <td><div class="primary-line">${esc(i.title)}</div><div class="sub-line">${esc(i.address)}</div></td>
      <td>${i.status==='closed'?'Päät.':'Aktiiv.'}</td>
    </tr>
  `).join('') || '<tr><td colspan="5">Ei tehtäviä valituilla suodattimilla.</td></tr>';
  $('#showClosedBtn').textContent=S.showClosed?'Myös päättyneet':'Aktiiviset';
  $$('#agencyFilters .filter').forEach(b=>b.classList.toggle('active',b.dataset.agency===S.agencyFilter));
}
function renderUnits() {
  $('#unitRows').innerHTML=listUnits().map(u=>`
    <tr tabindex="0" class="${isSelected('unit',u.id)?'selected':''}" data-select-unit="${esc(u.id)}" title="${esc(u.station)} — ${esc(u.type)}">
      <td class="unit-ind">${esc(u.call)}</td>
      <td><div class="primary-line">${esc(u.type)}</div><div class="sub-line">${esc(u.station)} · ${agencyShort(u.agency)}</div></td>
      <td>${showStatus(u.status)}</td>
      <td class="code-text">${esc((taskForUnit(u)?.code) || '—')}</td>
    </tr>
  `).join('') || '<tr><td colspan="4">Ei yksiköitä valituilla suodattimilla.</td></tr>';
  $('#freeOnlyBtn').textContent=S.freeOnly?'Vain vapaat':'Kaikki';
}
function detailsRow(name,value) {return `<div class="data-field"><span>${esc(name)}</span><span>${value}</span></div>`;}
function infoGroup(label,body){return `<section class="info-group"><div class="group-title">${esc(label)}</div>${body}</section>`;}
function renderDetails() {
  const i=selectedIncident(),u=selectedUnit();
  $('#detailsHeading').textContent=i?'TEHTÄVÄTIEDOT':u?'YKSIKKÖTIEDOT':'TIEDOT';
  $('#detailsIdentifier').textContent=i?.id||u?.call||'—';
  $$('.detail-tab').forEach(b=>b.classList.toggle('active',b.dataset.detailTab===S.detailTab));
  if(i) return renderIncidentDetails(i);
  if(u) return renderUnitDetails(u);
  $('#detailsContent').innerHTML='<div class="blank-selection">Valitse tehtävä tai yksikkö luettelosta tai kartalta.</div>';
}
function renderIncidentDetails(i) {
  const assigned=S.units.filter(u=>u.taskId===i.id);
  if(S.detailTab==='units') {
    const available=S.units.filter(u=>!u.taskId && u.status!=='unavailable');
    $('#detailsContent').innerHTML=infoGroup(`LIITETYT YKSIKÖT (${assigned.length})`,
      assigned.map(u=>`<div class="detail-unit"><div><strong>${esc(u.call)}</strong><small>${esc(u.type)} · ${esc(statuses[u.status])}</small></div><button class="btn tiny" data-action="removeUnit" data-unit="${esc(u.id)}">Irrota</button></div>`).join('')||'<p class="small-muted">Ei liitettyjä yksiköitä.</p>'
    )+infoGroup('LIITÄ RESURSSI',`
      <div class="assign-line"><select id="assignUnitSelect" aria-label="Yksikkö">${available.map(u=>`<option value="${esc(u.id)}">${esc(u.call)} · ${esc(u.type)}</option>`).join('')}</select>
      <button class="btn strong" data-action="assignUnit" ${available.length&&i.status==='active'?'':'disabled'}>Liitä</button></div>
      <p class="small-muted">Liittäminen muuttaa vain tämän työtilan paikallista tietoa.</p>
    `);
    return;
  }
  if(S.detailTab==='events') {
    $('#detailsContent').innerHTML=infoGroup('TEHTÄVÄKOHTAISET KIRJAUKSET',
      S.events.filter(e=>e.target===i.id).map(e=>`<div class="history-record"><time>${esc(formatDate(e.at))}</time>${esc(e.text)}</div>`).join('')||'<p class="small-muted">Ei kirjauksia.</p>'
    )+`<button class="btn strong" data-action="addNote">+ Kirjaa tapahtuma</button>`;
    return;
  }
  $('#detailsContent').innerHTML=
    infoGroup('PERUSTIEDOT',
      detailsRow('Tehtävätunnus',`<span class="mono">${esc(i.id)}</span>`)+
      detailsRow('Tehtävä',`${esc(i.code)} · ${esc(i.title)}`)+
      detailsRow('Kiireellisyys',`<span class="priority ${esc(i.priority)}">${esc(i.priority)}</span>`)+
      detailsRow('Toimiala',esc(agencies[i.agency]))+
      detailsRow('Tila',i.status==='active'?'Aktiivinen':'Päättynyt')+
      detailsRow('Ilmoitettu',esc(formatDate(i.createdAt)))+
      detailsRow('Johtaja',esc(i.commander||'Ei määritelty'))
    )+
    infoGroup('SIJAINTI',
      detailsRow('Paikka',esc(i.address))+
      detailsRow('WGS84',`<span class="mono">${Number(i.lat).toFixed(5)}, ${Number(i.lng).toFixed(5)}</span>`)+
      `<div class="detail-buttons"><button class="btn" data-action="focus">Näytä kartalla</button><button class="btn" data-action="copyCoords">Kopioi koordinaatit</button><button class="btn" data-action="setIncidentPoint">Siirrä kartalla</button></div>`
    )+
    infoGroup('TEHTÄVÄKUVAUS',`<div class="info-panel">${esc(i.description||'Ei lisätietoja.')}</div>`)+
    infoGroup('RESURSSIT',assigned.map(u=>`<div class="detail-unit"><div><strong>${esc(u.call)}</strong><small>${esc(u.type)}</small></div>${showStatus(u.status)}</div>`).join('')||'<p class="small-muted">Ei liitettyjä yksiköitä.</p>')+
    infoGroup('TOIMINNOT',`<div class="detail-buttons"><button class="btn" data-action="editIncident">Muokkaa tehtävää</button><button class="btn" data-action="addNote">Lisää kirjaus</button><button class="btn ${i.status==='active'?'danger':''}" data-action="toggleIncident">${i.status==='active'?'Päätä tehtävä':'Avaa tehtävä'}</button></div>`);
}
function renderUnitDetails(u) {
  const i=taskForUnit(u);
  if(S.detailTab==='events') {
    $('#detailsContent').innerHTML=infoGroup('YKSIKÖN KIRJAUKSET',
      S.events.filter(e=>e.target===u.call).map(e=>`<div class="history-record"><time>${esc(formatDate(e.at))}</time>${esc(e.text)}</div>`).join('')||'<p class="small-muted">Ei kirjauksia.</p>')+
      '<button class="btn strong" data-action="addNote">+ Kirjaa tapahtuma</button>';
    return;
  }
  if(S.detailTab==='units') {
    $('#detailsContent').innerHTML=infoGroup('TILATIEDOT',
      `<div class="assign-line"><select id="statusSelect" aria-label="Yksikön tila">${Object.entries(statuses).map(([key,label])=>`<option value="${key}" ${key===u.status?'selected':''}>${esc(label)}</option>`).join('')}</select><button class="btn strong" data-action="saveStatus">Päivitä</button></div><p class="small-muted">Tilat ovat paikallisen mallin tiloja, eivät KEJOn virallisia statusviestejä.</p>`
    )+infoGroup('TEHTÄVÄSIDONTA',i?`<p>${esc(i.code)} · ${esc(i.title)}</p><button class="btn" data-action="openUnitTask">Avaa tehtävä</button> <button class="btn" data-action="releaseSelectedUnit">Irrota</button>`:'<p class="small-muted">Ei tehtävälle sidottu.</p>');
    return;
  }
  $('#detailsContent').innerHTML=
    infoGroup('YKSIKKÖ',
      detailsRow('Tunnus',`<span class="mono">${esc(u.call)}</span>`)+
      detailsRow('Toimiala',esc(agencies[u.agency]))+
      detailsRow('Yksikkölaji',esc(u.type))+
      detailsRow('Asemapaikka',esc(u.station))+
      detailsRow('Miehistö',esc(u.crew||'Ei määritelty'))+
      detailsRow('Tila',showStatus(u.status))+
      detailsRow('Tehtävä',esc(i?`${i.code} · ${i.id}`:'—'))
    )+
    infoGroup('SUORITUSKYVYT', (u.caps||[]).map(c=>`<span class="status-badge free" style="margin:0 5px 5px 0">${esc(c)}</span>`).join('')||'<p class="small-muted">Ei määritelty.</p>')+
    infoGroup('SIJAINTI',detailsRow('WGS84',`<span class="mono">${Number(u.lat).toFixed(5)}, ${Number(u.lng).toFixed(5)}</span>`))+
    infoGroup('TOIMINNOT',`<div class="detail-buttons"><button class="btn" data-action="focus">Näytä kartalla</button><button class="btn" data-action="editUnit">Muokkaa yksikköä</button><button class="btn" data-action="setUnitPoint">Siirrä kartalla</button><button class="btn" data-action="openStatusTab">Vaihda tila</button></div>`);
}
function renderEvents() {
  const q=S.logSearch.toLocaleLowerCase('fi');
  $('#eventRows').innerHTML=S.events.filter(e=>!q||`${e.text} ${e.target}`.toLocaleLowerCase('fi').includes(q)).map(e=>`
    <tr><td class="code-text">${esc(formatDate(e.at))}</td><td class="code-text">${esc(e.target)}</td><td>${esc(e.text)}</td></tr>
  `).join('')||'<tr><td colspan="3">Ei tapahtumia.</td></tr>';
}
function renderTabs(){
  $$('.nav-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.mainTab===S.mainTab));
  $('#workspace').className='workspace view-'+S.mainTab;
  $('#eventPane').classList.toggle('is-expanded',S.mainTab==='log');
  $('#mapModule').classList.toggle('map-focused',S.mainTab==='map');
  requestAnimationFrame(()=>map?.invalidateSize());
}
function render() {
  renderCounts();renderIncidents();renderUnits();renderDetails();renderEvents();renderTabs();renderMapMarkers();
}
// ----------------------------- Karttapalvelut -------------------------------
// Pohjakartat: OSM, OpenTopoMap ja Esri. Julkiset palvelut voivat rajoittaa käyttöä.
// Syke WMS: 1.1.1 / EPSG:3857 / image/png / läpinäkyvä, OGC-karttapalvelu.
// Syvyysaineisto on osittaista eikä ole tarkoitettu navigointiin tai pelastustoiminnan päätöksiin.
const topoUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
const streetUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const imageryUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const hillshadeUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}';
const sykeUrl = 'https://paikkatiedot.ymparisto.fi/geoserver/inspire_el/wms';
const seaUrl = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';
let mmlApiKey = '';
try {mmlApiKey=sessionStorage.getItem('kenttatyoasema_mml_key')||'';}catch{}
function makeSykeLayer(layerName, name) {
  return L.tileLayer.wms(sykeUrl, {
    layers: layerName, format:'image/png', transparent:true,
    version:'1.1.1', attribution:`Syvyystieto: Suomen ympäristökeskus (Syke) · ${name} · CC BY 4.0`,
    opacity: S.mapSettings.opacity / 100, maxZoom:19
  });
}
function prepareMap() {
  if(typeof L==='undefined') { $('#mapWait').hidden=false;notify('Karttakirjastoa ei voitu avata. Tarkista verkkoyhteys.'); return; }
  try {
    const c=Array.isArray(S.mapCenter)&&validPos(S.mapCenter[0],S.mapCenter[1]) ? S.mapCenter : center;
    map=L.map('map',{zoomControl:true,attributionControl:true,preferCanvas:true}).setView(c,S.mapZoom||11);
    L.control.scale({metric:true,imperial:false,position:'bottomleft'}).addTo(map);
    baseLayers.street=L.tileLayer(streetUrl,{maxZoom:19,attribution:'© OpenStreetMapin tekijät'});
    baseLayers.topo=L.tileLayer(topoUrl,{maxZoom:17,maxNativeZoom:17,subdomains:'abc',attribution:'© OpenStreetMapin tekijät, SRTM · karttatyyli © OpenTopoMap (CC BY-SA)'});
    baseLayers.aerial=L.tileLayer(imageryUrl,{maxZoom:19,attribution:'Tiles © Esri, Maxar, Earthstar Geographics ja muut toimittajat'});
    let topoErrors=0;
    baseLayers.topo.on('tileerror',()=>{if(S.mapSettings.base==='topo'&&++topoErrors===4){changeBasemap('street');notify('Maastokarttatiiliä ei saatu palvelimelta. Vaihdettiin osoitekarttaan.');}});
    if(mmlApiKey)buildMmlLayer();
    $('#mmlKey').value=mmlApiKey;
    overlayLayers.hillshade=L.tileLayer(hillshadeUrl,{maxZoom:17,opacity:.42,attribution:'Rinnevarjoste © Esri ja aineistotoimittajat'});
    overlayLayers.depthAreas=makeSykeLayer('EL.Syvyysalue','Syvyysalue');
    overlayLayers.depthLines=makeSykeLayer('EL.ContourLine','Syvyyskäyrä');
    overlayLayers.depthPoints=makeSykeLayer('EL.SpotElevation','Syvyyspiste');
    overlayLayers.seamarks=L.tileLayer(seaUrl,{maxZoom:18,attribution:'Merimerkit © OpenSeaMapin tekijät'});
    markers.incidents=L.layerGroup().addTo(map);
    markers.units=L.layerGroup().addTo(map);
    markers.features=L.layerGroup().addTo(map);
    map.on('mousemove', e=>{
      latestPointer=e.latlng;
      $('#mapMouseCoord').textContent=`WGS84: ${e.latlng.lat.toFixed(6)} N / ${e.latlng.lng.toFixed(6)} E`;
    });
    map.on('click', onMapClick);
    map.on('dblclick', e=>{if(pointerMode?.type==='measure'){L.DomEvent.stop(e);endMeasure();}});
    map.on('moveend zoomend',()=>{
      $('#mapScaleText').textContent=`Zoom ${map.getZoom()} · Keskipiste ${map.getCenter().lat.toFixed(4)}, ${map.getCenter().lng.toFixed(4)}`;
      persist();
    });
    map.on('contextmenu', e=>{
      if(pointerMode)return;
      const text=prompt('Lisää oma paikkamerkintä (paikallinen). Nimi:');
      if(text&&text.trim()){
        S.features.push({id:makeId('M'),type:'point',name:text.trim().slice(0,140),lat:e.latlng.lat,lng:e.latlng.lng});
        record('KARTTA',`Paikkamerkintä: ${text.trim().slice(0,70)}`);commit('Paikkamerkintä lisätty.');
      }
    });
    configureLayers();
    renderMapMarkers();
  } catch(err) {
    console.error('Map initialization error',err);
    $('#mapWait').hidden=false;
    notify('Karttaa ei voitu alustaa.');
  }
}
function buildMmlLayer(){
  if(typeof L==='undefined'||!mmlApiKey)return;
  baseLayers.mml=L.tileLayer('https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/maastokartta/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.png?api-key='+encodeURIComponent(mmlApiKey),{maxZoom:18,attribution:'Maastokartta © Maanmittauslaitos, CC BY 4.0'});
  let errors=0;
  baseLayers.mml.on('tileerror',()=>{if(S.mapSettings.base==='mml'&&++errors===4){changeBasemap('topo');notify('MML-kartan lataus epäonnistui. Tarkista API-avain ja palvelun saatavuus.');}});
}
function configureLayers() {
  if(!map)return;
  if(!baseLayers[S.mapSettings.base])S.mapSettings.base='topo';
  if(selectedBase)map.removeLayer(selectedBase);
  selectedBase=baseLayers[S.mapSettings.base].addTo(map);
  Object.entries(overlayLayers).forEach(([name,layer])=>{
    if(S.mapSettings[name])layer.addTo(map);
    else if(map.hasLayer(layer))map.removeLayer(layer);
  });
  // Pidä viranomaismerkinnät ja omat piirrokset ylimpinä.
  Object.values(markers).forEach(group=>{
    if(group&&map.hasLayer(group)){group.remove();group.addTo(map);}
  });
  markers.incidents && (S.mapSettings.showTasks?markers.incidents.addTo(map):markers.incidents.remove());
  markers.units && (S.mapSettings.showUnits?markers.units.addTo(map):markers.units.remove());
  markers.features && (S.mapSettings.annotations?markers.features.addTo(map):markers.features.remove());
  $$('.layer-option input[name="basemap"]').forEach(r=>r.checked=r.value===S.mapSettings.base);
  $$('.layer-option input[data-layer]').forEach(c=>c.checked=!!S.mapSettings[c.dataset.layer]);
  $('#layerOpacity').value=S.mapSettings.opacity;
  $('#opacityLabel').textContent=`${S.mapSettings.opacity} %`;
  $('#toggleTaskMarkers').classList.toggle('active',S.mapSettings.showTasks);
  $('#toggleUnitMarkers').classList.toggle('active',S.mapSettings.showUnits);
  $('#activeLayerStatus').textContent=`POHJA: ${({street:'OSM',topo:'TOPO',aerial:'ILMAKUVA',mml:'MML MAASTO'})[S.mapSettings.base]} · LISÄTASOT: ${Object.keys(overlayLayers).filter(k=>S.mapSettings[k]).length}`;
  persist();
}
function updateOpacity(){
  Object.entries(overlayLayers).forEach(([name,layer])=>{
    if(typeof layer.setOpacity==='function')layer.setOpacity(name==='hillshade' ? S.mapSettings.opacity/100*.55 : S.mapSettings.opacity/100);
  });
  $('#opacityLabel').textContent=`${S.mapSettings.opacity} %`;
  persist();
}
function changeBasemap(name) {
  if(name==='mml'&&!mmlApiKey){notify('MML:n maastokartta vaatii oman API-avaimen. Syötä se karttatasovalikossa.');$$('.layer-option input[name="basemap"]').forEach(r=>r.checked=r.value===S.mapSettings.base);return;}
  if(!baseLayers[name])return;
  S.mapSettings.base=name;
  S.mapSettings.contours=name==='topo'||name==='mml';
  configureLayers();
  notify(name==='topo'?'Maastokartta: korkeuskäyrät, polut ja maastotyypit.':'Pohjakartta vaihdettu.');
}
function toggleLayer(name,checked) {
  if(name==='contours') {
    if(checked)changeBasemap('topo');
    else {S.mapSettings.contours=false;changeBasemap('street');}
    return;
  }
  if(!Object.hasOwn(overlayLayers,name) && name!=='annotations')return;
  S.mapSettings[name]=checked;
  configureLayers();
  const info=name.startsWith('depth')?'SYKE-aineisto näkyy vain järvillä, joilta on julkaistu syvyystietoja.':'';
  if(info)$('#layerNote').textContent=info;
}
function renderMapMarkers() {
  if(!map)return;
  markers.incidents.clearLayers();markers.units.clearLayers();markers.features.clearLayers();
  for(const i of S.incidents){
    if(i.status==='closed'||!validPos(i.lat,i.lng))continue;
    const icon=L.divIcon({className:'',html:`<div class="map-task ${isSelected('incident',i.id)?'selected':''}" title="${esc(i.code)} ${esc(i.title)}"></div>`,iconSize:[18,18],iconAnchor:[9,9]});
    const marker=L.marker([+i.lat,+i.lng],{icon}).addTo(markers.incidents);
    marker.bindPopup(`<strong>${esc(i.code)} · ${esc(i.title)}</strong>${esc(i.address)}<div>Kiireellisyys ${esc(i.priority)}</div><button data-map-select="incident" data-id="${esc(i.id)}">Avaa tehtävä</button>`);
    // Klikkaus avaa Leaflet-popupin; 'Avaa tehtävä' tekee valinnan.
  }
  for(const u of S.units){
    if(!validPos(u.lat,u.lng))continue;
    const label=agencyShort(u.agency);
    const icon=L.divIcon({className:'',html:`<div class="map-symbol ${u.agency==='pelastus'?'rescue':u.agency==='ensihoito'?'medical':'police'} ${isSelected('unit',u.id)?'selected':''}" title="${esc(u.call)}">${esc(label)}</div>`,iconSize:[31,22],iconAnchor:[15,11]});
    const marker=L.marker([+u.lat,+u.lng],{icon}).addTo(markers.units);
    marker.bindPopup(`<strong>${esc(u.call)}</strong>${esc(u.type)}<div>${esc(u.station)} · ${esc(statuses[u.status])}</div><div style="font-size:10px;margin-top:6px">Sijainti käsin syötetty mallitieto — ei GPS-paikannus</div><button data-map-select="unit" data-id="${esc(u.id)}">Avaa yksikkö</button>`);
    // Klikkaus avaa Leaflet-popupin; 'Avaa yksikkö' tekee valinnan.
  }
  for(const f of S.features){
    if(f.type==='point'&&validPos(f.lat,f.lng)){
      const marker=L.circleMarker([f.lat,f.lng],{radius:6,color:'#273c5b',weight:2,fillColor:'#f0db89',fillOpacity:.9}).addTo(markers.features);
      marker.bindPopup(`<strong>OMA KOHDE</strong>${esc(f.name)}<div><button data-delete-feature="${esc(f.id)}">Poista</button></div>`);
    }
    if(f.type==='line'&&Array.isArray(f.points)&&f.points.length>1){
      const poly=L.polyline(f.points,{color:'#f5c872',weight:3,dashArray:'6 4'}).addTo(markers.features);
      poly.bindTooltip(`${Number(f.distance||0).toFixed(0)} m`);
      L.circleMarker(f.points.at(-1),{radius:4,color:'#f5c872',fillOpacity:1,fillColor:'#f5c872'}).addTo(markers.features);
    }
  }
}
function focusSelected(){
  if(!map){notify('Kartta ei ole ladattuna.');return;}
  const entity=selectedIncident()||selectedUnit();
  if(entity && validPos(entity.lat,entity.lng))map.setView([+entity.lat,+entity.lng],Math.max(13,map.getZoom()),{animate:true});
  else notify('Valitulla kohteella ei ole kelvollisia koordinaatteja.');
}
function fitAll() {
  if(!map)return;
  const coords=[...S.incidents.filter(i=>i.status==='active'),...S.units].filter(e=>validPos(e.lat,e.lng)).map(e=>[+e.lat,+e.lng]);
  if(coords.length)map.fitBounds(L.latLngBounds(coords).pad(.2),{maxZoom:13});
  else map.setView(center,11);
}
function setPointerMode(mode) {
  pointerMode=mode;measurePoints=[];measureObjects.forEach(o=>map?.removeLayer(o));measureObjects=[];
  if(map)map.getContainer().style.cursor=mode?'crosshair':'';
  const hint=$('#mapModeHint');hint.hidden=!mode;
  hint.textContent=mode?.type==='measure'?'MITTAUS: napsauta karttaa lisätäksesi pisteitä. Kaksoisnapsautus tai Esc päättää.':
    mode?.type==='moveUnit'?'SIIRRÄ YKSIKKÖ: valitse uusi sijainti kartalta. Esc peruu.':
    mode?.type==='moveIncident'?'TEHTÄVÄN SIJAINTI: osoita kartalta uusi paikka. Esc peruu.':
    'UUSI TEHTÄVÄ: napsauta karttaa asettaaksesi paikan. Esc peruu.';
  $('#measureButton').classList.toggle('active',mode?.type==='measure');
  $('#pointButton').classList.toggle('active',mode?.type==='newIncident');
  if(map) {
    if(mode?.type==='measure')map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }
}
function onMapClick(e) {
  if(!pointerMode)return;
  if(pointerMode.type==='measure')return addMeasurePoint(e.latlng);
  if(pointerMode.type==='newIncident') {
    setPointerMode(null);
    return openIncidentModal(null,{lat:e.latlng.lat,lng:e.latlng.lng});
  }
  const entity=pointerMode.type==='moveUnit'?getUnit(pointerMode.id):getIncident(pointerMode.id);
  if(entity){
    entity.lat=e.latlng.lat;entity.lng=e.latlng.lng;
    record(pointerMode.type==='moveUnit'?entity.call:entity.id,'Sijaintia muutettu käsin kartalla');
    setPointerMode(null);commit('Sijainti päivitetty paikallisesti.');
  }
}
function addMeasurePoint(pt) {
  if(!map)return;
  measurePoints.push(pt);
  const dot=L.circleMarker(pt,{radius:4,color:'#fdd17a',fillOpacity:1,fillColor:'#fdd17a'}).addTo(map);
  measureObjects.push(dot);
  if(measurePoints.length>1){
    const last=measurePoints.at(-2);
    const segment=L.polyline([last,pt],{color:'#ffcb77',weight:3,dashArray:'7 4'}).addTo(map);
    measureObjects.push(segment);
  }
  const length=measurePoints.slice(1).reduce((sum,p,index)=>sum+measurePoints[index].distanceTo(p),0);
  $('#mapModeHint').textContent=`MITTAUS: ${length>=1000?(length/1000).toFixed(2)+' km':length.toFixed(0)+' m'} · ${measurePoints.length} pistettä · Kaksoisnapsautus tai Esc päättää`;
}
function endMeasure() {
  if(pointerMode?.type!=='measure')return;
  if(measurePoints.length>=2){
    const distance=measurePoints.slice(1).reduce((sum,p,index)=>sum+measurePoints[index].distanceTo(p),0);
    S.features.push({id:makeId('M'),type:'line',points:measurePoints.map(p=>[p.lat,p.lng]),distance});
    record('KARTTA',`Mitattu matka: ${distance.toFixed(0)} m`);
    setPointerMode(null);commit(`Mittaviiva tallennettu: ${distance.toFixed(0)} metriä.`);
  } else {setPointerMode(null);notify('Mittaus peruutettu (vähintään kaksi pistettä).');}
}
// ----------------------------- Muokkauslomakkeet -----------------------------
function f(label,name,value='',type='text',extra='') {
  return `<div class="form-field"><label for="form_${esc(name)}">${esc(label)}</label><input id="form_${esc(name)}" name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}></div>`;
}
function fieldSelect(label,name,items,selected) {
  return `<div class="form-field"><label for="form_${esc(name)}">${esc(label)}</label><select id="form_${esc(name)}" name="${esc(name)}">${items.map(([v,text])=>`<option value="${esc(v)}" ${String(v)===String(selected)?'selected':''}>${esc(text)}</option>`).join('')}</select></div>`;
}
function openModal(title,kind,content,id=null) {
  modalKind=kind;editId=id;
  $('#modalTitle').textContent=title;
  $('#modalContent').innerHTML=content;
  $('#modalBackdrop').hidden=false;
  requestAnimationFrame(()=>$('#modalContent input:not([type="checkbox"]), #modalContent select')?.focus());
}
function closeModal(){
  $('#modalBackdrop').hidden=true;
  $('#modalContent').innerHTML='';modalKind=null;editId=null;
}
function openIncidentModal(i=null,override={}) {
  const current=i||{agency:S.agencyFilter==='all'?'pelastus':S.agencyFilter,code:'402',title:'Rakennuspalo: keskisuuri',priority:'B',address:'',description:'',commander:'',lat:override.lat??center[0],lng:override.lng??center[1]};
  openModal(i?'Muokkaa tehtävää':'Uusi paikallinen tehtävä','incident',
    `<div class="form-note">Harjoitus- ja sovellusmallin tehtävätietoja. Ei yhteyttä hätäkeskukseen.</div>`+
    fieldSelect('Toimiala','agency',Object.entries(agencies),current.agency)+
    fieldSelect('Kiireellisyys','priority',['A','B','C','D'].map(x=>[x,`Luokka ${x}`]),current.priority)+
    `<div class="form-field full"><label for="form_code">Tehtäväkoodi (julkinen lähdelista)</label><input id="form_code" name="code" list="codeOptions" value="${esc(current.code)}" required maxlength="8" autocomplete="off"><datalist id="codeOptions"></datalist><small id="codeHint" class="small-muted">Valitse lähdeluettelon koodi tai kirjoita muu.</small></div>`+
    f('Tehtävän kuvaus / nimike','title',current.title,'text','required maxlength="150"')+
    f('Kohteen osoite / paikan nimi','address',current.address,'text','required maxlength="180"')+
    f('Johtaja / vastuuhenkilö (malli)','commander',current.commander,'text','maxlength="100"')+
    f('Leveysaste WGS84','lat',current.lat,'number','step="any" required')+
    f('Pituusaste WGS84','lng',current.lng,'number','step="any" required')+
    `<div class="form-field full"><label for="form_description">Lisätiedot</label><textarea id="form_description" name="description" rows="4" maxlength="3000">${esc(current.description)}</textarea></div>`, i?.id||null);
  updateCodeDatalist();
}
function updateCodeDatalist() {
  const a=$('#form_agency')?.value;
  const hints=DATA.codes.filter(x=>x[2]===a);
  const datalist=$('#codeOptions');
  if(!datalist)return;
  datalist.innerHTML=hints.map(x=>`<option value="${esc(x[0])}">${esc(x[1])}</option>`).join('');
  updateCodeTitle(false);
}
function updateCodeTitle(allowChange=true) {
  const code=$('#form_code')?.value.trim();
  const agency=$('#form_agency')?.value;
  const found=DATA.codes.find(x=>x[0]===code&&x[2]===agency);
  const hint=$('#codeHint');
  if(hint)hint.textContent=found?`${found[0]} · ${found[1]}`:'Ei löydy tämän toimialan lähdelistasta – tarkista koodi.';
  if(found&&allowChange&&$('#form_title'))$('#form_title').value=found[1];
}
function openUnitModal(u=null) {
  const current=u||{call:'',agency:'pelastus',type:'Sammutusyksikkö',station:'',status:'free',crew:'1+3',caps:[],lat:center[0],lng:center[1]};
  const types=DATA.types[current.agency]||DATA.types.pelastus;
  openModal(u?'Muokkaa yksikköä':'Uusi paikallinen yksikkö','unit',
    `<div class="form-note">Tunnus ja kalusto määritetään käsin. Ei oikeita yksiköiden sijainteja tai statustietoja.</div>`+
    f('Yksikkötunnus','call',current.call,'text','required maxlength="32"')+
    fieldSelect('Toimiala','agency',Object.entries(agencies),current.agency)+
    fieldSelect('Kalustotyyppi / tehtävä','type',[...new Set([...types,current.type])].map(x=>[x,x]),current.type)+
    fieldSelect('Tila','status',Object.entries(statuses),current.status)+
    f('Asemapaikka','station',current.station,'text','required maxlength="100"')+
    f('Vahvuus','crew',current.crew,'text','maxlength="20"')+
    f('Leveysaste WGS84','lat',current.lat,'number','step="any" required')+
    f('Pituusaste WGS84','lng',current.lng,'number','step="any" required')+
    `<div class="form-field full"><label>Suorituskyvyt</label><div class="capability-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px">${DATA.capabilityLabels.map(c=>`<label style="display:flex;align-items:center;gap:6px"><input name="caps" type="checkbox" value="${esc(c)}" ${(current.caps||[]).includes(c)?'checked':''}>${esc(c)}</label>`).join('')}</div></div>`,u?.id||null);
}
function updateUnitTypes() {
  const agency=$('#form_agency')?.value;
  const target=$('#form_type');
  if(!target||!DATA.types[agency])return;
  target.innerHTML=DATA.types[agency].map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
}
function saveModal() {
  const form=$('#modalForm');
  if(!form.reportValidity())return;
  const values=new FormData(form);
  const lat=String(values.get('lat')??'').trim(),lng=String(values.get('lng')??'').trim();
  if(modalKind==='incident') {
    if(!validPos(lat,lng))return notify('Koordinaatit eivät ole kelvollisia.');
    const agency=String(values.get('agency'));
    const code=String(values.get('code')??'').trim();
    const patch={agency,priority:String(values.get('priority')),code,title:String(values.get('title')).trim(),
      address:String(values.get('address')).trim(),commander:String(values.get('commander')||'').trim(),
      description:String(values.get('description')||'').trim(),lat:+lat,lng:+lng};
    if(!patch.title||!patch.address||!code)return notify('Täytä tehtävän pakolliset tiedot.');
    let entity=editId?getIncident(editId):null;
    if(entity){Object.assign(entity,patch);record(entity.id,'Tehtävätietoja muokattu');}
    else {entity={...patch,id:makeId('T'),createdAt:new Date().toISOString(),status:'active'};S.incidents.unshift(entity);record(entity.id,`Tehtävä vastaanotettu: ${code} ${patch.title}`);}
    S.selected={kind:'incident',id:entity.id};
    closeModal();commit('Tehtävätiedot tallennettu.');
    if(map)map.setView([entity.lat,entity.lng],Math.max(map.getZoom(),13));
    return;
  }
  if(modalKind==='unit') {
    if(!validPos(lat,lng))return notify('Koordinaatit eivät ole kelvollisia.');
    const call=String(values.get('call')||'').trim().toUpperCase();
    if(!call)return notify('Yksikkötunnus puuttuu.');
    if(S.units.some(u=>u.call.toUpperCase()===call&&u.id!==editId))return notify('Yksikkötunnus on jo käytössä.');
    const patch={call,agency:String(values.get('agency')),type:String(values.get('type')),status:String(values.get('status')),
      station:String(values.get('station')||'').trim(),crew:String(values.get('crew')||'').trim(),
      caps:values.getAll('caps').map(String),lat:+lat,lng:+lng};
    let entity=editId?getUnit(editId):null;
    if(entity){Object.assign(entity,patch);record(entity.call,'Yksikön perustiedot päivitetty');}
    else{entity={...patch,id:makeId('U'),taskId:null,createdAt:new Date().toISOString()};S.units.push(entity);record(entity.call,'Uusi yksikkö lisätty paikalliseen työtilaan');}
    if(entity.taskId && (entity.status==='free'||entity.status==='unavailable')){record(entity.call,'Yksikkö irrotettu tehtävästä tilamuutoksen vuoksi');entity.taskId=null;}
    S.selected={kind:'unit',id:entity.id};
    closeModal();commit('Yksikkö tallennettu.');
    return;
  }
  if(modalKind==='note') {
    const note=String(values.get('note')||'').trim();
    const target=selectedIncident()?.id||selectedUnit()?.call||'YLEINEN';
    if(!note)return notify('Kirjoita tapahtumakirjaus.');
    record(target,note.slice(0,1000));closeModal();commit('Kirjaus lisätty.');
    return;
  }
}
function noteModal() {
  const selected=selectedIncident()||selectedUnit();
  if(!selected)return notify('Valitse ensin tehtävä tai yksikkö.');
  openModal('Uusi tapahtumakirjaus','note',
    `<div class="form-note">Kohde: ${esc(selected.id||selected.call)} · vain paikallinen loki</div>
     <div class="form-field full"><label for="noteField">Tapahtuman kuvaus</label><textarea name="note" id="noteField" maxlength="1000" rows="5" required></textarea></div>`);
}
function updateUnitStatus(u,newStatus) {
  if(!u || !statuses[newStatus] || u.status===newStatus)return;
  if(u.taskId && (newStatus==='free'||newStatus==='unavailable'))u.taskId=null;
  u.status=newStatus;
  record(u.call,`Tila: ${statuses[newStatus]}`);
  commit(`Yksikön ${u.call} tila: ${statuses[newStatus]}`);
}
function assignUnit(incident,unit) {
  if(!incident||!unit||unit.taskId||incident.status==='closed')return notify('Yksikköä ei voida liittää tähän tehtävään.');
  unit.taskId=incident.id;
  unit.status='alerted';
  record(unit.call,`Liitetty tehtävään ${incident.code} / ${incident.id}`);
  record(incident.id,`Yksikkö ${unit.call} liitetty tehtävälle`);
  commit(`${unit.call} liitetty tehtävään.`);
}
function releaseUnit(unit) {
  if(!unit||!unit.taskId)return;
  const incident=unit.taskId;
  unit.taskId=null;unit.status='free';
  record(unit.call,'Tehtäväsidonta purettu / tila vapaa');
  record(incident,`Yksikkö ${unit.call} irrotettu`);
  commit(`${unit.call} vapautettu.`);
}
function toggleIncidentStatus(incident) {
  if(!incident)return;
  if(incident.status==='active') {
    if(!confirm(`Päätetäänkö paikallinen tehtävä ${incident.code} (${incident.id})?`))return;
    incident.status='closed';
    for(const u of S.units.filter(x=>x.taskId===incident.id)){u.taskId=null;u.status='free';record(u.call,`Vapautettu päättyneeltä tehtävältä ${incident.id}`);}
    record(incident.id,'Tehtävä päätetty');
  } else {incident.status='active';record(incident.id,'Tehtävä avattu uudelleen');}
  commit('Tehtävän tila päivitetty.');
}
function downloadJson() {
  const data={format:'KEJO-tyyppinen-paikallinen-tyotila',version:3,exportedAt:new Date().toISOString(),state:S};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`kenttatyoasema-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),800);
  notify('Paikallinen työtila viety JSON-tiedostoon.');
}
async function importJson(file) {
  if(!file || file.size>2_000_000)return notify('Tiedosto puuttuu tai on liian suuri (enintään 2 Mt).');
  try {
    const doc=JSON.parse(await file.text());
    const state=doc.state;
    if(doc.version!==3||!state||!Array.isArray(state.units)||!Array.isArray(state.incidents)||!Array.isArray(state.events))throw Error('Tiedostomuoto ei vastaa versiota 3.');
    if(state.units.length>500||state.incidents.length>2000||state.events.length>5000)throw Error('Aineisto ylittää sallitut määrät.');
    if(!confirm('Korvataanko nykyiset paikalliset tiedot tuodulla aineistolla?'))return;
    S={...defaults(),...state,mapSettings:{...defaults().mapSettings,...state.mapSettings}};
    S.incidents=S.incidents.filter(i=>validPos(i.lat,i.lng));
    S.units=S.units.filter(u=>validPos(u.lat,u.lng));
    S.features=Array.isArray(S.features)?S.features.filter(f=>f && (f.type==='point'||f.type==='line')).slice(0,250):[];
    S.agencyFilter=['all','pelastus','ensihoito','poliisi'].includes(S.agencyFilter)?S.agencyFilter:'all';
    S.mainTab=['situation','incidents','resources','map','log'].includes(S.mainTab)?S.mainTab:'situation';
    S.detailTab=['general','units','events'].includes(S.detailTab)?S.detailTab:'general';
    if(map){map.setView(S.mapCenter||center,S.mapZoom||11);configureLayers();}
    commit('JSON-aineisto tuotu paikalliseen työtilaan.');
  }catch(e){notify(`Tuonti epäonnistui: ${e.message}`);}
}
// ------------------------------- Käyttöliittymä -----------------------------
function handleDetailsAction(action,button) {
  const i=selectedIncident(),u=selectedUnit();
  if(action==='focus')return focusSelected();
  if(action==='copyCoords') {
    if(!i)return;
    const txt=`${i.lat.toFixed(6)}, ${i.lng.toFixed(6)}`;
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(txt).then(()=>notify('Koordinaatit kopioitu.')).catch(()=>notify(txt));
    else notify(txt);
  }
  if(action==='editIncident'&&i)return openIncidentModal(i);
  if(action==='editUnit'&&u)return openUnitModal(u);
  if(action==='addNote')return noteModal();
  if(action==='toggleIncident'&&i)return toggleIncidentStatus(i);
  if(action==='openStatusTab'&&u){S.detailTab='units';commit();return;}
  if(action==='setUnitPoint'&&u){setPointerMode({type:'moveUnit',id:u.id});return;}
  if(action==='setIncidentPoint'&&i){setPointerMode({type:'moveIncident',id:i.id});return;}
  if(action==='saveStatus'&&u)return updateUnitStatus(u,$('#statusSelect')?.value);
  if(action==='openUnitTask'&&u?.taskId)return selectEntity('incident',u.taskId);
  if(action==='releaseSelectedUnit'&&u)return releaseUnit(u);
  if(action==='removeUnit'&&i){
    const target=getUnit(button.dataset.unit);
    if(target?.taskId===i.id)return releaseUnit(target);
  }
  if(action==='assignUnit'&&i)return assignUnit(i,getUnit($('#assignUnitSelect')?.value));
}
function handleMainTab(tab) {
  S.mainTab=tab;
  if(tab==='incidents') {S.freeOnly=false;S.agencyFilter='all';$('#incidentRows').closest('.scroll-clip').scrollTop=0;}
  if(tab==='resources') {S.showClosed=false;S.agencyFilter='all';}
  if(tab==='map') {$('#layerPanel').hidden=false;$('#layerPanelButton').setAttribute('aria-expanded','true');}
  if(tab==='log') $('#eventPane').classList.remove('is-collapsed');
  commit();
  if(tab==='map')setTimeout(()=>map?.invalidateSize(),20);
}
function attachListeners() {
  $('#newIncidentBtn').addEventListener('click',()=>openIncidentModal());
  $('#newUnitBtn').addEventListener('click',()=>openUnitModal());
  $('#modalClose').addEventListener('click',closeModal);
  $('#modalCancel').addEventListener('click',closeModal);
  $('#modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal();});
  $('#modalForm').addEventListener('submit',e=>{e.preventDefault();saveModal();});
  $('#modalContent').addEventListener('change',e=>{
    if(e.target.id==='form_agency') {
      if(modalKind==='incident')updateCodeDatalist();
      if(modalKind==='unit')updateUnitTypes();
    }
    if(e.target.id==='form_code')updateCodeTitle(true);
  });
  $('#modalContent').addEventListener('input',e=>{
    if(e.target.id==='form_code')updateCodeTitle(true);
  });
  $('#incidentRows').addEventListener('click',e=>{
    const row=e.target.closest('[data-select-incident]');if(row)selectEntity('incident',row.dataset.selectIncident);
  });
  $('#incidentRows').addEventListener('dblclick',e=>{
    const row=e.target.closest('[data-select-incident]');if(row)selectEntity('incident',row.dataset.selectIncident,true);
  });
  $('#unitRows').addEventListener('click',e=>{
    const row=e.target.closest('[data-select-unit]');if(row)selectEntity('unit',row.dataset.selectUnit);
  });
  $('#unitRows').addEventListener('dblclick',e=>{
    const row=e.target.closest('[data-select-unit]');if(row)selectEntity('unit',row.dataset.selectUnit,true);
  });
  for(const el of [$('#incidentRows'),$('#unitRows')])el.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();e.target.closest('tr')?.click();}
  });
  $('#agencyFilters').addEventListener('click',e=>{
    const f=e.target.closest('[data-agency]');if(!f)return;
    S.agencyFilter=f.dataset.agency;commit();
  });
  $('#showClosedBtn').addEventListener('click',()=>{S.showClosed=!S.showClosed;commit();});
  $('#freeOnlyBtn').addEventListener('click',()=>{S.freeOnly=!S.freeOnly;commit();});
  $('#globalSearch').addEventListener('input',e=>{S.search=e.target.value.trim();commit();});
  $('#logSearch').addEventListener('input',e=>{S.logSearch=e.target.value;commit();});
  $('#collapseLogBtn').addEventListener('click',()=>{
    const collapsed=$('#eventPane').classList.toggle('is-collapsed');
    $('#collapseLogBtn').textContent=collapsed?'Näytä ▴':'Piilota ▾';
    setTimeout(()=>map?.invalidateSize(),40);
  });
  $('#detailsContent').addEventListener('click',e=>{
    const btn=e.target.closest('[data-action]');
    if(btn&&!btn.disabled)handleDetailsAction(btn.dataset.action,btn);
  });
  $$('.detail-tab').forEach(btn=>btn.addEventListener('click',()=>{S.detailTab=btn.dataset.detailTab;commit();}));
  $$('.nav-tab').forEach(btn=>btn.addEventListener('click',()=>handleMainTab(btn.dataset.mainTab)));
  $('#resetViewBtn').addEventListener('click',fitAll);
  $('#exportBtn').addEventListener('click',downloadJson);
  $('#importBtn').addEventListener('click',()=>$('#importFile').click());
  $('#importFile').addEventListener('change',async e=>{await importJson(e.target.files[0]);e.target.value='';});
  $('#settingsBtn').addEventListener('click',()=>{
    const answer=confirm('ASETUKSET\n\nPalautetaanko kaikki paikalliset mallitehtävät, yksiköt, loki ja kartta-asetukset alkutilaan?\n\nPeruuta = älä muuta mitään.');
    if(!answer)return;
    S=defaults();if(map){map.setView(center,11);configureLayers();}
    commit('Paikallinen mallitila palautettu.');
  });
  $('#layerPanelButton').addEventListener('click',()=>{
    const panel=$('#layerPanel');panel.hidden=!panel.hidden;
    $('#layerPanelButton').setAttribute('aria-expanded',String(!panel.hidden));
    $('#layerPanelButton').classList.toggle('active',!panel.hidden);
  });
  $('#closeLayerPanel').addEventListener('click',()=>{
    $('#layerPanel').hidden=true;$('#layerPanelButton').setAttribute('aria-expanded','false');$('#layerPanelButton').classList.remove('active');
  });
  $$('.layer-option input[name="basemap"]').forEach(el=>el.addEventListener('change',e=>{if(e.target.checked)changeBasemap(e.target.value);}));
  $$('.layer-option input[data-layer]').forEach(el=>el.addEventListener('change',e=>toggleLayer(e.target.dataset.layer,e.target.checked)));
  $('#layerOpacity').addEventListener('input',e=>{S.mapSettings.opacity=Number(e.target.value);updateOpacity();});
  $('#applyMmlKey').addEventListener('click',()=>{
    const key=$('#mmlKey').value.trim();
    if(!key){notify('Syötä ensin oma MML API-avain.');return;}
    mmlApiKey=key;
    try{sessionStorage.setItem('kenttatyoasema_mml_key',key);}catch{}
    buildMmlLayer();changeBasemap('mml');
    $('#layerNote').textContent='MML-maastokartta käytössä omalla API-avaimella. Julkinen WMTS-palvelu saattaa rajoittaa tai estää pyyntöjä.';
  });
  $('#toggleTaskMarkers').addEventListener('click',()=>{S.mapSettings.showTasks=!S.mapSettings.showTasks;configureLayers();});
  $('#toggleUnitMarkers').addEventListener('click',()=>{S.mapSettings.showUnits=!S.mapSettings.showUnits;configureLayers();});
  $('#pointButton').addEventListener('click',()=>{
    if(!map)return notify('Kartta ei ole käytettävissä.');
    setPointerMode(pointerMode?.type==='newIncident'?null:{type:'newIncident'});
  });
  $('#measureButton').addEventListener('click',()=>{
    if(!map)return notify('Kartta ei ole käytettävissä.');
    if(pointerMode?.type==='measure')endMeasure();
    else setPointerMode({type:'measure'});
  });
  // Popupit ovat karttakirjaston luomaa HTML:ää, joten kuuntelemme delegoidusti.
  document.addEventListener('click',e=>{
    const open=e.target.closest('[data-map-select]');
    if(open){selectEntity(open.dataset.mapSelect,open.dataset.id);}
    const del=e.target.closest('[data-delete-feature]');
    if(del){
      S.features=S.features.filter(f=>f.id!==del.dataset.deleteFeature);
      record('KARTTA','Oma paikkamerkintä poistettu');commit('Merkintä poistettu.');
    }
  });
  document.addEventListener('keydown',e=>{
    const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');
    if(e.key==='Escape') {
      if(!$('#modalBackdrop').hidden){closeModal();return;}
      if(pointerMode?.type==='measure'){endMeasure();return;}
      if(pointerMode){setPointerMode(null);return;}
    }
    if(e.key==='F2') {e.preventDefault();openIncidentModal();}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch').focus();$('#globalSearch').select();}
    if(!typing&&e.key.toLowerCase()==='m'&&e.altKey){e.preventDefault();$('#layerPanelButton').click();}
  });
}
function initialize() {
  $('#systemClock').textContent=new Date().toLocaleTimeString('fi-FI');
  setInterval(()=>$('#systemClock').textContent=new Date().toLocaleTimeString('fi-FI'),1000);
  attachListeners();
  prepareMap();
  render();
  if(S.mapSettings.base==='topo')$('#layerNote').textContent='Maastokartta sisältää korkeuskäyriä ja maastokohteita. SYKE-syvyysaineiston kattavuus on rajallinen.';
}
initialize();
})();
