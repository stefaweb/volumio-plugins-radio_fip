'use strict';

var libQ = require('kew');
var fs = require('fs');
var path = require('path');

var Metadata = require('./metadata');


module.exports = RadioFip;


function RadioFip(context) {

    var self = this;

    self.context = context;

    self.commandRouter = context.coreCommand;
    self.logger = context.logger;

    self.serviceName = 'radio_fip';

    self.stations = [];
    self.currentStation = null;
    self.metadataTimer = null;

    self.metadata = new Metadata(self.logger);

    self.loadStations();

    self.logger.info('[radio_fip] Constructor loaded');

}


// ----------------------------------------------------------
// Volumio lifecycle
// ----------------------------------------------------------

RadioFip.prototype.onVolumioStart = function() {

    this.logger.info('[radio_fip] onVolumioStart');

    return libQ.resolve();

};


RadioFip.prototype.onStart = function() {

    var self = this;

    self.logger.info('[radio_fip] Starting');

    self.commandRouter.volumioAddToBrowseSources({

        name: 'Radio FIP',

        uri: 'radio_fip',

        plugin_type: 'music_service',

        plugin_name: 'radio_fip',

        albumart:
            '/albumart?sourceicon=music_service/radio_fip/images/fip-cover-color.png'

    });


    return libQ.resolve();

};


RadioFip.prototype.onStop = function() {

    this.stopMetadata();

    return libQ.resolve();

};


// ----------------------------------------------------------
// Configuration
// ----------------------------------------------------------

RadioFip.prototype.getConfigurationFiles = function() {

    return [];

};


RadioFip.prototype.getUIConfig = function() {

    return {};

};


// ----------------------------------------------------------
// Stations
// ----------------------------------------------------------

RadioFip.prototype.loadStations = function() {

    try {

        var file = path.join(
            __dirname,
            'radio_stations.json'
        );


        this.stations =
            JSON.parse(
                fs.readFileSync(
                    file,
                    'utf8'
                )
            );


        this.logger.info(
            '[radio_fip] Loaded ' +
            this.stations.length +
            ' stations'
        );


    }
    catch(error) {

        this.logger.error(
            '[radio_fip] Load stations error: ' +
            error.message
        );

        this.stations = [];

    }

};


// ----------------------------------------------------------
// Browse
// ----------------------------------------------------------

RadioFip.prototype.handleBrowseUri = function(uri) {

    var self = this;

    var items = [];


    self.stations.forEach(function(station) {

        items.push({

            service: 'radio_fip',

            type: 'webradio',

            title: station.title,

            uri:
                'radio_fip/' +
                station.id,

            albumart:
                '/albumart?sourceicon=music_service/radio_fip/images/' +
                station.logo

        });

    });


    return libQ.resolve({

        navigation: {

            lists: [

                {

                    title: 'Radio FIP',

                    items: items

                }

            ]

        }

    });

};


// ----------------------------------------------------------
// Playback
// ----------------------------------------------------------

RadioFip.prototype.explodeUri = function(uri) {

    var self = this;

    var id =
        uri.replace(
            'radio_fip/',
            ''
        );


    var station =
        self.stations.find(function(item) {

            return item.id === id;

        });


    if (!station) {

        return libQ.reject(
            new Error('Station not found')
        );

    }


    return libQ.resolve([{

        service: 'radio_fip',

        type: 'track',

        title: station.title,

        name: station.title,

        uri: station.stream,

        albumart:
            '/albumart?sourceicon=music_service/radio_fip/images/' +
            station.logo,

        duration: 0,

        streaming: true

    }]);

};



RadioFip.prototype.clearAddPlayTrack = function(track) {

    return libQ.resolve();

};



RadioFip.prototype.handlePlayUri = function(uri) {

    var id =
        uri.replace(
            'radio_fip/',
            ''
        );


    var station =
        this.stations.find(function(item) {

            return item.id === id;

        });


    if (!station) {

        this.logger.error(
            '[radio_fip] Station not found ' + id
        );

        return;

    }


    this.currentStation = station;


    this.startMetadata();


    return {

        uri: station.stream,

        title: station.title,

        albumart:
            '/albumart?sourceicon=music_service/radio_fip/images/' +
            station.logo

    };

};


// ----------------------------------------------------------
// Metadata
// ----------------------------------------------------------

RadioFip.prototype.startMetadata = function() {

    var self = this;


    self.stopMetadata();


    if (!self.currentStation ||
        !self.currentStation.metadataId) {

        return;

    }


    self.metadataTimer =
        setInterval(function() {


            self.metadata.get(

                self.currentStation,

                function(info) {


                    if (!info) {

                        return;

                    }


                    self.commandRouter.pushState({

                        status: 'play',

                        service: 'radio_fip',

                        title: info.title,

                        artist: info.artist,

                        album: info.album,

                        albumart:
                            info.albumArt ||
                            '/albumart?sourceicon=music_service/radio_fip/images/fip-cover-color.png'

                    });


                }

            );


        },5000);


};



RadioFip.prototype.stopMetadata = function() {

    if (this.metadataTimer) {

        clearInterval(
            this.metadataTimer
        );

        this.metadataTimer = null;

    }

};


// ----------------------------------------------------------
// Player controls
// ----------------------------------------------------------

RadioFip.prototype.stop = function() {

    this.stopMetadata();

    return libQ.resolve();

};


RadioFip.prototype.pause = function() {

    return libQ.resolve();

};


RadioFip.prototype.resume = function() {

    return libQ.resolve();

};


RadioFip.prototype.search = function() {

    return libQ.resolve([]);

};