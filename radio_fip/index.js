'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var Metadata = require('./metadata');

module.exports = ControllerFIP;

function ControllerFIP(context) {
    var self = this;
    self.context = context;
    self.commandRouter = context.coreCommand;
    self.logger = context.logger;
    self.configManager = context.configManager;
    self.serviceName = 'radio_fip';
    self.radioStations = [];
    self.lastMetadata = '';
    self.metadataTimer = null;
}

ControllerFIP.prototype.onVolumioStart = function() {
    var self = this;
    self.configFile = self.commandRouter.pluginManager.getConfigurationFile(
        self.context,
        'config.json'
    );
    self.logger.info('[radio_fip] onVolumioStart');
    return libQ.resolve();
};

ControllerFIP.prototype.getConfigurationFiles = function() {
    return ['config.json'];
};

ControllerFIP.prototype.onStart = function() {
    var self = this;
    self.mpdPlugin = self.commandRouter.pluginManager.getPlugin(
        'music_service',
        'mpd'
    );
    self.loadRadioI18nStrings();
    self.addRadioResource();
    return self.addToBrowseSources().then(function() {
        self.logger.info('[radio_fip] Started');
    });
};

ControllerFIP.prototype.onStop = function() {
    this.stopMetadataTimer();
    return libQ.resolve();
};

ControllerFIP.prototype.onRestart = function() {
    return libQ.resolve();
};

ControllerFIP.prototype.getStationLogo = function(station) {
    var defaultLogo = 'fip-cover-black.png';
    if (!station || !station.logo) {
        return defaultLogo;
    }
    var logoPath = __dirname + '/images/' + station.logo;
    if (fs.existsSync(logoPath)) {
        return station.logo;
    }
    this.logger.info('[radio_fip] Missing logo ' + station.logo);
    return defaultLogo;
};

ControllerFIP.prototype.addToBrowseSources = function() {
    this.commandRouter.volumioAddToBrowseSources({
        name: 'FIP Radio',
        uri: 'fip',
        plugin_type: 'music_service',
        plugin_name: 'radio_fip',
        albumart:
            '/albumart?sourceicon=music_service/radio_fip/images/fip-cover-black.png'
    });
    return libQ.resolve();
};

ControllerFIP.prototype.handleBrowseUri = function(curUri) {
    if (!curUri || curUri === 'fip' || curUri === 'fip/') {
        return this.getRootContent();
    }
    if (curUri.indexOf('fip/') === 0) {
        return this.getStationContent(curUri);
    }
    return libQ.resolve({
        navigation: {
            lists: [{
                availableListViews: ['list'],
                items: []
            }]
        }
    });
};

ControllerFIP.prototype.getRootContent = function() {
    var self = this;
    var items = [];
    self.radioStations.forEach(function(station) {
        items.push({
            service: self.serviceName,
            type: 'folder',
            title: station.title,
            uri: 'fip/' + station.id,
            albumart:
                '/albumart?sourceicon=music_service/radio_fip/images/' +
                self.getStationLogo(station)
        });
    });
    return libQ.resolve({
        navigation: {
            lists: [{
                availableListViews: ['list'],
                items: items
            }]
        }
    });
};

ControllerFIP.prototype.getStationContent = function(uri) {
    var self = this;
    var stationId = uri.replace('fip/', '');
    var station = self.radioStations.find(function(item) {
        return item.id === stationId;
    });
    var items = [];
    if (station) {
        items.push({
            service: self.serviceName,
            type: 'track',
            station: station,
            trackType: 'FIP Radio',
            title: station.title,
            name: station.title,
            uri: station.stream,
            albumart:
                '/albumart?sourceicon=music_service/radio_fip/images/' +
                self.getStationLogo(station),
            duration: 0
        });
    }
    return libQ.resolve({
        navigation: {
            lists: [{
                availableListViews: ['list'],
                items: items
            }]
        }
    });
};

ControllerFIP.prototype.explodeUri = function(uri) {
    var self = this;
    var result = [];
    if (!uri) {
        return libQ.resolve(result);
    }
    if (uri.indexOf('fip/') !== 0) {
        return libQ.resolve(result);
    }
    var parts = uri.split('/');
    if (parts[0] !== 'fip') {
        return libQ.resolve(result);
    }
    var station = self.radioStations.find(function(item) {
        return item.id === parts[1];
    });
    if (!station) {
        return libQ.resolve(result);
    }
    result.push({
        service: self.serviceName,
        type: 'track',
	station: station,
        trackType: 'FIP Radio',
        title: station.title,
        name: station.title,
        uri: station.stream,
        albumart:
            '/albumart?sourceicon=music_service/radio_fip/images/' +
            self.getStationLogo(station),
        duration: 0
    });
    return libQ.resolve(result);
};

