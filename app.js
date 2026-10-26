/* KEJO-TYYPPINEN KENTTÄTILANNE — EPÄVIRALLINEN JULKINEN KÄYTTÖLIITTYMÄMALLI
   Ei yhteyttä KEJOon, ERICAan, VIRVEen, TUVEen tai muihin viranomaisjärjestelmiin.
   Kaikki alkutiedot ovat kuvitteellisia. Tallennus tehdään vain selaimen localStorageen.
*/
(() => {
'use strict';
const STORAGE_KEY='kejo_local_workspace_v2';
const AGENCIES={pelastus:'Pelastustoimi',ensihoito:'Ensihoito',poliisi:'Poliisi'};
const ST={vapaa:'Vapaa',halytys:'Hälytetty',matkalla:'Matkalla',kohteessa:'Kohteessa',varattu:'Varattu'};
const $=(selector,ctx=document)=>ctx.querySelector(selector);
const $$=(selector,ctx=document)=>[...ctx.querySelectorAll(selector)];
const pad=n=>String(n).padStart(2,'0');
const time=t=>new Date(t).toLocaleTimeString('fi-FI',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const shortTime=t=>new Date(t).toLocaleTimeString('fi-FI',{hour:'2-digit',minute:'2-digit'});
const dateTime=t=>new Date(t).toLocaleString('fi-FI');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validCoord=(a,b)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a))<=90&&Math.abs(Number(b))<=180;
const id=()=>String(Date.now()).slice(-9)+Math.random().toString(36).slice(2,6);
const stamp=(mins=0)=>new Date(Date.now()-mins*60000).toISOString();
function initialState(){
  const incidents=[
    {id:'T-260401',time:stamp(19),code:'402',title:'Rakennuspalo',address:'Kauppakatu, Joensuu',priority:'A',agency:'pelastus',status:'avoin',lat:62.6034,lng:29.7621,description:'Kuvitteellinen ilmoitus: savuhavainto rakennuksen porrashuoneessa.',units:['RPK131','RPK132'],source:'Mallitehtävä'},
    {id:'T-260402',time:stamp(12),code:'700',title:'Äkillinen sairastuminen',address:'Noljakantie, Joensuu',priority:'B',agency:'ensihoito',status:'avoin',lat:62.6180,lng:29.7190,description:'Kuvitteellinen tehtävä. Ei todellisia potilastietoja.',units:['EPK101'],source:'Mallitehtävä'},
    {id:'T-260403',time:stamp(8),code:'202',title:'Liikenneonnettomuus',address:'Kuopiontie, Joensuu',priority:'B',agency:'pelastus',status:'avoin',lat:62.6250,lng:29.7571,description:'Kuvitteellinen liikennetapahtuma, kaksi ajoneuvoa.',units:[],source:'Mallitehtävä'},
    {id:'T-260404',time:stamp(4),code:'123',title:'Häiriötehtävä',address:'Rantakatu, Joensuu',priority:'C',agency:'poliisi',status:'avoin',lat:62.6009,lng:29.7691,description:'Kuvitteellinen poliisitehtävä. Ei henkilötietoja.',units:['IP 310'],source:'Mallitehtävä'}
  ];
  const units=[
    {id:'RPK131',agency:'pelastus',type:'Sammutusyksikkö',status:'kohteessa',lat:62.6046,lng:29.7610},
    {id:'RPK132',agency:'pelastus',type:'Säiliöyksikkö',status:'matkalla',lat:62.6142,lng:29.7601},
    {id:'RPK301',agency:'pelastus',type:'Pelastusyksikkö',status:'vapaa',lat:62.5891,lng:29.7552},
    {id:'EPK101',agency:'ensihoito',type:'Ensihoitoyksikkö',status:'kohteessa',lat:62.6164,lng:29.7216},
    {id:'EPK102',agency:'ensihoito',type:'Ensihoitoyksikkö',status:'vapaa',lat:62.5945,lng:29.7712},
    {id:'EPK103',agency:'ensihoito',type:'Ensihoitoyksikkö',status:'vapaa',lat:62.6107,lng:29.7966},
    {id:'IP 310',agency:'poliisi',type:'Poliisipartio',status:'matkalla',lat:62.5996,lng:29.7802},
    {id:'IP 311',agency:'poliisi',type:'Poliisipartio',status:'vapaa',lat:62.6097,lng:29.7727}
  ];
  const logs=[
    {id:id(),time:stamp(18),target:'RPK131',message:'Yksikön tila: Kohteessa'},
    {id:id(),time:stamp(17),target:'T-260401',message:'Tilannetieto päivitetty (mallitieto)'},
    {id:id(),time:stamp(12),target:'T-260402',message:'Tehtävä vastaanotettu'},
    {id:id(),time:stamp(8),target:'T-260403',message:'Tehtävä vastaanotettu'},
    {id:id(),time:stamp(4),target:'T-260404',message:'Tehtävä vastaanotettu'}
  ];
  return {incidents,units,logs,selected:{type:'incident',id:'T-260401'},agencyFilter:'all',showClosed:false,freeOnly:false,search:'',logSearch:'',detailTab:'info',map:{units:true,tasks:true},view:'tilannekuva'};
}
let S;
try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));S=raw&&Array.isArray(raw.incidents)&&Array.isArray(raw.units)&&Array.isArray(raw.logs)?{...initialState(),...raw}:initialState()}catch{S=initialState()}
let map=null,incidentMarkers=new Map(),unitMarkers=new Map(),pointMode=false,pendingPoint=null,activeModal=null,toastTimeout=null;
const persist=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(S))}catch{toast('Selaimen tallennustila ei ole käytettävissä.')}};
function log(target,message){S.logs.unshift({id:id(),time:new Date().toISOString(),target,message});if(S.logs.length>700)S.logs.length=700;}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('shown');$('#statusMessage').textContent=message;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('shown'),3600)}
function getIncident(incidentId){return S.incidents.find(x=>x.id===incidentId)}
function getUnit(unitId){return S.units.find(x=>x.id===unitId)}
function currentIncident(){return S.selected?.type==='incident'?getIncident(S.selected.id):null}
function currentUnit(){return S.selected?.type==='unit'?getUnit(S.selected.id):null}
function unitTask(u){return S.incidents.find(x=>x.units.includes(u.id)&&x.status!=='paattynyt')}
function select(type,ident,{zoom=false}={}){S.selected={type,id:ident};S.detailTab='info';persist();render();if(zoom)zoomToSelected()}
function statusSpan(key){return `<span class="status-label st-${esc(key)}">${esc(ST[key]||key)}</span>`}
function matchesSearch(values){if(!S.search)return true;return values.some(v=>String(v||'').toLowerCase().includes(S.search.toLowerCase()))}
function renderIncidents(){
 const items=S.incidents.filter(x=>(S.showClosed||x.status!=='paattynyt')&&(S.agencyFilter==='all'||x.agency===S.agencyFilter)&&matchesSearch([x.id,x.title,x.code,x.address,AGENCIES[x.agency],x.priority]));
 items.sort((a,b)=>Date.parse(b.time)-Date.parse(a.time));$('#incidentCount').textContent=S.incidents.filter(x=>x.status!=='paattynyt').length;
 $('#filteredIncidents').textContent=`${items.length} näkyvissä`;
 $('#incidentsTbody').innerHTML=items.map(x=>`<tr tabindex="0" data-incident="${esc(x.id)}" class="${S.selected?.type==='incident'&&S.selected.id===x.id?'selected':''} ${x.status==='paattynyt'?'muted':''}" title="${esc(x.id)} – ${esc(x.title)}"><td class="time">${shortTime(x.time)}</td><td class="code">${esc(x.code)}</td><td><div class="event-title">${esc(x.title)} ${x.status==='paattynyt'?'✓':''}</div><span class="event-place">${esc(x.address)}</span></td><td><span class="pill p-${x.priority.toLowerCase()}">${esc(x.priority)}</span></td></tr>`).join('')||'<tr><td colspan="4" style="padding:14px;color:#80919a">Ei haun mukaisia tehtäviä.</td></tr>';
 $$('#agencyFilters .chip').forEach(b=>b.classList.toggle('selected',b.dataset.agency===S.agencyFilter));$('#closedToggleLabel').textContent=S.showClosed?'Myös päättyneet':'Aktiiviset';
}
function renderUnits(){
 const items=S.units.filter(u=>(!S.freeOnly||u.status==='vapaa')&&matchesSearch([u.id,u.type,ST[u.status],AGENCIES[u.agency],unitTask(u)?.id]));
 items.sort((a,b)=>a.id.localeCompare(b.id,'fi'));
 $('#unitCount').textContent=S.units.length;
 $('#unitsTbody').innerHTML=items.map(u=>`<tr data-unit="${esc(u.id)}" tabindex="0" class="${S.selected?.type==='unit'&&S.selected.id===u.id?'selected':''}"><td class="unit-code">${esc(u.id)}</td><td>${esc(u.agency==='pelastus'?'PEL':u.agency==='ensihoito'?'ENS':'POL')}</td><td>${statusSpan(u.status)}</td><td class="mono">${esc(unitTask(u)?.id||'—')}</td></tr>`).join('')||'<tr><td colspan="4" style="padding:14px;color:#80919a">Ei yksiköitä.</td></tr>';
 $('#unitsFooter').textContent=`${S.units.filter(u=>u.status==='vapaa').length} vapaana / ${S.units.length} kaikkiaan`;
 $('#freeOnlyText').textContent=S.freeOnly?'Vain vapaat':'Kaikki tilat';
}
function row(key,value){return `<tr><td>${esc(key)}</td><td>${value}</td></tr>`}
function renderDetails(){
 const i=currentIncident(),u=currentUnit();
 $('#detailHeading').textContent=i?'TEHTÄVÄTIEDOT':u?'YKSIKKÖTIEDOT':'TIEDOT';
 $('#detailId').textContent=i?.id||u?.id||'Ei valintaa';
 $$('.detail-tab').forEach(b=>b.classList.toggle('selected',b.dataset.tab===S.detailTab));
 if(!i&&!u){$('#detailBody').innerHTML='<div class="empty-detail"><div class="empty-icon">▤</div><strong>Ei valittua kohdetta</strong><span>Valitse tehtävä tai yksikkö vasemmalta luettelosta tai kartalta.</span></div>';return}
 if(i){renderIncidentDetails(i)}else{renderUnitDetails(u)}
}
function renderIncidentDetails(i){
 if(S.detailTab==='history'){
   const history=S.logs.filter(l=>l.target===i.id||i.units.includes(l.target));
   $('#detailBody').innerHTML=`<div class="section-label">TEHTÄVÄN TAPAHTUMAT (${history.length})</div>${history.length?history.map(l=>`<div class="history-record"><time>${esc(dateTime(l.time))} · ${esc(l.target)}</time>${esc(l.message)}</div>`).join(''):'<p>Ei merkintöjä.</p>'}<button class="action" data-act="newNote">＋ Lisää tapahtumamerkintä</button>`;
   return;
 }
 if(S.detailTab==='resources'){
  const assigned=i.units.map(x=>getUnit(x)).filter(Boolean);
  const available=S.units.filter(u=>!i.units.includes(u.id)&&(!unitTask(u)||unitTask(u)?.id===i.id));
  $('#detailBody').innerHTML=`<div class="section-label">TEHTÄVÄLLE LIITETYT YKSIKÖT (${assigned.length})</div>${assigned.map(u=>`<div class="assigned-unit"><div class="label"><b>${esc(u.id)}</b><small>${esc(u.type)} · ${esc(ST[u.status]||u.status)}</small></div><button class="tiny-action red" data-act="releaseUnit" data-id="${esc(u.id)}">Vapauta</button><button class="tiny-action" data-act="openUnit" data-id="${esc(u.id)}">Avaa</button></div>`).join('')||'<p style="color:#728493">Ei liitettyjä yksiköitä.</p>'}<div class="section-label">LIITÄ YKSIKKÖ</div><div class="assign-row"><select id="assignUnitSelect" class="formcontrol">${available.map(u=>`<option value="${esc(u.id)}">${esc(u.id)} · ${esc(ST[u.status])}</option>`).join('')}</select><button class="action primary" data-act="assignUnit" ${!available.length||i.status==='paattynyt'?'disabled':''}>Liitä</button></div><div class="form-hint">Yksikön liittäminen ja vapauttaminen vaikuttaa vain tämän selaimen mallidataan.</div>`;
  return;
 }
 $('#detailBody').innerHTML=`
  <div class="section-label">PERUSTIEDOT</div><table class="field-table">
   ${row('Tehtävätunnus',`<span class="mono">${esc(i.id)}</span>`)}
   ${row('Tehtäväkoodi',`<span class="mono">${esc(i.code)}</span>`)}
   ${row('Tehtävä',esc(i.title))}
   ${row('Kiireellisyys',`<span class="pill p-${i.priority.toLowerCase()}">${esc(i.priority)}</span>`)}
   ${row('Toimiala',esc(AGENCIES[i.agency]||i.agency))}
   ${row('Tila',i.status==='paattynyt'?'Päättynyt':'Aktiivinen')}
   ${row('Ilmoitusaika',esc(dateTime(i.time)))}
   ${row('Lähde',esc(i.source||'Paikallinen syöttö'))}
  </table>
  <div class="section-label">SIJAINTI</div><table class="field-table">${row('Kohdeosoite',esc(i.address))}${row('Koordinaatit',`<span class="mono">${Number(i.lat).toFixed(5)}, ${Number(i.lng).toFixed(5)}</span>`)}</table>
  <div class="section-label">TEHTÄVÄKUVAUS</div><div class="detail-comment">${esc(i.description||'Ei kirjauksia.')}</div>
  <div class="section-label">TOIMINNOT</div><div class="detail-actions"><button class="action" data-act="editIncident">Muokkaa tietoja</button><button class="action" data-act="focusIncident">Näytä kartalla</button><button class="action" data-act="newNote">Kirjaa tapahtuma</button><button class="action ${i.status==='paattynyt'?'green':'danger'}" data-act="toggleIncident">${i.status==='paattynyt'?'Avaa uudelleen':'Päätä tehtävä'}</button></div>
  <div class="section-label">RESURSSIT</div><div>${i.units.length?i.units.map(x=>`<span class="status-label">${esc(x)}</span>`).join(' '):'Ei liitettyjä yksiköitä'}</div>
  <div class="app-warning">Tämä ei ole oikean KEJO-järjestelmän näkymä eikä käytä viranomaisten tehtävä- tai henkilötietoja.</div>`;
}
function renderUnitDetails(u){
 const task=unitTask(u);
 if(S.detailTab==='history'){const history=S.logs.filter(l=>l.target===u.id);$('#detailBody').innerHTML=`<div class="section-label">YKSIKÖN TAPAHTUMAT (${history.length})</div>${history.map(l=>`<div class="history-record"><time>${esc(dateTime(l.time))}</time>${esc(l.message)}</div>`).join('')||'<p>Ei tapahtumia.</p>'}`;return}
 if(S.detailTab==='resources'){$('#detailBody').innerHTML=`<div class="section-label">YKSIKÖN TEHTÄVÄ</div>${task?`<table class="field-table">${row('Tunnus',esc(task.id))}${row('Tehtävä',esc(task.title))}${row('Kohde',esc(task.address))}</table><p><button class="action" data-act="goToTask" data-id="${esc(task.id)}">Avaa tehtävä</button></p>`:'<p>Yksiköllä ei ole aktiivista tehtävää.</p>'}`;return}
 $('#detailBody').innerHTML=`<div class="section-label">YKSIKÖN TIEDOT</div><table class="field-table">${row('Tunnus',`<span class="mono">${esc(u.id)}</span>`)}${row('Toimiala',esc(AGENCIES[u.agency]||u.agency))}${row('Tyyppi',esc(u.type))}${row('Tila',statusSpan(u.status))}${row('Aktiivinen tehtävä',task?`<span class="mono">${esc(task.id)}</span>`:'Ei tehtävää')}${row('Sijainti',`<span class="mono">${Number(u.lat).toFixed(5)}, ${Number(u.lng).toFixed(5)}</span>`)}</table>
  <div class="section-label">VAIHDA YKSIKÖN TILAA</div><select class="formcontrol" id="unitStatusSelect">${Object.entries(ST).map(([k,v])=>`<option value="${k}" ${u.status===k?'selected':''}>${esc(v)}</option>`).join('')}</select>
  <div class="detail-actions"><button class="action primary" data-act="saveUnitStatus">Tallenna tila</button><button class="action" data-act="focusUnit">Näytä kartalla</button><button class="action" data-act="editUnit">Muokkaa yksikköä</button><button class="action danger" data-act="deleteUnit">Poista yksikkö</button></div>
  ${task?`<div class="section-label">TEHTÄVÄSIDONTA</div><div class="assigned-unit"><div class="label"><b>${esc(task.id)}</b><small>${esc(task.title)}</small></div><button class="tiny-action" data-act="goToTask" data-id="${esc(task.id)}">Avaa</button></div>`:''}`;
}
function renderLog(){const q=(S.logSearch||'').toLowerCase();const items=S.logs.filter(l=>[l.target,l.message,dateTime(l.time)].some(x=>String(x).toLowerCase().includes(q)));
 $('#logCount').textContent=S.logs.length;
 $('#logTbody').innerHTML=items.slice(0,300).map(l=>`<tr><td class="time">${esc(time(l.time))}</td><td class="mono">${esc(l.target)}</td><td>${esc(l.message)}</td></tr>`).join('')||'<tr><td colspan="3">Ei kirjauksia.</td></tr>'}
