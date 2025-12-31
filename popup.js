// Popup script for Row Highlighter extension

const MODE_NAMES = {
  'off': 'Off',
  'fullYellow': 'Yellow Fill',
  'fullPurple': 'Purple Fill',
  'borderBlack': 'Black Border',
  'borderYellow': 'Yellow Border',
  'borderPurple': 'Purple Border'
};

function updateStatus(mode) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Mode: ' + (MODE_NAMES[mode] || 'Off');

  // Update active button state
  document.querySelectorAll('button').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.mode === mode) {
      btn.classList.add('active');
    }
  });
}

// Load current mode
chrome.storage.sync.get(['highlightMode'], function(result) {
  const mode = result.highlightMode || 'off';
  updateStatus(mode);
});

// Handle button clicks
document.querySelectorAll('button').forEach(button => {
  button.addEventListener('click', function() {
    const mode = this.dataset.mode;
    chrome.storage.sync.set({ highlightMode: mode }, function() {
      updateStatus(mode);
    });
  });
});
