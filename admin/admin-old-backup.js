// Admin Dashboard JavaScript
const API_BASE_URL = 'http://localhost:3000/api';
let map;
let reports = [];
let currentFilters = {};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadDashboardData();
    initializeMap();
    setupEventListeners();
    setupMobileMenu();
});

// Mobile menu toggle
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay') || document.querySelector('.sidebar-overlay');
    
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
    if (overlay) {
        overlay.classList.toggle('active');
    }
}

// Setup mobile menu functionality
function setupMobileMenu() {
    // Close sidebar when clicking on a link (on mobile)
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
                const overlay = document.getElementById('sidebarOverlay') || document.querySelector('.sidebar-overlay');
                if (sidebar) {
                    sidebar.classList.remove('active');
                }
                if (overlay) {
                    overlay.classList.remove('active');
                }
            }
        });
    });
}

// Setup event listeners
function setupEventListeners() {
    // Filter change events
    const statusFilter = document.getElementById('status-filter');
    const typeFilter = document.getElementById('type-filter');
    const severityFilter = document.getElementById('severity-filter');
    
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (typeFilter) typeFilter.addEventListener('change', applyFilters);
    if (severityFilter) severityFilter.addEventListener('change', applyFilters);
}

// Refresh current section data
function refreshData() {
    const activeSection = document.querySelector('.section[style*="display: block"]');
    if (!activeSection) {
        loadDashboardData();
        return;
    }
    
    const sectionId = activeSection.id.replace('-section', '');
    
    switch(sectionId) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'reports':
            loadReports();
            break;
        case 'map':
            loadMapData();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'departments':
            loadDepartments();
            break;
    }
    
    // Show refresh animation
    const btn = event?.target?.closest('button');
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.classList.add('fa-spin');
            setTimeout(() => icon.classList.remove('fa-spin'), 1000);
        }
    }
}

// Show specific section
function showSection(sectionName, event) {
    // Prevent default link behavior
    if (event) {
        event.preventDefault();
    }
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected section
    const sectionElement = document.getElementById(sectionName + '-section');
    if (sectionElement) {
        sectionElement.style.display = 'block';
    }
    
    // Add active class to clicked nav link
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    } else {
        // Fallback: find and activate the link by section name
        const links = document.querySelectorAll('.nav-link');
        links.forEach(link => {
            if (link.textContent.toLowerCase().includes(sectionName.replace('-', ' '))) {
                link.classList.add('active');
            }
        });
    }
    
    // Update page title
    const titles = {
        'dashboard': 'Dashboard',
        'reports': 'Reports',
        'map': 'Map View',
        'analytics': 'Analytics',
        'departments': 'Departments'
    };
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.textContent = titles[sectionName] || sectionName;
    }
    
    // Load section-specific data
    switch(sectionName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'reports':
            loadReports();
            break;
        case 'map':
            loadMapData();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'departments':
            loadDepartments();
            break;
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        const data = await response.json();
        const stats = data.stats || data; // Handle v2 API format
        
        // Update stats cards (handle both v1 and v2 API formats)
        document.getElementById('total-reports').textContent = stats.total || stats.total?.[0]?.count || 0;
        document.getElementById('resolved-reports').textContent = stats.resolved || stats.resolved?.[0]?.count || 0;
        document.getElementById('pending-reports').textContent = stats.pending || stats.pending?.[0]?.count || 0;
        document.getElementById('critical-reports').textContent = stats.critical || stats.critical?.[0]?.count || 0;
        
        // Load recent reports
        loadRecentReports();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data');
    }
}

