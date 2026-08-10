#!/usr/bin/env node
/*
 * FIP Station ID Deep Discovery v3
 *
 * Scan Radio France livemeta IDs
 *
 * Compatible Node.js 18+
 */

const fs = require("fs");
const https = require("https");

const OUTPUT = "fip_station_discovery_v3.json";
const OUTPUT_CANDIDATES = "fip_station_candidates.json";

const MIN_ID = 1;
const MAX_ID = 150;

const KEYWORDS = [
    "fip",
    "jazz",
    "groove",
    "electro",
    "hip",
    "hop",
    "metal",
    "rock",
    "reggae",
    "pop"
];


function httpGet(url) {

    return new Promise((resolve) => {

        https.get(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 RadioFIPScanner/3.0"
            }
        }, res => {

            let data = "";

            res.on("data", chunk => {
                data += chunk;
            });

            res.on("end", () => {

                resolve({
                    status: res.statusCode,
                    type: res.headers["content-type"] || "",
                    body: data
                });

            });

        }).on("error", err => {

            resolve({
                status: 0,
                type: "",
                body: "",
                error: err.message
            });

        });

    });

}



async function getJSON(id) {

    const urls = [
        `https://api.radiofrance.fr/livemeta/pull/${id}`,
        `https://api.radiofrance.fr/livemeta/pull/${id}?format=json`
    ];


    for (const url of urls) {

        const r = await httpGet(url);


        if (
            r.status === 200 &&
            r.type.includes("json")
        ) {

            try {

                return {
                    url,
                    json: JSON.parse(r.body)
                };

            } catch(e) {}

        }

    }


    return null;

}



function flatten(obj, path = "", out = {}) {

    if (!obj)
        return out;


    if (typeof obj === "object") {

        for (const key of Object.keys(obj)) {

            flatten(
                obj[key],
                path ? `${path}.${key}` : key,
                out
            );

        }

    }

    else {

        out[path] = String(obj);

    }


    return out;

}



function analyse(id, data) {


    const flat = flatten(data);


    const text =
        Object.values(flat)
        .join(" ")
        .toLowerCase();



    let score = 0;


    for (const k of KEYWORDS) {

        if (text.includes(k))
            score++;

    }


    const metadata = {};


    for (const [k,v] of Object.entries(flat)) {

        if (
            k.match(
                /(title|author|artist|album|label|firstLine|secondLine)/i
            )
        ) {

            metadata[k] = v;

        }

    }


    return {

        id,
        score,
        metadata,
        preview:
            text.substring(0,300)

    };

}



async function main() {


    console.log("");
    console.log("FIP STATION ID DEEP DISCOVERY v3");
    console.log("--------------------------------");
    console.log(
        `SCAN IDs ${MIN_ID} -> ${MAX_ID}`
    );
    console.log("");



    const found = [];
    const candidates = [];


    for (
        let id = MIN_ID;
        id <= MAX_ID;
        id++
    ) {


        process.stdout.write(
            `ID ${id} ... `
        );


        const result = await getJSON(id);


        if (!result) {

            console.log("no");

            continue;

        }


        const a =
            analyse(
                id,
                result.json
            );


        if (a.score > 0) {


            console.log(
                "MATCH score=" + a.score
            );


            const item = {

                id,
                endpoint: result.url,
                score: a.score,
                metadata: a.metadata

            };


            candidates.push(item);



            if (
                a.score >= 2 &&
                JSON.stringify(a.metadata)
                    .toLowerCase()
                    .includes("fip")
            ) {

                found.push(item);

            }


        }

        else {

            console.log("json");

        }


        await new Promise(r =>
            setTimeout(r,100)
        );

    }



    fs.writeFileSync(
        OUTPUT_CANDIDATES,
        JSON.stringify(
            candidates,
            null,
            4
        )
    );


    fs.writeFileSync(
        OUTPUT,
        JSON.stringify(
            found,
            null,
            4
        )
    );



    console.log("");
    console.log(
        "Candidates :",
        candidates.length
    );

    console.log(
        "FIP found :",
        found.length
    );

    console.log(
        "Saved :",
        OUTPUT
    );

}



main();
