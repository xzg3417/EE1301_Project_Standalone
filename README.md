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

## Algorithm Implementation Details

The core feature of the Radar Mapping Engine is the estimation of the signal source direction. This is achieved using a **Weighted Vector Sum** algorithm, which treats each measurement as a vector pointing in the scanned direction with a magnitude proportional to the signal strength.

### 1. Data Collection & Pre-processing
Before the algorithm runs, data is collected by performing angular sweeps. For each angle $\theta$, multiple RSSI (Received Signal Strength Indicator) samples are taken and averaged to reduce noise.

```javascript
// From finishMeasurement() in script.js
let avg = Math.round(currentSamples.reduce((a, b) => a + b, 0) / currentSamples.length);
mapData.push({ ..., angle: dialAngle, rssi: avg, ... });
```

Only data points with a signal strength greater than -100 dBm are considered for the calculation to filter out background noise.

### 2. Weight Calculation (Signal Amplitude)
The RSSI value (in dBm) is logarithmic. To perform a vector sum, we need a linear magnitude. The algorithm converts RSSI to a weight $w$ that approximates the **signal amplitude** (voltage).

The formula used is:
$$ w = 10^{\frac{RSSI + 100}{20}} $$

This is derived from the relationship where Power $\propto$ Amplitude$^2$. Since $P_{dBm} = 10 \log_{10}(P_{mW})$, converting back to a linear scale proportional to voltage gives us the division by 20. The `+100` offset ensures the exponent is positive for typical Wi-Fi signals (usually > -100 dBm), effectively scaling the result without changing the relative weights.

```javascript
// From calculateSource() in script.js
let w = Math.pow(10, (d.rssi+100)/20);
```

### 3. Vector Decomposition
Each measurement $i$ at angle $\theta_i$ with weight $w_i$ is converted into Cartesian coordinates $(x_i, y_i)$.
The coordinate system is adjusted so that $0^\circ$ corresponds to North (Up). To align with standard trigonometric functions (where $0^\circ$ is East), we shift the angle by $-90^\circ$.

$$ \theta'_{i} = (\theta_i - 90) \times \frac{\pi}{180} $$
$$ x_i = w_i \cos(\theta'_{i}) $$
$$ y_i = w_i \sin(\theta'_{i}) $$

```javascript
// From calculateSource() in script.js
let r = (d.angle-90)*Math.PI/180;
sumSin += Math.sin(r)*w; // Accumulate y components
sumCos += Math.cos(r)*w; // Accumulate x components
```
*Note: The code uses `sumSin` for the y-component accumulation and `sumCos` for the x-component.*

### 4. Resultant Vector & Direction Estimation
The algorithm sums all individual vectors to find the resultant vector $\vec{R} = (\sum x_i, \sum y_i)$.
The angle of this resultant vector represents the estimated direction of the signal source. We use the `atan2` function to find the angle and then reverse the rotation applied earlier.

$$ \theta_{est} = \text{atan2}(\sum y_i, \sum x_i) \times \frac{180}{\pi} + 90 $$

Finally, the angle is normalized to be within $[0, 360)$.

```javascript
// From calculateSource() in script.js
let deg = Math.round(Math.atan2(sumSin,sumCos)*180/Math.PI + 90);
if(deg<0) deg+=360;
```

This method is effective because strong signals (high RSSI) have exponentially higher weights, pulling the resultant vector significantly towards the source, while weaker reflections or side-lobes have minimal impact.

## Test Environment

-   **Device Firmware Version**: photon2@6.3.3
