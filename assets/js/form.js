// Import necessary Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-storage.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC63fKcQygMGxuaekB3LUhLHBrtePlgorc",
    authDomain: "plasware-pr.firebaseapp.com",
    projectId: "plasware-pr",
    storageBucket: "plasware-pr.appspot.com",
    messagingSenderId: "754561855795",
    appId: "1:754561855795:web:53001379d46a303ba0ce46",
    measurementId: "G-T4YEG16RDC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Global variables
let selectedCourses = [];
let selectedResources = [];
let userLat, userLng;

document.addEventListener("DOMContentLoaded", () => {
    initLocationSuggestions();
    initTagInput('available-courses', 'course-suggestions', 'course-tags', selectedCourses, 'courses');
    initTagInput('available-resources', 'resource-suggestions', 'resource-tags', selectedResources, 'resources');
});

// Initialize tag input with type-ahead
function initTagInput(inputId, suggestionsId, tagsContainerId, selectedItems, collectionName) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);
    const tagsContainer = document.getElementById(tagsContainerId);

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
        if (!input.contains(e.target)) {
            suggestions.style.display = 'none';
        }
    });
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

// Search courses in Firestore
async function searchCourses(searchTerm) {
    const q = query(
        collection(db, "courses"),
        where("keywords", "array-contains", searchTerm.toLowerCase())
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
    }));
}

