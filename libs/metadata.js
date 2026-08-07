'use strict';

const https = require('https');


class Metadata {

    constructor(logger) {
        this.logger = logger;
        this.current = null;
    }


    get(stationId, callback) {

        if (!stationId) {
            callback(null);
            return;
        }


        const url = `https://api.radiofrance.fr/livemeta/pull/${stationId}`;


        https.get(url, (res) => {

            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });


            res.on('end', () => {

                try {

                    const json = JSON.parse(data);

                    const metadata = this.parse(json);


                    if (metadata) {

                        callback(metadata);

                    } else {

                        callback(null);

                    }


                } catch (e) {

                    this.logger.error(
                        `[radio_fip] Metadata JSON error: ${e.message}`
                    );

                    callback(null);

                }

            });


        }).on('error', (err) => {

            this.logger.error(
                `[radio_fip] Metadata HTTP error: ${err.message}`
            );

            callback(null);

        });

    }



    parse(json) {

        /*
         * Structure Radio France livemeta :
         *
         * levels[]
         * steps[]
         *
         * Le dernier item correspond
         * au morceau en cours.
         */


        try {

            const level = json.levels[0];

            const id =
                level.items[level.position];


            const step =
                json.steps[id];


            if (!step) {
                return null;
            }


            let artist = "";
            let title = "";
            let album = "";
            let cover = "";


            if (step.title) {
                title = step.title;
            }


            if (step.firstLine) {
                artist = step.firstLine;
            }


            if (step.secondLine) {
                album = step.secondLine;
            }


            if (step.visual) {
                cover = step.visual;
            }


            return {

                artist: artist,

                title: title,

                album: album,

                albumArt: cover

            };


        } catch (e) {

            return null;

        }

    }

}


module.exports = Metadata;