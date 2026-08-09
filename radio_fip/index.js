'use strict';

var libQ = require('kew');
var fs = require('fs-extra');

module.exports = ControllerFIP;

function ControllerFIP(context) {
    var self = this;

    self.context = context;
    self.commandRouter = context.coreCommand;
    self.logger = context.logger;
    self.configManager = context.configManager;

    self.serviceName = "radio_fip";
    self.radioStations = [];
}

// ------------------------------------------------------
// Logo
// ------------------------------------------------------

ControllerFIP.prototype.getStationLogo = function(station) {
    var defaultLogo = "fip-cover-black.png";

    if (!station || !station.logo) {
        return defaultLogo;
    }

    var logoPath = __dirname + "/images/" + station.logo;

    if (fs.existsSync(logoPath)) {
        return station.logo;
    }

    this.logger.info(
        "[radio_fip] Missing logo " + station.logo
    );

    return defaultLogo;
};

// ------------------------------------------------------
// Start
// ------------------------------------------------------

ControllerFIP.prototype.onVolumioStart = function() {
    var self = this;

    self.configFile =
        self.commandRouter.pluginManager.getConfigurationFile(
            self.context,
            'config.json'
        );

    self.logger.info(
        '[radio_fip] onVolumioStart'
    );

    return libQ.resolve();
};

ControllerFIP.prototype.getConfigurationFiles = function() {
    return [
        'config.json'
    ];
};

ControllerFIP.prototype.onStart = function() {
    var self = this;

    self.mpdPlugin =
        self.commandRouter.pluginManager.getPlugin(
            'music_service',
            'mpd'
        );

    self.loadRadioI18nStrings();
    self.addRadioResource();

    return self.addToBrowseSources()
        .then(function() {
            self.logger.info(
                '[radio_fip] Starting'
            );
        });
};

ControllerFIP.prototype.onStop = function() {
    return libQ.resolve();
};

ControllerFIP.prototype.onRestart = function() {
    return libQ.resolve();
};

// ------------------------------------------------------
// Browse source
// ------------------------------------------------------

ControllerFIP.prototype.addToBrowseSources = function() {
    var self = this;

    self.logger.info(
        '[radio_fip] Registering browse source'
    );

    self.commandRouter.volumioAddToBrowseSources({
        name: "FIP Radio",
        uri: "fip",
        plugin_type: "music_service",
        plugin_name: "radio_fip",
        albumart:
            "/albumart?sourceicon=music_service/radio_fip/images/fip-cover-black.png"
    });

    return libQ.resolve();
};

// ------------------------------------------------------
// Browse navigation
// ------------------------------------------------------

ControllerFIP.prototype.handleBrowseUri = function(curUri) {
    var self = this;

    self.logger.info(
        "[radio_fip] handleBrowseUri: " + curUri
    );

    if (!curUri || curUri === "fip" || curUri === "fip/") {
        return self.getRootContent();
    }

    if (curUri.indexOf("fip/") === 0) {
        return self.getStationContent(curUri);
    }

    return libQ.resolve({
        navigation: {
            lists: [
                {
                    availableListViews: ["list"],
                    items: []
                }
            ]
        }
    });
};

ControllerFIP.prototype.getRootContent = function() {
    var self = this;

    var items = [];

    if (!self.radioStations) {
        self.radioStations = [];
    }

    self.radioStations.forEach(function(station) {

        items.push({
            service: self.serviceName,
            type: "folder",
            title: station.title,
            uri: "fip/" + station.id,
            albumart:
                "/albumart?sourceicon=music_service/radio_fip/images/" +
                self.getStationLogo(station)
        });

    });

    self.logger.info(
        "[radio_fip] Root items: " + items.length
    );

    return libQ.resolve({
        navigation: {
            lists: [
                {
                    availableListViews: ["list"],
                    items: items
                }
            ]
        }
    });
};