function renderMapMarkers(){if(!map||!window.L)return;
 incidentMarkers.forEach(m=>map.removeLayer(m));unitMarkers.forEach(m=>map.removeLayer(m));incidentMarkers.clear();unitMarkers.clear();
 if(S.map.tasks){S.incidents.filter(i=>i.status!=='paattynyt'&&validCoord(i.lat,i.lng)).forEach(i=>{
  const chosen=S.selected?.type==='incident'&&S.selected.id===i.id;
  const marker=L.marker([Number(i.lat),Number(i.lng)],{icon:L.divIcon({html:`<div class="incident-marker ${esc(i.agency)} ${chosen?'active':''}"></div>`,className:'',iconSize:[19,19],iconAnchor:[10,10]})});
  marker.addTo(map).bindTooltip(`${esc(i.code)} ${esc(i.title)} · ${esc(i.id)}`,{direction:'top',offset:[0,-8]});marker.on('click',()=>select('incident',i.id));incidentMarkers.set(i.id,marker);
 })}
 if(S.map.units){S.units.filter(u=>validCoord(u.lat,u.lng)).forEach(u=>{
  const chosen=S.selected?.type==='unit'&&S.selected.id===u.id;
  const marker=L.marker([Number(u.lat),Number(u.lng)],{icon:L.divIcon({html:`<div class="map-marker ${esc(u.agency)} ${chosen?'active':''}">${esc(u.id)}</div>`,className:'',iconSize:[70,27],iconAnchor:[35,15]})});
  marker.addTo(map).bindTooltip(`${esc(u.id)} / ${esc(ST[u.status]||u.status)}`,{direction:'top',offset:[0,-12]});marker.on('click',()=>select('unit',u.id));unitMarkers.set(u.id,marker);
 })}
 $('#mapZoom').textContent=`Kartta · zoom ${map.getZoom()}`;
}
function render(){renderIncidents();renderUnits();renderDetails();renderLog();renderMapMarkers();$('#globalSearch').value=S.search;$('#logSearch').value=S.logSearch;$$('.menu').forEach(b=>b.classList.toggle('active',b.dataset.view===S.view));$('#toggleUnits').classList.toggle('on',S.map.units);$('#toggleUnits').setAttribute('aria-pressed',String(S.map.units));$('#toggleTasks').classList.toggle('on',S.map.tasks);$('#toggleTasks').setAttribute('aria-pressed',String(S.map.tasks))}
function zoomToSelected(){if(!map)return;const x=currentIncident()||currentUnit();if(!x||!validCoord(x.lat,x.lng)){toast('Ei näytettävää sijaintia.');return}map.setView([Number(x.lat),Number(x.lng)],15)}
function fitToAll(){if(!map||!window.L)return;const pts=[...S.units,...S.incidents.filter(x=>x.status!=='paattynyt')].filter(x=>validCoord(x.lat,x.lng)).map(x=>[Number(x.lat),Number(x.lng)]);if(pts.length)map.fitBounds(L.latLngBounds(pts).pad(.23),{maxZoom:14})}
function initMap(){
 if(!window.L){$('#mapFallback').hidden=false;toast('Karttakirjasto ei latautunut. Tarvitset karttaa varten internetin.');return}
 try{
  map=L.map('map',{zoomControl:false,attributionControl:false,preferCanvas:true}).setView([62.6078,29.7560],12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,minZoom:5,attribution:'© OpenStreetMap contributors'}).addTo(map);
  L.control.zoom({position:'bottomright'}).addTo(map);
  map.on('mousemove',e=>$('#mapCoordinates').textContent=`WGS84  ${e.latlng.lat.toFixed(5)}° N  ${e.latlng.lng.toFixed(5)}° E`);
  map.on('zoomend',()=>$('#mapZoom').textContent=`Kartta · zoom ${map.getZoom()}`);
  map.on('click',e=>{if(pointMode){pendingPoint={lat:e.latlng.lat,lng:e.latlng.lng};endPointMode();openIncidentForm(null,pendingPoint)}});
  renderMapMarkers();setTimeout(()=>map?.invalidateSize(),150);
 }catch(e){console.error(e);$('#mapFallback').hidden=false;toast('Kartta ei ole käytettävissä.')}
}
function endPointMode(){pointMode=false;$('#mapGuide').hidden=true;$('#choosePoint').classList.remove('on');if(map)map.getContainer().style.cursor=''}
function fieldsForIncident(i=null,coords=null){return `
 <div class="form-two"><div class="form-field"><label for="fieldAgency">Toimiala *</label><select class="formcontrol" id="fieldAgency" name="agency" required>${Object.entries(AGENCIES).map(([k,v])=>`<option value="${k}" ${i?.agency===k?'selected':''}>${esc(v)}</option>`).join('')}</select></div><div class="form-field"><label for="fieldPriority">Kiireellisyys *</label><select class="formcontrol" id="fieldPriority" name="priority" required>${['A','B','C','D'].map(x=>`<option ${i?.priority===x?'selected':''}>${x}</option>`).join('')}</select></div></div>
 <div class="form-two"><div class="form-field"><label for="fieldCode">Tehtäväkoodi *</label><input class="formcontrol" id="fieldCode" name="code" maxlength="12" value="${esc(i?.code||'') }" placeholder="Esim. 402" required /></div><div class="form-field"><label for="fieldTitle">Tehtävän nimi *</label><input class="formcontrol" id="fieldTitle" name="title" maxlength="65" value="${esc(i?.title||'')}" placeholder="Esim. Rakennuspalo" required /></div></div>
 <div class="form-field"><label for="fieldAddress">Kohdeosoite / paikka *</label><input class="formcontrol" id="fieldAddress" name="address" maxlength="140" value="${esc(i?.address||'')}" placeholder="Katu, kunta" required /></div>
 <div class="form-two"><div class="form-field"><label for="fieldLat">Leveysaste (WGS84) *</label><input class="formcontrol" type="number" id="fieldLat" name="lat" step="any" min="-90" max="90" value="${esc(i?.lat??coords?.lat??62.6034)}" required /></div><div class="form-field"><label for="fieldLng">Pituusaste (WGS84) *</label><input class="formcontrol" type="number" id="fieldLng" name="lng" step="any" min="-180" max="180" value="${esc(i?.lng??coords?.lng??29.7621)}" required /></div></div>
 <div class="form-field"><label for="fieldDescription">Tehtävän kuvaus</label><textarea class="formcontrol" name="description" id="fieldDescription" maxlength="1500" rows="4" placeholder="Vain keksittyä tietoa...">${esc(i?.description||'')}</textarea></div>
 <div class="form-hint">Tallenna vain kuvitteellisia tietoja. Tämä sovellus ei välitä hälytyksiä.</div>`}
