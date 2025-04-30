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

// DOM Elements
const elements = {
    workspaceName: document.getElementById('workspace-name'),
    workspaceAddress: document.getElementById('workspace-address'),
    workspaceDescription: document.getElementById('workspace-description-text'),
    hostName: document.getElementById('host-name'),
    hostPhone: document.getElementById('host-phone'),
    workspacePrice: document.getElementById('workspace-price'),
    mainImage: document.getElementById('workspace-main-image'),
    amenitiesContainer: document.getElementById('amenities-container'),
    coursesContainer: document.getElementById('courses-container'),
    bookingForm: document.querySelector('.booking-form'),
    bookButton: document.getElementById('book-now-btn'),
    bookingDate: document.getElementById('booking-date'),
    bookingHours: document.getElementById('booking-hours'),
    thumbnailContainer: document.getElementById('thumbnail-container')
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const workspaceId = getWorkspaceIdFromURL();
        if (!workspaceId) return;

        const workspace = await fetchWorkspaceData(workspaceId);
        if (!workspace) return;

        populateWorkspaceData(workspace);
        setupImageGallery(workspace);
        setupEventListeners();
    } catch (error) {
        console.error("Error initializing page:", error);
        showError('Error loading workspace details');
    }
});

function getWorkspaceIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const workspaceId = urlParams.get('id');

    if (!workspaceId) {
        showError('No workspace specified', 'locationSearch.html');
        return null;
    }
    return workspaceId;
}

async function fetchWorkspaceData(workspaceId) {
    const docRef = doc(db, "workspaces", workspaceId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        showError('Workspace not found', 'locationSearch.html');
        return null;
    }
    return docSnap.data();
}

function populateWorkspaceData(workspace) {
    // Basic info
    elements.workspaceName.textContent = workspace.workspaceLocation || 'Workspace';
    elements.workspaceAddress.textContent = workspace.fullAddress || 'Address not available';
    elements.workspaceDescription.textContent = workspace.workspaceDescription || 'No description available';
    elements.hostName.textContent = workspace.ownerName || 'Host';
    elements.hostPhone.textContent = workspace.ownerPhone || 'Phone not available';
    elements.workspacePrice.textContent = workspace.price ? workspace.price.toLocaleString() : 'N/A';

    // Set default image
    elements.mainImage.src = workspace.imageUrl || './assets/images/default-workspace.jpg';
    elements.mainImage.onerror = () => {
        elements.mainImage.src = './assets/images/default-workspace.jpg';
    };

    // Amenities
    renderAmenities(workspace.resourcesAvailable || []);
    
    // Courses
    renderCourses(workspace.availableCourses || []);
}

function setupImageGallery(workspace) {
    // For now we only have one image, but this can be expanded
    if (workspace.imageUrl) {
        const thumbnail = createThumbnail(workspace.imageUrl);
        thumbnail.addEventListener('click', () => {
            elements.mainImage.src = workspace.imageUrl;
        });
        elements.thumbnailContainer.appendChild(thumbnail);
    }
}

function createThumbnail(imageUrl) {
    const thumbnail = document.createElement('img');
    thumbnail.src = imageUrl;
    thumbnail.alt = 'Workspace thumbnail';
    thumbnail.className = 'thumbnail';
    return thumbnail;
}

function renderAmenities(amenities) {
    elements.amenitiesContainer.innerHTML = '';

    if (amenities.length === 0) {
        elements.amenitiesContainer.innerHTML = '<p class="no-amenities">No amenities listed</p>';
        return;
    }

    amenities.forEach(amenity => {
        const amenityElement = createAmenityElement(amenity);
        elements.amenitiesContainer.appendChild(amenityElement);
    });
}

function renderCourses(courses) {
    elements.coursesContainer.innerHTML = '';

    if (courses.length === 0) {
        elements.coursesContainer.innerHTML = '<p class="no-amenities">No courses listed</p>';
        return;
    }

    courses.forEach(course => {
        const courseElement = document.createElement('span');
        courseElement.className = 'course-tag';
        courseElement.textContent = course;
        elements.coursesContainer.appendChild(courseElement);
    });
}

function createAmenityElement(resourceName) {
    const amenityElement = document.createElement('div');
    amenityElement.className = 'amenity';
    
    const icon = getIconForResource(resourceName);
    
    amenityElement.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${resourceName}</span>
    `;
    
    return amenityElement;
}

function getIconForResource(resourceName) {
    const iconMap = {
        wifi: 'fa-wifi',
        internet: 'fa-wifi',
        power: 'fa-plug',
        outlet: 'fa-plug',
        print: 'fa-print',
        coffee: 'fa-coffee',
        parking: 'fa-parking',
        computer: 'fa-desktop',
        laptop: 'fa-laptop',
        air: 'fa-snowflake',
        ac: 'fa-snowflake',
        desk: 'fa-book-reader',
        chair: 'fa-chair',
        meetup: 'fa-users',
        assistance: 'fa-user',
        collaboration: 'fa-handshake'
    };

    const lowerName = resourceName.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
        if (lowerName.includes(key)) return icon;
    }
    
    return 'fa-check-circle'; // default icon
}

function setupEventListeners() {
    // Mobile menu
    const menuToggle = document.querySelector('.hamburger');
    const mobileMenu = document.querySelector('.mobile');
    
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('active');
            menuToggle.textContent = mobileMenu.classList.contains('active') ? '✕' : '☰';
        });
    }

    // Booking form
    elements.bookButton.addEventListener('click', handleBooking);
    elements.bookingHours.addEventListener('change', updatePriceDisplay);
    elements.bookingDate.min = new Date().toISOString().split('T')[0];
}

function handleBooking(e) {
    e.preventDefault();
    
    const date = elements.bookingDate.value;
    const hours = elements.bookingHours.value;
    
    if (!date) {
        showMessage('Please select a date', 'error');
        return;
    }

    // Calculate price based on hours
    const pricePerDay = parseInt(elements.workspacePrice.textContent.replace(/,/g, '')) || 0;
    const hoursRate = {
        '4': 0.25,
        '8': 0.5,
        '12': 0.75,
        '24': 1
    };
    const totalPrice = pricePerDay * hoursRate[hours];

    // In a real app, you would send this to your backend
    showMessage(`Booking confirmed for ${date} (${hours} hours). Total: ₦${totalPrice.toLocaleString()}`, 'success');
    
    // Reset form
    elements.bookingForm.reset();
}

function updatePriceDisplay() {
    // This would update the price summary in a real implementation
    console.log('Booking duration changed:', elements.bookingHours.value);
}

function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
        <span>${message}</span>
        <button class="close-message"><i class="fas fa-times"></i></button>
    `;
    
    const messagesContainer = document.getElementById('form-messages');
    messagesContainer.appendChild(messageDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageDiv.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => messageDiv.remove(), 300);
    }, 5000);
    
    // Manual close
    messageDiv.querySelector('.close-message').addEventListener('click', () => {
        messageDiv.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => messageDiv.remove(), 300);
    });
}

function showError(message, redirectUrl = null) {
    console.error(message);
    showMessage(message, 'error');
    if (redirectUrl) {
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 3000);
    }
}