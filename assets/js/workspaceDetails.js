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

document.addEventListener('DOMContentLoaded', async () => {
    // Get workspace ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const workspaceId = urlParams.get('id');

    if (!workspaceId) {
        showError('No workspace specified', 'locationSearch.html');
        return;
    }

    try {
        const docRef = doc(db, "workspaces", workspaceId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const workspace = docSnap.data();
            populateWorkspaceData(workspace);
            setupBookingForm();
            setupMenuToggle();
        } else {
            showError('Workspace not found', 'locationSearch.html');
        }
    } catch (error) {
        console.error("Error fetching workspace:", error);
        showError('Error loading workspace details');
    }
});

function populateWorkspaceData(workspace) {
    // Basic info
    document.getElementById('workspace-name').textContent = workspace.workspaceLocation || 'Workspace';
    document.getElementById('workspace-address').textContent = workspace.fullAddress || 'Address not available';
    document.getElementById('workspace-description-text').textContent = workspace.workspaceDescription || 'No description available';
    document.getElementById('host-name').textContent = workspace.ownerName || 'Host';
    document.getElementById('host-phone').textContent = workspace.ownerPhone || 'Phone not available';
    document.getElementById('workspace-price').textContent = workspace.price ? `₦${workspace.price}` : 'Price not available';

    // Image handling
    const mainImage = document.getElementById('workspace-main-image');
    if (workspace.imageUrl) {
        mainImage.src = workspace.imageUrl;
        mainImage.onerror = () => {
            mainImage.src = './assets/images/default-workspace.jpg';
        };
    } else {
        mainImage.src = './assets/images/default-workspace.jpg';
    }

    // Amenities - dynamically display all resources
    const amenitiesContainer = document.getElementById('amenities-container');
    amenitiesContainer.innerHTML = '';

    if (workspace.resourcesAvailable?.length) {
        workspace.resourcesAvailable.forEach(resource => {
            const amenityElement = createAmenityElement(resource);
            amenitiesContainer.appendChild(amenityElement);
        });
    } else {
        amenitiesContainer.innerHTML = '<p class="no-amenities">No amenities listed</p>';
    }
}

function createAmenityElement(resourceName) {
    const amenityElement = document.createElement('div');
    amenityElement.className = 'amenity';
    
    // Smart icon selection
    const icon = getIconForResource(resourceName);
    
    amenityElement.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${resourceName}</span>
    `;
    
    return amenityElement;
}

function getIconForResource(resourceName) {
    const lowerName = resourceName.toLowerCase();
    
    if (lowerName.includes('wifi') || lowerName.includes('internet')) return 'fa-wifi';
    if (lowerName.includes('power') || lowerName.includes('outlet')) return 'fa-plug';
    if (lowerName.includes('print')) return 'fa-print';
    if (lowerName.includes('coffee')) return 'fa-coffee';
    if (lowerName.includes('park')) return 'fa-parking';
    if (lowerName.includes('computer')) return 'fa-desktop';
    if (lowerName.includes('air') || lowerName.includes('ac')) return 'fa-snowflake';
    if (lowerName.includes('desk')) return 'fa-table';
    if (lowerName.includes('chair')) return 'fa-chair';
    
    return 'fa-check-circle'; // default icon
}

function setupBookingForm() {
    document.querySelector('.book-button').addEventListener('click', (e) => {
        e.preventDefault();
        
        const date = document.getElementById('check-in').value;
        const hours = document.getElementById('hours').value;
        
        if (!date) {
            alert('Please select a date');
            return;
        }

        // Here you would typically send the booking to your backend
        alert(`Booking requested for ${date} for ${hours} hours`);
        
        // Reset form
        document.getElementById('check-in').value = '';
        document.getElementById('hours').selectedIndex = 0;
    });
}

function setupMenuToggle() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });
}

function showError(message, redirectUrl = null) {
    console.error(message);
    alert(message);
    if (redirectUrl) {
        window.location.href = redirectUrl;
    }
}