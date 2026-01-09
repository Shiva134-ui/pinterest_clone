let currentUser = null;

async function handleAuth() {
    const email = document.getElementById('emailInput').value;
    const pass = document.getElementById('passInput').value;
    const user = document.getElementById('usernameInput').value;
    const isSignup = document.getElementById('authBtn').innerText === "Sign Up";
    const msg = document.getElementById('authMsg');

    if (!email || !pass) { msg.innerText = "Please fill fields"; return; }
    msg.innerText = "Processing...";

    const action = isSignup ? "signup" : "login";
    const payload = { action, email, password: pass, username: user };

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.status === "success") {
            currentUser = { email: data.email, username: data.username };
            localStorage.setItem('pinterestUser', JSON.stringify(currentUser));
            document.getElementById('loginScreen').classList.add('hidden');
            loadUserProfile();
            showToast("Welcome " + data.username);
        } else {
            msg.innerText = data.message;
        }
    } catch (e) {
        console.warn("CORS/Net Error", e);
        currentUser = { email, username: user || "User" };
        localStorage.setItem('pinterestUser', JSON.stringify(currentUser));
        document.getElementById('loginScreen').classList.add('hidden');
        loadUserProfile();
    }
}

function toggleAuthMode() {
    const btn = document.getElementById('authBtn');
    const toggle = document.querySelector('.toggle-auth');
    const nameInput = document.getElementById('usernameInput');
    if (btn.innerText === "Log in") {
        btn.innerText = "Sign Up"; toggle.innerText = "Already have an account? Log in";
        nameInput.style.display = 'block'; document.getElementById('authTitle').innerText = "Join Pinterest";
    } else {
        btn.innerText = "Log in"; toggle.innerText = "Not on Pinterest yet? Sign up";
        nameInput.style.display = 'none'; document.getElementById('authTitle').innerText = "Welcome to Pinterest";
    }
}

function logout() {
    localStorage.removeItem('pinterestUser');
    location.reload();
}

function checkSession() {
    const saved = localStorage.getItem('pinterestUser');
    if (saved) {
        currentUser = JSON.parse(saved);
        document.getElementById('loginScreen').classList.add('hidden');
        loadUserProfile();
    }
}

function loadUserProfile() {
    if (currentUser) {
        document.getElementById('profileNameDisplay').innerText = currentUser.username;
        document.getElementById('profileUserDisplay').innerText = "@" + currentUser.username.toLowerCase().replace(/ /g, '');
        document.getElementById('profilePicDisplay').innerText = currentUser.username[0].toUpperCase();
    }
}
