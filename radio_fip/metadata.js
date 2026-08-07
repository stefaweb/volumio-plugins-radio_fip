'use strict';


const https = require('https');


class Metadata {


    constructor(logger) {

        this.logger = logger;

        this.lastTrack = null;

    }



    get(station, callback) {


        if (!station || !station.metadataId) {

            callback(null);

            return;

        }


        const url =
            'https://api.radiofrance.fr/livemeta/pull/' +
            station.metadataId;



        https.get(
            url,
            (res) => {


                let body = '';



                res.on(
                    'data',
                    (chunk) => {

                        body += chunk;

                    }
                );



                res.on(
                    'end',
                    () => {


                        try {


                            const json =
                                JSON.parse(body);



                            const metadata =
                                this.parse(json);



                            if (!metadata) {

                                callback(null);

                                return;

                            }



                            /*
                             * Evite les pushState inutiles
                             */

                            const track =
                                metadata.artist +
                                '|' +
                                metadata.title;



                            if (track === this.lastTrack) {

                                callback(null);

                                return;

                            }



                            this.lastTrack =
                                track;



                            callback(metadata);



                        }
                        catch(error) {


                            this.logger.error(
                                '[radio_fip] Metadata parse error: ' +
                                error.message
                            );


                            callback(null);

                        }


                    }
                );


            }
        )
        .on(
            'error',
            (error) => {


                this.logger.error(
                    '[radio_fip] Metadata HTTP error: ' +
                    error.message
                );


                callback(null);


            }
        );

    }




    parse(json) {


        try {


            /*
             * Structure Radio France :
             *
             * levels[0]
             *   position
             *   items[]
             *
             * steps[]
             *
             */


            const level =
                json.levels[0];



            if (!level) {

                return null;

            }



            const itemId =
                level.items[level.position];



            const item =
                json.steps[itemId];



            if (!item) {

                return null;

            }



            let artist = '';
            let title = '';
            let album = '';
            let cover = '';



            if (item.firstLine) {

                artist =
                    item.firstLine;

            }



            if (item.title) {

                title =
                    item.title;

            }



            if (item.secondLine) {

                album =
                    item.secondLine;

            }



            /*
             * Selon les versions de l'API,
             * la pochette peut avoir plusieurs noms
             */

            if (item.visual) {

                cover =
                    item.visual;

            }
            else if (item.image) {

                cover =
                    item.image;

            }



            return {


                artist: artist,

                title: title,

                album: album,

                albumArt: cover


            };


        }
        catch(error) {


            return null;

        }

    }


}


module.exports = Metadata;