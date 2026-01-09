function switchTab(tab) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (tab === 'home') document.getElementById('homeScreen').classList.add('active');
    if (tab === 'profile') {
        document.getElementById('profileScreen').classList.add('active');
        loadProfilePins();
    }
}

async function loadProfilePins(activeBoard = null) {
    const grid = document.getElementById('savedGrid');
    const loader = document.getElementById('profileLoader');
    const tabContainer = document.querySelector('.profile-tabs');

    // Init Sync: Map cloud pins to "All Pins" if needed
    const cloudPins = await fetchUserPins();
    BoardSystem.syncCloudPins(cloudPins);

    // Render Tabs
    const boards = BoardSystem.getBoards();
    let tabsHtml = '';
    boards.forEach(b => {
        const isActive = (activeBoard === b) || (!activeBoard && b === BoardSystem.DEFAULT_BOARD);
        tabsHtml += `<div class="tab-item ${isActive ? 'active' : ''}" onclick="loadProfilePins('${b}')">${b}</div>`;
    });
    // Add "Create Board" button
    tabsHtml += `<div class="tab-item" style="color:var(--primary-color)" onclick="createNewBoardUI()">+</div>`;
    tabContainer.innerHTML = tabsHtml;

    // determine active board
    const currentBoard = activeBoard || BoardSystem.DEFAULT_BOARD;

    grid.innerHTML = '';

    // Get pins for this board
    // We combine cloud data (metadata like title might be missing in local map, but source is key)
    // Actually, BoardSystem.getPinsInBoard returns {src, alt}. 
    // We should try to use cloud data if available for better resolution/titles if we matched by URL? 
    // For now, simple BoardSystem return is enough.
    const boardPins = BoardSystem.getPinsInBoard(currentBoard);

    if (boardPins.length === 0) {
        grid.innerHTML = `<div style="text-align:center; width:100%; grid-column:span 2;">No pins in '${currentBoard}'.</div>`;
    } else {
        boardPins.forEach(pin => grid.appendChild(createPinHTML(pin.src, pin.alt, true)));
    }
}

function createNewBoardUI() {
    const name = prompt("Enter new board name:");
    if (name) {
        if (BoardSystem.createBoard(name)) {
            showToast(`Board '${name}' created!`);
            loadProfilePins(name);
        } else {
            showToast("Board already exists");
        }
    }
}

function handleCreateReal() {
    const url = document.getElementById('createUrl').value;
    const title = document.getElementById('createTitle').value;
    if (!url) return showToast("Please add an image URL");
    showToast("Creating Pin...");
    savePinToSheet(url, title);
    setTimeout(() => {
        closeModal(null, true);
        showToast("Pin Created!"); switchTab('profile');
    }, 1500);
}

function openCreateModal() { document.getElementById('createModal').style.display = 'flex'; }

function createPinHTML(src, alt, isSavedMode = false) {
    const wrap = document.createElement('div');
    wrap.className = 'pin-wrapper';
    wrap.innerHTML = `
        <div class="pin-card" onclick="openPinModal('${src}', '${(alt || "").replace(/'/g, "")}')">
            <img src="${src}" loading="lazy" onerror="this.style.display='none'; this.parentElement.style.display='none'">
            <div class="pin-overlay">
                <button class="save-btn ${isSavedMode ? 'saved' : ''}" onclick="event.stopPropagation(); toggleSave(this, false, '${src}', '${(alt || "").replace(/'/g, "")}')">
                    ${isSavedMode ? 'Saved' : 'Save'}
                </button>
            </div>
        </div>
    `;
    return wrap;
}

