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

// DOM Content Loaded
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded");
    
    // Initialize menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    // Initialize form functionality
    initLocationSuggestions();
    initTagInput('available-courses', 'course-suggestions', 'course-tags', selectedCourses, 'courses');
    initTagInput('available-resources', 'resource-suggestions', 'resource-tags', selectedResources, 'resources');
    
    // Form submission
    const form = document.getElementById('workspace-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmission);
    } else {
        console.error('Form not found!');
    }
});

// Form submission handler
async function handleFormSubmission(e) {
    e.preventDefault();
    console.log("Form submission initiated");

    const submitButton = document.getElementById("submit-button");
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        // Validate form
        if (!validateForm()) {
            return;
        }

        // Process form data
        const formData = {
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
            longitude: parseFloat(document.getElementById("longitude").value)
        };

        // Upload image
        const imageFile = document.getElementById("image-upload").files[0];
        const storageRef = ref(storage, 'workspaces/' + Date.now() + '_' + imageFile.name.replace(/\s+/g, '_'));
        const snapshot = await uploadBytes(storageRef, imageFile);
        const downloadURL = await getDownloadURL(snapshot.ref);
        formData.imageUrl = downloadURL;

        // Save courses to database
        for (const course of selectedCourses) {
            await addCourseToDatabaseIfNew(course);
        }

        // Save to Firestore
        await addDoc(collection(db, "workspaces"), {
            ...formData,
            createdAt: new Date(),
            status: "pending"
        });

        alert("Workspace submitted successfully! It will be reviewed before going live.");
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error("Form submission error:", error);
        alert(`Submission failed: ${error.message || "Please try again later."}`);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Submit";
        }
    }
}

// Form validation
function validateForm() {
    const requiredFields = [
        'location-name', 'full-address', 'owner-name',
        'price', 'owner-phone', 'workspace-description',
        'seating-capacity', 'latitude', 'longitude'
    ];

    const missingFields = [];
    
    requiredFields.forEach(id => {
        const element = document.getElementById(id);
        if (!element || !element.value.trim()) {
            missingFields.push(id.replace('-', ' '));
        }
    });

    if (missingFields.length > 0) {
        alert(`Please fill in the following fields:\n${missingFields.join('\n')}`);
        return false;
    }

    if (selectedCourses.length === 0) {
        alert("Please add at least one course");
        return false;
    }

    const imageFile = document.getElementById("image-upload").files[0];
    if (!imageFile) {
        alert("Please upload an image of your workspace");
        return false;
    }

    if (!imageFile.type.match('image.*')) {
        alert("Please upload a valid image file (JPEG, PNG, etc.)");
        return false;
    }

    return true;
}

// Tag input initialization
function initTagInput(inputId, suggestionsId, tagsContainerId, selectedItems, collectionName) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);
    const tagsContainer = document.getElementById(tagsContainerId);

    if (!input || !suggestions || !tagsContainer) {
        console.error("Tag input elements not found");
        return;
    }

    input.addEventListener('input', debounce(() => handleInput(input, suggestions, selectedItems, collectionName), 300));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = input.value.trim();
            if (value) {
                addItem(value, selectedItems, tagsContainer);
                if (collectionName === 'courses') {
                    addCourseToDatabaseIfNew(value);
                } else {
                    addResourceToDatabaseIfNew(value);
                }
                input.value = '';
                suggestions.style.display = 'none';
            }
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.style.display = 'none';
        }
    });
}

// Debounce function
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// Handle input with debounce
async function handleInput(input, suggestions, selectedItems, collectionName) {
    const searchTerm = input.value.trim();
    if (searchTerm.length < 1) {
        suggestions.style.display = 'none';
        return;
    }
    
    try {
        let items = [];
        if (collectionName === 'courses') {
            items = await searchCourses(searchTerm);
        } else {
            items = await searchResources(searchTerm);
        }
        
        displaySuggestions(items, suggestions, selectedItems, input, searchTerm, collectionName);
    } catch (error) {
        console.error("Error searching:", error);
        suggestions.style.display = 'none';
    }
}

// Search functions
async function searchCourses(searchTerm) {
    const searchTermLower = searchTerm.toLowerCase();
    const q = query(
        collection(db, "courses"),
        where("keywords", "array-contains", searchTermLower)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
    }));
}

async function searchResources(searchTerm) {
    const searchTermLower = searchTerm.toLowerCase();
    const q = query(
        collection(db, "resources"),
        where("keywords", "array-contains", searchTermLower)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
    }));
}

