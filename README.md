# FIP Radio Plugin for Volumio

VERSION: 1.0.3 of 16-08-2026

## Description

`radio_fip` is a Volumio music service plugin providing access to the FIP radio channels from Radio France.

The plugin provides:

- 12 FIP radio stations
- AAC 192 Kbps HiFi streams
- Station logos
- Track metadata (artist, title, album)
- Album artwork when available
- FIP default cover when no artwork is available

## Supported Stations

- FIP National
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
<img width="2940" height="1852" alt="radio_fip_plugins_sc_1" src="https://github.com/user-attachments/assets/d6864727-5b00-4104-993b-fde385442ed3" />
<br>
<br>
<img width="2732" height="1800" alt="Image" src="https://github.com/user-attachments/assets/41222148-5e9c-42c3-b9c5-0f05070f9969" />
<br>
<br>
<img width="1125" height="2090" alt="radio_fip_plugins_sc_3" src="https://github.com/user-attachments/assets/f1452cd4-93ee-43ab-b821-02212de86e81" />
<br>
<br>

## Installation

The **Radio FIP** plugin is now available in beta on the **Volumio Plugin Store**.

To access the beta plugin store in Volumio:
1. Open the Volumio web interface.
2. Go to **Plugins**.
3. Open the **Plugin Store**.
4. Enable the **Show beta plugins** option in the store settings.
5. Search for **Radio FIP** and install the plugin.

This plugin can also be installed using the **Volumio Plugin Manager**:

[https://github.com/stefaweb/volumio-plugin-manager](https://github.com/stefaweb/volumio-plugin-manager)

Please refer to the Volumio Plugin Manager documentation for installation instructions.

The plugin can also be installed manually. Refer to the Volumio documentation for instructions.

## Installation example

The following example shows how to install, activate, check information, restart and remove the plugin using the **Volumio Plugin Manager**.

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

Remove the plugin:

```bash
./volumio_plugin_manager.py \
  --host http://volumio.local:3000 \
  --remove radio_fip
```
  
