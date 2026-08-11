#!/usr/bin/env node
'use strict';

const fs = require('fs');

const CONFIG = {
    minMetadataId: 1,
    maxMetadataId: 150,
    delayMs: 100,
    minScore: 60,
    timeoutMs: 5000
};

const DEBUG = process.argv.includes('--debug');
const FAST = process.argv.includes('--fast');

const METADATA_CACHE = new Map();

const STATIONS = [
    {
        id: "national",
        title: "FIP National",
        stream: "https://icecast.radiofrance.fr/fip-hifi.aac?id=radiofrance",
        metadataId: 7,
        logo: "fip-national.png"
    },
    {
        id: "electro",
        title: "FIP Electro",
        stream: "https://icecast.radiofrance.fr/fipelectro-hifi.aac?id=radiofrance",
        metadataId: 74,
        logo: "fip-electro.png"
    },
    {
        id: "groove",
        title: "FIP Groove",
        stream: "https://icecast.radiofrance.fr/fipgroove-hifi.aac?id=radiofrance",
        metadataId: 65,
        logo: "fip-groove.png"
    },
    {
        id: "hiphop",
        title: "FIP Hip Hop",
        stream: "https://icecast.radiofrance.fr/fiphiphop-hifi.aac?id=radiofrance",
        metadataId: 66,
        logo: "fip-hiphop.png"
    },
    {
        id: "jazz",
        title: "FIP Jazz",
        stream: "https://icecast.radiofrance.fr/fipjazz-hifi.aac?id=radiofrance",
        metadataId: 64,
        logo: "fip-jazz.png"
    },
    {
        id: "metal",
        title: "FIP Metal",
        stream: "https://icecast.radiofrance.fr/fipmetal-hifi.aac?id=radiofrance",
        metadataId: 68,
        logo: "fip-metal.png"
    },
    {
        id: "nouveautes",
        title: "FIP Nouveautés",
        stream: "https://icecast.radiofrance.fr/fipnouveautes-hifi.aac?id=radiofrance",
        metadataId: 70,
        logo: "fip-nouveautes.png"
    },
    {
        id: "pop",
        title: "FIP Pop",
        stream: "https://icecast.radiofrance.fr/fippop-hifi.aac?id=radiofrance",
        metadataId: 78,
        logo: "fip-pop.png"
    },
    {
        id: "reggae",
        title: "FIP Reggae",
        stream: "https://icecast.radiofrance.fr/fipreggae-hifi.aac?id=radiofrance",
        metadataId: 71,
        logo: "fip-reggae.png"
    },
    {
        id: "rock",
        title: "FIP Rock",
        stream: "https://icecast.radiofrance.fr/fiprock-hifi.aac?id=radiofrance",
        metadataId: null,
        logo: "fip-rock.png"
    },
    {
        id: "sacrefrancais",
        title: "FIP Sacré Français",
        stream: "https://icecast.radiofrance.fr/fipsacrefrancais-hifi.aac?id=radiofrance",
        metadataId: null,
        logo: "fip-sacrefrancais.png"
    },
    {
        id: "world",
        title: "FIP World",
        stream: "https://icecast.radiofrance.fr/fipworld-hifi.aac?id=radiofrance",
        metadataId: 69,
        logo: "fip-world.png"
    }
];

function sleep(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url)
{
    const controller = new AbortController();

    const timer = setTimeout(
        () => controller.abort(),
        CONFIG.timeoutMs
    );

    try
    {
        const response = await fetch(
            url,
            {
                signal: controller.signal,
                headers:
                {
                    "User-Agent": "RadioFrance-LiveMeta-Scanner-v3.1"
                }
            }
        );

        if (!response.ok)
            return null;

        return await response.json();
    }
    catch(error)
    {
        return null;
    }
    finally
    {
        clearTimeout(timer);
    }
}

async function getLiveMeta(metadataId)
{
    if (METADATA_CACHE.has(metadataId))
    {
        if (DEBUG)
            console.log(`[CACHE] metadataId=${metadataId}`);

        return METADATA_CACHE.get(metadataId);
    }

    const data = await fetchJson(
        `https://api.radiofrance.fr/livemeta/pull/${metadataId}`
    );

    METADATA_CACHE.set(
        metadataId,
        data
    );

    return data;
}

function flatten(obj, path = "")
{
    let result = [];

    if (!obj || typeof obj !== "object")
        return result;

    for (const key of Object.keys(obj))
    {
        const current = path
            ? `${path}.${key}`
            : key;

        if (typeof obj[key] === "object" && obj[key] !== null)
        {
            result.push(
                ...flatten(
                    obj[key],
                    current
                )
            );
        }
        else
        {
            result.push(
                {
                    path: current,
                    value: String(obj[key])
                }
            );
        }
    }

    return result;
}


