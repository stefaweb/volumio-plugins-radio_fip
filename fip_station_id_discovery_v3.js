#!/usr/bin/env node

/*
 FIP STATION ID DISCOVERY v3.0

 Recherche automatique des IDs FIP dans Radio France livemeta

 Sortie :
   fip_station_id_database.json
*/


const fs = require("fs");


const MAX_ID = 150;
const DELAY = 100;


const ENDPOINTS = [
    id => `https://api.radiofrance.fr/livemeta/pull/${id}`,
    id => `https://api.radiofrance.fr/livemeta/pull/${id}?format=json`
];



function sleep(ms)
{
    return new Promise(resolve=>setTimeout(resolve,ms));
}



async function fetchJson(url)
{
    try
    {
        const r = await fetch(url,{
            headers:{
                "User-Agent":
                "Mozilla/5.0 RadioFrance FIP scanner"
            }
        });


        const ct =
        r.headers.get("content-type") || "";


        if(!r.ok)
            return null;


        if(!ct.includes("json"))
            return null;


        return await r.json();

    }
    catch(e)
    {
        return null;
    }
}




function flatten(obj,path="")
{
    let out=[];


    if(!obj ||
       typeof obj !== "object")
        return out;


    for(const key of Object.keys(obj))
    {

        const p =
        path ? path+"."+key : key;


        if(typeof obj[key]==="object")
        {
            out.push(...flatten(obj[key],p));
        }
        else
        {
            out.push({
                path:p,
                value:String(obj[key])
            });
        }
    }


    return out;
}




function extractMusic(data)
{

    let tracks=[];


    let current={};


    for(const x of data)
    {

        if(
            x.path.includes(".title")
        )
        {

            if(Object.keys(current).length)
                tracks.push(current);


            current={
                title:x.value
            };

        }


        if(
            x.path.includes("authors")
        )
        {
            current.artist=x.value;
        }


        if(
            x.path.includes("titreAlbum")
        )
        {
            current.album=x.value;
        }


        if(
            x.path.includes("label")
        )
        {
            current.label=x.value;
        }

    }


    if(Object.keys(current).length)
        tracks.push(current);



    return tracks.slice(0,10);

}





function analyse(id,json)
{

    const data=flatten(json);


    const text =
    data
    .map(x=>x.value)
    .join(" ")
    .toLowerCase();



    let score=0;
    let reasons=[];



    /*
       Signature FIP
    */


    if(text.includes("fip"))
    {
        score+=50;
        reasons.push("fip");
    }



    /*
       Métadonnées musicales
    */


    const musicCount =
    data.filter(x=>
        x.path.includes("authors") ||
        x.path.includes("titreAlbum") ||
        x.path.includes("label")
    ).length;



    if(musicCount>=8)
    {
        score+=25;
        reasons.push("music-metadata");
    }



    /*
       Liens musique
    */


    if(
        text.includes("music.apple") ||
        text.includes("youtube")
    )
    {
        score+=10;
        reasons.push("music-links");
    }




    /*
       Genres FIP
    */


    const genres=[
        "jazz",
        "groove",
        "electro",
        "hip-hop",
        "hip hop",
        "metal",
        "reggae",
        "soul",
        "funk",
        "world"
    ];


    for(const g of genres)
    {
        if(text.includes(g))
        {
            score+=5;
            reasons.push(g);
        }
    }



    /*
       Exclusions
    */


    const bad=[
        "france inter",
        "france musique",
        "france culture",
        "franceinfo"
    ];


    for(const b of bad)
    {
        if(text.includes(b))
        {
            score-=60;
            reasons.push(
                "exclude:"+b
            );
        }
    }





    const tracks =
    extractMusic(data);



    /*
       Validation musique réelle
    */


    let validTracks =
    tracks.filter(t=>
        t.title &&
        t.artist
    );


    if(validTracks.length>=3)
    {
        score+=15;
        reasons.push(
            "tracks"
        );
    }



    return {

        id,

        score,

        confidence:
            Math.round(
                Math.min(
                    100,
                    Math.max(
                        0,
                        score
                    )
                )
            ),


        reasons,


        tracks:
        validTracks.slice(0,5)

    };

}





async function scanId(id)
{

    for(const make of ENDPOINTS)
    {

        const url=make(id);


        const json=
        await fetchJson(url);



        if(json)
        {
            return analyse(
                id,
                json
            );
        }

    }


    return null;

}







(async()=>{


console.log(
"\nFIP STATION ID DISCOVERY v3.0\n"
);



let results=[];



for(
let id=1;
id<=MAX_ID;
id++
)
{

    process.stdout.write(
        `Scan ${id}/${MAX_ID}\r`
    );


    const result =
    await scanId(id);



    if(
        result &&
        result.score>=35
    )
    {

        console.log(
            "\nFOUND",
            id,
            "score",
            result.score,
            result.reasons
        );


        results.push(result);

    }



    await sleep(DELAY);

}




results.sort(
(a,b)=>
b.score-a.score
);



fs.writeFileSync(
"fip_station_id_database.json",
JSON.stringify(
results,
null,
4
)
);



console.log(
"\n\nTerminé"
);


console.log(
"Stations candidates:",
results.length
);


console.log(
"Fichier : fip_station_id_database.json"
);



})();
