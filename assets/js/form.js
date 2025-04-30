// Firebase configuration and initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyC63fKcQygMGxuaekB3LUhLHBrtePlgorc",
    authDomain: "plasware-pr.firebaseapp.com",
    projectId: "plasware-pr",
    storageBucket: "plasware-pr.appspot.com",
    messagingSenderId: "754561855795",
    appId: "1:754561855795:web:53001379d46a303ba0ce46",
    measurementId: "G-T4YEG16RDC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Global variables
let selectedCourses = [];
let selectedResources = [];
let userLat, userLng;

// Main initialization
document.addEventListener("DOMContentLoaded", () => {
    initMobileMenu();
    initCurrentPageHighlight();
    initLocationSuggestions();
    initTagInputs();
    initFormSubmission();
    initFormUX();
    initImagePreview();
});

// Mobile Menu Functionality
function initMobileMenu() {
    const menuToggle = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.mobile');
    
    if (!menuToggle || !navLinks) return;

    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        navLinks.classList.toggle('active');
        menuToggle.innerHTML = navLinks.classList.contains('active') ? '✕' : '&#9776;';
    });

    // Close menu when clicking on links
    document.querySelectorAll('.mobile a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            menuToggle.innerHTML = '&#9776;';
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
            navLinks.classList.remove('active');
            menuToggle.innerHTML = '&#9776;';
        }
    });
}

// Highlight current page in navigation
function initCurrentPageHighlight() {
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.nav-links a, .mobile a').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

// Form UX Enhancements
function initFormUX() {
    // Clear error state when user starts typing
    document.querySelectorAll('input, textarea, select').forEach(input => {
        input.addEventListener('input', () => {
            const formGroup = input.closest('.form-group') || 
                            input.closest('.tag-input-container');
            if (formGroup) formGroup.classList.remove('error');
        });
    });
    
    // Prevent form resubmission
    if (window.history.replaceState) {
        window.history.replaceState(null, null, window.location.href);
    }
}

// Image Preview Functionality
function initImagePreview() {
    const imageUpload = document.getElementById('image-upload');
    const previewContainer = document.getElementById('image-preview');
    
    if (!imageUpload || !previewContainer) return;
    
    imageUpload.addEventListener('change', function() {
        previewContainer.innerHTML = '';
        const files = this.files;
        
        if (files.length > 3) {
            showMessage('Maximum 3 images allowed', 'warning');
            this.value = '';
            return;
        }
        
        for (let i = 0; i < Math.min(files.length, 3); i++) {
            const file = files[i];
            if (!file.type.match('image.*')) continue;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'image-preview';
                previewContainer.appendChild(img);
            }
            reader.readAsDataURL(file);
        }
    });
}

// Form Submission Handling
function initFormSubmission() {
    const form = document.getElementById('workspace-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmission);
    }
}

async function handleFormSubmission(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = document.getElementById("submit-button");
    const submitText = document.getElementById("submit-text");
    const submitSpinner = document.getElementById("submit-spinner");
    
    try {
        // Validate all fields first
        let isValid = true;
        form.querySelectorAll('[required]').forEach(field => {
            if (!validateField({ target: field })) {
                isValid = false;
            }
        });
        
        if (selectedCourses.length === 0) {
            document.querySelector('.tag-input-container #available-courses')
                .closest('.form-group').classList.add('error');
            showMessage('Please add at least one course', 'error');
            isValid = false;
        }
        
        if (!isValid) {
            showMessage('Please fix the errors in the form', 'error');
            return;
        }

        // Show loading state
        submitButton.classList.add('loading');
        submitText.textContent = "Submitting...";
        submitSpinner.classList.remove("hidden");
        
        const formData = await prepareFormData();
        await saveWorkspace(formData);

        showMessage('Workspace submitted successfully!', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        
    } catch (error) {
        console.error("Submission error:", error);
        showMessage(`Submission failed: ${error.message || "Please try again"}`, 'error');
    } finally {
        submitButton.classList.remove('loading');
        submitText.textContent = "Submit Listing";
        submitSpinner.classList.add("hidden");
    }
}

function validateField(e) {
    const field = e.target;
    const formGroup = field.closest('.form-group') || field.closest('.tag-input-container');
    
    if (!formGroup) return true;
    
    const errorMessage = formGroup.querySelector('.error-message');
    
    if (field.required && !field.value.trim()) {
        formGroup.classList.add('error');
        if (errorMessage) errorMessage.textContent = 'This field is required';
        return false;
    }
    
    // Special validation for specific fields
    if (field.id === 'owner-phone' && !/^[\d\s\-()+]{10,}$/.test(field.value)) {
        formGroup.classList.add('error');
        if (errorMessage) errorMessage.textContent = 'Please enter a valid phone number';
        return false;
    }
    
    if (field.id === 'price' && parseFloat(field.value) <= 0) {
        formGroup.classList.add('error');
        if (errorMessage) errorMessage.textContent = 'Please enter a valid price';
        return false;
    }
    
    if (field.id === 'image-upload' && field.files.length === 0) {
        formGroup.classList.add('error');
        if (errorMessage) errorMessage.textContent = 'Please upload at least one image';
        return false;
    }
    
    // Clear error state if valid
    formGroup.classList.remove('error');
    return true;
}

async function prepareFormData() {
    const imageFile = document.getElementById("image-upload").files[0];
    const storageRef = ref(storage, 'workspaces/' + Date.now() + '_' + imageFile.name.replace(/\s+/g, '_'));
    const snapshot = await uploadBytes(storageRef, imageFile);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
        workspaceLocation: document.getElementById("location-name").value,
        fullAddress: document.getElementById("full-address").value,
        ownerName: document.getElementById("owner-name").value,
        price: parseFloat(document.getElementById("price").value),
        ownerPhone: document.getElementById("owner-phone").value,
        availableCourses: selectedCourses,
        resourcesAvailable: selectedResources,
        workspaceDescription: document.getElementById("workspace-description").value,
        seatingCapacity: document.getElementById("seating-capacity").value,
        latitude: parseFloat(document.getElementById("latitude").value),
        longitude: parseFloat(document.getElementById("longitude").value),
        imageUrl: downloadURL,
        createdAt: new Date(),
        status: "pending"
    };
}

