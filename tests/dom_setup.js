const fs = require('fs');
const path = require('path');

module.exports = function setupDOM() {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    document.body.innerHTML = html;

    // Mock canvas contexts as JSDOM doesn't support them fully
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach(canvas => {
        canvas.getContext = (type) => {
            return {
                clearRect: jest.fn(),
                createRadialGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
                beginPath: jest.fn(),
                arc: jest.fn(),
                fill: jest.fn(),
                stroke: jest.fn(),
                moveTo: jest.fn(),
                lineTo: jest.fn(),
                save: jest.fn(),
                translate: jest.fn(),
                rotate: jest.fn(),
                restore: jest.fn(),
                fillRect: jest.fn(),
                fillText: jest.fn(),
                closePath: jest.fn(),
                setLineDash: jest.fn(),
            };
        };
    });

    // Mock navigator.serial
    Object.defineProperty(navigator, 'serial', {
        value: {
            requestPort: jest.fn(),
        },
        writable: true
    });

    // Mock window.URL.createObjectURL
    window.URL.createObjectURL = jest.fn();

    // Mock alert
    window.alert = jest.fn();
};
