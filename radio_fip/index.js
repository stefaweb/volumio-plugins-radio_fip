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
    self.state = {};
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

    this.logger.info(
        '[radio_fip] BROWSE CALL uri=' + curUri
    );

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

            type: 'mywebradio',

            title: station.title,

            artist: '',

            album: '',

            icon: 'fa fa-music',

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

    var stationId = uri.replace(/^fip\//, '');

    var station = self.radioStations.find(function(item) {
        return item.id === stationId;
    });

    self.logger.info(
        '[radio_fip] station lookup id=' +
        stationId +
        ' result=' +
        JSON.stringify(station)
    );

    if (!station) {
        self.logger.error(
            '[radio_fip] Station not found: ' + stationId
        );

        return libQ.resolve({
            navigation: {
                lists: [{
                    availableListViews: ['list'],
                    items: []
                }]
            }
        });
    }

    self.logger.info(
        '[radio_fip] getStationContent station=' +
        station.title
    );

    return libQ.resolve({
        navigation: {
            lists: [{
                availableListViews: ['list'],
                items: [{
                    service: self.serviceName,
                    type: 'mywebradio',
                    title: station.title,
                    name: station.title,
                    artist: '',
                    album: '',
                    uri: station.stream,
                    icon: 'fa fa-music',
                    albumart:
                        '/albumart?sourceicon=music_service/radio_fip/images/' +
                        self.getStationLogo(station)
                }]
            }]
        }
    });
};

