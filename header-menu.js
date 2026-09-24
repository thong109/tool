// Global Header Menu Functionality

// Theme management
let currentTheme = localStorage.getItem('theme') || 'dark';

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', function() {
    // Apply saved theme
    if (currentTheme === 'light') {
        document.querySelector('.global-header')?.classList.add('light-theme');
        const themeIcon = document.querySelector('.theme-icon');
        if (themeIcon) themeIcon.textContent = '☀️';
    }

    // Setup theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Set active nav link based on current page
    setActiveNavLink();
});

// Toggle between dark and light theme
function toggleTheme() {
    const header = document.querySelector('.global-header');
    const themeIcon = document.querySelector('.theme-icon');
    
    if (!header) return;

    if (currentTheme === 'dark') {
        currentTheme = 'light';
        header.classList.add('light-theme');
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        currentTheme = 'dark';
        header.classList.remove('light-theme');
        if (themeIcon) themeIcon.textContent = '🌙';
    }

    localStorage.setItem('theme', currentTheme);
}

// Set active navigation link based on current URL
function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && currentPath.includes(href)) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Export functions for potential use
if (typeof window !== 'undefined') {
    window.headerMenu = {
        toggleTheme,
        setActiveNavLink,
        getCurrentTheme: () => currentTheme
    };
}