// Display suggestions
function displaySuggestions(items, suggestions, selectedItems, input, searchTerm, collectionName) {
    suggestions.innerHTML = '';
    
    const filteredItems = items.filter(item => 
        !selectedItems.some(selected => 
            selected.toLowerCase() === item.name.toLowerCase()
        )
    );
    
    if (filteredItems.length > 0) {
        filteredItems.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.name;
            li.style.padding = '8px';
            li.style.cursor = 'pointer';
            
            li.addEventListener('click', () => {
                addItem(item.name, selectedItems, input.parentNode.querySelector('.tags-container'));
                if (collectionName === 'courses') {
                    addCourseToDatabaseIfNew(item.name);
                }
                input.value = '';
                suggestions.style.display = 'none';
            });
            
            suggestions.appendChild(li);
        });
    }
    
    if (searchTerm && !items.some(item => 
        item.name.toLowerCase() === searchTerm.toLowerCase()
    )) {
        const li = document.createElement('li');
        li.className = 'add-new';
        li.innerHTML = `Add "${searchTerm}" as new ${collectionName === 'courses' ? 'course' : 'resource'}`;
        li.style.padding = '8px';
        li.style.cursor = 'pointer';
        li.style.fontWeight = '600';
        li.style.color = '#166088';
        
        li.addEventListener('click', () => {
            addItem(searchTerm, selectedItems, input.parentNode.querySelector('.tags-container'));
            if (collectionName === 'courses') {
                addCourseToDatabaseIfNew(searchTerm);
            }
            input.value = '';
            suggestions.style.display = 'none';
        });
        
        suggestions.appendChild(li);
    }
    
    suggestions.style.display = suggestions.children.length > 0 ? 'block' : 'none';
}

// Add item to selected list
function addItem(itemName, selectedItems, tagsContainer) {
    if (!itemName || selectedItems.some(item => item.toLowerCase() === itemName.toLowerCase())) return;
    
    selectedItems.push(itemName);
    renderTags(selectedItems, tagsContainer);
}

// Add new course to database
async function addCourseToDatabaseIfNew(courseName) {
    try {
        const q = query(
            collection(db, "courses"),
            where("name_lower", "==", courseName.toLowerCase())
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            await addDoc(collection(db, "courses"), {
                name: courseName,
                name_lower: courseName.toLowerCase(),
                keywords: generateKeywords(courseName),
                createdAt: new Date()
            });
        }
    } catch (error) {
        console.error("Error adding course to database:", error);
    }
}

// Add new resource to database
async function addResourceToDatabaseIfNew(resourceName) {
    try {
        const q = query(
            collection(db, "resources"),
            where("name_lower", "==", resourceName.toLowerCase())
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            await addDoc(collection(db, "resources"), {
                name: resourceName,
                name_lower: resourceName.toLowerCase(),
                keywords: generateKeywords(resourceName),
                createdAt: new Date()
            });
        }
    } catch (error) {
        console.error("Error adding resource to database:", error);
    }
}

// Generate keywords
function generateKeywords(name) {
    const keywords = new Set();
    const normalized = name.toLowerCase().trim();
    
    keywords.add(normalized);
    
    normalized.split(/[\s\/\-_]+/).forEach(part => {
        if (part.length > 2) {
            keywords.add(part);
        }
    });
    
    if (normalized.includes('/')) {
        keywords.add(normalized.replace(/\//g, ' '));
    }
    if (normalized.includes(' ')) {
        keywords.add(normalized.replace(/\s+/g, '-'));
    }
    
    return Array.from(keywords);
}

// Render tags
function renderTags(items, container) {
    container.innerHTML = '';
    
    items.forEach((item, index) => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.innerHTML = `
            ${item}
            <span class="remove-tag" data-index="${index}">×</span>
        `;
        container.appendChild(tag);
    });
    
    container.querySelectorAll('.remove-tag').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            items.splice(index, 1);
            renderTags(items, container);
        });
    });
}

// Location suggestions
function initLocationSuggestions() {
    const locationInput = document.getElementById('location-name');
    const suggestionsList = document.getElementById('location-suggestions');

    if (!locationInput || !suggestionsList) {
        console.error("Location suggestion elements not found");
        return;
    }

    locationInput.addEventListener('input', debounce(function() {
        const query = this.value;
        if (query.length > 2) {
            getLocationSuggestions(query);
        } else {
            suggestionsList.style.display = 'none';
        }
    }, 300));

    async function getLocationSuggestions(query) {
        const nominatimURL = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
    
        try {
            const response = await fetch(nominatimURL);
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            
            const data = await response.json();
            
            if (Array.isArray(data)) {
                const suggestions = data.map(result => ({
                    name: result.display_name,
                    lat: result.lat,
                    lng: result.lon
                }));
                displayLocationSuggestions(suggestions);
            } else {
                console.error("Unexpected response format from Nominatim:", data);
                suggestionsList.style.display = 'none';
            }
        } catch (error) {
            console.error("Error fetching data from Nominatim:", error);
            suggestionsList.style.display = 'none';
        }
    }

    function displayLocationSuggestions(suggestions) {
        suggestionsList.innerHTML = '';
        
        if (suggestions.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No results found';
            suggestionsList.appendChild(li);
        } else {
            suggestions.forEach((suggestion) => {
                const li = document.createElement('li');
                li.textContent = suggestion.name;
                li.dataset.lat = suggestion.lat;
                li.dataset.lng = suggestion.lng;
                
                li.addEventListener('click', function() {
                    document.getElementById('location-name').value = suggestion.name;
                    document.getElementById('full-address').value = suggestion.name;
                    document.getElementById('latitude').value = suggestion.lat;
                    document.getElementById('longitude').value = suggestion.lng;
                    suggestionsList.style.display = 'none';
                });
                
                suggestionsList.appendChild(li);
            });
        }
        suggestionsList.style.display = 'block';
    }

    document.addEventListener('click', function(e) {
        if (e.target !== locationInput && !suggestionsList.contains(e.target)) {
            suggestionsList.style.display = 'none';
        }
    });
}