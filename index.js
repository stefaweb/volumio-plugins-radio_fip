'use strict';


const MusicService = require('music_service');
const Stations = require('./lib/stations');
const Metadata = require('./lib/metadata');


module.exports = MusicService.extend({


    constructor: function(context) {

        this.context = context;

        this.commandRouter =
            context.coreCommand;

        this.logger =
            context.logger;


        this.metadata =
            new Metadata(this.logger);


        this.currentStation = null;
        this.metadataTimer = null;


        this.logger.info(
            "[radio_fip] Plugin created"
        );

    },


    onVolumioStart: function() {

        this.logger.info(
            "[radio_fip] Plugin started"
        );

    },


    getConfigurationFiles: function() {

        return [];

    },


    getUIConfig: function() {

        return {};

    },


    browse: function(uri) {


        let self = this;


        let items = [];


        Stations.forEach((station)=>{


            items.push({

                service: "radio_fip",

                type: "station",

                title: station.title,

                uri:
                    "radio_fip/" + station.id,

                albumart:
                    "/albumart?sourceicon=/data/INTERNAL/albumart/" +
                    station.logo

            });


        });


        self.commandRouter.executeOnPlugin(
            'music_service',
            'radio_fip',
            'handleBrowseResult',
            {
                navigation: {
                    lists: [
                        {
                            title: "FIP",
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
                service: "radio_fip",
                type: "station",
                uri: uri
            }
        ];

    },



    clearTimer: function() {

        if(this.metadataTimer){

            clearInterval(
                this.metadataTimer
            );

            this.metadataTimer = null;

        }

    },



    startMetadata: function(station) {


        let self = this;


        this.clearTimer();


        if(!station.metadataId){

            this.logger.info(
                "[radio_fip] No metadata available"
            );

            return;

        }


        this.metadataTimer =
            setInterval(()=>{


                self.metadata.get(
                    station.metadataId,
                    (info)=>{


                        if(!info) {
                            return;
                        }


                        self.commandRouter.pushState({

                            status: "play",

                            service:
                                "radio_fip",

                            title:
                                info.title,

                            artist:
                                info.artist,

                            album:
                                info.album,

                            albumart:
                                info.albumArt ||
                                station.logo

                        });


                    });


            },5000);


    },



    handlePlayUri: function(uri) {


        let id =
            uri.replace(
                "radio_fip/",
                ""
            );


        let station =
            Stations.find(
                s => s.id === id
            );


        if(!station){

            return;

        }


        this.currentStation =
            station;


        this.logger.info(
            `[radio_fip] Playing ${station.title}`
        );


        this.startMetadata(
            station
        );


        return {

            uri:
                station.stream,

            service:
                "radio_fip",

            title:
                station.title,

            albumart:
                station.logo

        };


    },


    stop: function() {

        this.clearTimer();

    },


    pause: function(){},

    resume: function(){},


    getServiceName: function(){

        return "Radio FIP";

    }


});