async function saveWorkspace(formData) {
    // Save courses first
    await Promise.all(selectedCourses.map(course => 
        addCourseToDatabaseIfNew(course)
    ));
    
    // Then save workspace
    await addDoc(collection(db, "workspaces"), formData);
}

// Tag Input Functionality
function initTagInputs() {
    initTagInput('available-courses', 'course-suggestions', 'course-tags', selectedCourses, 'courses');
    initTagInput('available-resources', 'resource-suggestions', 'resource-tags', selectedResources, 'resources');
}

function initTagInput(inputId, suggestionsId, tagsContainerId, selectedItems, collectionName) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);
    const tagsContainer = document.getElementById(tagsContainerId);

    if (!input || !suggestions || !tagsContainer) return;

    input.addEventListener('input', debounce(() => 
        handleInput(input, suggestions, selectedItems, collectionName), 300));

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = input.value.trim();
            if (value) addTag(value, input, suggestions, selectedItems, tagsContainer, collectionName);
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.style.display = 'none';
        }
    });
}

async function handleInput(input, suggestions, selectedItems, collectionName) {
    const searchTerm = input.value.trim();
    if (searchTerm.length < 1) {
        suggestions.style.display = 'none';
        return;
    }
    
    try {
        const items = await (collectionName === 'courses' ? 
            searchCollection('courses', searchTerm) : 
            searchCollection('resources', searchTerm));
        
        displaySuggestions(items, suggestions, selectedItems, input, searchTerm, collectionName);
    } catch (error) {
        console.error("Search error:", error);
        suggestions.style.display = 'none';
    }
}

