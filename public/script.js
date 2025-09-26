const API_URL = 'http://localhost:3001/api/projects';
let projectsCache = [];
let isLoggedIn = false;

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    fetchProjects();
    showPortfolio(); // Default view

    document.getElementById('projectForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

// --- API Functions ---
// --- Auth Functions ---
async function checkAuthStatus() {
    try {
        const response = await fetch('http://localhost:3001/api/auth/status');
        const data = await response.json();
        isLoggedIn = data.loggedIn;
        updateUIForAuth();
    } catch (error) {
        console.error('Error checking auth status:', error);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginError = document.getElementById('loginError');

    try {
        const response = await fetch('http://localhost:3001/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            isLoggedIn = true;
            document.getElementById('loginModal').style.display = 'none';
            loginError.textContent = '';
            showCMS();
            updateUIForAuth();
        } else {
            loginError.textContent = data.message || 'Login failed.';
        }
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'An error occurred. Please try again.';
    }
}

async function logout() {
    try {
        await fetch('http://localhost:3001/api/logout', { method: 'POST' });
        isLoggedIn = false;
        showPortfolio();
        updateUIForAuth();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// --- API Functions ---
async function fetchProjects() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        projectsCache = await response.json();
        
        displayPortfolioProjects();
        displayAdminProjects();
        updateStats();
    } catch (error) {
        console.error('Failed to fetch projects:', error);
        alert('Gagal memuat project. Pastikan server backend berjalan.');
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const projectId = document.getElementById('projectId').value;
    
    const formData = new FormData();
    formData.append('title', document.getElementById('projectTitle').value.trim());
    formData.append('category', document.getElementById('projectCategory').value);
    formData.append('description', document.getElementById('projectDescription').value.trim());
    formData.append('tech', document.getElementById('projectTech').value.trim());
    formData.append('url', document.getElementById('projectUrl').value.trim());
    
    const imageFile = document.getElementById('projectImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    if (!formData.get('title') || !formData.get('category') || !formData.get('description')) {
        alert('Mohon lengkapi field yang wajib diisi!');
        return;
    }

    try {
        let response;
        if (projectId) {
            // Update existing project
            response = await fetch(`${API_URL}/${projectId}`, {
                method: 'PUT',
                body: formData // FormData sets the correct Content-Type header automatically
            });
        } else {
            // Add new project
            response = await fetch(API_URL, {
                method: 'POST',
                body: formData
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Something went wrong');
        }

        const result = await response.json();
        alert(`Project berhasil ${projectId ? 'diupdate' : 'ditambahkan'}!`);
        resetForm();
        fetchProjects(); // Refresh data

    } catch (error) {
        console.error('Error submitting form:', error);
        alert(`Gagal menyimpan project: ${error.message}`);
    }
}

async function deleteProject(id) {
    if (!isLoggedIn) {
        alert('You must be logged in to delete projects.');
        return;
    }
    if (!confirm('Yakin ingin menghapus project ini?')) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete');
        }

        alert('Project berhasil dihapus!');
        fetchProjects(); // Refresh data

    } catch (error) {
        console.error('Error deleting project:', error);
        alert(`Gagal menghapus project: ${error.message}`);
    }
}

// --- UI/Display Functions ---

function showPortfolio() {
    document.getElementById('portfolioSection').classList.remove('hidden');
    document.getElementById('cmsSection').classList.add('hidden');
    document.getElementById('heroSection').classList.remove('hidden');
    document.getElementById('loginModal').style.display = 'none'; // Hide login modal if showing
}

function showCMS() {
    if (isLoggedIn) {
        document.getElementById('portfolioSection').classList.add('hidden');
        document.getElementById('cmsSection').classList.remove('hidden');
        document.getElementById('heroSection').classList.add('hidden');
    } else {
        document.getElementById('loginModal').style.display = 'flex';
    }
}

function updateUIForAuth() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (isLoggedIn) {
        logoutBtn.classList.remove('hidden');
    } else {
        logoutBtn.classList.add('hidden');
    }
}

function editProject(id) {
    if (!isLoggedIn) {
        alert('You must be logged in to edit projects.');
        return;
    }
    const project = projectsCache.find(p => p.id === id);
    if (!project) return;

    document.getElementById('projectId').value = project.id;
    document.getElementById('projectTitle').value = project.title;
    document.getElementById('projectCategory').value = project.category;
    document.getElementById('projectDescription').value = project.description;
    document.getElementById('projectTech').value = project.tech.join(', ');
    document.getElementById('projectUrl').value = project.url || '';

    const preview = document.getElementById('imagePreview');
    if (project.image) {
        preview.src = project.image;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
    
    document.getElementById('submitText').textContent = 'Update Project';
    document.getElementById('cancelBtn').style.display = 'inline-block';
    
    document.getElementById('projectForm').scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
    document.getElementById('projectForm').reset();
    document.getElementById('projectId').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('imagePreview').src = '';
    document.getElementById('submitText').textContent = 'Tambah Project';
    document.getElementById('cancelBtn').style.display = 'none';
}

function displayPortfolioProjects() {
    const container = document.getElementById('portfolioGrid');
    if (projectsCache.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; font-size: 18px; grid-column: 1 / -1;">Belum ada project yang ditambahkan.</p>';
        return;
    }

    container.innerHTML = projectsCache.map(project => `
        <div class="project-card">
            <div class="project-image">
                ${project.image ? 
                    `<img src="${project.image}" style="width: 100%; height: 100%; object-fit: cover;" alt="${project.title}">`  : 
                    'Tidak ada gambar'
                }
            </div>
            <div class="project-content">
                <h3 class="project-title">${project.title}</h3>
                <span class="project-category">${project.category}</span>
                <p class="project-description">${project.description}</p>
                ${project.tech.length > 0 ? `
                    <div class="project-tech">
                        ${project.tech.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
                    </div>
                ` : ''}
                ${project.url ? `
                    <a href="${project.url}" target="_blank" class="btn btn-primary btn-small">Lihat Project</a>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function displayAdminProjects() {
    const container = document.getElementById('adminProjectsGrid');
    if (projectsCache.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; font-size: 18px; grid-column: 1 / -1;">Belum ada project. Tambahkan project pertama Anda!</p>';
        return;
    }

    container.innerHTML = projectsCache.map(project => `
        <div class="project-card">
            <div class="project-image">
                ${project.image ? 
                    `<img src="${project.image}" style="width: 100%; height: 100%; object-fit: cover;" alt="${project.title}">`  : 
                    'Tidak ada gambar'
                }
            </div>
            <div class="project-content">
                <h3 class="project-title">${project.title}</h3>
                <span class="project-category">${project.category}</span>
                <p class="project-description">${project.description.substring(0, 100)}${project.description.length > 100 ? '...' : ''}</p>
                ${project.tech.length > 0 ? `
                    <div class="project-tech">
                        ${project.tech.slice(0, 3).map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
                        ${project.tech.length > 3 ? `<span class="tech-tag">+${project.tech.length - 3} lainnya</span>`  : ''}
                    </div>
                ` : ''}
                <div class="project-actions">
                    <button class="btn btn-warning btn-small" onclick="editProject(${project.id})">Edit</button>
                    <button class="btn btn-danger btn-small" onclick="deleteProject(${project.id})">Hapus</button>
                </div>
            </div>
        </div>
    `).join('');
}

function updateStats() {
    document.getElementById('totalProjects').textContent = projectsCache.length;
    const uniqueCategories = [...new Set(projectsCache.map(p => p.category))];
    document.getElementById('totalCategories').textContent = uniqueCategories.length;
}

function previewImage() {
    const file = document.getElementById('projectImage').files[0];
    const preview = document.getElementById('imagePreview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        preview.style.display = 'none';
    }
}
