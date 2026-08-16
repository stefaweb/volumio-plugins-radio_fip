# Changelog for FIP Radio Plugin for Volumio

## Version 1.0.3
Date: 16-08-2026

- Added compatibility with Volumio 3.x and Volumio 4.x.
- Fixed plugin installation permissions on Volumio 4, where files and directories (node_modules, package-lock.json and .package-lock.json) could be created with root:root ownership, causing the uninstall operation to fail.
- Added automatic ownership check and correction for files created by npm.
- Improved plugin removal reliability by preventing permission issues during uninstall.
- Improved overall plugin installation and removal handling (including index.js changes).
- Added debug log support (enable with var DEBUG = true; in index.js).
- Improved FIP Radio menu cleanup to properly remove the browse source entry during plugin stop and removal.