async function searchCollection(collectionName, searchTerm) {
    const q = query(
        collection(db, collectionName),
        where("keywords", "array-contains", searchTerm.toLowerCase())
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
}

function displaySuggestions(items, suggestions, selectedItems, input, searchTerm, collectionName) {
    suggestions.innerHTML = '';
    
    // Filter out already selected items
    const filteredItems = items.filter(item => 
        !selectedItems.some(selected => 
            selected.toLowerCase() === item.name.toLowerCase()
        )
    );

    // Add existing matches
    if (filteredItems.length > 0) {
        filteredItems.forEach(item => {
            const li = createSuggestionItem(item.name, () => {
                addTag(item.name, input, suggestions, selectedItems, suggestions.parentElement.querySelector('.tags-container'), collectionName);
            });
            suggestions.appendChild(li);
        });
    }

    // Add "create new" option if needed
    if (searchTerm && !items.some(item => item.name.toLowerCase() === searchTerm.toLowerCase())) {
        const li = createSuggestionItem(
            `Add "${searchTerm}" as new ${collectionName.slice(0, -1)}`,
            () => addTag(searchTerm, input, suggestions, selectedItems, suggestions.parentElement.querySelector('.tags-container'), collectionName),
            'add-new'
        );
        suggestions.appendChild(li);
    }

    suggestions.style.display = suggestions.children.length > 0 ? 'block' : 'none';
}

function createSuggestionItem(text, onClick, className = '') {
    const li = document.createElement('li');
    li.textContent = text;
    li.className = className;
    li.style.cssText = 'padding: 8px; cursor: pointer; font-weight: 600; color: #166088;';
    li.addEventListener('click', onClick);
    return li;
}

async function addTag(value, input, suggestions, selectedItems, tagsContainer, collectionName) {
    if (!value || selectedItems.some(item => item.toLowerCase() === value.toLowerCase())) return;
    
    selectedItems.push(value);
    renderTags(selectedItems, tagsContainer);
    input.value = '';
    suggestions.style.display = 'none';

    if (collectionName === 'courses') {
        await addCourseToDatabaseIfNew(value);
    } else {
        await addResourceToDatabaseIfNew(value);
    }
}

async function addCourseToDatabaseIfNew(courseName) {
    await addItemToDatabaseIfNew('courses', courseName);
}

async function addResourceToDatabaseIfNew(resourceName) {
    await addItemToDatabaseIfNew('resources', resourceName);
}

async function addItemToDatabaseIfNew(collectionName, itemName) {
    const q = query(
        collection(db, collectionName),
        where("name_lower", "==", itemName.toLowerCase())
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
        await addDoc(collection(db, collectionName), {
            name: itemName,
            name_lower: itemName.toLowerCase(),
            keywords: generateKeywords(itemName),
            createdAt: new Date()
        });
    }
}

function renderTags(items, container) {
    container.innerHTML = items.map((item, index) => `
        <span class="tag">
            ${item}
            <span class="remove-tag" data-index="${index}">×</span>
        </span>
    `).join('');

    container.querySelectorAll('.remove-tag').forEach(btn => {
        btn.addEventListener('click', (e) => {
            items.splice(parseInt(e.target.dataset.index), 1);
            renderTags(items, container);
        });
    });
}

// Location Suggestions
function initLocationSuggestions() {
    const locationInput = document.getElementById('location-name');
    const suggestionsList = document.getElementById('location-suggestions');

    if (!locationInput || !suggestionsList) return;

    locationInput.addEventListener('input', debounce(() => {
        const query = locationInput.value.trim();
        if (query.length > 2) fetchLocationSuggestions(query);
        else suggestionsList.style.display = 'none';
    }, 300));

    document.addEventListener('click', (e) => {
        if (e.target !== locationInput && !suggestionsList.contains(e.target)) {
            suggestionsList.style.display = 'none';
        }
    });
}

async function fetchLocationSuggestions(query) {
    const nominatimURL = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
    const suggestionsList = document.getElementById('location-suggestions');

    try {
        const response = await fetch(nominatimURL);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        
        const data = await response.json();
        displayLocationSuggestions(Array.isArray(data) ? data : []);
    } catch (error) {
        console.error("Location fetch error:", error);
        suggestionsList.style.display = 'none';
    }
}

function displayLocationSuggestions(results) {
    const suggestionsList = document.getElementById('location-suggestions');
    suggestionsList.innerHTML = '';

    if (results.length === 0) {
        suggestionsList.innerHTML = '<li>No results found</li>';
    } else {
        results.forEach(result => {
            const li = document.createElement('li');
            li.textContent = result.display_name;
            li.dataset.lat = result.lat;
            li.dataset.lng = result.lon;
            li.addEventListener('click', () => selectLocation(result));
            suggestionsList.appendChild(li);
        });
    }
    suggestionsList.style.display = 'block';
}

function selectLocation(result) {
    document.getElementById('location-name').value = result.display_name;
    document.getElementById('full-address').value = result.display_name;
    document.getElementById('latitude').value = result.lat;
    document.getElementById('longitude').value = result.lon;
    document.getElementById('location-suggestions').style.display = 'none';
}

// Utility Functions
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function generateKeywords(name) {
    const keywords = new Set();
    const normalized = name.toLowerCase().trim();
    
    keywords.add(normalized);
    normalized.split(/[\s\/\-_]+/).forEach(part => {
        if (part.length > 2) keywords.add(part);
    });
    
    if (normalized.includes('/')) keywords.add(normalized.replace(/\//g, ' '));
    if (normalized.includes(' ')) keywords.add(normalized.replace(/\s+/g, '-'));
    
    return Array.from(keywords);
}

function showMessage(text, type = 'success') {
    const messagesContainer = document.getElementById('form-messages');
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.innerHTML = `
        <span>${text}</span>
        <button class="close-message" aria-label="Close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    messagesContainer.appendChild(message);
    
    // Auto-remove after 5 seconds
    const autoRemove = setTimeout(() => {
        message.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => message.remove(), 300);
    }, 5000);
    
    // Manual close
    message.querySelector('.close-message').addEventListener('click', () => {
        clearTimeout(autoRemove);
        message.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => message.remove(), 300);
    });
}