function fieldsForUnit(u=null){return `<div class="form-two"><div class="form-field"><label>Yksikön tunnus *</label><input class="formcontrol" name="id" maxlength="18" value="${esc(u?.id||'')}" ${u?'readonly':''} required placeholder="RPK131" /></div><div class="form-field"><label>Toimiala *</label><select class="formcontrol" name="agency" required>${Object.entries(AGENCIES).map(([k,v])=>`<option value="${k}" ${u?.agency===k?'selected':''}>${esc(v)}</option>`).join('')}</select></div></div>
 <div class="form-field"><label>Yksikön tyyppi *</label><input class="formcontrol" name="type" maxlength="65" value="${esc(u?.type||'')}" placeholder="Pelastusyksikkö / Ensihoitoyksikkö / Poliisipartio" required /></div>
 <div class="form-two"><div class="form-field"><label>Leveysaste (WGS84) *</label><input class="formcontrol" type="number" name="lat" min="-90" max="90" step="any" value="${esc(u?.lat??62.6024)}" required /></div><div class="form-field"><label>Pituusaste (WGS84) *</label><input class="formcontrol" type="number" name="lng" min="-180" max="180" step="any" value="${esc(u?.lng??29.7595)}" required /></div></div>`}
function openModal(title,html,onSave,submitText='Tallenna'){
 activeModal=onSave;$('#modalTitle').textContent=title;$('#modalFields').innerHTML=html;$('#modalSubmit').textContent=submitText;$('#modalBackdrop').hidden=false;
 const first=$('#modalFields input:not([readonly]),#modalFields select,#modalFields textarea');first?.focus();
}
function closeModal(){activeModal=null;$('#modalBackdrop').hidden=true;$('#modalFields').innerHTML=''}
function openIncidentForm(existing=null,coords=null){openModal(existing?'Muokkaa tehtävää':'Uusi tehtävä',fieldsForIncident(existing,coords),data=>{
  if(!validCoord(data.lat,data.lng)){toast('Virheelliset koordinaatit.');return false}
  const record={agency:data.agency,priority:data.priority,code:data.code.trim(),title:data.title.trim(),address:data.address.trim(),lat:Number(data.lat),lng:Number(data.lng),description:data.description.trim()};
  if(!AGENCIES[record.agency]||!['A','B','C','D'].includes(record.priority)||!record.code||!record.title||!record.address)return false;
  if(existing){Object.assign(existing,record);log(existing.id,`Tehtävän tietoja muokattu`);select('incident',existing.id)}
  else{const task={id:`T-${String(Date.now()).slice(-9)}`,time:new Date().toISOString(),source:'Paikallinen syöttö',status:'avoin',units:[],...record};S.incidents.unshift(task);log(task.id,`Tehtävä luotu: ${task.code} ${task.title}`);select('incident',task.id);if(map)map.setView([task.lat,task.lng],14)}
  toast(existing?'Tehtävätiedot päivitetty.':'Tehtävä luotu paikallisesti.');return true;
 },existing?'Tallenna muutokset':'Luo tehtävä')}
