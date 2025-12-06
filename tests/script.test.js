const setupDOM = require('./dom_setup');

describe('Signal Hunter Script Tests', () => {
    let script;

    beforeEach(() => {
        // Reset DOM before each test
        setupDOM();

        // Reset modules to ensure fresh script execution
        jest.resetModules();

        // We need to require the script again to bind to the new DOM
        script = require('../script.js');
    });

    test('should load script and populate els', () => {
        expect(script.els).toBeDefined();
        expect(script.els.tabs.live).not.toBeNull();
        expect(script.els.views.live).not.toBeNull();
    });

    test('getTheme should return correct colors based on mode', () => {
        // Default is light mode in script?
        // "isLightMode = true" in script.js
        const lightTheme = script.getTheme();
        expect(lightTheme.bg).toBe("#ffffff");

        // Toggle theme via button click
        const themeBtn = document.getElementById('themeBtn');
        themeBtn.click();

        const darkTheme = script.getTheme();
        expect(darkTheme.bg).toBe("#000000");
    });

    test('processLine should handle DATA lines correctly', () => {
        // processLine update live chart or map data depending on tab

        // Switch to live tab (default)
        window.switchTab('live');

        script.processLine('DATA:-50,1,XX:XX:XX:XX:XX:XX');

        const liveData = script.getLiveChartData();
        // The last element should be -50
        expect(liveData[liveData.length - 1]).toBe(-50);

        const dispRSSI = document.getElementById('dispRSSI');
        expect(dispRSSI.innerText).toBe(-50);
    });

    test('processLine should parse LIST lines and add network', () => {
        const list = document.getElementById('networkList');
        // Clear list first (script might have "WAITING..." text)
        list.innerHTML = "";

        script.processLine('LIST:TestSSID,-60,6,BSSID,WPA2');

        const items = list.querySelectorAll('.list-item');
        expect(items.length).toBe(1);
        expect(items[0].innerHTML).toContain('TestSSID');
        expect(items[0].innerHTML).toContain('-60dBm');
        expect(items[0].innerHTML).toContain('CH:6');
    });

    test('processLine should update device status', () => {
        script.processLine('STATUS:DEVICE:CONNECTED,MyWiFi,192.168.1.10,-45,gw,mask,mac');

        const miniState = document.getElementById('miniState');
        const miniSSID = document.getElementById('miniSSID');
        const miniIP = document.getElementById('miniIP');
        const miniRSSI = document.getElementById('miniRSSI');

        expect(miniState.innerText).toBe("ONLINE");
        expect(miniSSID.innerText).toBe("MyWiFi");
        expect(miniIP.innerText).toBe("192.168.1.10");
        expect(miniRSSI.innerText).toBe("-45dBm");
    });

    test('handleMapData should accumulate samples', () => {
        // Setup for mapping
        window.switchTab('map');
        script.setMapTarget("TestNet", 6);
        script.setIsMeasuring(true);
        script.setRequiredSamples(3);
        script.setDialAngle(45);
        script.resetCurrentSamples();

        script.handleMapData(-60);
        script.handleMapData(-62);

        // Should not be finished yet
        expect(script.getMapData().length).toBe(0);

        script.handleMapData(-58);

        // Now it should be finished
        const mapData = script.getMapData();
        expect(mapData.length).toBe(1);
        expect(mapData[0].rssi).toBe(-60); // Average of -60, -62, -58
        expect(mapData[0].angle).toBe(45);
        expect(mapData[0].rawSamples).toEqual([-60, -62, -58]);
    });

    test('calculateSource should estimate correct angle', () => {
        script.resetState();
        const mapData = script.getMapData();

        // Add synthetic data for a source at 90 degrees (East)
        // 90 deg -> North (0 deg in math) if 0 is North?
        // Script says: "0-North coordinates".
        // Formula: theta' = (theta - 90) * PI / 180.
        // If angle is 90 (East), theta' = 0. cos(0)=1, sin(0)=0. Vector is (1, 0).
        // If source is at 90 deg, we expect peak RSSI at 90 deg.

        mapData.push({ id: 1, angle: 90, rssi: -40, rawSamples: [-40] }); // Strongest
        mapData.push({ id: 2, angle: 45, rssi: -60, rawSamples: [-60] });
        mapData.push({ id: 3, angle: 135, rssi: -60, rawSamples: [-60] });
        mapData.push({ id: 4, angle: 180, rssi: -80, rawSamples: [-80] }); // Weakest opposite

        script.calculateSource();

        const result = document.getElementById('predictionResult');
        // We expect something close to 90. Due to floating point math, it might be slightly off.
        // In the test setup:
        // 90 deg: -40dBm (w = 10^3 = 1000)
        // 45 deg: -60dBm (w = 10^2 = 100)
        // 135 deg: -60dBm (w = 10^2 = 100)
        // 180 deg: -80dBm (w = 10^1 = 10)
        // Vectors:
        // 90 deg -> (0, 1) * 1000 = (0, 1000)
        // 45 deg -> (0.707, 0.707) * 100 = (70.7, 70.7)
        // 135 deg -> (-0.707, 0.707) * 100 = (-70.7, 70.7)
        // 180 deg -> (-1, 0) * 10 = (-10, 0)
        // Sum X = 0 + 70.7 - 70.7 - 10 = -10
        // Sum Y = 1000 + 70.7 + 70.7 + 0 = 1141.4
        // Angle = atan2(1141.4, -10)
        // atan2(y, x) gives angle from X axis (East).
        // 90 deg is North.
        // The script uses: theta' = (theta - 90) * PI / 180.
        // x_total = sum(w * cos(theta'))
        // y_total = sum(w * sin(theta'))
        // theta_est = atan2(y_total, x_total) * 180/PI + 90

        // Let's recheck the test inputs and script logic.
        // Input 90: theta' = 0. cos=1, sin=0. w=1000. X+=1000, Y+=0.
        // Input 45: theta' = -45. cos=0.707, sin=-0.707. w=100. X+=70.7, Y+=-70.7.
        // Input 135: theta' = 45. cos=0.707, sin=0.707. w=100. X+=70.7, Y+=70.7.
        // Input 180: theta' = 90. cos=0, sin=1. w=10. X+=0, Y+=10.

        // Total X = 1000 + 70.7 + 70.7 + 0 = 1141.4
        // Total Y = 0 - 70.7 + 70.7 + 10 = 10

        // atan2(10, 1141.4) is very small positive angle (approx 0.5 deg).
        // Result = 0.5 * 180/PI + 90 = 0.5 + 90 = 90.5.
        // Rounded: 91.

        expect(result.innerHTML).toMatch(/EST: 9[01]°/);
    });

    test('getQuality should return correct percentage', () => {
        // Formula: (rssi + 100) * 1.5
        // -40 -> (-40 + 100) * 1.5 = 60 * 1.5 = 90
        expect(script.getQuality(-40)).toBe(90);
        // -100 -> 0
        expect(script.getQuality(-100)).toBe(0);
        // -30 -> 70 * 1.5 = 105 -> clamped to 100
        expect(script.getQuality(-30)).toBe(100);
    });

    test('Switching tabs should update visibility', () => {
        window.switchTab('map');
        expect(document.getElementById('view-map').style.display).toBe('flex');
        expect(document.getElementById('view-live').style.display).toBe('none');

        window.switchTab('live');
        expect(document.getElementById('view-live').style.display).toBe('flex');
        expect(document.getElementById('view-map').style.display).toBe('none');
    });

    test('processLine should handle malformed DATA lines gracefully', () => {
        // Should not crash
        expect(() => {
            script.processLine(null);
            script.processLine('');
            script.processLine('DATA:');
            script.processLine('DATA:garbage');
        }).not.toThrow();
    });

    test('generateTestData should populate mapData', () => {
        script.resetState();
        window.generateTestData();
        const mapData = script.getMapData();
        expect(mapData.length).toBe(16); // 360 / 22.5
        expect(mapData[0].rssi).toBeDefined();
        expect(mapData[0].angle).toBeDefined();
    });

    test('startPing should send command if connected', () => {
        const mockWriter = {
            write: jest.fn().mockResolvedValue(undefined)
        };
        script.setWriter(mockWriter);
        script.setIsConnected(true);

        // Mock input values
        document.getElementById('pingTarget').value = "8.8.8.8";
        document.getElementById('pingCount').value = "3";

        window.startPing();

        expect(mockWriter.write).toHaveBeenCalledWith("PING:8.8.8.8:3\n");
    });

    test('CSV Export logic (mocked Blob)', () => {
        // Mock URL.createObjectURL and Blob
        global.Blob = jest.fn((content) => ({ content }));
        global.URL.createObjectURL = jest.fn((blob) => "blob:url");

        // Mock link click
        const clickMock = jest.fn();
        // Since 'document' is available in jsdom environment, we can spy on it.
        // However, jest.spyOn(document, 'createElement') might be tricky if we want to preserve original behavior.
        // Instead of replacing implementation for everything, we can just intercept 'a' creation.

        const originalCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
            if (tagName === 'a') {
                return {
                    click: clickMock,
                    href: '',
                    download: '',
                    style: {}
                };
            }
            return originalCreateElement(tagName);
        });

        // Add some data
        script.resetState();
        script.setMapData([
            { id: 1, angle: 0, rssi: -50, rawSamples: [-50] }
        ]);

        window.exportCSV();

        expect(global.Blob).toHaveBeenCalled();
        const blobContent = global.Blob.mock.calls[0][0][0];
        expect(blobContent).toContain("ID,Angle,AvgRSSI");
        expect(blobContent).toContain("1,0,-50");
        expect(clickMock).toHaveBeenCalled();

        // Restore mocks
        jest.restoreAllMocks();
    });

    test('CSV Import logic', (done) => {
        // Mock FileReader
        const mockFileReader = {
            readAsText: jest.fn(),
            onload: null
        };
        window.FileReader = jest.fn(() => mockFileReader);

        // Create a fake file input
        const input = document.createElement('input');
        input.type = 'file';

        // Mock file
        const file = new File(["ID,Angle,AvgRSSI,Count,Raw_Samples\n1,0,-50,1,,-50\n"], "data.csv", { type: 'text/csv' });

        // Trigger import
        // We can't easily set input.files programmatically in JSDOM securely, but we can mock the property.
        Object.defineProperty(input, 'files', {
            value: [file]
        });

        window.importCSV(input);

        expect(window.FileReader).toHaveBeenCalled();
        expect(mockFileReader.readAsText).toHaveBeenCalledWith(file);

        // Simulate onload
        mockFileReader.onload({
            target: {
                result: "ID,Angle,AvgRSSI,Count,Raw_Samples\n1,90,-55,1,-55\n"
            }
        });

        // Check if mapData updated
        const mapData = script.getMapData();
        expect(mapData.length).toBe(1);
        expect(mapData[0].angle).toBe(90);
        expect(mapData[0].rssi).toBe(-55);

        done();
    });
});
