/**
 * Google Sheets Row Highlighter - Content Script
 * Highlights the current row as you navigate
 */

(function() {
  'use strict';

  let currentMode = 'off';
  let highlightOverlay = null;
  let animationFrameId = null;
  let isUpdating = false;

  // Mode configurations
  const MODES = {
    fullYellow: { type: 'fill', color: 'rgba(255, 255, 0, 0.35)', blendMode: 'multiply' },
    fullPurple: { type: 'fill', color: 'rgba(200, 150, 255, 0.4)', blendMode: 'multiply' },
    borderBlack: { type: 'border', color: '#000000' },
    borderYellow: { type: 'border', color: '#DAA520' },
    borderPurple: { type: 'border', color: '#8B00FF' }
  };

  // Cache for mode styles (avoid recalculating)
  let cachedModeStyle = '';
  let cachedMode = '';

  // Initialize
  function init() {
    chrome.storage.sync.get(['highlightMode'], function(result) {
      if (result.highlightMode) {
        currentMode = result.highlightMode;
        updateModeStyle();
      }
    });

    chrome.storage.onChanged.addListener(function(changes, namespace) {
      if (changes.highlightMode) {
        currentMode = changes.highlightMode.newValue;
        updateModeStyle();
        if (currentMode === 'off') {
          removeHighlight();
        } else {
          scheduleUpdate();
        }
      }
    });

    createOverlay();

    // Selection change events
    document.addEventListener('mouseup', scheduleUpdate);
    document.addEventListener('keyup', scheduleUpdate);
    document.addEventListener('click', scheduleUpdate);

    // Scroll events - use passive listeners for better performance
    document.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true });
    document.addEventListener('wheel', scheduleUpdate, { capture: true, passive: true });

    // Start animation loop for smooth updates
    startAnimationLoop();

    console.log('Row Highlighter extension loaded');
  }

  function createOverlay() {
    highlightOverlay = document.createElement('div');
    highlightOverlay.id = 'row-highlighter-overlay';
    // Set base styles that don't change
    highlightOverlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 100;
      display: none;
      box-sizing: border-box;
    `;
    document.body.appendChild(highlightOverlay);
  }

  function updateModeStyle() {
    if (cachedMode === currentMode) return;
    cachedMode = currentMode;

    const mode = MODES[currentMode];
    if (!mode) {
      cachedModeStyle = '';
      return;
    }

    if (mode.type === 'fill') {
      cachedModeStyle = `background-color: ${mode.color}; mix-blend-mode: ${mode.blendMode || 'normal'}; border: none;`;
    } else if (mode.type === 'border') {
      cachedModeStyle = `background-color: transparent; border: 2px solid ${mode.color};`;
    }
  }

  function scheduleUpdate() {
    if (currentMode === 'off') return;
    isUpdating = true;
  }

  function startAnimationLoop() {
    function loop() {
      if (isUpdating && currentMode !== 'off') {
        updateHighlight();
        isUpdating = false;
      }
      animationFrameId = requestAnimationFrame(loop);
    }
    loop();
  }

  function updateHighlight() {
    if (currentMode === 'off') {
      removeHighlight();
      return;
    }

    // Find the active cell border
    const activeCellBorder = document.querySelector('.active-cell-border');
    if (!activeCellBorder) return;

    const cellRect = activeCellBorder.getBoundingClientRect();

    // Get left edge (after row numbers) - need this first for row height calculation
    let leftEdge = 0;
    const rowHeaders = document.querySelector('.row-headers-wrapper');
    if (rowHeaders) {
      leftEdge = rowHeaders.getBoundingClientRect().right;
    }

    // Get row height - need to find the actual row height for wrapped cells
    let rowHeight = cellRect.height;

    // The active-cell-border may not reflect wrapped row height
    // Try to find the corresponding row header cell which has the correct height
    if (rowHeaders) {
      // Find all row header cells and match by vertical position
      const rowHeaderCells = rowHeaders.querySelectorAll('.row-header-wrapper');
      for (const headerCell of rowHeaderCells) {
        const headerRect = headerCell.getBoundingClientRect();
        // Check if this header aligns with our cell (within 2px tolerance)
        if (Math.abs(headerRect.top - cellRect.top) < 2) {
          rowHeight = headerRect.height;
          break;
        }
      }
    }

    // Fallback: try to get height from the selection box or other elements
    if (rowHeight < 10) {
      const selectionBox = document.querySelector('.selection-box');
      if (selectionBox) {
        rowHeight = Math.max(rowHeight, selectionBox.getBoundingClientRect().height);
      }
    }

    if (rowHeight < 10) {
      const cellInput = document.querySelector('.cell-input');
      if (cellInput) {
        rowHeight = Math.max(rowHeight, cellInput.getBoundingClientRect().height);
      }
    }

    if (rowHeight < 10) rowHeight = 21;

    // Get right edge - find the grid container's right boundary
    let rightEdge = window.innerWidth;
    const gridScrollable = document.querySelector('.grid-scrollable-wrapper');
    if (gridScrollable) {
      rightEdge = gridScrollable.getBoundingClientRect().right;
    } else {
      // Fallback: try to find other containers
      const gridContainer = document.querySelector('[role="grid"]') ||
                           document.querySelector('.waffle-container');
      if (gridContainer) {
        rightEdge = gridContainer.getBoundingClientRect().right;
      }
    }

    // Calculate width
    const width = rightEdge - leftEdge;

    // Find grid top boundary
    let gridTopBoundary = 0;
    const possibleTopElements = [
      document.querySelector('.frozen-rows-wrapper'),
      document.querySelector('.row-header-wrapper'),
      document.querySelector('.grid-scrollable-wrapper'),
      document.querySelector('[role="grid"]'),
    ];

    for (const el of possibleTopElements) {
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top > gridTopBoundary) {
          gridTopBoundary = rect.top;
        }
      }
    }

    if (gridTopBoundary === 0 && rowHeaders) {
      gridTopBoundary = rowHeaders.getBoundingClientRect().top;
    }
    if (gridTopBoundary === 0) {
      gridTopBoundary = 140;
    }

    // Calculate clipping for top
    const top = cellRect.top;
    let clipTop = 0;

    if (top < gridTopBoundary) {
      clipTop = gridTopBoundary - top;
      if (clipTop >= rowHeight) {
        highlightOverlay.style.display = 'none';
        return;
      }
    }

    // Apply styles directly to properties for better performance
    highlightOverlay.style.display = 'block';
    highlightOverlay.style.top = top + 'px';
    highlightOverlay.style.left = leftEdge + 'px';
    highlightOverlay.style.width = width + 'px';
    highlightOverlay.style.height = rowHeight + 'px';
    highlightOverlay.style.clipPath = `inset(${clipTop}px 0 0 0)`;

    // Apply mode-specific styles
    const mode = MODES[currentMode];
    if (mode) {
      if (mode.type === 'fill') {
        highlightOverlay.style.backgroundColor = mode.color;
        highlightOverlay.style.mixBlendMode = mode.blendMode || 'normal';
        highlightOverlay.style.border = 'none';
      } else if (mode.type === 'border') {
        highlightOverlay.style.backgroundColor = 'transparent';
        highlightOverlay.style.border = `2px solid ${mode.color}`;
        highlightOverlay.style.mixBlendMode = 'normal';
      }
    }
  }

  function removeHighlight() {
    if (highlightOverlay) {
      highlightOverlay.style.display = 'none';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
