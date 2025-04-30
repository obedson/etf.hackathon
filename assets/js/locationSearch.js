import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js";

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

// DOM Elements
const elements = {
    locationInput: document.getElementById('location-input'),
    locationSuggestions: document.getElementById('location-suggestions'),
    courseSelect: document.getElementById('course-select'),
    searchButton: document.getElementById('search-button'),
    map: document.getElementById('map'),
    useLocationBtn: document.getElementById('use-location-btn'),
    resetMapBtn: document.getElementById('reset-map-btn'),
    workspaceResults: document.getElementById('workspace-results'),
    sponsoredResults: document.getElementById('sponsored-results'),
    loadingSpinner: document.getElementById('loading-spinner'),
    noResults: document.getElementById('no-results'),
    sortBy: document.getElementById('sort-by')
};

// Global variables
let map;
let userLocation = null;
let markers = [];
let currentLocationMarker = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initMap();
        await loadAvailableCourses();
        setupEventListeners();
    } catch (error) {
        console.error("Initialization error:", error);
        showMessage('Error initializing page', 'error');
    }
});

async function initMap() {
    // Initialize Leaflet map centered on Nigeria
    map = L.map('map').setView([9.0820, 8.6753], 6);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Add zoom controls
    map.zoomControl.setPosition('topright');
}

async function loadAvailableCourses() {
    try {
        if (!elements.courseSelect) {
            console.error("Course select element not found");
            return;
        }

        const q = query(collection(db, "courses"));
        const querySnapshot = await getDocs(q);
        
        // Clear existing options except the first one
        while (elements.courseSelect.options.length > 1) {
            elements.courseSelect.remove(1);
        }
        
        querySnapshot.forEach((doc) => {
            const option = document.createElement('option');
            option.value = doc.data().name;
            option.textContent = doc.data().name;
            elements.courseSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading courses:", error);
        showMessage('Error loading course options', 'error');
    }
}

function setupEventListeners() {
    // Location input suggestions
    elements.locationInput.addEventListener('input', debounce(handleLocationInput, 300));
    
    // Search button
    elements.searchButton.addEventListener('click', handleSearch);
    
    // Use location button
    elements.useLocationBtn.addEventListener('click', getUserLocation);
    
    // Reset map button
    elements.resetMapBtn.addEventListener('click', resetMap);
    
    // Sort options
    elements.sortBy.addEventListener('change', handleSortChange);
    
    // Close suggestions when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (e.target !== elements.locationInput) {
            elements.locationSuggestions.style.display = 'none';
        }
    });
}

async function handleLocationInput() {
    const query = elements.locationInput.value.trim();
    
    if (query.length < 3) {
        elements.locationSuggestions.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
        const data = await response.json();
        
        elements.locationSuggestions.innerHTML = '';
        
        if (data.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No results found';
            elements.locationSuggestions.appendChild(li);
        } else {
            data.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item.display_name;
                li.addEventListener('click', () => {
                    elements.locationInput.value = item.display_name;
                    elements.locationSuggestions.style.display = 'none';
                    map.setView([item.lat, item.lon], 13);
                });
                elements.locationSuggestions.appendChild(li);
            });
        }
        
        elements.locationSuggestions.style.display = 'block';
    } catch (error) {
        console.error("Location search error:", error);
        elements.locationSuggestions.style.display = 'none';
    }
}

// ... (keep previous imports and config)

// Enhanced getUserLocation function
async function getUserLocation() {
    if (!navigator.geolocation) {
        showMessage('Geolocation is not supported by your browser', 'error');
        return;
    }

    // UI feedback
    elements.useLocationBtn.disabled = true;
    const originalText = elements.useLocationBtn.innerHTML;
    elements.useLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';

    try {
        // Get high accuracy position with timeout
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: true,  // Request best possible accuracy
                    timeout: 10000,           // 10 second timeout
                    maximumAge: 0             // Don't use cached position
                }
            );
        });

        userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy // Store accuracy in meters
        };

        // Update UI with accuracy information
        updateMapWithLocation(position);
        await updateAddressFromCoordinates();

        showMessage(`Location found (accuracy: ${Math.round(userLocation.accuracy)} meters)`, 'success');

        // Start watching position for updates
        startWatchingPosition();

    } catch (error) {
        console.error("Geolocation error:", error);
        handleGeolocationError(error);
    } finally {
        elements.useLocationBtn.disabled = false;
        elements.useLocationBtn.innerHTML = originalText;
    }
}

// New function to continuously watch position
function startWatchingPosition() {
    if (this.positionWatcher) {
        navigator.geolocation.clearWatch(this.positionWatcher);
    }

    this.positionWatcher = navigator.geolocation.watchPosition(
        (position) => {
            const newLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
            };

            // Only update if significant movement detected (10m threshold)
            if (calculateDistance(userLocation.lat, userLocation.lng, newLocation.lat, newLocation.lng) > 0.01) {
                userLocation = newLocation;
                updateMapWithLocation(position);
                console.log('Position updated:', newLocation);
            }
        },
        (error) => {
            console.error('Position watch error:', error);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 30000,
            timeout: 5000
        }
    );
}

