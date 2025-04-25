import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js";

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

// Get workspace ID from URL
const urlParams = new URLSearchParams(window.location.search);
const workspaceId = urlParams.get('id');

// Amenities mapping
const amenitiesMap = {
    'internet-wifi': { icon: 'fa-wifi', name: 'High-speed WiFi' },
    'power-outlets': { icon: 'fa-plug', name: 'Power outlets' },
    'printing': { icon: 'fa-print', name: 'Printing services' },
    'coffee': { icon: 'fa-coffee', name: 'Free coffee' },
    'parking': { icon: 'fa-car', name: 'Free parking' },
    'air-conditioning': { icon: 'fa-snowflake', name: 'Air conditioning' }
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!workspaceId) {
        alert('No workspace specified');
        window.location.href = 'locationSearch.html';
        return;
    }

    try {
        const docRef = doc(db, "workspaces", workspaceId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const workspace = docSnap.data();
            populateWorkspaceData(workspace);
        } else {
            alert('Workspace not found');
            window.location.href = 'locationSearch.html';
        }
    } catch (error) {
        console.error("Error fetching workspace:", error);
        alert('Error loading workspace details');
    }
});

function populateWorkspaceData(workspace) {
    // Basic info
    document.getElementById('workspace-name').textContent = workspace.workspaceLocation || 'Workspace';
    document.getElementById('workspace-address').textContent = workspace.fullAddress || 'Address not available';
    document.getElementById('workspace-description-text').textContent = workspace.workspaceDescription || 'No description available';
    document.getElementById('host-name').textContent = workspace.ownerName || 'Host';
    document.getElementById('host-phone').textContent = workspace.ownerPhone || 'Phone not available';
    document.getElementById('workspace-price').textContent = workspace.price || 'N/A';

    // Main image
    if (workspace.imageUrl) {
        document.getElementById('workspace-main-image').src = workspace.imageUrl;
        // Set all gallery images to the same for now
        document.querySelectorAll('.gallery img').forEach(img => {
            img.src = workspace.imageUrl;
        });
    }

    // Amenities
    const amenitiesContainer = document.getElementById('amenities-container');
    amenitiesContainer.innerHTML = '';

    if (workspace.resourcesAvailable && Array.isArray(workspace.resourcesAvailable)) {
        workspace.resourcesAvailable.forEach(resource => {
            const amenity = amenitiesMap[resource];
            if (amenity) {
                const amenityElement = document.createElement('div');
                amenityElement.className = 'amenity';
                amenityElement.innerHTML = `
                    <i class="fas ${amenity.icon}"></i>
                    <span>${amenity.name}</span>
                `;
                amenitiesContainer.appendChild(amenityElement);
            }
        });
    }

    // Booking form submission
    document.querySelector('.book-button').addEventListener('click', () => {
        const date = document.getElementById('check-in').value;
        const hours = document.getElementById('hours').value;
        
        if (!date) {
            alert('Please select a date');
            return;
        }

        // Here you would typically send the booking to your backend
        alert(`Booking requested for ${date} for ${hours} hours`);
    });
}