/* KEJO-tyyppinen epävirallinen työpöytämalli.
   Luokkalista perustuu julkiseen Wikipedia-luetteloon; EI virallinen ajantasainen koodisto.
   Esimerkkiyksiköt ja tehtävät ovat mallidataa eivätkä esitä ajantasaisia operatiivisia valmiuksia. */
window.KEJO_DATA = Object.freeze({
  codeSource: 'https://fi.wikipedia.org/wiki/Luettelo_h%C3%A4t%C3%A4keskuksen_teht%C3%A4v%C3%A4luokista',
  codes: [
    ['103','Automaattinen palohälytys','pelastus'],['105','Ilmoitinlaitehälytys: hissihälytys','pelastus'],
    ['200','Tieliikenneonnettomuus: muu tai onnettomuuden uhka','pelastus'],
    ['201','Tieliikenneonnettomuus: peltikolari, suistuminen','pelastus'],
    ['202','Tieliikenneonnettomuus: pieni','pelastus'],['203','Tieliikenneonnettomuus: keskisuuri','pelastus'],
    ['204','Tieliikenneonnettomuus: suuri','pelastus'],['212','Raideliikenneonnettomuus: pieni','pelastus'],
    ['213','Raideliikenneonnettomuus: keskisuuri','pelastus'],['214','Raideliikenneonnettomuus: suuri','pelastus'],
    ['221','Vesiliikenneonnettomuus: pieni','pelastus'],['222','Vesiliikenneonnettomuus: keskisuuri','pelastus'],
    ['223','Vesiliikenneonnettomuus: suuri','pelastus'],['231','Ilmaliikenneonnettomuus: pieni','pelastus'],
    ['232','Ilmaliikenneonnettomuus: keskisuuri','pelastus'],['233','Ilmaliikenneonnettomuus: suuri','pelastus'],
    ['271','Maastoliikenneonnettomuus','pelastus'],['401','Rakennuspalo: pieni','pelastus'],
    ['402','Rakennuspalo: keskisuuri','pelastus'],['403','Rakennuspalo: suuri','pelastus'],
    ['411','Liikennevälinepalo: pieni','pelastus'],['412','Liikennevälinepalo: keskisuuri','pelastus'],
    ['413','Liikennevälinepalo: suuri','pelastus'],['420','Savuhavainto / tarkastustehtävä','pelastus'],
    ['421','Maastopalo: pieni','pelastus'],['422','Maastopalo: keskisuuri','pelastus'],
    ['423','Maastopalo: suuri','pelastus'],['431','Tulipalo, muu: pieni','pelastus'],
    ['432','Tulipalo, muu: keskisuuri','pelastus'],['433','Tulipalo, muu: suuri','pelastus'],
    ['441','Räjähdys / sortuma: pieni','pelastus'],['442','Räjähdys / sortuma: keskisuuri','pelastus'],
    ['443','Räjähdys / sortuma: suuri','pelastus'],['451','Vaarallisen aineen onnettomuus: pieni','pelastus'],
    ['452','Vaarallisen aineen onnettomuus: keskisuuri','pelastus'],['453','Vaarallisen aineen onnettomuus: suuri','pelastus'],
    ['461','Vahingontorjunta: pieni','pelastus'],['462','Vahingontorjunta: keskisuuri','pelastus'],
    ['463','Vahingontorjunta: suuri','pelastus'],['471','Öljyvahinko maalla: pieni','pelastus'],
    ['472','Öljyvahinko maalla: keskisuuri','pelastus'],['473','Öljyvahinko maalla: suuri','pelastus'],
    ['700','Eloton','ensihoito'],['701','Elvytys','ensihoito'],['702','Tajuttomuus','ensihoito'],
    ['703','Hengitysvaikeus','ensihoito'],['704','Rintakipu','ensihoito'],
    ['705','Peruselintoiminnan häiriö: muu','ensihoito'],['706','Aivoverenkiertohäiriö','ensihoito'],
    ['711','Ilmatie-este','ensihoito'],['714','Hukkuminen','ensihoito'],
    ['741','Putoaminen','ensihoito'],['744','Haava','ensihoito'],['745','Kaatuminen','ensihoito'],
    ['746','Isku','ensihoito'],['747','Vamma: muu','ensihoito'],
    ['751','Kaasumyrkytys','ensihoito'],['752','Myrkytys','ensihoito'],
    ['753','Sähköisku','ensihoito'],['754','Palovamma','ensihoito'],
    ['755','Ylilämpöisyys','ensihoito'],['756','Paleltuminen / alilämpöisyys','ensihoito'],
    ['761','Verenvuoto: suu','ensihoito'],['771','Sokeritasapainon häiriö','ensihoito'],
    ['772','Kouristelu','ensihoito'],['773','Yliherkkyysreaktio','ensihoito'],
    ['774','Muu sairastuminen','ensihoito'],['781','Vatsakipu','ensihoito'],
    ['782','Pää- tai niskasärky','ensihoito'],['783','Selkä-, raaja- tai vartalokipu','ensihoito'],
    ['785','Mielenterveysongelma','ensihoito'],['791','Synnytys','ensihoito'],
    ['793','Hoitolaitossiirto','ensihoito']
  ],
  types: {
    pelastus: ['Sammutusyksikkö','Säiliöyksikkö','Pelastusyksikkö','Johtoyksikkö','Kärkiyksikkö','Ensivasteyksikkö','Nostolavayksikkö','Miehistöyksikkö','Öljyntorjuntayksikkö','Veneyksikkö','Raivausyksikkö','Huoltoyksikkö'],
    ensihoito: ['Hoitotason ensihoitoyksikkö','Perustason ensihoitoyksikkö','Ensihoidon kenttäjohtoyksikkö','Lääkäriyksikkö','Ensivasteyksikkö'],
    poliisi: ['Valvonta- ja hälytyspartio','Liikennevalvontapartio','Kenttäjohtoyksikkö','Tutkintapartio','Koirapartio']
  },
  capabilityLabels: ['Sammutus','Säiliövesi','Ensivaste','Sukellus','Pintapelastus','Vene','Nostolava','Raivaus','Johtaminen','Hoitotaso','Perustaso','Lääkäri','Liikennevalvonta','Koirapartio'],
  baseUnits: [
    // Asemapaikka ja RPK-tunnus julkisista PK:n ensivasteyksikkötaulukoista. Muut roolit/tilat mallitietoa.
    {call:'RPK 101',agency:'pelastus',type:'Pelastusyksikkö',station:'Noljakka',caps:['Sammutus','Ensivaste'],crew:'1+3',lat:62.6208,lng:29.7134},
    {call:'RPK 131',agency:'pelastus',type:'Sammutusyksikkö',station:'Reijola',caps:['Sammutus','Ensivaste'],crew:'1+3',lat:62.5500,lng:29.8005},
    {call:'RPK 121',agency:'pelastus',type:'Sammutusyksikkö',station:'Hammaslahti',caps:['Sammutus','Ensivaste'],crew:'1+3',lat:62.4314,lng:29.9716},
    {call:'RPK 1515',agency:'pelastus',type:'Pelastusyksikkö',station:'Pekkala',caps:['Sammutus','Ensivaste'],crew:'1+3',lat:62.6015,lng:29.7848},
    // Alla ensihoito ja poliisi: pelkkiä havainnollistavia tunnuksia, eivät oikeita partioita.
    {call:'E SIM 101',agency:'ensihoito',type:'Hoitotason ensihoitoyksikkö',station:'Joensuu (malli)',caps:['Hoitotaso'],crew:'2',lat:62.6046,lng:29.7686},
    {call:'E SIM 102',agency:'ensihoito',type:'Perustason ensihoitoyksikkö',station:'Joensuu (malli)',caps:['Perustaso'],crew:'2',lat:62.6177,lng:29.7314},
    {call:'E SIM F01',agency:'ensihoito',type:'Ensihoidon kenttäjohtoyksikkö',station:'Joensuu (malli)',caps:['Johtaminen','Hoitotaso'],crew:'1',lat:62.5945,lng:29.7585},
    {call:'P SIM 201',agency:'poliisi',type:'Valvonta- ja hälytyspartio',station:'Joensuu (malli)',caps:[],crew:'2',lat:62.6087,lng:29.7541},
    {call:'P SIM 202',agency:'poliisi',type:'Kenttäjohtoyksikkö',station:'Joensuu (malli)',caps:['Johtaminen'],crew:'1',lat:62.6070,lng:29.7520}
  ]
});