// Improved map update function
function updateMapWithLocation(position) {
    const { latitude, longitude, accuracy } = position.coords;
    
    // Update map view
    map.setView([latitude, longitude], 16); // Zoom closer for better accuracy
    
    // Add accuracy circle
    if (this.accuracyCircle) {
        map.removeLayer(this.accuracyCircle);
    }
    this.accuracyCircle = L.circle([latitude, longitude], {
        radius: accuracy,
        color: '#3498db',
        fillColor: '#3498db',
        fillOpacity: 0.2
    }).addTo(map);

    // Update marker
    if (!currentLocationMarker) {
        currentLocationMarker = L.marker([latitude, longitude], {
            icon: L.divIcon({
                className: 'current-location-marker',
                html: '<i class="fas fa-circle" style="color: #3498db"></i>',
                iconSize: [20, 20]
            }),
            zIndexOffset: 1000
        }).addTo(map);
        currentLocationMarker.bindPopup('Your current location').openPopup();
    } else {
        currentLocationMarker.setLatLng([latitude, longitude]);
    }
}

// Enhanced reverse geocoding
async function updateAddressFromCoordinates() {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLocation.lat}&lon=${userLocation.lng}`);
        const data = await response.json();
        
        if (data.display_name) {
            elements.locationInput.value = data.display_name;
            
            // Add more specific address components if available
            const addressParts = [];
            if (data.address?.road) addressParts.push(data.address.road);
            if (data.address?.suburb) addressParts.push(data.address.suburb);
            if (data.address?.city) addressParts.push(data.address.city);
            
            if (addressParts.length > 0) {
                currentLocationMarker.setPopupContent(`Your location: ${addressParts.join(', ')}`);
            }
        }
    } catch (error) {
        console.error("Reverse geocoding error:", error);
        elements.locationInput.value = `Lat: ${userLocation.lat.toFixed(6)}, Lng: ${userLocation.lng.toFixed(6)}`;
    }
}

// Better error handling
function handleGeolocationError(error) {
    let message = 'Error getting your location';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location access was denied. Please enable permissions in your browser settings.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable.';
            break;
        case error.TIMEOUT:
            message = 'The request to get your location timed out. Please try again.';
            break;
    }
    
    showMessage(message, 'error');
    
    // Fallback to IP-based location if high accuracy fails
    if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
        getApproximateLocation();
    }
}

// Fallback IP-based location
async function getApproximateLocation() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        if (data.latitude && data.longitude) {
            userLocation = {
                lat: parseFloat(data.latitude),
                lng: parseFloat(data.longitude),
                accuracy: 5000 // Approximate accuracy for IP-based location
            };
            
            map.setView([userLocation.lat, userLocation.lng], 12);
            showMessage('Using approximate location based on your IP', 'warning');
        }
    } catch (error) {
        console.error("IP-based location error:", error);
    }
}

// ... (keep the rest of your existing code)

function resetMap() {
    map.setView([9.0820, 8.6753], 6);
    elements.locationInput.value = '';
    userLocation = null;
    
    if (currentLocationMarker) {
        map.removeLayer(currentLocationMarker);
        currentLocationMarker = null;
    }
}

async function handleSearch() {
    const location = elements.locationInput.value.trim();
    const course = elements.courseSelect.value;
    
    if (!location && !userLocation) {
        showMessage('Please enter a location or use your current location', 'warning');
        return;
    }
    
    try {
        // Show loading state
        elements.loadingSpinner.classList.remove('hidden');
        elements.workspaceResults.innerHTML = '';
        elements.noResults.classList.add('hidden');
        
        // Clear existing markers
        clearMarkers();
        
        // Build Firestore query
        let q = query(collection(db, "workspaces"), where("status", "==", "approved"));
        
        if (course) {
            q = query(q, where("availableCourses", "array-contains", course));
        }
        
        const querySnapshot = await getDocs(q);
        
        // Process results
        const workspaces = [];
        querySnapshot.forEach((doc) => {
            workspaces.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort results
        sortWorkspaces(workspaces);
        
        // Display results
        displayResults(workspaces);
        
        // Show sponsored workspaces
        await loadSponsoredWorkspaces();
    } catch (error) {
        console.error("Search error:", error);
        showMessage('Error searching workspaces', 'error');
    } finally {
        elements.loadingSpinner.classList.add('hidden');
    }
}

function sortWorkspaces(workspaces) {
    const sortValue = elements.sortBy.value;
    
    switch (sortValue) {
        case 'distance':
            if (userLocation) {
                workspaces.sort((a, b) => {
                    const distA = calculateDistance(userLocation.lat, userLocation.lng, a.latitude, a.longitude);
                    const distB = calculateDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude);
                    return distA - distB;
                });
            }
            break;
        case 'price-low':
            workspaces.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            workspaces.sort((a, b) => b.price - a.price);
            break;
        case 'rating':
            // Assuming rating field exists
            workspaces.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            break;
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula to calculate distance between two coordinates
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function displayResults(workspaces) {
    elements.workspaceResults.innerHTML = '';
    
    if (workspaces.length === 0) {
        elements.noResults.classList.remove('hidden');
        return;
    }
    
    workspaces.forEach(workspace => {
        const card = createWorkspaceCard(workspace);
        elements.workspaceResults.appendChild(card);
        
        // Add marker to map
        if (workspace.latitude && workspace.longitude) {
            const marker = L.marker([workspace.latitude, workspace.longitude])
                .addTo(map)
                .bindPopup(workspace.workspaceLocation);
            markers.push(marker);
        }
    });
    
    // Adjust map view to show all markers if we have locations
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        if (userLocation && currentLocationMarker) {
            group.addLayer(currentLocationMarker);
        }
        map.fitBounds(group.getBounds().pad(0.2));
    }
}

async function loadSponsoredWorkspaces() {
    try {
        const q = query(collection(db, "workspaces"), 
                       where("status", "==", "approved"),
                       where("isSponsored", "==", true));
        const querySnapshot = await getDocs(q);
        
        elements.sponsoredResults.innerHTML = '';
        
        const sponsoredWorkspaces = [];
        querySnapshot.forEach((doc) => {
            sponsoredWorkspaces.push({ id: doc.id, ...doc.data() });
        });
        
        if (sponsoredWorkspaces.length === 0) {
            return;
        }
        
        sponsoredWorkspaces.forEach(workspace => {
            const card = createWorkspaceCard(workspace, true);
            elements.sponsoredResults.appendChild(card);
        });
    } catch (error) {
        console.error("Error loading sponsored workspaces:", error);
    }
}

// In the createWorkspaceCard function, update the template to properly show distance:
function createWorkspaceCard(workspace, isSponsored = false) {
    const card = document.createElement('div');
    card.className = `workspace-card ${isSponsored ? 'sponsored' : ''}`;
    card.addEventListener('click', () => {
        window.location.href = `workspaceDetails.html?id=${workspace.id}`;
    });

    // Calculate distance if we have user location
    let distanceInfo = '';
    if (userLocation && workspace.latitude && workspace.longitude) {
        const distance = calculateDistance(
            userLocation.lat, 
            userLocation.lng,
            workspace.latitude, 
            workspace.longitude
        );
        distanceInfo = `
            <div class="workspace-distance">
                <i class="fas fa-route"></i>
                ${distance.toFixed(1)} km away
            </div>
        `;
    }

    card.innerHTML = `
        <img src="${workspace.imageUrl || './assets/images/default-workspace.jpg'}" 
             alt="${workspace.workspaceLocation}" 
             class="workspace-card-image"
             onerror="this.src='./assets/images/default-workspace.jpg'">
        <div class="workspace-card-content">
            <h3 class="workspace-card-title">${workspace.workspaceLocation}</h3>
            <p class="workspace-card-location">
                <i class="fas fa-map-marker-alt"></i>
                ${workspace.fullAddress || 'Address not available'}
            </p>
            <div class="workspace-card-meta">
                <span class="workspace-card-price">₦${workspace.price?.toLocaleString() || 'N/A'}</span>
                ${distanceInfo}
            </div>
        </div>
    `;
    
    return card;
}


function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

function handleSortChange() {
    // Re-run search with new sort order
    if (elements.workspaceResults.children.length > 0) {
        handleSearch();
    }
}

function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
        <span>${message}</span>
        <button class="close-message"><i class="fas fa-times"></i></button>
    `;
    
    // Add to top of page
    document.body.prepend(messageDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageDiv.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => messageDiv.remove(), 300);
    }, 5000);
    
    // Manual close
    messageDiv.querySelector('.close-message').addEventListener('click', () => {
        messageDiv.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => messageDiv.remove(), 300);
    });
}

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// Add CSS animation for messages
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
    }
    .message {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 250px;
        max-width: 90%;
        z-index: 10000;
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
        animation: fadeIn 0.3s ease-out;
    }
    .message.success {
        background-color: #2ecc71;
    }
    .message.error {
        background-color: #e74c3c;
    }
    .message.warning {
        background-color: #f39c12;
    }
    .close-message {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        margin-left: 10px;
    }
    .current-location-marker {
        color: #3498db;
        font-size: 24px;
        text-align: center;
    }
`;
document.head.appendChild(style);