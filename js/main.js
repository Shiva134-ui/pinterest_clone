// APP LOGIC
const gallery = document.getElementById('gallery');
const sInput = document.getElementById('searchInput');
const sDrop = document.getElementById('searchDropdown');

// Global Click Listener
window.onclick = function (e) {
    if (!e.target.closest('.icon-btn')) {
        document.querySelectorAll('.dropdown').forEach(d => d.style.display = 'none');
    }
}

// Search Logic
sInput.addEventListener('focus', () => sDrop.style.display = 'block');
sInput.addEventListener('blur', () => setTimeout(() => sDrop.style.display = 'none', 200));
sInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') resetSearch(sInput.value); });

function resetSearch(query) {
    if (query) sInput.value = query;
    page = 0;
    exhaustedAPIs.clear();
    isFetching = false;
    gallery.innerHTML = '';
    sDrop.style.display = 'none';
    loadImages();
}


// Init Tags
const tags = ["Sun", "Nature", "Wallpaper", "Space", "Movies"];
const tBar = document.getElementById('tagsBar');
tags.forEach(t => {
    const b = document.createElement('button'); b.className = 'tag-pill'; b.innerText = t;
    b.onclick = () => resetSearch(t);
    tBar.appendChild(b);
});

// Infinite Scroll
let scrollTimeout;
window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        // Load more if user is near bottom (within 300px)
        if (scrollTop + clientHeight >= scrollHeight - 300) {
            loadImages();
        }
    }, 100);
});

// Initial Load
if (localStorage.getItem('pinterestDarkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
}
checkSession();
loadImages();
