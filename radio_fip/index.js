'use strict';

const MusicService = require('music_service');
const fs = require('fs');
const path = require('path');

const Metadata = require('./metadata');


const PLUGIN_NAME = 'radio_fip';

const IMAGE_PATH =
    '/data/plugins/music_service/' +
    PLUGIN_NAME +
    '/images/';


module.exports = MusicService.extend({


    constructor: function(context) {

        this.context = context;

        this.commandRouter =
            context.coreCommand;

        this.logger =
            context.logger;


        this.stations = [];

        this.currentStation = null;

        this.metadataTimer = null;


        this.metadata =
            new Metadata(
                this.logger
            );


        this.loadStations();


        this.logger.info(
            '[radio_fip] Plugin created'
        );

    },


    loadStations: function() {

        try {

            const file =
                path.join(
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


        } catch (error) {

            this.logger.error(
                '[radio_fip] Unable to load stations: ' +
                error.message
            );

        }

    },


    onVolumioStart: function() {

        this.logger.info(
            '[radio_fip] Started'
        );

    },


    onStop: function() {

        this.stopMetadata();

    },


    getConfigurationFiles: function() {

        return [];

    },


    getUIConfig: function() {

        return {};

    },


    getServiceName: function() {

        return 'Radio FIP';

    },


    browse: function(uri) {


        let items = [];


        this.stations.forEach(
            (station) => {


                items.push({

                    service: PLUGIN_NAME,

                    type: 'station',

                    title:
                        station.title,

                    uri:
                        PLUGIN_NAME +
                        '/' +
                        station.id,

                    albumart:
                        IMAGE_PATH +
                        station.logo

                });


            }
        );


        this.commandRouter.executeOnPlugin(
            'music_service',
            PLUGIN_NAME,
            'handleBrowseResult',
            {

                navigation: {

                    lists: [

                        {

                            title: 'Radio FIP',

                            items: items

                        }

                    ]

                }

            }
        );


    },


    explodeUri: function(uri) {

        return [

            {

                service: PLUGIN_NAME,

                type: 'station',

                uri: uri

            }

        ];

    },


    handlePlayUri: function(uri) {


        const stationId =
            uri.replace(
                PLUGIN_NAME + '/',
                ''
            );


        const station =
            this.stations.find(
                (item) =>
                    item.id === stationId
            );


        if (!station) {


            this.logger.error(
                '[radio_fip] Station not found: ' +
                stationId
            );


            return;

        }


        this.currentStation =
            station;


        this.logger.info(
            '[radio_fip] Playing ' +
            station.title
        );


        this.startMetadata();


        return {


            uri:
                station.stream,


            title:
                station.title,


            albumart:
                IMAGE_PATH +
                station.logo


        };

    },


    startMetadata: function() {


        this.stopMetadata();


        if (
            !this.currentStation ||
            !this.currentStation.metadataId
        ) {


            this.logger.info(
                '[radio_fip] Metadata unavailable'
            );


            return;

        }



        this.metadataTimer =
            setInterval(

                () => {


                    this.metadata.get(

                        this.currentStation,

                        (info) => {


                            if (!info) {

                                return;

                            }


                            this.commandRouter.pushState({

                                status: 'play',

                                service:
                                    PLUGIN_NAME,

                                title:
                                    info.title,

                                artist:
                                    info.artist,

                                album:
                                    info.album,

                                albumart:
                                    info.albumArt ||
                                    IMAGE_PATH +
                                    'fip-cover-color.png'

                            });


                        }

                    );


                },

                5000

            );


    },


    stopMetadata: function() {


        if (this.metadataTimer) {


            clearInterval(
                this.metadataTimer
            );


            this.metadataTimer = null;


            this.logger.info(
                '[radio_fip] Metadata stopped'
            );

        }

    },


    stop: function() {

        this.stopMetadata();

    },


    pause: function() {

    },


    resume: function() {

    }


});