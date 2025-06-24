"use client";

import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { load as cocoSSDLoad } from "@tensorflow-models/coco-ssd";
import * as tf from "@tensorflow/tfjs";
import { renderPredictions } from "@/utils/render-predictions";
import { saveAs } from "file-saver";

let detectInterval;

const ObjectDetection = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [objectCounts, setObjectCounts] = useState({});
  const [history, setHistory] = useState([]);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(null); // null = live
  const [darkMode, setDarkMode] = useState(false);

  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  // Collect heatmap points (center of each bbox)
  const heatmapPoints = history.map((h) => {
    const [x, y, w, hgt] = h.bbox;
    return { x: x + w / 2, y: y + hgt / 2 };
  });

  async function runCoco() {
    setIsLoading(true);
    const net = await cocoSSDLoad();
    setIsLoading(false);

    detectInterval = setInterval(() => {
      if (playbackIndex === null) runObjectDetection(net);
    }, 10);
  }

  async function runObjectDetection(net) {
    if (
      canvasRef.current &&
      webcamRef.current !== null &&
      webcamRef.current.video?.readyState === 4
    ) {
      canvasRef.current.width = webcamRef.current.video.videoWidth;
      canvasRef.current.height = webcamRef.current.video.videoHeight;

      const detectedObjects = await net.detect(
        webcamRef.current.video,
        undefined,
        0.6
      );

      // Count objects
      const counts = {};
      detectedObjects.forEach((obj) => {
        counts[obj.class] = (counts[obj.class] || 0) + 1;
      });
      setObjectCounts(counts);

      // Add to history
      if (detectedObjects.length > 0) {
        setHistory((prev) => [
          ...prev,
          ...detectedObjects.map((obj) => ({
            ...obj,
            timestamp: new Date().toLocaleString(),
          })),
        ]);
      }

      const context = canvasRef.current.getContext("2d");
      renderPredictions(
        detectedObjects,
        context,
        privacyMode,
        webcamRef.current.video,
        showHeatmap ? heatmapPoints : null,
        null // playbackDetections
      );
    }
  }

  // For playback: render selected detection log (multi-frame)
  useEffect(() => {
    if (playbackIndex !== null && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      // Show detections within +/- 1 second window (assuming ~100ms per detection)
      const windowSize = 10; // 10 frames before and after
      const start = Math.max(0, playbackIndex - windowSize);
      const end = Math.min(history.length, playbackIndex + windowSize + 1);
      const playbackDetections = history.slice(start, end);
      renderPredictions(
        playbackDetections,
        context,
        privacyMode,
        null,
        showHeatmap ? heatmapPoints : null,
        playbackDetections
      );
    }
  }, [playbackIndex, privacyMode, showHeatmap, history]);

  const showmyVideo = () => {
    if (
      webcamRef.current !== null &&
      webcamRef.current.video?.readyState === 4
    ) {
      const myVideoWidth = webcamRef.current.video.videoWidth;
      const myVideoHeight = webcamRef.current.video.videoHeight;

      webcamRef.current.video.width = myVideoWidth;
      webcamRef.current.video.height = myVideoHeight;
    }
  };

  useEffect(() => {
    runCoco();
    showmyVideo();
    return () => clearInterval(detectInterval);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // CSV Export
  const exportCSV = () => {
    const header = ["Timestamp", "Class", "Score", "BBox"].join(",");
    const rows = history.map((h) =>
      [h.timestamp, h.class, h.score, JSON.stringify(h.bbox)].join(",")
    );
    const csvContent = [header, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "detection_history.csv");
  };

  // Resume live detection
  const resumeLive = () => setPlaybackIndex(null);

  // Export heatmap/canvas as PNG
  const exportHeatmap = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = "heatmap.png";
      link.click();
    }
  };

  return (
    <div className="glass-card fade-in">
      <div className="toolbar">
        <span className="font-bold text-lg">Object Detector</span>
        <span className="status-badge">
          {playbackIndex === null ? "Live" : "Playback"}
        </span>
        <button
          className="btn-accent"
          onClick={() => setDarkMode((dm) => !dm)}
          title="Toggle Dark Mode"
        >
          {darkMode ? "🌙" : "☀️"}
        </button>
      </div>
      <div className="mb-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h2 className="font-bold">Object Count (Live):</h2>
          <ul className="flex flex-wrap gap-2">
            {Object.entries(objectCounts).map(([cls, count]) => (
              <li
                key={cls}
                className="bg-gray-200 dark:bg-gray-700 rounded px-2 py-1 text-sm"
              >
                {cls}: {count}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button
            className="btn-accent"
            onClick={exportCSV}
            disabled={history.length === 0}
            title="Export Detection History CSV"
          >
            📄 Export CSV
          </button>
          <button
            className="btn-accent"
            onClick={exportHeatmap}
            disabled={!showHeatmap}
            title="Export Heatmap as PNG"
          >
            🖼️ Export Heatmap
          </button>
          <label
            className="ml-2 flex items-center cursor-pointer"
            title="Blur faces for privacy"
          >
            <input
              type="checkbox"
              checked={privacyMode}
              onChange={(e) => setPrivacyMode(e.target.checked)}
              className="mr-1"
            />
            🕶️ Privacy
          </label>
          <label
            className="ml-2 flex items-center cursor-pointer"
            title="Show heatmap overlay"
          >
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={(e) => setShowHeatmap(e.target.checked)}
              className="mr-1"
            />
            🔥 Heatmap
          </label>
        </div>
      </div>
      <div className="legend">
        <span>Heatmap:</span>
        <span className="legend-gradient"></span>
        <span>Low</span>
        <span>High</span>
      </div>
      <div className="mb-4 max-h-40 overflow-y-auto bg-white dark:bg-gray-900 rounded shadow p-2">
        <h2 className="font-bold mb-2">Detection History (Recent 20):</h2>
        <ul className="text-xs">
          {history
            .slice(-20)
            .reverse()
            .map((h, idx) => (
              <li key={idx}>
                [{h.timestamp}] {h.class} (score: {h.score.toFixed(2)}) bbox:{" "}
                {JSON.stringify(h.bbox)}
              </li>
            ))}
        </ul>
      </div>
      {/* Playback Timeline */}
      <div className="mb-4 flex items-center gap-4">
        <label className="font-bold">Timeline:</label>
        <input
          type="range"
          min={0}
          max={history.length - 1}
          value={playbackIndex === null ? history.length - 1 : playbackIndex}
          onChange={(e) => setPlaybackIndex(Number(e.target.value))}
          disabled={history.length === 0}
          className="slider w-64"
        />
        <button
          className="btn-accent"
          onClick={resumeLive}
          disabled={playbackIndex === null}
          title="Resume Live Detection"
        >
          ▶️ Live
        </button>
        <span className="text-xs">
          {playbackIndex === null ? "Live" : `#${playbackIndex + 1}`}
        </span>
      </div>
      {isLoading ? (
        <div className="gradient-text">Loading AI Model...</div>
      ) : (
        <div className="relative flex justify-center items-center gradient p-1.5 rounded-md">
          {/* webcam */}
          <Webcam
            ref={webcamRef}
            className="rounded-md w-full lg:h-[720px]"
            muted
          />
          {/* canvas */}
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 z-99999 w-full lg:h-[720px]"
          />
        </div>
      )}
    </div>
  );
};

export default ObjectDetection;