ControllerFIP.prototype.clearAddPlayTrack = function(track) {
    var self = this;

    self.logger.info(
        '[radio_fip] clearAddPlayTrack ' + track.uri
    );

    if (!self.mpdPlugin) {
        return libQ.reject('MPD plugin unavailable');
    }


    if (track.station) {
        self.logger.info(
            '[radio_fip] Station resolved: ' +
            track.station.title
        );
    }


    var initialState = {
        status: 'play',
        service: self.serviceName,
        type: 'track',
        trackType: 'FIP Radio',

        title: track.station ?
            track.station.title :
            'FIP Radio',

        name: track.station ?
            track.station.title :
            'FIP Radio',

        artist: '',
        album: '',

        station: track.station ?
            track.station.title :
            'FIP Radio',

        albumart:
            '/albumart?sourceicon=music_service/radio_fip/images/' +
            self.getStationLogo(track.station),

        uri: track.uri,

        duration: 0,
        seek: 0
    };


    self.logger.info(
        '[radio_fip] Initial state PUSH ' +
        JSON.stringify(initialState)
    );


    self.commandRouter.servicePushState(
        initialState,
        self.serviceName
    );


    return self.mpdPlugin.sendMpdCommand(
        'stop',
        []
    )
    .then(function() {

        return self.mpdPlugin.sendMpdCommand(
            'clear',
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
            'play',
            []
        );

    })
    .then(function() {

        self.logger.info(
            '[radio_fip] Playback started'
        );


        if (track.station) {

            self.logger.info(
                '[radio_fip] Starting metadata timer for ' +
                track.station.title
            );

            self.startMetadataTimer(track.station);

        }


        return true;

    });
};

ControllerFIP.prototype.addRadioResource = function() {
    var self = this;
    try {
        var data = fs.readJsonSync(
            __dirname + '/radio_stations.json'
        );
        self.radioStations = Array.isArray(data) ? data : data.stations;
    } catch (e) {
        self.logger.error(
            '[radio_fip] stations error ' + e.message
        );
        self.radioStations = [];
    }
    self.logger.info(
        '[radio_fip] Loaded ' +
        self.radioStations.length +
        ' stations'
    );
};

ControllerFIP.prototype.loadRadioI18nStrings = function() {
    try {
        this.i18nStrings = fs.readJsonSync(
            __dirname + '/i18n/strings_en.json'
        );
    } catch (e) {
        this.i18nStrings = {};
    }
};

ControllerFIP.prototype.getRadioI18nString = function(key) {
    return this.i18nStrings[key] || key;
};

ControllerFIP.prototype.startMetadataTimer = function(station) {
    var self = this;

    self.logger.info(
        '[radio_fip] startMetadataTimer ' +
        (station ? station.title : 'unknown')
    );

    self.stopMetadataTimer();

    if (!station) {
        self.logger.error('[radio_fip] Cannot start metadata timer without station');
        return;
    }

    // Première récupération immédiate
    self.updateMetadata(station);

    // Puis toutes les 5 secondes
    self.metadataTimer = setInterval(function() {

        try {
            self.updateMetadata(station);
        }
        catch (err) {
            self.logger.error(
                '[radio_fip] Metadata timer exception ' +
                err.message
            );
        }

    }, 5000);

    self.logger.info('[radio_fip] Metadata timer started');
};

ControllerFIP.prototype.stopMetadataTimer = function() {
    if (this.metadataTimer) {
        clearInterval(this.metadataTimer);
        this.metadataTimer = null;
    }
};

ControllerFIP.prototype.updateMetadata = function(station) {
    var self = this;

    if (!station || !station.metadataId) {
        self.logger.warn(
            '[radio_fip] No metadataId for station'
        );
        return;
    }


    Metadata.getMetadata(station.metadataId)
    .then(function(data) {

        if (!data) {
            self.logger.warn(
                '[radio_fip] Empty metadata response'
            );
            return;
        }


        self.logger.info(
            '[radio_fip] Metadata received ' +
            JSON.stringify(data)
        );


        if (
            !data.title &&
            !data.artist &&
            !data.album
        ) {
            self.logger.warn(
                '[radio_fip] Empty metadata ignored'
            );
            return;
        }


        var currentMetadata =
            data.station + '|' +
            data.title + '|' +
            data.artist + '|' +
            data.album;


        if (currentMetadata === self.lastMetadata) {
            return;
        }


        self.lastMetadata = currentMetadata;


        self.logger.info(
            '[radio_fip] ' +
            data.artist +
            ' - ' +
            data.title
        );


        var state = {

            status: 'play',

            service: self.serviceName,

            type: 'track',

            trackType: 'FIP Radio',


            title: data.title,

            name: data.title,


            artist: data.artist,

            album: data.album,


            station: data.station,


            albumart: data.albumart,


            uri: station.stream,


            duration: 0,

            seek: 0

        };


        self.logger.info(
            '[radio_fip] Metadata state PUSH ' +
            JSON.stringify(state)
        );


        self.commandRouter.servicePushState(
            state,
            self.serviceName
        );


        self.logger.info(
            '[radio_fip] Metadata PUSH done'
        );


    })
    .catch(function(err) {

        self.logger.error(
            '[radio_fip] metadata error ' +
            err.message
        );

    });
};

ControllerFIP.prototype.search = function() {
    return libQ.resolve([]);
};