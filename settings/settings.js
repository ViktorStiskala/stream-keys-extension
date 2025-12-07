// Settings page JavaScript - manages subtitle language preferences

const STORAGE_KEY = 'subtitleLanguages';
const DEFAULT_LANGUAGES = ['English', 'English [CC]', 'English CC'];

let languages = [];

// DOM elements
const languageInput = document.getElementById('language-input');
const addButton = document.getElementById('add-button');
const languageList = document.getElementById('language-list');
const restoreDefaultsButton = document.getElementById('restore-defaults-button');

// Load preferences from storage
async function loadPreferences() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  languages = result[STORAGE_KEY] || [...DEFAULT_LANGUAGES];
  renderList();
}

// Save preferences to storage
async function savePreferences() {
  await chrome.storage.sync.set({ [STORAGE_KEY]: languages });
}

// Render the language list
function renderList() {
  languageList.innerHTML = '';
  
  languages.forEach((language, index) => {
    const li = document.createElement('li');
    li.className = 'language-item';
    li.draggable = true;
    li.dataset.index = index;
    
    // Drag handle
    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.innerHTML = '⋮⋮';
    handle.title = 'Drag to reorder';
    
    // Language text
    const text = document.createElement('span');
    text.className = 'language-text';
    text.textContent = language;
    
    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-button';
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', () => removeLanguage(index));
    
    li.appendChild(handle);
    li.appendChild(text);
    li.appendChild(removeBtn);
    
    // Drag events
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragend', handleDragEnd);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('drop', handleDrop);
    li.addEventListener('dragenter', handleDragEnter);
    li.addEventListener('dragleave', handleDragLeave);
    
    languageList.appendChild(li);
  });
}

// Add a new language
function addLanguage() {
  const value = languageInput.value.trim();
  if (!value) return;
  
  // Check for duplicates (case insensitive)
  const exists = languages.some(lang => lang.toLowerCase() === value.toLowerCase());
  if (exists) {
    languageInput.select();
    return;
  }
  
  languages.push(value);
  languageInput.value = '';
  savePreferences();
  renderList();
  languageInput.focus();
}

// Remove a language
function removeLanguage(index) {
  languages.splice(index, 1);
  savePreferences();
  renderList();
}

// Drag and drop handlers
let draggedIndex = null;

function handleDragStart(e) {
  draggedIndex = parseInt(e.target.dataset.index);
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.language-item').forEach(item => {
    item.classList.remove('drag-over');
  });
  draggedIndex = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  const item = e.target.closest('.language-item');
  if (item && parseInt(item.dataset.index) !== draggedIndex) {
    item.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  const item = e.target.closest('.language-item');
  if (item) {
    item.classList.remove('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  const item = e.target.closest('.language-item');
  if (!item) return;
  
  const dropIndex = parseInt(item.dataset.index);
  if (draggedIndex === null || draggedIndex === dropIndex) return;
  
  // Reorder the array
  const [removed] = languages.splice(draggedIndex, 1);
  languages.splice(dropIndex, 0, removed);
  
  savePreferences();
  renderList();
}

// Restore defaults
function restoreDefaults() {
  languages = [...DEFAULT_LANGUAGES];
  savePreferences();
  renderList();
}

// Event listeners
addButton.addEventListener('click', addLanguage);
restoreDefaultsButton.addEventListener('click', restoreDefaults);
languageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addLanguage();
  }
});

// Initialize
loadPreferences();

