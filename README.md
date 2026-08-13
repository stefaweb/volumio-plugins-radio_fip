# FIP Radio Plugin for Volumio

VERSION: 1.0 of 13-08-2026

## Description

`radio_fip` is a Volumio music service plugin providing access to the FIP radio channels from Radio France.

The plugin provides:

- 12 FIP radio stations
- AAC HiFi streams
- Station logos
- Track metadata (artist, title, album)
- Album artwork when available
- FIP default cover when no artwork is available

## Supported Stations

- FIP
- FIP Electro
- FIP Groove
- FIP Hip Hop
- FIP Jazz
- FIP Metal
- FIP Nouveautés
- FIP Pop
- FIP Reggae
- FIP Rock
- FIP Sacré Français
- FIP Monde

<br>
<img width="2940" height="1852" alt="radio_fip_plugins_sc_1" src="https://github.com/user-attachments/assets/aea57d1c-0e45-4a4c-8a9e-5ce5f77be7fd" />
<br>
<br>
<img width="2732" height="1800" alt="Image" src="https://github.com/user-attachments/assets/41222148-5e9c-42c3-b9c5-0f05070f9969" />
<br>
<br>
<img width="563" height="1218" alt="radio_fip_plugins_sc_3" src="https://github.com/user-attachments/assets/c71c7455-6ec6-44dd-bdaf-ec6339a759e8" />
<br>
<br>

## Installation

This plugin can be installed using the **Volumio Plugin Manager**:

[https://github.com/stefaweb/volumio-plugin-manager](https://github.com/stefaweb/volumio-plugin-manager)

Please refer to the Volumio Plugin Manager documentation for installation instructions.

## Installation example

The following example shows how to install, activate, check information and restart the plugin using the **Volumio Plugin Manager**.

Install the plugin:

```bash
./volumio_plugin_manager.py \
  --host http://volumio.local:3000 \
  --install-url "https://raw.githubusercontent.com/stefaweb/volumio-plugins-radio_fip/main/radio_fip.zip"
```

Activate the plugin:

```bash
./volumio_plugin_manager.py \
  --host http://volumio.local:3000 \
  --activate radio_fip
```

Display plugin information:

```bash
./volumio_plugin_manager.py \
  --host http://volumio.local:3000 \
  --info radio_fip
```

Restart the plugin:

```bash
./volumio_plugin_manager.py \
  --host http://volumio.local:3000 \
  --restart radio_fip
```