// Load recent reports
async function loadRecentReports() {
    try {
        const response = await fetch(`${API_BASE_URL}/reports?limit=5`);
        const data = await response.json();
        const recentReports = data.reports || data; // Handle v2 API format
        
        const container = document.getElementById('recent-reports-list');
        
        if (recentReports.length === 0) {
            container.innerHTML = '<div class="text-center py-4 text-muted">No reports found</div>';
            return;
        }
        
        container.innerHTML = recentReports.map(report => `
            <div class="d-flex align-items-center py-2 border-bottom">
                <div class="flex-shrink-0">
                    <div class="bg-${getSeverityColor(report.severity)} text-white rounded-circle p-2">
                        <i class="fas fa-${getTypeIcon(report.type)}"></i>
                    </div>
                </div>
                <div class="flex-grow-1 ms-3">
                    <h6 class="mb-1">${formatTypeName(report.type)}</h6>
                    <small class="text-muted">${report.address}</small>
                </div>
                <div class="flex-shrink-0">
                    <span class="badge ${getStatusBadgeClass(report.status)} status-badge">
                        ${formatStatusName(report.status)}
                    </span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading recent reports:', error);
        document.getElementById('recent-reports-list').innerHTML = 
            '<div class="text-center py-4 text-danger">Failed to load recent reports</div>';
    }
}

// Load all reports
async function loadReports() {
    try {
        const params = new URLSearchParams(currentFilters);
        const response = await fetch(`${API_BASE_URL}/reports?${params}`);
        const data = await response.json();
        reports = data.reports || data; // Handle v2 API format
        
        displayReports(reports);
        
    } catch (error) {
        console.error('Error loading reports:', error);
        showError('Failed to load reports');
    }
}

// Display reports
function displayReports(reportsList) {
    const container = document.getElementById('reports-list');
    
    if (reportsList.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-muted">No reports found</div>';
        return;
    }
    
    container.innerHTML = reportsList.map(report => `
        <div class="card issue-card">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-1">
                        <div class="bg-${getSeverityColor(report.severity)} text-white rounded-circle p-2 text-center">
                            <i class="fas fa-${getTypeIcon(report.type)}"></i>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <h6 class="mb-1">${formatTypeName(report.type)}</h6>
                        <small class="text-muted">${report.address}</small>
                    </div>
                    <div class="col-md-2">
                        <span class="badge ${getStatusBadgeClass(report.status)} status-badge">
                            ${formatStatusName(report.status)}
                        </span>
                    </div>
                    <div class="col-md-2">
                        <span class="badge ${getSeverityBadgeClass(report.severity)} severity-badge">
                            ${formatSeverityName(report.severity)}
                        </span>
                    </div>
                    <div class="col-md-2">
                        <small class="text-muted">${formatDate(report.timestamp)}</small>
                    </div>
                    <div class="col-md-2">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="viewReport('${report.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-outline-success" onclick="updateStatus('${report.id}', 'acknowledged')">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn btn-outline-warning" onclick="updateStatus('${report.id}', 'in_progress')">
                                <i class="fas fa-clock"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Apply filters
function applyFilters() {
    currentFilters = {
        status: document.getElementById('status-filter').value,
        type: document.getElementById('type-filter').value,
        severity: document.getElementById('severity-filter').value
    };
    
    // Remove empty filters
    Object.keys(currentFilters).forEach(key => {
        if (!currentFilters[key]) {
            delete currentFilters[key];
        }
    });
    
    loadReports();
}

// Update report status
async function updateStatus(reportId, status) {
    try {
        const response = await fetch(`${API_BASE_URL}/reports/${reportId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showSuccess('Report status updated successfully');
            loadReports();
            loadDashboardData();
        } else {
            throw new Error('Failed to update status');
        }
        
    } catch (error) {
        console.error('Error updating status:', error);
        showError('Failed to update report status');
    }
}

// View report details
function viewReport(reportId) {
    const report = reports.find(r => r.id === reportId);
    if (report) {
        // Create modal for report details
        const modal = createReportModal(report);
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // Remove modal after hiding
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }
}

// Create report details modal
function createReportModal(report) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Report Details</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-md-6">
                            <h6>Issue Information</h6>
                            <p><strong>Type:</strong> ${formatTypeName(report.type)}</p>
                            <p><strong>Severity:</strong> ${formatSeverityName(report.severity)}</p>
                            <p><strong>Status:</strong> ${formatStatusName(report.status)}</p>
                            <p><strong>Location:</strong> ${report.address}</p>
                            <p><strong>Reported:</strong> ${formatDate(report.timestamp)}</p>
                        </div>
                        <div class="col-md-6">
                            <h6>Coordinates</h6>
                            <p><strong>Latitude:</strong> ${report.latitude}</p>
                            <p><strong>Longitude:</strong> ${report.longitude}</p>
                            ${report.description ? `<p><strong>Description:</strong> ${report.description}</p>` : ''}
                        </div>
                    </div>
                    ${report.image_path ? `
                        <div class="mt-3">
                            <h6>Image</h6>
                            <img src="/uploads/${report.image_path.split('/').pop()}" class="img-fluid rounded" alt="Issue Image">
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-primary" onclick="updateStatus('${report.id}', 'acknowledged')">Acknowledge</button>
                </div>
            </div>
        </div>
    `;
    return modal;
}

// Initialize map
function initializeMap() {
    // Only initialize if map doesn't exist
    if (map) return;
    
    const mapElement = document.getElementById('map');
    if (!mapElement) return;
    
    try {
        map = L.map('map').setView([17.4065, 78.4772], 13); // Default to Hyderabad
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// Load map data
async function loadMapData() {
    try {
        // Initialize map if needed
        if (!map) {
            initializeMap();
        }
        
        // Fix map size after it becomes visible
        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 100);
        
        const response = await fetch(`${API_BASE_URL}/reports`);
        const data = await response.json();
        const reports = data.reports || data; // Handle v2 API format
        
        // Clear existing markers
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });
        
        // Add markers for each report
        reports.forEach(report => {
            const marker = L.marker([report.latitude, report.longitude])
                .addTo(map);
            
            marker.bindPopup(`
                <div>
                    <h6>${formatTypeName(report.type)}</h6>
                    <p><strong>Status:</strong> ${formatStatusName(report.status)}</p>
                    <p><strong>Severity:</strong> ${formatSeverityName(report.severity)}</p>
                    <p><strong>Address:</strong> ${report.address}</p>
                    <p><strong>Reported:</strong> ${formatDate(report.timestamp)}</p>
                </div>
            `);
        });
        
        // Fit map to show all markers
        if (reports.length > 0) {
            const group = new L.featureGroup(reports.map(report => 
                L.marker([report.latitude, report.longitude])
            ));
            map.fitBounds(group.getBounds().pad(0.1));
        }
        
    } catch (error) {
        console.error('Error loading map data:', error);
        showError('Failed to load map data');
    }
}

// Load analytics
async function loadAnalytics() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        const data = await response.json();
        const stats = data.stats || data; // Handle v2 API format
        
        // Create type chart
        createTypeChart(stats.byType);
        
        // Create status chart
        createStatusChart(stats.byStatus);
        
    } catch (error) {
        console.error('Error loading analytics:', error);
        showError('Failed to load analytics');
    }
}

// Create type chart
function createTypeChart(typeData) {
    const canvas = document.getElementById('type-chart');
    if (!canvas) return;
    
    // Destroy existing chart if any
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();
    
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: typeData.map(item => formatTypeName(item.type)),
            datasets: [{
                data: typeData.map(item => item.count),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                    '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Create status chart
function createStatusChart(statusData) {
    const canvas = document.getElementById('status-chart');
    if (!canvas) return;
    
    // Destroy existing chart if any
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();
    
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: statusData.map(item => formatStatusName(item.status)),
            datasets: [{
                label: 'Reports',
                data: statusData.map(item => item.count),
                backgroundColor: [
                    '#36A2EB', '#FFCE56', '#FF9F40', '#4BC0C0', '#C9CBCF'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Load departments
async function loadDepartments() {
    try {
        const response = await fetch(`${API_BASE_URL}/departments`);
        const data = await response.json();
        const departments = data.departments || data; // Handle v2 API format
        
        const container = document.getElementById('departments-list');
        
        if (departments.length === 0) {
            container.innerHTML = '<div class="text-center py-4 text-muted">No departments found</div>';
            return;
        }
        
        container.innerHTML = departments.map(dept => `
            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title">${dept.name}</h5>
                    <p class="card-text">${dept.description || 'No description available'}</p>
                    ${dept.contact_email ? `<p class="card-text"><small class="text-muted">Contact: ${dept.contact_email}</small></p>` : ''}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading departments:', error);
        showError('Failed to load departments');
    }
}

// Utility functions
function formatTypeName(type) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatStatusName(status) {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatSeverityName(severity) {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString();
}

function getTypeIcon(type) {
    const icons = {
        'pothole': 'road',
        'streetlight': 'lightbulb',
        'trash': 'trash',
        'graffiti': 'paint-brush',
        'damaged_sign': 'sign',
        'broken_sidewalk': 'walking',
        'water_leak': 'tint',
        'other': 'question'
    };
    return icons[type] || 'question';
}

function getSeverityColor(severity) {
    const colors = {
        'low': 'success',
        'medium': 'warning',
        'high': 'danger',
        'critical': 'danger'
    };
    return colors[severity] || 'secondary';
}

function getStatusBadgeClass(status) {
    const classes = {
        'reported': 'bg-primary',
        'acknowledged': 'bg-info',
        'in_progress': 'bg-warning',
        'resolved': 'bg-success',
        'closed': 'bg-secondary'
    };
    return classes[status] || 'bg-secondary';
}

function getSeverityBadgeClass(severity) {
    const classes = {
        'low': 'bg-success',
        'medium': 'bg-warning',
        'high': 'bg-danger',
        'critical': 'bg-danger'
    };
    return classes[severity] || 'bg-secondary';
}

function showSuccess(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-white bg-success border-0';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    document.body.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove toast after hiding
    toast.addEventListener('hidden.bs.toast', () => {
        document.body.removeChild(toast);
    });
}

function showError(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-white bg-danger border-0';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    document.body.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove toast after hiding
    toast.addEventListener('hidden.bs.toast', () => {
        document.body.removeChild(toast);
    });
}
