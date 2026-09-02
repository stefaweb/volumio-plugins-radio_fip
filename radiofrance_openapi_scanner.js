#!/usr/bin/env node
'use strict';

/*
 * Radio France FIP Open API Scanner
 *
 * File        : radiofrance_openapi_scanner.js
 * Version     : 1.0.0
 * Date        : 02-09-2026
 * Author      : Stef
 *
 * Description :
 *
 *   Scanner for the Radio France Open API.
 *
 *   Retrieves the current FIP station list, validates the
 *   station-to-metadata ID mapping and generates the
 *   radio_stations.json file used by the Volumio FIP plugin.
 *
 * Compatibility :
 *
 *   Node.js 18+
 *
 * License :
 *
 *   GPL License
 *
 * Copyright (C) 2026 Stef
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'https://openapi.radiofrance.fr/v1/graphql';
const CONFIG_FILE = path.join(__dirname, 'radiofrance_openapi.conf');
const DEFAULT_OUTPUT = path.join(__dirname, 'radio_stations.json');
const args = process.argv.slice(2);

const CONFIG = {
    token: null,
    outputFile: DEFAULT_OUTPUT,
    delayMs: 100,
    timeoutMs: 5000
};

// Load scanner configuration from the external configuration file.
function loadConfig() {
    if (!fs.existsSync(CONFIG_FILE))
        throw new Error(`Configuration file not found: ${CONFIG_FILE}`);
    const lines = fs.readFileSync(CONFIG_FILE, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (!match)
            continue;
        const key = match[1];
        let value = match[2].trim();
        if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))))
            value = value.slice(1, -1);
        switch (key) {
        case 'RADIOFRANCE_TOKEN':
            CONFIG.token = value;
            break;
        case 'OUTPUT_FILE':
            CONFIG.outputFile = path.resolve(__dirname, value);
            break;
        case 'REQUEST_DELAY_MS':
            CONFIG.delayMs = Number(value);
            break;
        case 'REQUEST_TIMEOUT_MS':
            CONFIG.timeoutMs = Number(value);
            break;
        }
    }
    if (!CONFIG.token || CONFIG.token === 'PASTE_YOUR_RADIOFRANCE_TOKEN_HERE')
        throw new Error('RADIOFRANCE_TOKEN is missing from the configuration file');
    if (!Number.isFinite(CONFIG.delayMs) || CONFIG.delayMs < 0)
        throw new Error('Invalid REQUEST_DELAY_MS value');
    if (!Number.isFinite(CONFIG.timeoutMs) || CONFIG.timeoutMs <= 0)
        throw new Error('Invalid REQUEST_TIMEOUT_MS value');
}

// Parse command-line options.
function parseArguments() {
    const index = args.indexOf('--output');
    if (index >= 0 && args[index + 1])
        CONFIG.outputFile = path.resolve(__dirname, args[index + 1]);
}

// Wait for a specified number of milliseconds.
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Execute an HTTP request with a timeout.
async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.timeoutMs);
    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    }
    finally {
        clearTimeout(timer);
    }
}

// Execute a Radio France Open API GraphQL query.
async function queryOpenApi(query) {
    const response = await fetchWithTimeout(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-token': CONFIG.token,
            'User-Agent': 'RadioFrance-FIP-OpenAPI-Scanner'
        },
        body: JSON.stringify({ query })
    });
    const text = await response.text();
    let json = null;
    try {
        json = JSON.parse(text);
    }
    catch (error) {
        json = null;
    }
    if (!response.ok) {
        let detail = '';
        if (json && json.errors)
            detail = json.errors.map(error => error.message).join('; ');
        else if (text)
            detail = text.slice(0, 500);
        throw new Error(`Open API HTTP ${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`);
    }
    if (!json)
        throw new Error('Open API returned invalid JSON');
    if (json.errors && json.errors.length)
        throw new Error('Open API GraphQL error: ' + json.errors.map(error => error.message).join('; '));
    if (!json.data)
        throw new Error('Open API returned no data');
    return json.data;
}

// Extract the numeric station identifier from an Open API player URL.
function extractPlayerStationId(playerUrl) {
    if (!playerUrl)
        return null;
    const match = String(playerUrl).match(/[?&]id_station=(\d+)/i);
    return match ? Number(match[1]) : null;
}

// Extract the metadata identifier from a live song identifier.
function extractLiveSongStationId(songId) {
    if (!songId)
        return null;
    const match = String(songId).match(/_(\d+)$/);
    return match ? Number(match[1]) : null;
}

// Retrieve the current FIP station and webradio list from the Open API.
async function fetchFipStations() {
    const query = `{
        brand(id: FIP) {
            id
            title
            playerUrl
            liveStream
            webRadios {
                id
                title
                playerUrl
                liveStream
            }
        }
    }`;
    const data = await queryOpenApi(query);
    if (!data.brand)
        throw new Error('Open API returned no FIP brand');
    const stations = [];
    if (data.brand.liveStream) {
        stations.push({
            id: data.brand.id,
            title: data.brand.title,
            stream: data.brand.liveStream,
            playerUrl: data.brand.playerUrl || '',
            openApiStationId: extractPlayerStationId(data.brand.playerUrl)
        });
    }
    for (const station of data.brand.webRadios || []) {
        if (!station.id || !station.title || !station.liveStream)
            continue;
        stations.push({
            id: station.id,
            title: station.title,
            stream: station.liveStream,
            playerUrl: station.playerUrl || '',
            openApiStationId: extractPlayerStationId(station.playerUrl)
        });
    }
    const unique = new Map();
    for (const station of stations) {
        if (!unique.has(station.id))
            unique.set(station.id, station);
    }
    return Array.from(unique.values());
}

// Query the current live metadata for one Radio France station.
async function queryLiveStation(stationId) {
    const query = `{
        live(station: ${stationId}) {
            song {
                id
                start
                end
                track {
                    id
                    title
                    albumTitle
                    discNumber
                    trackNumber
                }
            }
        }
    }`;
    const data = await queryOpenApi(query);
    return data.live || null;
}

// Retrieve and validate current live metadata for all FIP stations.
async function fetchLiveStations(stations) {
    const results = [];
    console.log('\nRetrieving current GraphQL live metadata...\n');
    for (const station of stations) {
        process.stdout.write(`  ${station.title.padEnd(25)} `);
        try {
            const live = await queryLiveStation(station.id);
            if (!live)
                throw new Error('No live data returned');
            if (station.openApiStationId === null)
                throw new Error('No id_station found in playerUrl');
            const metadataId = station.openApiStationId;
            let songStatus = 'no current song';
            if (live.song) {
                if (!live.song.id)
                    throw new Error('Current song has no ID');
                const songStationId = extractLiveSongStationId(live.song.id);
                if (songStationId === null)
                    throw new Error(`Unable to extract station ID from song ID "${live.song.id}"`);
                if (songStationId !== station.openApiStationId)
                    throw new Error(`song ID station ${songStationId} does not match playerUrl id_station ${station.openApiStationId}`);
                songStatus = live.song.track && live.song.track.title
                    ? `"${live.song.track.title}"`
                    : 'current song';
            }
            results.push({
                station,
                metadataId,
                songId: live.song ? live.song.id : null,
                track: live.song ? live.song.track : null
            });
            console.log(`OK -> metadataId=${metadataId} (${songStatus})`);
        }
        catch (error) {
            console.log(`ERROR -> ${error.message}`);
        }
        if (CONFIG.delayMs > 0)
            await sleep(CONFIG.delayMs);
    }
    return results;
}

// Test the current GraphQL live metadata API for all discovered FIP stations.
async function testLiveStations(stations) {
    console.log('\nTesting GraphQL live metadata...\n');
    for (const station of stations) {
        console.log(`${'='.repeat(80)}`);
        console.log(`${station.title} [${station.id}]`);
        console.log(`${'='.repeat(80)}`);
        try {
            const live = await queryLiveStation(station.id);
            console.log(JSON.stringify(live, null, 4));
            if (live && live.song && live.song.id) {
                const metadataId = extractLiveSongStationId(live.song.id);
                console.log(`\nExtracted metadataId: ${metadataId}`);
                if (station.openApiStationId !== null)
                    console.log(`playerUrl id_station: ${station.openApiStationId}`);
            }
        }
        catch (error) {
            console.error(`ERROR: ${error.message}`);
        }
        console.log('');
        if (CONFIG.delayMs > 0)
            await sleep(CONFIG.delayMs);
    }
}

// Normalize text before comparing station names.
function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Find an existing station matching the Open API station.
function findExistingStation(station, existing) {
    const normalizedTitle = normalizeText(station.title);
    return existing.find(item =>
        (item.stream && item.stream === station.stream) ||
        (item.title && normalizeText(item.title) === normalizedTitle)
    ) || null;
}

// Generate a stable plugin station identifier from the Open API station ID.
function stationId(station, existing) {
    const existingStation = findExistingStation(station, existing);
    if (existingStation && existingStation.id)
        return existingStation.id;
    if (station.id === 'FIP')
        return 'national';
    return station.id
        .replace(/^FIP_/, '')
        .toLowerCase()
        .replace(/_/g, '');
}

// Preserve existing logo filenames whenever possible.
function getLogo(station, existing) {
    const existingStation = findExistingStation(station, existing);
    if (existingStation && existingStation.logo)
        return existingStation.logo;
    if (station.id === 'FIP')
        return 'fip-national.png';
    const name = station.id
        .replace(/^FIP_/, '')
        .toLowerCase()
        .replace(/_/g, '');
    return `fip-${name}.png`;
}

// Load the existing station file only for preserving compatible identifiers and logos.
function loadExistingStations() {
    if (!fs.existsSync(CONFIG.outputFile))
        return [];
    try {
        const json = JSON.parse(fs.readFileSync(CONFIG.outputFile, 'utf8'));
        return Array.isArray(json) ? json : [];
    }
    catch (error) {
        return [];
    }
}

// Validate that every discovered station has a unique metadata ID.
function validateLiveStations(results, stations) {
    const errors = [];
    const metadataIds = new Map();
    const resultsByStation = new Map(results.map(result => [result.station.id, result]));
    if (results.length !== stations.length)
        errors.push(`Only ${results.length}/${stations.length} station(s) returned valid live metadata`);
    for (const result of results) {
        if (metadataIds.has(result.metadataId)) {
            errors.push(`${result.station.title}: metadataId ${result.metadataId} is already assigned to ${metadataIds.get(result.metadataId)}`);
            continue;
        }
        metadataIds.set(result.metadataId, result.station.title);
    }
    for (const station of stations) {
        const result = resultsByStation.get(station.id);
        if (!result) {
            errors.push(`${station.title}: no validated live metadata`);
            continue;
        }
        if (station.openApiStationId !== null && result.metadataId !== station.openApiStationId)
            errors.push(`${station.title}: metadataId ${result.metadataId} does not match Open API id_station ${station.openApiStationId}`);
    }
    return {
        valid: errors.length === 0,
        errors
    };
}

// Build the final radio_stations.json structure.
function buildOutput(results, existing) {
    return results.map(result => {
        const station = result.station;
        return {
            id: stationId(station, existing),
            title: station.id === 'FIP' ? 'FIP National' : station.title,
            stream: station.stream,
            metadataId: result.metadataId,
            logo: getLogo(station, existing)
        };
    });
}

// Validate the final JSON structure before writing it.
function validateOutput(stations) {
    const errors = [];
    const ids = new Set();
    const metadataIds = new Set();
    for (const station of stations) {
        if (!station.id || !station.title || !station.stream)
            errors.push(`Invalid station entry: ${JSON.stringify(station)}`);
        if (!Number.isInteger(station.metadataId))
            errors.push(`Invalid metadataId: ${JSON.stringify(station)}`);
        if (ids.has(station.id))
            errors.push(`Duplicate station id: ${station.id}`);
        if (metadataIds.has(station.metadataId))
            errors.push(`Duplicate metadataId: ${station.metadataId}`);
        ids.add(station.id);
        metadataIds.add(station.metadataId);
    }
    return errors;
}

// Display the validated station-to-metadata mapping.
function displayResults(results) {
    console.log('\nValidated mappings:\n');
    for (const result of results) {
        const track = result.track || {};
        console.log(`${result.station.title.padEnd(25)} -> ${String(result.metadataId).padEnd(4)} ${track.title ? `"${track.title}"` : ''}`);
    }
}

// Write the generated JSON atomically.
function writeOutput(stations) {
    const temporary = `${CONFIG.outputFile}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(stations, null, 4) + '\n', 'utf8');
    fs.renameSync(temporary, CONFIG.outputFile);
}

// Run the scanner.
async function main() {
    console.log('\nRadio France FIP Open API Scanner\n');
    loadConfig();
    parseArguments();
    console.log('Retrieving current FIP station list from Open API...');
    const stations = await fetchFipStations();
    if (!stations.length)
        throw new Error('No FIP station returned by Open API');
    console.log(`Found ${stations.length} FIP station(s):`);
    for (const station of stations)
        console.log(`  - ${station.title} [${station.id}]${station.openApiStationId !== null ? ` -> id_station=${station.openApiStationId}` : ''}`);
    if (args.includes('--test-live')) {
        await testLiveStations(stations);
        return;
    }
    const results = await fetchLiveStations(stations);
    const validation = validateLiveStations(results, stations);
    if (!validation.valid) {
        console.error('\nVALIDATION FAILED\n');
        for (const error of validation.errors)
            console.error(`  ERROR: ${error}`);
        console.error('\nradio_stations.json has NOT been modified.');
        process.exitCode = 2;
        return;
    }
    displayResults(results);
    const existing = loadExistingStations();
    const output = buildOutput(results, existing);
    const outputErrors = validateOutput(output);
    if (outputErrors.length) {
        console.error('\nOUTPUT VALIDATION FAILED\n');
        for (const error of outputErrors)
            console.error(`  ERROR: ${error}`);
        console.error('\nradio_stations.json has NOT been modified.');
        process.exitCode = 2;
        return;
    }
    writeOutput(output);
    console.log(`\nSuccessfully written: ${CONFIG.outputFile}`);
    console.log(`Stations: ${output.length}`);
}

// Start the scanner and report fatal errors.
main().catch(error => {
    console.error(`\nERROR: ${error.message}`);
    console.error('\nradio_stations.json has NOT been modified.');
    process.exitCode = 1;
});