function openUnitForm(existing=null){openModal(existing?'Muokkaa yksikköä':'Lisää yksikkö',fieldsForUnit(existing),data=>{
  const code=data.id.trim().toUpperCase();if(!code||!AGENCIES[data.agency]||!validCoord(data.lat,data.lng)||!data.type.trim())return false;
  if(existing){Object.assign(existing,{agency:data.agency,type:data.type.trim(),lat:Number(data.lat),lng:Number(data.lng)});log(existing.id,'Yksikön tietoja päivitetty');select('unit',existing.id)}
  else{if(getUnit(code)){toast('Tämä yksikkötunnus on jo käytössä.');return false}S.units.push({id:code,agency:data.agency,type:data.type.trim(),lat:Number(data.lat),lng:Number(data.lng),status:'vapaa'});log(code,'Yksikkö lisätty paikallisesti');select('unit',code)}
  toast('Yksikön tiedot tallennettu.');return true;
 })}
function openNoteForm(i){openModal(`Tapahtumamerkintä · ${i.id}`,`<div class="form-field"><label for="noteField">Merkintä *</label><textarea class="formcontrol" name="note" id="noteField" rows="5" maxlength="800" placeholder="Tapahtuman kuvaus (kuvitteellinen)..." required></textarea></div>`,data=>{if(!data.note.trim())return false;log(i.id,data.note.trim());render();toast('Merkintä tallennettu lokiin.');return true},'Lisää merkintä')}
function assignUnit(incident,unitId){const unit=getUnit(unitId);if(!unit||incident.units.includes(unitId)||incident.status==='paattynyt')return;
 const current=unitTask(unit);if(current&&current.id!==incident.id){toast(`Yksikkö ${unitId} on jo tehtävällä ${current.id}.`);return}
 incident.units.push(unitId);unit.status='halytys';log(incident.id,`Yksikkö ${unitId} liitetty tehtävään`);log(unitId,`Hälytetty tehtävälle ${incident.id}`);persist();render();toast(`Yksikkö ${unitId} liitetty tehtävään.`)}
