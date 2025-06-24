export const renderPredictions = (
  predictions,
  ctx,
  privacyMode = false,
  video = null,
  heatmapPoints = null,
  playbackDetections = null
) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Draw heatmap if enabled (with color gradient)
  if (heatmapPoints && heatmapPoints.length > 0) {
    // Create a grid for density
    const gridSize = 32;
    const cols = Math.ceil(ctx.canvas.width / gridSize);
    const rows = Math.ceil(ctx.canvas.height / gridSize);
    const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
    heatmapPoints.forEach(({ x, y }) => {
      const col = Math.floor(x / gridSize);
      const row = Math.floor(y / gridSize);
      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        grid[row][col] += 1;
      }
    });
    // Find max density for normalization
    const maxDensity = Math.max(1, ...grid.flat());
    // Draw grid cells with color based on density
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const density = grid[row][col];
        if (density > 0) {
          // Color gradient: blue (low) -> yellow (mid) -> red (high)
          const t = density / maxDensity;
          let color;
          if (t < 0.5) {
            // blue to yellow
            const r = Math.round(255 * (t * 2));
            const g = Math.round(255 * (t * 2));
            color = `rgba(${r},${g},255,0.35)`;
          } else {
            // yellow to red
            const r = 255;
            const g = Math.round(255 * (1 - (t - 0.5) * 2));
            color = `rgba(${r},${g},0,0.45)`;
          }
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.fillStyle = color;
          ctx.fillRect(col * gridSize, row * gridSize, gridSize, gridSize);
          ctx.restore();
        }
      }
    }
  }

  // Use playbackDetections if provided (for timeline), else use predictions
  const toRender =
    playbackDetections && playbackDetections.length > 0
      ? playbackDetections
      : predictions;

  // Fonts
  const font = "16px sans-serif";
  ctx.font = font;
  ctx.textBaseline = "top";

  toRender.forEach((prediction) => {
    const [x, y, width, height] = prediction["bbox"];
    const isPerson = prediction.class === "person";

    // Privacy mode: blur faces (bounding box for person)
    if (privacyMode && isPerson && video) {
      // Draw blurred region for person
      try {
        // Get the image data from the video
        ctx.save();
        ctx.filter = "blur(12px)";
        ctx.drawImage(video, x, y, width, height, x, y, width, height);
        ctx.restore();
      } catch (e) {
        // fallback: fill with semi-transparent color
        ctx.fillStyle = "rgba(200,200,200,0.7)";
        ctx.fillRect(x, y, width, height);
      }
    } else {
      // bounding box
      ctx.strokeStyle = isPerson ? "#FF0000" : "#00FFFF";
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, width, height);
      // fill the color
      ctx.fillStyle = `rgba(255, 0, 0, ${isPerson ? 0.2 : 0})`;
      ctx.fillRect(x, y, width, height);
    }

    // Draw the label background.
    ctx.fillStyle = isPerson ? "#FF0000" : "#00FFFF";
    const textWidth = ctx.measureText(prediction.class).width;
    const textHeight = parseInt(font, 10); // base 10
    ctx.fillRect(x, y, textWidth + 4, textHeight + 4);

    ctx.fillStyle = "#000000";
    ctx.fillText(prediction.class, x, y);

    if (isPerson) {
      // playAudio(); // Removed to disable sound when a person is detected
    }
  });
};
