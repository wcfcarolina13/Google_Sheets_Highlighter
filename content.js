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

    // Watch for DOM changes that might affect row heights (text wrapping, content changes)
    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

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
      z-index: 1;
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

    // Get row height and top position - need to find the actual row dimensions for wrapped cells
    // The active cell border may not reflect the full row height, so we need to find the row header
    let rowHeight = cellRect.height;
    let rowTop = cellRect.top;
    const cellTop = cellRect.top;
    const cellBottom = cellRect.bottom;
    const cellMidY = (cellTop + cellBottom) / 2;

    // Method 1: Find the row header cell in the row-headers-wrapper
    // These are the row number cells on the left side that span the full row height
    if (rowHeaders) {
      const rowHeaderCells = rowHeaders.querySelectorAll('div');
      for (const cell of rowHeaderCells) {
        const rect = cell.getBoundingClientRect();
        // Check if this cell contains our active cell's vertical midpoint
        if (rect.height > 10 && rect.top <= cellMidY && rect.bottom >= cellMidY) {
          rowHeight = rect.height;
          rowTop = rect.top;
          break;
        }
      }
    }

    // Method 2: Try the .row-header-canvas-container which has individual row divs
    if (rowHeight === cellRect.height) {
      const canvasContainer = document.querySelector('.row-header-canvas-container');
      if (canvasContainer) {
        const children = canvasContainer.children;
        for (const child of children) {
          const rect = child.getBoundingClientRect();
          if (rect.height > 10 && rect.top <= cellMidY && rect.bottom >= cellMidY) {
            rowHeight = rect.height;
            rowTop = rect.top;
            break;
          }
        }
      }
    }

    // Method 3: Look for elements with explicit row styling in the grid
    if (rowHeight === cellRect.height) {
      // Try to find any element that spans the row at this position
      const gridContainer = document.querySelector('.grid-scrollable-wrapper') ||
                           document.querySelector('[role="grid"]');
      if (gridContainer) {
        // Check elements that might represent rows
        const potentialRows = gridContainer.querySelectorAll('[data-row], .cell-input');
        for (const el of potentialRows) {
          const rect = el.getBoundingClientRect();
          if (rect.height > rowHeight && rect.top <= cellMidY && rect.bottom >= cellMidY) {
            rowHeight = rect.height;
            rowTop = rect.top;
            break;
          }
        }
      }
    }

    // Method 4: Parse the active cell's computed positioning from Google Sheets internal structure
    // The active cell often has sibling elements or parent containers with full row info
    if (rowHeight === cellRect.height && activeCellBorder.parentElement) {
      const parent = activeCellBorder.parentElement;
      const siblings = parent.children;
      for (const sibling of siblings) {
        if (sibling !== activeCellBorder) {
          const rect = sibling.getBoundingClientRect();
          if (rect.height > rowHeight && rect.top <= cellMidY && rect.bottom >= cellMidY) {
            rowHeight = rect.height;
            rowTop = rect.top;
            break;
          }
        }
      }
    }

    // Method 5: Look at the native selection background which Google Sheets renders
    // to match the full row height
    if (rowHeight === cellRect.height) {
      const selectionBg = document.querySelector('.native-selection');
      if (selectionBg) {
        const rect = selectionBg.getBoundingClientRect();
        if (rect.height > rowHeight) {
          rowHeight = rect.height;
          rowTop = rect.top;
        }
      }
    }

    // Method 6: Check the cell editor input area which expands to row height
    if (rowHeight === cellRect.height) {
      const cellInput = document.querySelector('.cell-input');
      if (cellInput) {
        const rect = cellInput.getBoundingClientRect();
        if (rect.height > rowHeight && rect.top <= cellMidY && rect.bottom >= cellMidY) {
          rowHeight = rect.height;
          rowTop = rect.top;
        }
      }
    }

    // Fallback
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

    // Calculate clipping for top - use rowTop which reflects the full row position
    const top = rowTop;
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