function releaseUnit(incident,unitId){incident.units=incident.units.filter(v=>v!==unitId);const u=getUnit(unitId);if(u)u.status='vapaa';log(incident.id,`Yksikkö ${unitId} vapautettu`);log(unitId,`Vapautettu tehtävältä ${incident.id}`);persist();render();toast(`${unitId} vapautettu.`)}
function toggleIncident(i){if(i.status==='avoin'){
   if(!confirm(`Päätetäänkö tehtävä ${i.id}? Kaikki siihen liitetyt yksiköt vapautetaan.`))return;
   i.status='paattynyt';for(const code of [...i.units]){const u=getUnit(code);if(u)u.status='vapaa';log(code,`Tehtävä ${i.id} päättynyt`)}i.units=[];log(i.id,'Tehtävä päätetty');
 }else{i.status='avoin';log(i.id,'Tehtävä avattu uudelleen')}
 persist();render();toast('Tehtävän tila päivitetty.');}
function removeUnit(u){if(unitTask(u)){toast('Vapauta yksikkö ensin tehtävältä.');return}if(!confirm(`Poistetaanko yksikkö ${u.id}?`))return;S.units=S.units.filter(x=>x.id!==u.id);log(u.id,'Yksikkö poistettu');S.selected=null;persist();render();toast('Yksikkö poistettu.')}
function exportData(){const obj={format:'kejo-local-v2',exported:new Date().toISOString(),incidents:S.incidents,units:S.units,logs:S.logs};const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`kejo-paikalliset-tiedot-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);toast('JSON-tiedosto viety.')}
function importData(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{
 try{const data=JSON.parse(reader.result);if(!Array.isArray(data.incidents)||!Array.isArray(data.units)||!Array.isArray(data.logs)||data.incidents.length>3000||data.units.length>3000||data.logs.length>10000)throw Error('Väärä tiedostomuoto.');
  const cleanText=(t,max)=>String(t??'').slice(0,max);
  const units=data.units.map(x=>({id:cleanText(x.id,18),agency:AGENCIES[x.agency]?x.agency:'pelastus',type:cleanText(x.type,65),status:ST[x.status]?x.status:'vapaa',lat:Number(x.lat),lng:Number(x.lng)})).filter(x=>x.id&&validCoord(x.lat,x.lng));
  const ids=new Set(units.map(x=>x.id));
  const incidents=data.incidents.map(x=>({id:cleanText(x.id,30),code:cleanText(x.code,12),title:cleanText(x.title,65),address:cleanText(x.address,140),description:cleanText(x.description,1500),agency:AGENCIES[x.agency]?x.agency:'pelastus',priority:['A','B','C','D'].includes(x.priority)?x.priority:'C',status:x.status==='paattynyt'?'paattynyt':'avoin',time:Number.isFinite(Date.parse(x.time))?x.time:new Date().toISOString(),source:cleanText(x.source,40),lat:Number(x.lat),lng:Number(x.lng),units:Array.isArray(x.units)?x.units.filter(v=>ids.has(v)).slice(0,100):[]})).filter(x=>x.id&&validCoord(x.lat,x.lng));
  const logs=data.logs.map(x=>({id:cleanText(x.id||id(),30),time:Number.isFinite(Date.parse(x.time))?x.time:new Date().toISOString(),target:cleanText(x.target,50),message:cleanText(x.message,900)}));
  if(!confirm(`Tuodaanko ${incidents.length} tehtävää ja ${units.length} yksikköä? Nykyiset tiedot korvataan.`))return;
  Object.assign(S,{incidents,units,logs,selected:null});persist();render();fitToAll();toast('Tiedot tuotu onnistuneesti.');
 }catch(e){toast('JSON-tiedosto ei kelpaa: '+e.message)}finally{$('#importInput').value=''}
 };reader.readAsText(file)}
function handleDetailAction(button){const act=button.dataset.act;const i=currentIncident(),u=currentUnit(),which=button.dataset.id;
 switch(act){
 case 'editIncident':if(i)openIncidentForm(i);break;
 case 'focusIncident':case 'focusUnit':zoomToSelected();break;
 case 'newNote':if(i)openNoteForm(i);break;
 case 'toggleIncident':if(i)toggleIncident(i);break;
 case 'assignUnit':if(i)assignUnit(i,$('#assignUnitSelect')?.value);break;
 case 'releaseUnit':if(i&&which)releaseUnit(i,which);break;
 case 'openUnit':if(which)select('unit',which);break;
 case 'goToTask':if(which)select('incident',which);break;
 case 'saveUnitStatus':if(u){const status=$('#unitStatusSelect')?.value;if(!ST[status])return;u.status=status;log(u.id,`Yksikön tila: ${ST[status]}`);persist();render();toast(`Tila tallennettu: ${ST[status]}.`)}break;
 case 'editUnit':if(u)openUnitForm(u);break;
 case 'deleteUnit':if(u)removeUnit(u);break;
 }
}
function focusView(v){S.view=v;$$('.menu').forEach(b=>b.classList.toggle('active',b.dataset.view===v));if(v==='tilannekuva'){map?.invalidateSize();fitToAll()}else if(v==='tehtavat'){$('#incidentsPane').scrollIntoView({block:'nearest'});$('#incidentsTbody tr')?.focus()}else if(v==='yksikot'){$('#unitsPane').scrollIntoView({block:'nearest'});$('#unitsTbody tr')?.focus()}else if(v==='tapahtumat'){if($('#bottomArea').classList.contains('collapsed'))toggleLog();$('#logSearch').focus()}persist()}
function toggleLog(){const el=$('#bottomArea');const collapsed=el.classList.toggle('collapsed');$('.workspace').style.gridTemplateRows=collapsed?'49px 36px 43px minmax(0,1fr) 31px 26px':'';$('#toggleLog').textContent=collapsed?'▴':'▾';map?.invalidateSize()}
function bind(){
 $('#newIncidentBtn').addEventListener('click',()=>openIncidentForm());$('#newUnitBtn').addEventListener('click',()=>openUnitForm());
 $('#zoomToIncident').addEventListener('click',zoomToSelected);$('#zoomToAll').addEventListener('click',fitToAll);
 $('#exportData').addEventListener('click',exportData);$('#importData').addEventListener('click',()=>$('#importInput').click());$('#importInput').addEventListener('change',e=>importData(e.target.files[0]));
 $('#resetData').addEventListener('click',()=>{if(!confirm('Palautetaanko kaikki esimerkkitiedot? Nykyiset paikalliset tiedot korvataan.'))return;S=initialState();persist();render();fitToAll();toast('Esimerkkitiedot palautettu.')});
 $('#openSettings').addEventListener('click',()=>openModal('Tietoa sovelluksesta',`<p><b>KEJO-tyyppinen kenttätilanne · v2.0</b></p><p>Tämä on itsenäisesti tehty, epävirallinen käyttöliittymämalli. Se ei ole kopio todellisen KEJOn nykyisestä käyttöliittymästä.</p><p><b>Yhteydet:</b> ei yhteyttä viranomaisjärjestelmiin. <b>Tallennus:</b> vain paikallinen selaintallennus. <b>Kartta:</b> OpenStreetMap internetyhteydellä.</p><p><b>Pikanäppäimet:</b> F2 = uusi tehtävä, Ctrl+K = haku, Esc = sulje ikkuna/peru karttapiste.</p><div class="app-warning">Älä syötä oikeita potilastietoja, henkilötietoja tai operatiivisia viranomaistietoja.</div>`,()=>true,'Sulje'));
 $$('.menu').forEach(b=>b.addEventListener('click',()=>focusView(b.dataset.view)));
 $('#incidentsTbody').addEventListener('click',e=>{const tr=e.target.closest('tr[data-incident]');if(tr)select('incident',tr.dataset.incident)});
 $('#incidentsTbody').addEventListener('dblclick',e=>{if(e.target.closest('tr[data-incident]'))zoomToSelected()});
 $('#unitsTbody').addEventListener('click',e=>{const tr=e.target.closest('tr[data-unit]');if(tr)select('unit',tr.dataset.unit)});
 $('#unitsTbody').addEventListener('dblclick',e=>{if(e.target.closest('tr[data-unit]'))zoomToSelected()});
 for(const tb of ['#incidentsTbody','#unitsTbody'])$(tb).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.target.click()}});
 $$('#agencyFilters .chip').forEach(b=>b.addEventListener('click',()=>{S.agencyFilter=b.dataset.agency;persist();renderIncidents()}));
 $('#toggleClosed').addEventListener('click',()=>{S.showClosed=!S.showClosed;persist();renderIncidents()});$('#freeOnly').addEventListener('click',()=>{S.freeOnly=!S.freeOnly;persist();renderUnits()});
 $('#globalSearch').addEventListener('input',e=>{S.search=e.target.value;persist();renderIncidents();renderUnits()});
 $('#logSearch').addEventListener('input',e=>{S.logSearch=e.target.value;persist();renderLog()});$('#clearLogSearch').addEventListener('click',()=>{S.logSearch='';$('#logSearch').value='';persist();renderLog()});
 $$('.detail-tab').forEach(b=>b.addEventListener('click',()=>{S.detailTab=b.dataset.tab;persist();renderDetails()}));
 $('#detailBody').addEventListener('click',e=>{const b=e.target.closest('button[data-act]');if(b)handleDetailAction(b)});
 $('#toggleUnits').addEventListener('click',()=>{S.map.units=!S.map.units;persist();render()});$('#toggleTasks').addEventListener('click',()=>{S.map.tasks=!S.map.tasks;persist();render()});
 $('#choosePoint').addEventListener('click',()=>{pointMode=!pointMode;$('#mapGuide').hidden=!pointMode;$('#choosePoint').classList.toggle('on',pointMode);if(!map&&pointMode){endPointMode();toast('Karttaa ei ole käytettävissä. Voit kirjoittaa koordinaatit tehtäväikkunaan.')}});
 $('#toggleLog').addEventListener('click',toggleLog);
 $('#closeModal').addEventListener('click',closeModal);$('#cancelModal').addEventListener('click',closeModal);$('#modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});
 $('#modalForm').addEventListener('submit',e=>{e.preventDefault();if(!activeModal)return;const data=Object.fromEntries(new FormData(e.target).entries());if(activeModal(data)!==false){persist();render();closeModal()}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#modalBackdrop').hidden)closeModal();else endPointMode()}if(e.key==='F2'&&$('#modalBackdrop').hidden){e.preventDefault();openIncidentForm()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch').focus();$('#globalSearch').select()}});
}
function tick(){const now=new Date();$('#clock').textContent=now.toLocaleDateString('fi-FI')+'  '+now.toLocaleTimeString('fi-FI')}
bind();tick();setInterval(tick,1000);render();initMap();
})();