ControllerFIP.prototype.explodeUri = function(uri) {

    var self = this;
    var defer = libQ.defer();
    var response = [];

    self.logger.info(
        '[radio_fip] explodeUri uri=' + uri
    );

    var stationId = uri.replace(/^fip\//, '');

    var station = self.radioStations.find(function(item) {
        return item.id === stationId;
    });

    if (!station) {

        self.logger.error(
            '[radio_fip] explodeUri station not found id=' + stationId
        );

        defer.resolve([]);
        return defer.promise;
    }


    response.push({

        service: self.serviceName,

        type: 'track',

        trackType: 'webradio',

        radioType: 'FIP',

        title: station.title,

        name: station.title,

        artist: '',

        album: '',

        uri: station.stream,

        stationId: station.id,

        stationTitle: station.title,

        albumart:
            '/albumart?sourceicon=music_service/radio_fip/images/' +
            self.getStationLogo(station),

        duration: 0

    });


    self.logger.info(
        '[radio_fip] explodeUri OK station=' +
        station.title
    );


    defer.resolve(response);

    return defer.promise;
};

ControllerFIP.prototype.clearAddPlayTrack = function(track) {

    var self = this;

    var station = null;


    /*
     * 1. Retrouver la station.
     *
     * On privilégie stationId ajouté par explodeUri().
     * Sinon on utilise l'URI du flux.
     */

    if (track && track.stationId) {

        station = self.radioStations.find(function(item) {
            return item.id === track.stationId;
        });

    }


    if (!station && track && track.uri) {

        station = self.radioStations.find(function(item) {
            return item.stream === track.uri;
        });

    }


    if (!station) {

        self.logger.error(
            '[radio_fip] clearAddPlayTrack: station not found'
        );

        self.logger.error(
            '[radio_fip] track=' +
            JSON.stringify(track)
        );

        return libQ.reject('FIP station not found');

    }


    self.logger.info(
        '[radio_fip] clearAddPlayTrack station=' +
        JSON.stringify(station)
    );


    /*
     * 2. Construire l'état initial de la station.
     */

    self.state = {

        status: 'play',

        service: self.serviceName,

        type: 'webradio',

        trackType: 'webradio',

        radioType: 'FIP',

        title: station.title,

        name: station.title,

        artist: '',

        album: '',

        albumart:
            '/albumart?sourceicon=music_service/radio_fip/images/' +
            self.getStationLogo(station),

        uri: station.stream,

        streaming: true,

        disableUiControls: true,

        duration: 0,

        seek: 0

    };


    /*
     * 3. Arrêter l'ancien timer de métadonnées.
     */

    self.stopMetadataTimer();

    self.lastMetadata = '';


    /*
     * 4. Mettre à jour la PlayQueue Volumio.
     *
     * C'est important pour l'affichage du morceau courant
     * en bas de l'écran.
     */

    try {

        var currentState =
            self.commandRouter.stateMachine.getState();

        self.logger.info(
            '[radio_fip] Current state before queue update=' +
            JSON.stringify(currentState)
        );


        var position =
            currentState.position;


        var queue =
            self.commandRouter.stateMachine.playQueue;


        if (queue &&
            queue.arrayQueue &&
            position !== undefined &&
            queue.arrayQueue[position]) {

            var queueItem =
                queue.arrayQueue[position];


            self.logger.info(
                '[radio_fip] Updating queue position=' +
                position
            );


            queueItem.service =
                self.serviceName;

            queueItem.type =
                'webradio';

            queueItem.trackType =
                'webradio';

            queueItem.radioType =
                'FIP';

            queueItem.title =
                station.title;

            queueItem.name =
                station.title;

            queueItem.artist =
                '';

            queueItem.album =
                '';

            queueItem.uri =
                station.stream;

            queueItem.albumart =
                '/albumart?sourceicon=music_service/radio_fip/images/' +
                self.getStationLogo(station);

            queueItem.duration =
                0;

            queueItem.stationId =
                station.id;


            self.logger.info(
                '[radio_fip] Queue item after update=' +
                JSON.stringify(queueItem)
            );


            /*
             * Signaler à Volumio que la queue a changé.
             */

            if (self.commandRouter.volumioPushQueue) {

                self.commandRouter.volumioPushQueue();

            }

        }
        else {

            self.logger.info(
                '[radio_fip] No current queue item found at position=' +
                position
            );

        }

    }
    catch (e) {

        self.logger.error(
            '[radio_fip] Queue update error ' +
            e.message
        );

    }


    /*
     * 5. Piloter MPD.
     */

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
            'add "' + station.stream + '"',
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


        /*
         * 6. Le plugin devient le propriétaire
         * des mises à jour de lecture.
         */

        self.commandRouter.stateMachine
            .setConsumeUpdateService(
                self.serviceName
            );


        self.logger.info(
            '[radio_fip] Pushing initial state station=' +
            station.title
        );


        self.commandRouter.servicePushState(
            self.state,
            self.serviceName
        );


        self.logger.info(
            '[radio_fip] Playback started station=' +
            station.title
        );


        /*
         * 7. Démarrer les métadonnées de cette station.
         */

        self.startMetadataTimer(
            station
        );


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
    self.updateMetadata(station);
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

ControllerFIP.prototype.pushSongState = function(data, station) {
    var self = this;
    var state = {
        status: 'play',
        service: self.serviceName,
        type: 'webradio',
        trackType: 'webradio',
        radioType: 'FIP',
        title: data.title,
        name: data.title,
        artist: data.artist,
        album: data.album,
        albumart: data.albumart,
        uri: station.stream,
        streaming: true,
        disableUiControls: true,
        duration: 0,
        seek: 0
    };
    try {
        var vState =
            self.commandRouter.stateMachine.getState();
        var queueItem =
            self.commandRouter.stateMachine.playQueue.arrayQueue[
                vState.position
            ];
        if (queueItem) {
            queueItem.name = data.title;
            queueItem.title = data.title;
            queueItem.artist = data.artist;
            queueItem.album = data.album;
            queueItem.albumart = data.albumart;
            queueItem.trackType = 'FIP Radio';
            queueItem.duration = 0;
        }
        self.commandRouter.stateMachine.currentSeek = 0;
        self.commandRouter.stateMachine.playbackStart = Date.now();
        self.commandRouter.stateMachine.currentSongDuration = 0;
        self.commandRouter.stateMachine.askedForPrefetch = false;
        self.commandRouter.stateMachine.prefetchDone = false;
    }
    catch(e) {
        self.logger.error(
            '[radio_fip] queue update error ' + e.message
        );
    }
    self.logger.info(
        '[radio_fip] PUSH STATE ' +
        JSON.stringify(state)
    );
    self.commandRouter.servicePushState(
        state,
        self.serviceName
    );
};

ControllerFIP.prototype.updateMetadata = function(station) {
    var self = this;
    Metadata.getMetadata(station.metadataId)
    .then(function(data) {
        if (!data) {
            return;
        }
        var current =
            data.artist + '|' +
            data.title + '|' +
            data.album;
        if (current === self.lastMetadata) {
            return;
        }
        self.lastMetadata = current;
        self.logger.info(
            '[radio_fip] ' +
            data.artist +
            ' - ' +
            data.title
        );
        var state = {
            status:'play',
            service:self.serviceName,
            type:'webradio',
            trackType:'webradio',
            radioType:'FIP',
            title:data.title,
            name:data.title,
            artist:data.artist,
            album:data.album,
            albumart:data.albumart,
            uri:station.stream,
            streaming:true,
            disableUiControls:true,
            duration:0,
            seek:0
        };
        self.state = state;
        try {
            var vState =
                self.commandRouter.stateMachine.getState();
            var queueItem =
                self.commandRouter
                .stateMachine
                .playQueue
                .arrayQueue[vState.position];
            if(queueItem){
                queueItem.name = data.title;
                queueItem.artist = data.artist;
                queueItem.album = data.album;
                queueItem.albumart = data.albumart;
                queueItem.trackType = 'FIP Radio';
            }
            self.commandRouter.stateMachine.currentSeek = 0;
            self.commandRouter.stateMachine.playbackStart =
                Date.now();
            self.commandRouter.stateMachine.currentSongDuration =
                0;
        }
        catch(e){
            self.logger.error(
                '[radio_fip] queue update error ' +
                e.message
            );
        }
        self.state = state;
        self.logger.info(
            '[radio_fip] METADATA PUSH radioType=' +
            self.state.radioType +
            ' station=' +
            (station ? station.title : 'undefined')
        );
        self.commandRouter.servicePushState(
            self.state,
            self.serviceName
        );
        self.logger.info(
            '[radio_fip] Metadata PUSH done'
        );
    })
    .catch(function(err){

        self.logger.error(
            '[radio_fip] metadata error ' +
            err.message
        );
    });
};

ControllerFIP.prototype.stop = function() {
    var self = this;
    self.stopMetadataTimer();
    if(self.mpdPlugin){
        return self.mpdPlugin.sendMpdCommand(
            'stop',
            []
        )
        .then(function(){
            self.state.status = 'stop';
            self.commandRouter.servicePushState(
                self.state,
                self.serviceName
            );
        });
    }
    return libQ.resolve();
};

ControllerFIP.prototype.search = function() {
    return libQ.resolve([]);
};