function analyseMetadata(data)
{
    if (!data)
        return null;

    return {
        text: JSON.stringify(data).toLowerCase(),
        flat: flatten(data)
    };
}


function getStreamKey(stream)
{
    const match = stream.match(
        /(fip[a-z]+)-/
    );

    return match
        ? match[1]
        : null;
}


function scoreStation(station, metadata)
{
    if (!metadata)
        return 0;

    let score = 0;

    const text = metadata.text;

    const streamKey =
        getStreamKey(
            station.stream
        );

    if (
        streamKey
        &&
        text.includes(streamKey)
    )
    {
        score += 80;
    }

    const name =
        station.id
            .replace(
                "sacrefrancais",
                "sacre francais"
            )
            .replace(
                "nouveautes",
                "nouveautes"
            );

    if (
        text.includes(name)
    )
    {
        score += 40;
    }

    if (
        text.includes("fip")
    )
    {
        score += 10;
    }

    return score;
}


async function validateMetadata(station)
{
    const data =
        await getLiveMeta(
            station.metadataId
        );

    if (DEBUG)
    {
        console.log(
            `[CHECK] ${station.title} metadataId=${station.metadataId}`
        );
    }

    if (!data)
        return false;

    return (
        JSON.stringify(data).length > 50
    );
}


async function scanMetadataBatch(ids)
{
    return await Promise.all(
        ids.map(
            async id =>
            ({
                id: id,
                data:
                    await getLiveMeta(id)
            })
        )
    );
}


async function findMissingMetadataId(station)
{
    let bestCandidate = null;
    let bestScore = 0;

    console.log("");

    console.log(
        `Recherche metadataId : ${station.title}`
    );


    const ids = [];

    for (
        let id = CONFIG.minMetadataId;
        id <= CONFIG.maxMetadataId;
        id++
    )
    {
        ids.push(id);
    }


    for (
        let i = 0;
        i < ids.length;
        i += 10
    )
    {
        const batch =
            ids.slice(
                i,
                i + 10
            );


        if (DEBUG)
        {
            console.log(
                `[BATCH] Scan ${batch[0]}-${batch[batch.length - 1]}`
            );
        }


        const results =
            await scanMetadataBatch(
                batch
            );


        for (const item of results)
        {
            const metadata =
                analyseMetadata(
                    item.data
                );

            const score =
                scoreStation(
                    station,
                    metadata
                );


            if (
                score > bestScore
            )
            {
                bestScore = score;

                bestCandidate =
                {
                    metadataId: item.id,
                    score: score
                };


                if (DEBUG)
                {
                    console.log(
                        `[CANDIDAT] ${station.title} ID=${item.id} score=${score}`
                    );
                }
            }
        }


        if (!FAST)
        {
            await sleep(
                CONFIG.delayMs
            );
        }
    }


    if (
        bestCandidate
        &&
        bestCandidate.score >= CONFIG.minScore
    )
    {
        station.metadataId =
            bestCandidate.metadataId;

        console.log(
            `[OK] ${station.title} metadataId=${station.metadataId}`
        );

        return true;
    }


    console.log(
        `[NON TROUVE] ${station.title}`
    );

    return false;
}

async function resolveMissingStations()
{
    for (const station of STATIONS)
    {
        if (station.metadataId === null)
        {
            await findMissingMetadataId(
                station
            );

            generateRadioStations();
        }
    }
}


function generateRadioStations()
{
    const stations =
        STATIONS.map(
            station =>
            ({
                id: station.id,
                title: station.title,
                stream: station.stream,
                metadataId: station.metadataId,
                logo: station.logo
            })
        );


    fs.writeFileSync(
        "radio_stations.json",
        JSON.stringify(
            stations,
            null,
            4
        )
    );


    return stations;
}


async function validateKnownStations()
{
    console.log("");
    console.log(
        "Validation des metadataId connus"
    );
    console.log("");

    for (const station of STATIONS)
    {
        if (station.metadataId !== null)
        {
            const valid =
                await validateMetadata(
                    station
                );


            console.log(
                `${valid ? "[OK]" : "[KO]"} ${station.title} metadataId=${station.metadataId}`
            );


            if (!FAST)
            {
                await sleep(
                    CONFIG.delayMs
                );
            }
        }
    }
}


(async () =>
{
    console.log(
        "Radio France LiveMeta Scanner v3.1"
    );


    console.log(
        `Stations définies : ${STATIONS.length}`
    );


    await validateKnownStations();


    await resolveMissingStations();


    const stations =
        generateRadioStations();


    console.log("");

    console.log(
        "Scan terminé"
    );


    console.log(
        `Stations générées : ${stations.length}`
    );


    console.log(
        "Fichier créé : radio_stations.json"
    );

})();
