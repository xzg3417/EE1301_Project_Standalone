# Web Serial Radar Mapping Engine

## Project Introduction

The Web Serial Radar Mapping Engine is a semi-automated mapping tool designed to visualize and track Wi-Fi signal strength and sources. The system utilizes a Particle Photon 2 hardware device as a scanning backend, communicating with a frontend web application via the Web Serial API.

This project enables users to:
- Scan for nearby Wi-Fi networks in real-time.
- Track signal strength (RSSI) of specific targets over time.
- Perform directional mapping by recording signal strength at various angles.
- Visualize signal data on a radar chart and a live time-series chart.
- Estimate the direction of a signal source based on recorded data points.

The core logic resides in the firmware (`src/project.cpp`) which handles Wi-Fi scanning and serial communication, while the frontend (`index.html`, `script.js`, `style.css`) provides the user interface and data visualization.

## Code Analysis

The codebase is structured into two main components: the Firmware (Backend) and the Web Interface (Frontend).

### Firmware (`src/project.cpp`)
- **Platform**: Particle Photon 2 (C++).
- **Core Functionality**:
  - **Serial Command Processing**: Listens for commands like `SCAN`, `TRACK`, `STOP`, and `PING`.
  - **State Machine**: Manages the device state (`IDLE`, `SCANNING`, `TRACKING`).
  - **Wi-Fi Scanning**: Uses `WiFi.scan()` to detect networks and `WiFi.RSSI()` for signal strength.
  - **Tracking Logic**: Continuously scans for a specific target SSID and reports the strongest signal found.
  - **Device Status**: Periodically reports connection status, IP, and MAC address.

### Web Interface
- **HTML (`index.html`)**: Defines the structure of the application, including the sidebar, main view area, and terminal panel.
- **CSS (`style.css`)**: Provides styling for the dark/light themes, layout management (flexbox), and custom UI components like the dial and radar.
- **JavaScript (`script.js`)**:
  - **Web Serial API**: Manages the connection to the Photon 2 device (`navigator.serial`).
  - **Data Visualization**: Uses HTML5 Canvas for the Radar Chart (`drawRadar`), Dial UI (`drawDial`), and Live Signal Chart (`drawLiveChart`).
  - **Data Management**: Handles CSV import/export of mapping data.
  - **Algorithm**: Implements a weighted vector sum algorithm to estimate the signal source direction.

## Technical Path

1.  **Hardware Abstraction**: The Particle Photon 2 is used as a Wi-Fi radio interface. It abstracts the low-level 802.11 scanning into simple serial data streams.
2.  **Communication Protocol**: A custom ASCII-based protocol is defined for communication between the browser and the device:
    -   **Commands**: `SCAN`, `TRACK:SSID:CH`, `PING:TARGET:COUNT`.
    -   **Responses**: `LIST:...`, `DATA:...`, `STATUS:...`.
3.  **Frontend Architecture**:
    -   **Event-Driven**: The UI updates in response to serial data events and user interactions.
    -   **Canvas Rendering**: Custom drawing functions are used instead of heavy charting libraries to maintain performance and control over the visual style (Radar/Dial).
    -   **Responsive Design**: The layout supports resizing panels to adapt to different screen sizes or workflows.
4.  **Signal Processing**:
    -   **RSSI Conversion**: Raw signal strength (dBm) is normalized for display on the radar chart.
    -   **Source Estimation**: A simple trigonometric approach (weighted average of vectors) is used to predict the direction of the signal source.

## Test Environment

-   **Device Firmware Version**: photon2@6.3.3
