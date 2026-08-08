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

    self.state = {};
    self.serviceName = "radio_fip";
}


ControllerFIP.prototype.onVolumioStart = function () {

    var self = this;

    self.configFile =
        self.commandRouter.pluginManager.getConfigurationFile(
            self.context,
            'config.json'
        );

    self.logger.info('[radio_fip] onVolumioStart');

    return libQ.resolve();
};


ControllerFIP.prototype.getConfigurationFiles = function () {

    return [
        'config.json'
    ];

};


ControllerFIP.prototype.onStart = function () {

    var self = this;

    self.logger.info('[radio_fip] Starting');

    self.mpdPlugin =
        self.commandRouter.pluginManager.getPlugin(
            'music_service',
            'mpd'
        );


    self.addRadioResource();

    self.addToBrowseSources();


    return libQ.resolve();

};


ControllerFIP.prototype.onStop = function () {

    return libQ.resolve();

};


ControllerFIP.prototype.onRestart = function () {

    return libQ.resolve();

};



// ------------------------------------------------------
// Sources Volumio
// ------------------------------------------------------

ControllerFIP.prototype.addToBrowseSources = function () {

    var self = this;

    self.commandRouter.volumioAddToBrowseSources({

        name: "FIP Radio",

        uri: "radio_fip",

        plugin_type: "music_service",

        plugin_name: "radio_fip",

        albumart:
        "/albumart?sourceicon=music_service/radio_fip/images/fip.svg"

    });

};



// ------------------------------------------------------
// Navigation
// ------------------------------------------------------

ControllerFIP.prototype.handleBrowseUri = function(uri) {

    var self = this;

    self.logger.info(
        '[radio_fip] browse ' + uri
    );


    if(uri === "radio_fip") {

        return self.getRootContent();

    }


    if(uri.startsWith("radio_fip/")) {

        return self.getStationContent(uri);

    }


    return libQ.reject();

};



ControllerFIP.prototype.getRootContent = function() {

    var self = this;

    var defer = libQ.defer();

    var response = {

        navigation: {

            lists: [

                {

                    availableListViews:["list"],

                    items:[]

                }

            ]

        }

    };


    for(var key in self.rootStations) {

        response.navigation.lists[0].items.push({

            service:self.serviceName,

            type:"folder",

            title:self.rootStations[key].title,

            uri:self.rootStations[key].uri

        });

    }


    defer.resolve(response);

    return defer.promise;

};




ControllerFIP.prototype.getStationContent = function(uri) {

    var self=this;

    var defer=libQ.defer();


    var station =
        uri.replace("radio_fip/","");


    var response={

        navigation:{

            lists:[{

                availableListViews:["list"],

                items:[]

            }]

        }

    };


    self.radioStations[station].forEach(function(item,index){


        response.navigation.lists[0].items.push({

            service:self.serviceName,

            type:"mywebradio",

            title:item.title,

            uri:
            "webradio/" + station + "/" + index

        });


    });


    defer.resolve(response);

    return defer.promise;

};



// ------------------------------------------------------
// Lecture
// ------------------------------------------------------

ControllerFIP.prototype.explodeUri=function(uri){

    var self=this;

    var defer=libQ.defer();

    var result=[];


    var parts=uri.split("/");


    if(parts[0] !== "webradio") {

        defer.resolve();

        return defer.promise;

    }


    var station=parts[1];

    var index=parseInt(parts[2]);


    var radio=self.radioStations[station][index];


    result.push({

        service:self.serviceName,

        type:"track",

        title:radio.title,

        name:radio.title,

        uri:radio.url,

        albumart:radio.cover,

        duration:1000

    });


    defer.resolve(result);


    return defer.promise;

};





ControllerFIP.prototype.clearAddPlayTrack=function(track){

    var self=this;


    return self.mpdPlugin.sendMpdCommand('stop',[])

    .then(function(){

        return self.mpdPlugin.sendMpdCommand('clear',[]);

    })

    .then(function(){

        return self.mpdPlugin.sendMpdCommand(

            'add "'+track.uri+'"',

            []

        );

    })

    .then(function(){

        return self.mpdPlugin.sendMpdCommand(

            'play',

            []

        );

    });


};




// ------------------------------------------------------
// Ressources
// ------------------------------------------------------

ControllerFIP.prototype.addRadioResource=function(){

    var self=this;


    var data =
        fs.readJsonSync(
            __dirname+'/radio_stations.json'
        );


    self.rootStations=data.rootStations;

    self.radioStations=data.stations;


};




// ------------------------------------------------------

ControllerFIP.prototype.search=function(){

    return libQ.resolve();

};