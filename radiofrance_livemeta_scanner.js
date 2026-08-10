#!/usr/bin/env node
'use strict';

const fs=require('fs');

const args=process.argv.slice(2);
function opt(n,d){const i=args.indexOf(n);return i>=0&&args[i+1]?args[i+1]:d;}

const MAX_ID=Number(opt('--max-id',300));
const DELAY=Number(opt('--delay',100));

const FIP_STREAMS=[
 {id:'national',title:'FIP National',stream:'https://icecast.radiofrance.fr/fip-hifi.aac?id=radiofrance',logo:'fip-national.png'},
 {id:'jazz',title:'FIP Jazz',stream:'https://icecast.radiofrance.fr/fipjazz-hifi.aac?id=radiofrance',logo:'fip-jazz.png'},
 {id:'groove',title:'FIP Groove',stream:'https://icecast.radiofrance.fr/fipgroove-hifi.aac?id=radiofrance',logo:'fip-groove.png'},
 {id:'electro',title:'FIP Electro',stream:'https://icecast.radiofrance.fr/fipelectro-hifi.aac?id=radiofrance',logo:'fip-electro.png'},
 {id:'hiphop',title:'FIP Hip-Hop',stream:'https://icecast.radiofrance.fr/fiphiphop-hifi.aac?id=radiofrance',logo:'fip-hiphop.png'},
 {id:'metal',title:'FIP Metal',stream:'https://icecast.radiofrance.fr/fipmetal-hifi.aac?id=radiofrance',logo:'fip-metal.png'}
];

const KNOWN_IDS={
 7:'national'
};

function sleep(ms){
 return new Promise(r=>setTimeout(r,ms));
}

async function getJson(url){
 try{
  const r=await fetch(url,{
   headers:{
    'User-Agent':'Mozilla/5.0 RadioFrance Scanner'
   }
  });
  if(!r.ok)return null;
  return await r.json();
 }catch(e){
  return null;
 }
}

function flatten(obj,path=''){
 let out=[];
 if(!obj||typeof obj!=='object')return out;
 for(const k of Object.keys(obj)){
  const p=path?path+'.'+k:k;
  if(typeof obj[k]==='object')
   out.push(...flatten(obj[k],p));
  else
   out.push({path:p,value:String(obj[k])});
 }
 return out;
}

function getText(json){
 return flatten(json)
 .map(x=>x.value)
 .join(' ')
 .toLowerCase();
}

function extractTracks(json){
 const flat=flatten(json);
 let tracks=[];
 let current={};

 for(const x of flat){

  if(x.path.includes('.title')){
   if(Object.keys(current).length)
    tracks.push(current);
   current={title:x.value};
  }

  if(x.path.includes('authors'))
   current.artist=x.value;

  if(x.path.includes('titreAlbum'))
   current.album=x.value;
 }

 if(Object.keys(current).length)
  tracks.push(current);

 return tracks.filter(t=>t.title).slice(0,5);
}

function detectGenre(text){
 if(text.includes('jazz'))return 'jazz';
 if(text.includes('groove'))return 'groove';
 if(text.includes('electro'))return 'electro';
 if(text.includes('metal'))return 'metal';
 if(text.includes('hip hop')||text.includes('hip-hop'))return 'hiphop';
 return 'national';
}

async function scanId(id){
 const urls=[
  `https://api.radiofrance.fr/livemeta/pull/${id}`,
  `https://api.radiofrance.fr/livemeta/pull/${id}?format=json`
 ];

 for(const url of urls){
  const json=await getJson(url);
  if(json)
   return {id,json,text:getText(json)};
 }
 return null;
}

function matchStation(scan){
 if(KNOWN_IDS[scan.id])
  return FIP_STREAMS.find(s=>s.id===KNOWN_IDS[scan.id]);

 const genre=detectGenre(scan.text);

 return FIP_STREAMS.find(s=>s.id===genre);
}

(async()=>{

 console.log('Radio France FIP Scanner');
 console.log(`Scan IDs 1-${MAX_ID}`);

 const matches={};

 for(let id=1;id<=MAX_ID;id++){

  process.stdout.write(`Scan ${id}/${MAX_ID}\r`);

  const scan=await scanId(id);

  if(scan){

   const station=matchStation(scan);

   if(station){

    if(!matches[station.id] ||
       matches[station.id].score < scan.text.length){

     matches[station.id]={
      station,
      metadataId:scan.id,
      tracks:extractTracks(scan.json)
     };

     console.log('');
     console.log(
      'Trouvé:',
      station.title,
      'ID:',
      scan.id
     );
    }
   }
  }

  await sleep(DELAY);
 }

 const output=[];

 for(const station of FIP_STREAMS){

  const found=matches[station.id];

  output.push({
   id:station.id,
   title:station.title,
   stream:station.stream,
   metadataId:found ? found.metadataId : null,
   logo:station.logo
  });
 }

 fs.writeFileSync(
  'radio_stations.json',
  JSON.stringify(output,null,4)
 );

 console.log('');
 console.log('Terminé');
 console.log('Créé: radio_stations.json');

})();
