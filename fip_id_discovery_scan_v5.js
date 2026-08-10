#!/usr/bin/env node

/*
 FIP ID DISCOVERY SCANNER v5.0

 Détection radios FIP Radio France
*/

const fs = require("fs");


const MAX_ID = 200;
const DELAY = 120;

const BASE =
"https://api.radiofrance.fr/livemeta/pull/";


function sleep(ms)
{
    return new Promise(r=>setTimeout(r,ms));
}



async function getJSON(url)
{
    try
    {
        const r = await fetch(url,{
            headers:{
                "User-Agent":"Mozilla/5.0"
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

    if(!obj || typeof obj!=="object")
        return out;


    for(const k of Object.keys(obj))
    {
        let p =
        path ? path+"."+k : k;


        if(typeof obj[k]==="object")
            out.push(...flatten(obj[k],p));
        else
            out.push({
                key:p,
                value:String(obj[k])
            });
    }

    return out;
}



function analyse(id,json)
{
    const data=flatten(json);


    let score=0;
    let positive=[];
    let negative=[];


    let text =
    data.map(x=>x.value)
    .join(" ")
    .toLowerCase();



    /*
      Signature FIP
    */


    if(text.includes("fip"))
    {
        score+=50;
        positive.push("fip");
    }


    if(
        text.includes("music.apple") ||
        text.includes("youtube")
    )
    {
        score+=5;
        positive.push("music-links");
    }


    /*
      Métadonnées musicales
    */

    let musicFields=0;


    for(const x of data)
    {
        if(
            x.key.includes("authors") ||
            x.key.includes("titreAlbum") ||
            x.key.includes("label")
        )
        {
            musicFields++;
        }
    }


    if(musicFields>5)
    {
        score+=20;
        positive.push(
            "music-metadata"
        );
    }


    /*
      Genres FIP
    */


    const genres=[
        "jazz",
        "groove",
        "electro",
        "hip hop",
        "hip-hop",
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
            score+=8;
            positive.push(g);
        }
    }



    /*
      Exclusions
    */


    const exclude=[
        "france musique",
        "france inter",
        "france culture",
        "franceinfo"
    ];


    for(const e of exclude)
    {
        if(text.includes(e))
        {
            score-=40;
            negative.push(e);
        }
    }



    /*
      Extraction titres
    */


    let samples=[];


    for(const x of data)
    {
        if(
            x.key.includes(".title") ||
            x.key.includes("authors")
        )
        {
            samples.push(x.value);
        }
    }


    return {

        id,

        score,

        confidence:
            Math.min(
                1,
                Math.max(
                    0,
                    score/100
                )
            ),

        positive,

        negative,

        samples:
            samples.slice(0,12)

    };

}



async function scan(id)
{

    const urls=[
        BASE+id,
        BASE+id+"?format=json"
    ];


    for(const url of urls)
    {

        let json=
        await getJSON(url);


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
"\nFIP ID DISCOVERY SCANNER v5.0\n"
);


let results=[];


for(
let id=1;
id<=MAX_ID;
id++
)
{

    process.stdout.write(
        "Scan "+id+"\r"
    );


    let r=
    await scan(id);


    if(
        r &&
        r.score>=15
    )
    {

        console.log(
            "\nFOUND",
            r.id,
            "score",
            r.score,
            r.positive
        );


        results.push(r);

    }


    await sleep(DELAY);

}



results.sort(
(a,b)=>b.score-a.score
);



fs.writeFileSync(
"fip_id_candidates_v5.json",
JSON.stringify(
results,
null,
4
)
);



let detected =
results.filter(
x=>x.score>=50
);



fs.writeFileSync(
"radio_fip_detected_v5.json",
JSON.stringify(
detected,
null,
4
)
);



console.log("\nFINI");

console.log(
"Candidats:",
results.length
);

console.log(
"FIP détectés:",
detected.length
);

console.log(
"Fichiers créés:"
);

console.log(
"- fip_id_candidates_v5.json"
);

console.log(
"- radio_fip_detected_v5.json"
);


})();