function toggleSave(btn, fromModal, src, alt) {
    if (btn.classList.contains('saved')) return; // Already saved

    // Prompt for Board
    const boards = BoardSystem.getBoards();
    // Simple prompt for now - ideally a nice modal
    let boardName = BoardSystem.DEFAULT_BOARD;

    if (boards.length > 1) {
        // Create a simple selection string
        // "1. All Pins, 2. Design..."
        const msg = "Choose Board:\n" + boards.map((b, i) => `${i + 1}. ${b}`).join("\n");
        const limit = boards.length;
        const choice = prompt(msg, "1");
        if (choice === null) return; // Cancelled
        const idx = parseInt(choice) - 1;
        if (idx >= 0 && idx < limit) {
            boardName = boards[idx];
        } else {
            alert("Invalid selection, saving to " + BoardSystem.DEFAULT_BOARD);
        }
    }

    btn.innerText = "Saved";
    btn.classList.add('saved');
    showToast(`Saved to ${boardName}!`);

    // Save to Local Board System
    if (fromModal) {
        const modalSrc = document.getElementById('modalImg').src;
        const modalTitle = document.getElementById('modalTitle').innerText;
        BoardSystem.addPinToBoard({ src: modalSrc, alt: modalTitle }, boardName);
        savePinToSheet(modalSrc, modalTitle); // Cloud Backup
    } else {
        BoardSystem.addPinToBoard({ src: src, alt: alt }, boardName);
        savePinToSheet(src, alt); // Cloud Backup
    }
}

async function openPinModal(src, title) {
    const modalImg = document.getElementById('modalImg');
    const modalTitle = document.getElementById('modalTitle');
    const modalDownload = document.getElementById('modalDownload');
    const relatedGrid = document.getElementById('relatedGrid');

    modalImg.src = src;
    modalImg.onerror = function () { this.src = 'https://via.placeholder.com/400x600?text=Image+Not+Found'; };

    modalTitle.innerText = title || "Untitled";

    // Setup Download
    modalDownload.href = src;
    // We can't force download on cross-origin images easily without proxy, but target=_blank helps
    modalDownload.download = "pinterest_image.jpg";

    document.getElementById('pinModal').style.display = 'flex';

    // Fetch Related
    relatedGrid.innerHTML = '<div class="loader-spinner" style="margin:20px auto;"></div>';
    try {
        const related = await fetchRelatedImages(title);
        relatedGrid.innerHTML = '';
        if (related.length === 0) {
            relatedGrid.innerHTML = '<div style="color:#888; text-align:center; width:100%;">No related pins found.</div>';
        } else {
            related.slice(0, 8).forEach(img => { // Limit to 8 related items
                relatedGrid.appendChild(createPinHTML(img.src, img.alt));
            });
        }
    } catch (e) {
        relatedGrid.innerHTML = '<div style="color:red; text-align:center;">Failed to load related pins.</div>';
        console.error(e);
    }
}

function copyLink() {
    const url = document.getElementById('modalImg').src;
    navigator.clipboard.writeText(url).then(() => {
        showToast("Link Copied to Clipboard!");
    }).catch(() => {
        showToast("Failed to copy link");
    });
}

function closeModal(e, force) {
    if (force || e.target.classList.contains('modal-overlay'))
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}

function showToast(m) {
    const t = document.getElementById('toast'); t.innerText = m; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function toggleDropdown(id) { document.getElementById(id).style.display = 'flex'; }

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('pinterestDarkMode', isDark ? 'enabled' : 'disabled');
}

loadImages();


// --- SKELETON LOADING ---
function showSkeletons() {
    // Determine how many skeletons to show based on screen size
    const width = window.innerWidth;
    const cols = width > 1400 ? 5 : width > 1024 ? 4 : width > 768 ? 3 : 2;
    const count = cols * 3; // Fill roughly one screen

    // Create specific container if not exists, or just append to gallery
    // Note: To avoid messing up Masonry flow, we just append standard divs
    // But better to have a "loading" section at bottom?
    // For Infinite Scroll, simply appending is safer.

    // Check if we already have skeletons
    if (document.querySelector('.skeleton')) return;

    for (let i = 0; i < count; i++) {
        const h = Math.floor(Math.random() * (400 - 200 + 1)) + 200; // Random height
        const skel = document.createElement('div');
        skel.className = 'skeleton';
        skel.style.height = `${h}px`;
        skel.id = `skel-${i}`;
        gallery.appendChild(skel);
    }
}

function hideSkeletons() {
    document.querySelectorAll('.skeleton').forEach(el => el.remove());
}
