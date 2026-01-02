/**
 * Google Sheets Row Highlighter - Content Script
 * Highlights the current row as you navigate
 */

(function() {
  'use strict';

  let currentMode = 'off';
  let lastHighlightedRow = null;
  let highlightOverlay = null;

  // Mode configurations
  const MODES = {
    fullYellow: { type: 'fill', color: 'rgba(255, 255, 0, 0.35)', blendMode: 'multiply' },
    fullPurple: { type: 'fill', color: 'rgba(200, 150, 255, 0.4)', blendMode: 'multiply' },
    borderBlack: { type: 'border', color: '#000000' },
    borderYellow: { type: 'border', color: '#DAA520' },
    borderPurple: { type: 'border', color: '#8B00FF' }
  };

  // Initialize
  function init() {
    chrome.storage.sync.get(['highlightMode'], function(result) {
      if (result.highlightMode) {
        currentMode = result.highlightMode;
      }
    });

    chrome.storage.onChanged.addListener(function(changes, namespace) {
      if (changes.highlightMode) {
        currentMode = changes.highlightMode.newValue;
        if (currentMode === 'off') {
          removeHighlight();
        } else {
          updateHighlight();
        }
      }
    });

    createOverlay();

    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('keyup', handleSelectionChange);
    document.addEventListener('click', handleSelectionChange);

    observeSheetChanges();

    console.log('Row Highlighter extension loaded');
  }

  function createOverlay() {
    highlightOverlay = document.createElement('div');
    highlightOverlay.id = 'row-highlighter-overlay';
    document.body.appendChild(highlightOverlay);
  }

  function handleSelectionChange() {
    if (currentMode === 'off') {
      removeHighlight();
      return;
    }
    setTimeout(updateHighlight, 50);
  }

  function updateHighlight() {
    if (currentMode === 'off') {
      removeHighlight();
      return;
    }

    // Find the active cell border - the blue box around selected cell
    const activeCellBorder = document.querySelector('.active-cell-border');
    if (!activeCellBorder) return;

    // Get the cell's bounding rect
    const cellRect = activeCellBorder.getBoundingClientRect();

    // The active-cell-border might have small height, so get height from its parent or style
    let rowHeight = cellRect.height;

    // If height is too small, try to get it from the computed style or parent
    if (rowHeight < 10) {
      // Try getting height from the cell input wrapper or parent elements
      const cellInput = document.querySelector('.cell-input');
      if (cellInput) {
        const inputRect = cellInput.getBoundingClientRect();
        if (inputRect.height > rowHeight) {
          rowHeight = inputRect.height;
        }
      }

      // Fallback: use a reasonable default row height
      if (rowHeight < 10) {
        rowHeight = 21; // Default Google Sheets row height
      }
    }

    // Find the left edge (after row numbers column)
    let leftEdge = 0;
    const rowHeaders = document.querySelector('.row-headers-wrapper');
    if (rowHeaders) {
      leftEdge = rowHeaders.getBoundingClientRect().right;
    }

    // Use full viewport width
    const rightEdge = window.innerWidth;
    const width = rightEdge - leftEdge;

    // Find the top boundary of the grid area (below frozen rows and column headers)
    let gridTopBoundary = 0;
    const columnHeaders = document.querySelector('.column-headers-wrapper');
    if (columnHeaders) {
      gridTopBoundary = columnHeaders.getBoundingClientRect().bottom;
    }

    const rowInfo = {
      rowIndex: Math.round(cellRect.top),
      top: cellRect.top,
      left: leftEdge,
      width: width,
      height: rowHeight,
      gridTop: gridTopBoundary
    };

    // Skip if same row
    if (lastHighlightedRow !== null && Math.abs(lastHighlightedRow - rowInfo.rowIndex) < 2) {
      return;
    }
    lastHighlightedRow = rowInfo.rowIndex;

    applyHighlight(rowInfo);
  }

  function applyHighlight(rowInfo) {
    if (!highlightOverlay) createOverlay();

    const mode = MODES[currentMode];
    if (!mode) return;

    // Calculate clipping if the row is partially above the grid area
    let top = rowInfo.top;
    let height = rowInfo.height;
    let clipTop = 0;

    if (top < rowInfo.gridTop) {
      // Row is partially or fully above the visible grid area
      clipTop = rowInfo.gridTop - top;
      if (clipTop >= height) {
        // Row is completely above the grid - hide the highlight
        highlightOverlay.style.cssText = 'display: none;';
        return;
      }
    }

    // Build the complete style string
    // z-index 100 keeps it above the grid but below modals/dialogs
    let styleStr = `
      position: fixed;
      pointer-events: none;
      z-index: 100;
      top: ${top}px;
      left: ${rowInfo.left}px;
      width: ${rowInfo.width}px;
      height: ${height}px;
      box-sizing: border-box;
      clip-path: inset(${clipTop}px 0 0 0);
    `;

    if (mode.type === 'fill') {
      styleStr += `
        background-color: ${mode.color};
        mix-blend-mode: ${mode.blendMode || 'normal'};
      `;
    } else if (mode.type === 'border') {
      styleStr += `
        background-color: transparent;
        border: 2px solid ${mode.color};
      `;
    }

    highlightOverlay.style.cssText = styleStr;

    // Debug
    console.log('Highlight applied:', {
      top: rowInfo.top,
      left: rowInfo.left,
      width: rowInfo.width,
      height: rowInfo.height,
      mode: currentMode
    });
  }

  function removeHighlight() {
    if (highlightOverlay) {
      highlightOverlay.style.cssText = 'display: none;';
    }
    lastHighlightedRow = null;
  }

  function observeSheetChanges() {
    const observer = new MutationObserver(function(mutations) {
      if (currentMode !== 'off') {
        clearTimeout(window.highlightUpdateTimeout);
        window.highlightUpdateTimeout = setTimeout(updateHighlight, 50);
      }
    });

    const startObserving = () => {
      const grid = document.querySelector('[role="grid"]') ||
                   document.querySelector('.grid-container') ||
                   document.querySelector('#docs-editor-container');

      if (grid) {
        observer.observe(grid, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class', 'transform']
        });
      } else {
        setTimeout(startObserving, 500);
      }
    };

    startObserving();

    document.addEventListener('scroll', function() {
      if (currentMode !== 'off') {
        setTimeout(updateHighlight, 10);
      }
    }, true);

    document.addEventListener('wheel', function() {
      if (currentMode !== 'off') {
        setTimeout(updateHighlight, 50);
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
