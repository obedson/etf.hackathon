import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js";

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

// Global variables
let userLat, userLng;
let map;
let markers = [];

document.addEventListener("DOMContentLoaded", () => {
    console.log("[INIT] App initialized");
    loadAvailableCourses();
    initLocationSearch();
    loadSponsoredWorkspaces();
    testFirebaseConnection(); // Test connection on load
});

// Test Firebase connection
async function testFirebaseConnection() {
    try {
        console.log("[DEBUG] Testing Firebase connection...");
        const testQuery = query(collection(db, "workspaces"), limit(1));
        const testSnapshot = await getDocs(testQuery);
        
        if (testSnapshot.empty) {
            console.warn("[DEBUG] No documents found in workspaces collection");
            alert("Warning: No workspaces found in database. Please check Firebase setup.");
        } else {
            testSnapshot.forEach(doc => {
                console.log("[DEBUG] Sample workspace document:", {
                    id: doc.id,
                    data: doc.data()
                });
            });
        }
    } catch (error) {
        console.error("[DEBUG] Firebase connection error:", error);
        alert("Error connecting to Firebase. Check console for details.");
    }
}

// Load available courses from Firestore
async function loadAvailableCourses() {
    const coursesSelect = document.getElementById('available-courses');
    console.log("[DEBUG] Loading available courses...");
    
    try {
        const querySnapshot = await getDocs(collection(db, "courses"));
        console.log(`[DEBUG] Found ${querySnapshot.size} courses`);
        
        // Clear existing options except the first one
        while (coursesSelect.options.length > 1) {
            coursesSelect.remove(1);
        }
        
        querySnapshot.forEach((doc) => {
            const courseData = doc.data();
            const option = document.createElement('option');
            option.value = courseData.name;
            option.textContent = courseData.name;
            coursesSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error("[DEBUG] Error loading courses:", error);
        alert("Error loading courses. Check console for details.");
    }
}


// Initialize location search functionality
function initLocationSearch() {
    console.log("[DEBUG] Initializing location search...");
    
    // Initialize map (hidden by default)
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // Location input event listener
    $('#location-input').on('input', function() {
        const query = $(this).val();
        if (query.length > 2) {
            getLocationSuggestions(query);
        } else {
            $('#location-suggestions').hide();
        }
    });

    // Search button click handler
    $('#search-button').click(async function() {
        const selectedCourse = $('#available-courses').val();
        console.log("[DEBUG] Search initiated. Course:", selectedCourse, "Location:", userLat, userLng);
        
        if (!userLat || !userLng) {
            alert('Please select a location from the suggestions.');
            return;
        }
        if (!selectedCourse) {
            alert('Please select a learning track.');
            return;
        }
        
        await searchWorkspaces(selectedCourse);
    });
}

// Get location suggestions from Nominatim
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
        }
    } catch (error) {
        console.error("Error fetching data from Nominatim:", error);
    }
}

// Display location suggestions
function displayLocationSuggestions(suggestions) {
    $('#location-suggestions').empty();
    
    if (suggestions.length === 0) {
        $('#location-suggestions').append('<li>No results found</li>');
    } else {
        suggestions.forEach((suggestion) => {
            const suggestionItem = $('<li>')
                .text(suggestion.name)
                .data('lat', suggestion.lat)
                .data('lng', suggestion.lng)
                .click(function() {
                    $('#location-input').val(suggestion.name);
                    userLat = parseFloat($(this).data('lat'));
                    userLng = parseFloat($(this).data('lng'));
                    $('#location-suggestions').hide();
                    
                    // Update map to show selected location
                    updateMap(userLat, userLng);
                });
            $('#location-suggestions').append(suggestionItem);
        });
    }
    $('#location-suggestions').show();
}

// Update map to show selected location
function updateMap(lat, lng) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Set new view
    map.setView([lat, lng], 13);
    map.style.display = 'block';
    
    // Add marker for user location
    const userMarker = L.marker([lat, lng])
        .addTo(map)
        .bindPopup("Your Location");
    markers.push(userMarker);
}

// Search workspaces by course and location
async function searchWorkspaces(courseName) {
    console.groupCollapsed("[DEBUG] Searching workspaces for:", courseName);
    try {
        console.log("[DEBUG] Creating Firebase query...");
        const workspacesQuery = query(
            collection(db, "workspaces"),
            where("availableCourses", "array-contains", courseName),
            where("status", "==", "approved")
        );
        
        console.log("[DEBUG] Executing query...");
        const querySnapshot = await getDocs(workspacesQuery);
        console.log(`[DEBUG] Found ${querySnapshot.size} matching workspaces`);
        
        const workspaceList = [];
        let validLocations = 0;

        querySnapshot.forEach((doc) => {
            const workspaceData = doc.data();
            console.log("[DEBUG] Processing workspace:", doc.id, workspaceData);
            
            if (workspaceData.latitude && workspaceData.longitude) {
                const distance = calculateDistance(
                    userLat, 
                    userLng, 
                    workspaceData.latitude, 
                    workspaceData.longitude
                );
                
                workspaceList.push({
                    ...workspaceData,
                    id: doc.id,
                    distance
                });
                validLocations++;
                console.log(`[DEBUG] Added workspace (${doc.id}) with distance: ${distance.toFixed(2)} km`);
            } else {
                console.warn("[DEBUG] Workspace missing location data:", doc.id);
            }
        });

        console.log(`[DEBUG] Found ${validLocations} workspaces with valid locations`);
        console.log("[DEBUG] Workspaces before sorting:", workspaceList);
        
        workspaceList.sort((a, b) => a.distance - b.distance);
        console.log("[DEBUG] Workspaces after sorting:", workspaceList);
        
        if (workspaceList.length === 0) {
            console.warn("[DEBUG] No valid workspaces found after filtering");
            alert("No workspaces found for this course with valid location data.");
        }
        
        displayWorkspaceResults(workspaceList);
        displayWorkspacesOnMap(workspaceList);
        
    } catch (error) {
        console.error("[DEBUG] Error searching workspaces:", error);
        alert("An error occurred while searching. Please try again.");
    }
    console.groupEnd();
}