// Search resources in Firestore
async function searchResources(searchTerm) {
    const q = query(
        collection(db, "resources"),
        where("keywords", "array-contains", searchTerm.toLowerCase())
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
    
    if (items.length > 0) {
        items.forEach(item => {
            if (!selectedItems.includes(item.name)) {
                const li = document.createElement('li');
                li.textContent = item.name;
                li.style.padding = '8px';
                li.style.cursor = 'pointer';
                
                li.addEventListener('click', () => {
                    addItem(item.name, selectedItems, input.parentNode.querySelector('.tags-container'));
                    input.value = '';
                    suggestions.style.display = 'none';
                });
                
                suggestions.appendChild(li);
            }
        });
    }
    
    // Add option to create new item if not found
    if (searchTerm && !items.some(item => item.name.toLowerCase() === searchTerm.toLowerCase())) {
        const li = document.createElement('li');
        li.className = 'add-new';
        li.innerHTML = `Add "${searchTerm}" as new ${collectionName === 'courses' ? 'course' : 'resource'}`;
        li.style.padding = '8px';
        li.style.cursor = 'pointer';
        
        li.addEventListener('click', () => {
            addItem(searchTerm, selectedItems, input.parentNode.querySelector('.tags-container'));
            if (collectionName === 'courses') {
                addCourseToDatabaseIfNew(searchTerm);
            } else {
                addResourceToDatabaseIfNew(searchTerm);
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
    if (!itemName || selectedItems.includes(itemName)) return;
    
    selectedItems.push(itemName);
    renderTags(selectedItems, tagsContainer);
}

// Add new course to database if it doesn't exist
async function addCourseToDatabaseIfNew(courseName) {
    try {
        const q = query(
            collection(db, "courses"),
            where("name", "==", courseName)
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            await addDoc(collection(db, "courses"), {
                name: courseName,
                keywords: generateKeywords(courseName),
                createdAt: new Date()
            });
        }
    } catch (error) {
        console.error("Error adding course to database:", error);
    }
}

// Add new resource to database if it doesn't exist
async function addResourceToDatabaseIfNew(resourceName) {
    try {
        const q = query(
            collection(db, "resources"),
            where("name", "==", resourceName)
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            await addDoc(collection(db, "resources"), {
                name: resourceName,
                keywords: generateKeywords(resourceName),
                createdAt: new Date()
            });
        }
    } catch (error) {
        console.error("Error adding resource to database:", error);
    }
}

// Generate search keywords
function generateKeywords(name) {
    const keywords = [name.toLowerCase()];
    // Add variations for better searching
    if (name.includes('/')) {
        keywords.push(name.replace('/', ' ').toLowerCase());
    }
    if (name.includes(' ')) {
        keywords.push(name.replace(' ', '-').toLowerCase());
    }
    return [...new Set(keywords)]; // Remove duplicates
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
    
    // Add event listeners to remove buttons
    container.querySelectorAll('.remove-tag').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            items.splice(index, 1);
            renderTags(items, container);
        });
    });
}

// Location suggestions functionality
function initLocationSuggestions() {
    const locationInput = document.getElementById('location-name');
    const suggestionsList = document.getElementById('location-suggestions');

    locationInput.addEventListener('input', function() {
        const query = this.value;
        if (query.length > 2) {
            getLocationSuggestions(query);
        } else {
            suggestionsList.style.display = 'none';
        }
    });

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

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
                    userLat = suggestion.lat;
                    userLng = suggestion.lng;
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

// Form submission handler
document.getElementById("submit-button").addEventListener("click", async function() {
    const submitButton = document.getElementById("submit-button");
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
    
    try {
        // Get form values
        const workspaceLocation = document.getElementById("location-name").value;
        const fullAddress = document.getElementById("full-address").value;
        const ownerName = document.getElementById("owner-name").value;
        const price = document.getElementById("price").value;
        const ownerPhone = document.getElementById("owner-phone").value;
        const workspaceDescription = document.getElementById("workspace-description").value;
        const seatingCapacity = document.getElementById("seating-capacity").value;
        const imageFile = document.getElementById("image-upload").files[0];
        const latitude = document.getElementById("latitude").value;
        const longitude = document.getElementById("longitude").value;
        
        // Check if user has typed but not added courses/resources
        const typedCourse = document.getElementById("available-courses").value.trim();
        const typedResource = document.getElementById("available-resources").value.trim();
        
        // Validate all required fields
        const missingFields = [];
        if (!workspaceLocation) missingFields.push("Workspace Location");
        if (!fullAddress) missingFields.push("Full Address");
        if (!ownerName) missingFields.push("Owner Name");
        if (!price) missingFields.push("Price");
        if (!ownerPhone) missingFields.push("Phone Number");
        if (!workspaceDescription) missingFields.push("Description");
        if (selectedCourses.length === 0 && !typedCourse) missingFields.push("At least one course");
        if (selectedResources.length === 0 && !typedResource) missingFields.push("At least one resource");
        if (!seatingCapacity) missingFields.push("Seating Capacity");
        if (!imageFile) missingFields.push("Workspace Image");
        if (!latitude || !longitude) missingFields.push("Location Coordinates");

        if (missingFields.length > 0) {
            // Offer to add typed but not submitted courses/resources
            if (typedCourse && selectedCourses.length === 0) {
                if (confirm(`Add "${typedCourse}" as a course offering?`)) {
                    addCourseToDatabaseIfNew(typedCourse);
                    addItem(typedCourse, selectedCourses, document.getElementById("course-tags"));
                    document.getElementById("available-courses").value = '';
                    return; // Let the form submit on next click
                }
            }
            if (typedResource && selectedResources.length === 0) {
                if (confirm(`Add "${typedResource}" as an available resource?`)) {
                    addResourceToDatabaseIfNew(typedResource);
                    addItem(typedResource, selectedResources, document.getElementById("resource-tags"));
                    document.getElementById("available-resources").value = '';
                    return; // Let the form submit on next click
                }
            }
            
            alert(`Please fill in the following fields:\n${missingFields.join('\n')}`);
            return;
        }

        // Validate image file
        if (!imageFile.type.match('image.*')) {
            throw new Error('Please upload an image file (JPEG, PNG, etc.)');
        }
        if (imageFile.size > 5 * 1024 * 1024) {
            throw new Error('Image file is too large (max 5MB)');
        }

        // Upload image to Firebase Storage
        const storageRef = ref(storage, 'workspaces/' + Date.now() + '_' + imageFile.name.replace(/\s+/g, '_'));
        const snapshot = await uploadBytes(storageRef, imageFile);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Save workspace data to Firestore
        await addDoc(collection(db, "workspaces"), {
            workspaceLocation,
            fullAddress,
            ownerName,
            price,
            ownerPhone,
            availableCourses: selectedCourses,
            resourcesAvailable: selectedResources,
            workspaceDescription,
            seatingCapacity,
            imageUrl: downloadURL,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            createdAt: new Date(),
            status: "pending"
        });

        alert("Workspace submitted successfully! It will be reviewed before going live.");
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error("Error submitting form:", error);
        
        if (error.code === 'storage/unauthorized') {
            alert("Upload failed: You don't have permission to upload files.");
        } else if (error.message.includes('image file')) {
            alert(error.message);
        } else {
            alert("An error occurred: " + (error.message || "Please try again later."));
        }
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit";
    }
});

