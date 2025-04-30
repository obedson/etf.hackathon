const navLinks = document.querySelector(".mobile");

let currentIndex = 0;
const slides = document.querySelectorAll(".slide");

function toggleMenu() {
  navLinks.classList.toggle("mobileShow");
}

function showSlide(index) {
  slides.forEach((slide, i) => {
    slide.style.display = i === index ? "block" : "none";
  });
}

function autoSlide() {
  currentIndex = (currentIndex + 1) % slides.length;
  showSlide(currentIndex);
}

setInterval(autoSlide, 3000); // Change every 3 seconds
showSlide(currentIndex); // Show the initial slide

// Team member toggle functionality
document.getElementById('seeMoreBtn').addEventListener('click', function() {
  const hiddenMembers = document.querySelectorAll('.hidden-team');
  const btn = this;
  
  hiddenMembers.forEach(member => {
      member.classList.toggle('hidden-team');
  });
  
  if (btn.textContent === 'See More Team Members') {
      btn.textContent = 'See Less';
  } else {
      btn.textContent = 'See More Team Members';
      // Scroll to team section when hiding members
      document.querySelector('.team-section').scrollIntoView({ behavior: 'smooth' });
  }
});