// Display workspace results with debugging info
function displayWorkspaceResults(workspaces) {
    const resultsContainer = $('#product-results');
    resultsContainer.empty();
    console.log("[DEBUG] Displaying", workspaces.length, "workspaces");
    
    if (workspaces.length === 0) {
        resultsContainer.html(`
            <div class="no-results">
                <p>No workspaces found for this course in your area.</p>
                <p>Try expanding your search area or check back later.</p>
            </div>
        `);
        return;
    }
    
    workspaces.forEach((workspace, index) => {
        const distanceText = workspace.distance < 1 
            ? `${(workspace.distance * 1000).toFixed(0)} meters away` 
            : `${workspace.distance.toFixed(1)} km away`;
        
        const workspaceCard = $(`
            <div class="workspace-card" data-id="${workspace.id}">
                <div class="distance-badge">${index + 1}</div>
                <h3>${workspace.workspaceLocation || 'Unnamed Location'}</h3>
                <p>${workspace.fullAddress || 'Address not available'}</p>
                <p class="workspace-distance">${distanceText}</p>
                <p class="workspace-price">Price: ₦${workspace.price || 'N/A'}</p>
                <p>${workspace.workspaceDescription?.substring(0, 100) || 'No description available'}...</p>
                <div class="debug-info" style="display:none;">
                    <pre>${JSON.stringify(workspace, null, 2)}</pre>
                </div>
            </div>
        `).click(() => {
            window.location.href = `workspaceDetails.html?id=${workspace.id}`;
        });
        
        // Toggle debug info on double-click
        workspaceCard.on('dblclick', function() {
            $(this).find('.debug-info').toggle();
        });
        
        resultsContainer.append(workspaceCard);
    });
}


// Display workspaces on map
function displayWorkspacesOnMap(workspaces) {
    console.log("[DEBUG] Updating map with", workspaces.length, "workspaces");
    
    // Clear existing markers except user location
    if (markers.length > 1) {
        markers.slice(1).forEach(marker => map.removeLayer(marker));
        markers = markers.slice(0, 1);
    }
    
    // Add markers for each workspace
    workspaces.forEach((workspace, index) => {
        const workspaceMarker = L.marker([workspace.latitude, workspace.longitude])
            .addTo(map)
            .bindPopup(`
                <b>#${index + 1} - ${workspace.workspaceLocation}</b><br>
                ${workspace.distance.toFixed(1)} km away<br>
                ₦${workspace.price || 'N/A'}
            `);
        markers.push(workspaceMarker);
    });
    
    // Adjust map bounds to show all markers
    if (workspaces.length > 0) {
        const markerGroup = L.featureGroup(markers);
        map.fitBounds(markerGroup.getBounds().pad(0.2));
    }
    
    console.log("[DEBUG] Map updated with", markers.length, "markers");
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
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

// Load sponsored workspaces
async function loadSponsoredWorkspaces() {
    try {
        const sponsoredQuery = query(
            collection(db, "workspaces"),
            where("isSponsored", "==", true),
            where("status", "==", "approved"),
            limit(3)
        );
        
        const querySnapshot = await getDocs(sponsoredQuery);
        const sponsoredContainer = $('#sponsored-results');
        sponsoredContainer.empty();
        
        querySnapshot.forEach(doc => {
            const workspace = doc.data();
            const sponsoredCard = $(`
                <div class="workspace-card sponsored" data-id="${doc.id}">
                    <h3>${workspace.workspaceLocation}</h3>
                    <p>${workspace.fullAddress}</p>
                    <p class="workspace-price">Price: ₦${workspace.price}</p>
                    <p>${workspace.workspaceDescription.substring(0, 80)}...</p>
                </div>
            `).click(() => {
                window.location.href = `workspaceDetails.html?id=${doc.id}`;
            });
            
            sponsoredContainer.append(sponsoredCard);
        });
        
    } catch (error) {
        console.error("Error loading sponsored workspaces:", error);
    }
}

// Hide suggestions when clicking outside
$(document).click(function(e) {
    if (!$(e.target).closest('#location-input, #location-suggestions').length) {
        $('#location-suggestions').hide();
    }
});