ControllerFIP.prototype.getStationContent = function(uri) {
    var self = this;

    var stationId =
        uri.replace("fip/", "");

    var station =
        self.radioStations.find(function(item) {
            return item.id === stationId;
        });

    var items = [];

    if (station) {

        self.logger.info(
            "[radio_fip] Station found: " +
            station.title
        );

        var streamUrl = station.stream;

        self.logger.info(
            "[radio_fip] URL: " +
            streamUrl
        );

        items.push({
            service: self.serviceName,
            type: "track",
            trackType: "FIP Radio",
            title: station.title,
            name: station.title,
            uri: streamUrl,
            albumart:
                "/albumart?sourceicon=music_service/radio_fip/images/" +
                self.getStationLogo(station),
            duration: 0
        });

    }
    else {

        self.logger.error(
            "[radio_fip] Station not found: " +
            stationId
        );

    }

    return libQ.resolve({
        navigation: {
            lists: [
                {
                    availableListViews: ["list"],
                    items: items
                }
            ]
        }
    });
};

// ------------------------------------------------------
// Explode URI
// ------------------------------------------------------

ControllerFIP.prototype.explodeUri = function(uri) {
    var self = this;

    var result = [];

    self.logger.info(
        "[radio_fip] explodeUri CALLED: " + uri
    );

    self.logger.info(
        "[radio_fip] explodeUri: " + uri
    );

    if (!uri) {
        return libQ.resolve(result);
    }

    var parts = uri.split("/");

    if (parts[0] !== "fip") {
        return libQ.resolve(result);
    }

    var station =
        self.radioStations.find(function(item) {
            return item.id === parts[1];
        });

    if (!station) {
        return libQ.resolve(result);
    }

    result.push({
        service: self.serviceName,
        type: "track",
        trackType: "FIP Radio",
        title: station.title,
        name: station.title,
        uri: station.stream,
        albumart:
            "/albumart?sourceicon=music_service/radio_fip/images/" +
            self.getStationLogo(station),
        duration: 0
    });

    self.logger.info(
        "[radio_fip] explodeUri result: " +
        JSON.stringify(result)
    );

    return libQ.resolve(result);
};

// ------------------------------------------------------
// MPD playback
// ------------------------------------------------------

ControllerFIP.prototype.clearAddPlayTrack = function(track) {
    var self = this;

    self.logger.info(
        "[radio_fip] Playing " + track.uri
    );

    if (!self.mpdPlugin) {
        return libQ.reject(
            "MPD plugin unavailable"
        );
    }

    return self.mpdPlugin.sendMpdCommand(
        "stop",
        []
    )
    .then(function() {
        return self.mpdPlugin.sendMpdCommand(
            "clear",
            []
        );
    })
    .then(function() {
        return self.mpdPlugin.sendMpdCommand(
            'add "' + track.uri + '"',
            []
        );
    })
    .then(function() {
        return self.mpdPlugin.sendMpdCommand(
            "play",
            []
        );
    });
};

// ------------------------------------------------------
// Load stations
// ------------------------------------------------------

ControllerFIP.prototype.addRadioResource = function() {
    var self = this;

    try {

        var radioResource =
            fs.readJsonSync(
                __dirname + "/radio_stations.json"
            );

        if (Array.isArray(radioResource)) {

            self.radioStations = radioResource;

        }
        else if (radioResource.stations) {

            self.radioStations =
                radioResource.stations;

        }

    }
    catch (e) {

        self.logger.error(
            "[radio_fip] Cannot load radio_stations.json: " +
            e.message
        );

        self.radioStations = [];

    }

    self.logger.info(
        "[radio_fip] Loaded " +
        self.radioStations.length +
        " stations"
    );
};

// ------------------------------------------------------
// I18n
// ------------------------------------------------------

ControllerFIP.prototype.loadRadioI18nStrings = function() {
    var self = this;

    try {

        self.i18nStrings =
            fs.readJsonSync(
                __dirname + "/i18n/strings_en.json"
            );

    }
    catch (e) {

        self.i18nStrings = {};

    }
};

ControllerFIP.prototype.getRadioI18nString = function(key) {

    if (this.i18nStrings &&
        this.i18nStrings[key]) {

        return this.i18nStrings[key];

    }

    return key;
};

// ------------------------------------------------------
// Search
// ------------------------------------------------------

ControllerFIP.prototype.search = function() {

    return libQ.resolve([]);

};
