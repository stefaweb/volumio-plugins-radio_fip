# Changelog for FIP Radio Plugin for Volumio

## Version 1.0.5
Date: 02-09-2026

- New radio_stations.json
- Fixed the stream that was pointing to .mp3 instead of .aac.

## Version 1.0.4
Date: 02-09-2026

- New radio_stations.json
- Added 'FIP Cultes'
- Corrected some metadataId

# Changelog for Radio France FIP Open API Scanner

## Version 1.0.0
Date: 02-09-2026

- Initial release.
- Added Radio France Open API GraphQL station discovery.
- Added FIP station and webradio detection.
- Added live metadata retrieval and station ID validation.
- Added metadata ID uniqueness validation.
- Added preservation of existing station IDs and logo filenames.
- Added generation and validation of radio_stations.json.
- Added atomic output file writing.
- Added external configuration file support.
- Added --output command-line option.
- Added --test-live command-line option.
- Added configurable request delay and HTTP timeout.
- Added error handling for API, GraphQL and validation failures.

## Version 1.0.3
Date: 16-08-2026

- Added compatibility with Volumio 3.x and Volumio 4.x.
- Fixed plugin installation permissions on Volumio 4, where files and directories (node_modules, package-lock.json and .package-lock.json) could be created with root:root ownership, causing the uninstall operation to fail.
- Added automatic ownership check and correction for files created by npm.
- Improved plugin removal reliability by preventing permission issues during uninstall.
- Improved overall plugin installation and removal handling (including index.js changes).
- Added debug log support (enable with var DEBUG = true; in index.js).
- Improved FIP Radio menu cleanup to properly remove the browse source entry during plugin stop and removal.
