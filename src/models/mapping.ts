import { useState, useCallback } from 'react';
import { useModel } from '@umijs/max';

export interface Measurement {
  id: number;
  angle: number;
  rssi: number;
  rawSamples: number[];
}

export default () => {
  const { rssi } = useModel('serial');
  const [mapData, setMapData] = useState<Measurement[]>([]);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [currentSamples, setCurrentSamples] = useState<number[]>([]);
  const [requiredSamples, setRequiredSamples] = useState(5);
  const [dialAngle, setDialAngle] = useState(0);
  const [measurementID, setMeasurementID] = useState(1);

  const startMeasure = useCallback((samples: number) => {
    setRequiredSamples(samples);
    setCurrentSamples([]);
    setIsMeasuring(true);
  }, []);

  // Listen to RSSI updates
  // Note: This relies on the component calling a hook or effect to sync RSSI to this logic,
  // or we can just expose a function `addSample(rssi)` that the page calls when RSSI changes.
  // Since `useModel` shares state, we can watch `rssi` here if we were a component, but as a hook,
  // we are reactive. However, `useModel` inside another `useModel` is valid in Umi.

  // Actually, let's expose an `addSample` method and let the Page component call it when `rssi` changes
  // if `isMeasuring` is true. This avoids tight coupling inside the models for now.

  const addSample = useCallback((val: number) => {
    if (!isMeasuring) return;
    if (val <= -100) return; // Filter invalid/weak

    const newSamples = [...currentSamples, val];
    setCurrentSamples(newSamples);

    if (newSamples.length >= requiredSamples) {
      // Finish
      const avg = Math.round(newSamples.reduce((a, b) => a + b, 0) / newSamples.length);
      const newMeasurement: Measurement = {
        id: measurementID,
        angle: dialAngle,
        rssi: avg,
        rawSamples: newSamples,
      };
      setMapData((prev) => [...prev, newMeasurement]);
      setMeasurementID((prev) => prev + 1);
      setIsMeasuring(false);
      setCurrentSamples([]);
    }
  }, [isMeasuring, currentSamples, requiredSamples, dialAngle, measurementID]);

  const deleteMeasurement = useCallback((id: number) => {
    setMapData((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearMapData = useCallback(() => {
    setMapData([]);
    setMeasurementID(1);
  }, []);

  return {
    mapData,
    isMeasuring,
    currentSamples,
    requiredSamples,
    dialAngle,
    setDialAngle,
    startMeasure,
    addSample,
    deleteMeasurement,
    clearMapData,
  };
};
