// Admin Dashboard JavaScript
const API_BASE_URL = 'http://localhost:3000/api';
let map;
let reports = [];
let currentFilters = {};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Admin Dashboard Initializing...');
    console.log('📚 Checking libraries: L =', typeof L, ', Chart =', typeof Chart, ', bootstrap =', typeof bootstrap);
    
    setupNavigation();
    setupEventListeners();
    setupMobileMenu();
    loadDashboardData();
    // DON'T initialize map here - it's hidden and won't render properly
    // Map will initialize when user clicks "Map View" tab
    console.log('✅ Dashboard Ready!');
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

// Setup navigation with proper event listeners
function setupNavigation() {
    const navLinks = document.querySelectorAll('[data-section]');
    console.log(`Found ${navLinks.length} navigation links`);
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionName = this.getAttribute('data-section');
            console.log(`Navigating to: ${sectionName}`);
            showSection(sectionName, e);
        });
    });
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
    console.log(`showSection called with: ${sectionName}`);
    
    try {
        // Prevent default if event exists
        if (event) {
            event.preventDefault();
        }
        
        // Hide all sections
        const allSections = document.querySelectorAll('.section');
        console.log(`Found ${allSections.length} sections`);
        allSections.forEach(section => {
            section.style.display = 'none';
        });
        
        // Remove active class from all nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Show selected section
        const sectionId = sectionName + '-section';
        const sectionElement = document.getElementById(sectionId);
        console.log(`Looking for section: ${sectionId}, Found:`, !!sectionElement);
        
        if (sectionElement) {
            sectionElement.style.display = 'block';
            console.log(`✅ Showing section: ${sectionName}`);
        } else {
            console.error(`❌ Section not found: ${sectionId}`);
            return;
        }
        
        // Add active class to the clicked link
        const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
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
        console.log(`Loading data for: ${sectionName}`);
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
    } catch (error) {
        console.error('Error in showSection:', error);
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
        
        // Sort by priority (upvotes + verifications) descending
        reports.sort((a, b) => {
            const priorityA = (a.upvotes || 0) + (a.verification_count || 0);
            const priorityB = (b.upvotes || 0) + (b.verification_count || 0);
            return priorityB - priorityA;
        });
        
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
                        ${report.image_path ? `
                            <img src="${getImageUrl(report.image_path)}" 
                                 style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px; cursor: pointer;" 
                                 onclick="viewReport('${report.id}')"
                                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3ENo Image%3C/text%3E%3C/svg%3E'"
                                 title="Click to view details">
                        ` : `
                            <div class="bg-${getSeverityColor(report.severity)} text-white rounded-circle p-2 text-center">
                                <i class="fas fa-${getTypeIcon(report.type)}"></i>
                            </div>
                        `}
                    </div>
                    <div class="col-md-2">
                        <h6 class="mb-1">${formatTypeName(report.type)}</h6>
                        <small class="text-muted">${report.address}</small>
                    </div>
                    <div class="col-md-2">
                        <span class="badge ${getStatusBadgeClass(report.status)} status-badge">
                            ${formatStatusName(report.status)}
                        </span>
                        <br>
                        <small class="text-muted mt-1">
                            <i class="fas fa-thumbs-up text-success"></i> ${report.upvotes || 0} 
                            <i class="fas fa-check-circle text-primary ms-2"></i> ${report.verification_count || 0}
                        </small>
                    </div>
                    <div class="col-md-1">
                        <span class="badge ${getSeverityBadgeClass(report.severity)} severity-badge">
                            ${formatSeverityName(report.severity)}
                        </span>
                    </div>
                    <div class="col-md-2">
                        <small class="text-muted">${formatDate(report.timestamp || report.created_at)}</small>
                    </div>
                    <div class="col-md-3">
                        <div class="btn-group btn-group-sm mb-1" style="width: 100%;">
                            <button class="btn btn-outline-primary" onclick="viewReport('${report.id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${report.image_path ? `
                                <a href="${getImageUrl(report.image_path)}" target="_blank" class="btn btn-outline-info" title="Open Image">
                                    <i class="fas fa-image"></i>
                                </a>
                            ` : ''}
                            <button class="btn btn-outline-info" onclick="uploadProofOfFix('${report.id}')" title="Upload Proof of Fix">
                                <i class="fas fa-camera"></i> Upload Proof
                            </button>
                            <button class="btn btn-outline-danger" onclick="deleteReport('${report.id}', '${report.type}')" title="Delete Report">
                                <i class="fas fa-trash"></i> Delete
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
                            <h6>Reported Issue Image</h6>
                            <img src="${getImageUrl(report.image_path)}" 
                                 class="img-fluid rounded" 
                                 alt="Issue Image" 
                                 style="max-height: 500px; object-fit: contain; cursor: pointer;"
                                 onclick="window.open('${getImageUrl(report.image_path)}', '_blank')"
                                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3EImage not found%3C/text%3E%3C/svg%3E'">
                            <p class="small text-muted mt-2">Click image to open in new tab</p>
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

// Initialize map - Force recreation every time for proper rendering
function initializeMap() {
    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
        console.error('❌ Leaflet (L) is not defined! Library not loaded.');
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.innerHTML = '<div style="padding: 40px; text-align: center; color: #ef4444;"><h4>❌ Map Library Not Loaded</h4><p>Please refresh the page or check your internet connection.</p></div>';
        }
        return;
    }
    
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('❌ Map element not found!');
        return;
    }
    
    console.log('🗺️ Initializing Leaflet map...');
    
    try {
        // Destroy existing map if any
        if (map) {
            console.log('Removing existing map...');
            try {
                map.remove();
            } catch (e) {
                console.warn('Error removing old map:', e);
            }
            map = null;
        }
        
        // Clear the map div
        mapElement.innerHTML = '';
        
        // Create fresh map instance with explicit container sizing
        map = L.map('map', {
            center: [17.4065, 78.4772],
            zoom: 13,
            zoomControl: true,
            scrollWheelZoom: true,
            preferCanvas: false,
            // Force Leaflet to use explicit dimensions
            worldCopyJump: false,
            maxBounds: undefined
        });
        
        // Ensure the map container has proper dimensions immediately
        mapElement.style.height = '600px';
        mapElement.style.width = '100%';
        mapElement.style.minHeight = '600px';
        mapElement.style.display = 'block';
        
        console.log('✅ Map object created');
        
        // Simple, reliable tile layer
        const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 19,
            minZoom: 10,
            attribution: '© CARTO, © OpenStreetMap contributors'
        }).addTo(map);

        console.log('✅ CartoDB tile layer added');
        
        // Simple success logging
        tileLayer.on('tileload', function() {
            console.log('✅ Map tiles loaded successfully');
        });
        
        // Simple error logging (don't try to fix, just log)
        tileLayer.on('tileerror', function(e) {
            console.warn('⚠️ Tile loading error:', e);
        });
        
        console.log('✅ Tile layer added');
        
        // Add map legend
        const legend = L.control({position: 'bottomright'});
        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = `
                <div style="background: white; padding: 15px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                    <h6 style="margin: 0 0 10px 0; font-weight: 600;">Map Legend</h6>
                    <div style="font-size: 0.85rem;">
                        <div style="margin-bottom: 8px;">
                            <span style="display: inline-block; width: 15px; height: 15px; background: #10b981; border-radius: 50%; margin-right: 8px;"></span>
                            <strong>Low Severity</strong>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <span style="display: inline-block; width: 15px; height: 15px; background: #f59e0b; border-radius: 50%; margin-right: 8px;"></span>
                            <strong>Medium Severity</strong>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <span style="display: inline-block; width: 15px; height: 15px; background: #ef4444; border-radius: 50%; margin-right: 8px;"></span>
                            <strong>High/Critical</strong>
                        </div>
                        <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
                            <div style="margin-bottom: 5px;">
                                <span style="color: #3b82f6;">━━━</span> 
                                <strong style="font-size: 0.8rem;">Verification Zone (450m)</strong>
                            </div>
                            <small style="color: #666;">Citizens within this radius can verify issues</small>
                        </div>
                    </div>
                </div>
            `;
            return div;
        };
        legend.addTo(map);
        
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// Load map data
async function loadMapData() {
    try {
        console.log('🗺️ Loading map data...');
        
        // ALWAYS reinitialize map when section opens (fixes hidden div issue)
        console.log('Force re-initializing map...');
        initializeMap();
        
        // CRITICAL: Force map to recalculate size when container becomes visible
        const invalidateTimes = [100, 300, 600, 1000];
        invalidateTimes.forEach(delay => {
            setTimeout(() => {
                if (map) {
                    console.log(`Map size invalidated (${delay}ms)`);
                    map.invalidateSize();
                    
                    // Force a view reset to ensure proper rendering
                    if (delay === 100) {
                        map.setView([17.4065, 78.4772], 13, { animate: false });
                    }
                }
            }, delay);
        });
        
        // Additional fix: Force container to have proper dimensions
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.style.height = '600px';
            mapElement.style.width = '100%';
            mapElement.style.minHeight = '600px';
        }
        
        const response = await fetch(`${API_BASE_URL}/reports`);
        const data = await response.json();
        const reports = data.reports || data; // Handle v2 API format
        
        console.log(`📊 Found ${reports.length} reports to display on map`);
        
        // Clear existing markers and circles
        let cleared = 0;
        map.eachLayer(layer => {
            if (layer instanceof L.Marker || layer instanceof L.Circle) {
                map.removeLayer(layer);
                cleared++;
            }
        });
        console.log(`🧹 Cleared ${cleared} existing markers/circles`);
        
        // Add markers and verification radius for each report
        reports.forEach((report, index) => {
            console.log(`Adding marker ${index + 1}: ${report.type} at [${report.latitude}, ${report.longitude}]`);
            // Color-code marker by severity
            const markerColor = getSeverityMarkerColor(report.severity);
            
            // Create custom icon based on severity
            const customIcon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="background: ${markerColor}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                    ${getTypeEmoji(report.type)}
                </div>`,
                iconSize: [30, 30]
            });
            
            const marker = L.marker([report.latitude, report.longitude], {icon: customIcon})
                .addTo(map);
            
            // Add verification radius circle (450 meters) - VERY VISIBLE
            const verificationRadius = L.circle([report.latitude, report.longitude], {
                color: markerColor,
                fillColor: markerColor,
                fillOpacity: 0.25, // More visible
                opacity: 0.8,
                radius: 450, // 450 meters verification zone
                weight: 4,
                dashArray: '10, 5'
            }).addTo(map);
            
            console.log(`  ✅ Added 450m circle at [${report.latitude}, ${report.longitude}] with color ${markerColor}`);
            
            // Enhanced popup with voting
            const upvotes = report.upvotes || 0;
            const verifications = report.verification_count || 0;
            
            marker.bindPopup(`
                <div style="min-width: 250px;">
                    <h6 style="margin-bottom: 12px; color: #333;">
                        <strong>${getTypeEmoji(report.type)} ${formatTypeName(report.type)}</strong>
                    </h6>
                    
                    <div style="margin-bottom: 10px;">
                        <span class="badge ${getSeverityBadgeClass(report.severity)} severity-badge" style="margin-right: 5px;">
                            ${formatSeverityName(report.severity)}
                        </span>
                        <span class="badge ${getStatusBadgeClass(report.status)} status-badge">
                            ${formatStatusName(report.status)}
                        </span>
                    </div>
                    
                    <p style="margin: 8px 0; font-size: 0.9rem;">
                        <i class="fas fa-map-marker-alt" style="color: #ef4444;"></i> 
                        <strong>Location:</strong><br>
                        <span style="font-size: 0.85rem;">${report.address}</span>
                    </p>
                    
                    <p style="margin: 8px 0; font-size: 0.9rem;">
                        <i class="fas fa-clock" style="color: #3b82f6;"></i> 
                        <strong>Reported:</strong> ${formatDate(report.timestamp || report.created_at)}
                    </p>
                    
                    <div style="background: #f0f9ff; padding: 10px; border-radius: 8px; margin: 10px 0;">
                        <p style="margin: 0; font-size: 0.85rem; color: #1e40af;">
                            <i class="fas fa-circle-info"></i> 
                            <strong>Verification Zone:</strong> 450m radius<br>
                            <span style="font-size: 0.8rem;">Citizens within this area can verify</span>
                        </p>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                        <div>
                            <button onclick="uploadProofOfFix('${report.id}')" class="btn btn-sm" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; margin-right: 5px;">
                                <i class="fas fa-camera"></i> Upload Proof
                            </button>
                            <button onclick="deleteReport('${report.id}', '${report.type}')" class="btn btn-sm" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                    
                    ${report.image_path ? `
                        <div style="margin-top: 12px;">
                            <img src="${getImageUrl(report.image_path)}" 
                                 style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer;"
                                 onclick="window.open('${getImageUrl(report.image_path)}', '_blank')">
                        </div>
                    ` : ''}
                </div>
            `, {maxWidth: 300});
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

// Admin Functions - Voting removed (only for citizens)

// Upload proof of fix (admin only)
async function uploadProofOfFix(reportId) {
  // Step 1: Select image file
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Step 2: Get civic coins amount
    const civicCoins = prompt('Enter civic coins to award (default: 10):', '10');
    if (civicCoins === null) return; // User cancelled
    
    const coinsAmount = parseInt(civicCoins) || 10;
    
    // Step 3: Get resolution notes
    const resolutionNotes = prompt('Enter resolution notes (optional):', '') || '';
    
    // Step 4: Upload with confirmation
    const confirmed = confirm(`📸 UPLOAD PROOF OF FIX?\n\nReport ID: ${reportId}\nCivic Coins: ${coinsAmount}\nResolution: ${resolutionNotes || 'No notes'}\n\nThis will:\n• Mark report as RESOLVED ✅\n• Award ${coinsAmount} civic coins to the reporter 💰\n• Show as resolved (+1) in both dashboards\n• Keep report for tracking purposes\n\nProceed?`);
    
    if (!confirmed) return;
    
    const formData = new FormData();
    formData.append('pof_image', file);
    formData.append('resolution_notes', resolutionNotes);
    formData.append('civic_coins', coinsAmount);
    
    try {
      console.log(`📸 Uploading proof of fix for report: ${reportId}`);
      
      const response = await fetch(`${API_BASE_URL}/reports/${reportId}/pof`, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`🎉 PROOF OF FIX UPLOADED SUCCESSFULLY!\n\n✅ Report ID: ${reportId}\n💰 Civic Coins Awarded: ${coinsAmount}\n📝 Resolution: ${resolutionNotes || 'No notes provided'}\n🏆 Report Status: RESOLVED\n\nThe reporter has received ${coinsAmount} civic coins!\n\nThe issue is now marked as resolved (+1) and will show in both dashboards with the proof of fix image.`);
        
        // Refresh all data
        loadMapData();
        loadReports();
        loadDashboardData();
        
      } else {
        alert('❌ Upload failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error uploading proof of fix:', error);
      alert('❌ Error uploading proof of fix: ' + error.message);
    }
  };
  
  fileInput.click();
}

// Delete a report (admin only)
async function deleteReport(reportId, reportType) {
    // Show confirmation dialog
    const confirmed = confirm(`🗑️ DELETE REPORT CONFIRMATION\n\nAre you sure you want to delete this ${reportType} report?\n\nThis action cannot be undone and will:\n• Remove the report from the system\n• Delete all related votes and verifications\n• Remove it from citizen maps\n• Log the deletion in activity history`);
    
    if (!confirmed) return;

    // Get deletion reason
    const reason = prompt('Please provide a reason for deletion (optional):', 'Admin decision');
    if (reason === null) return; // User cancelled

    try {
        console.log(`🗑️ Admin deleting report: ${reportId}, reason: ${reason}`);
        
        const response = await fetch(`${API_BASE_URL}/reports/${reportId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reason: reason || 'Admin decision'
            })
        });

        const result = await response.json();
        
        if (result.success) {
            // Show success message
            alert(`✅ REPORT DELETED SUCCESSFULLY!\n\nReport ID: ${reportId}\nType: ${reportType}\nReason: ${reason || 'Admin decision'}\n\nThis report has been removed from:\n• Admin dashboard\n• Citizen maps\n• All related data`);
            
            // Refresh all data
            loadMapData();
            loadReports();
            loadDashboardData();
            
        } else {
            alert('❌ ' + (result.error || 'Failed to delete report'));
        }
    } catch (error) {
        console.error('Error deleting report:', error);
        alert('❌ Error deleting report: ' + error.message);
    }
}

// Map Helper Functions
function getSeverityMarkerColor(severity) {
    const colors = {
        'low': '#10b981',      // Green
        'medium': '#f59e0b',   // Orange
        'high': '#ef4444',     // Red
        'critical': '#dc2626'  // Dark Red
    };
    return colors[severity] || '#6b7280';
}

function getTypeEmoji(type) {
    const emojis = {
        'pothole': '🕳️',
        'trash': '🗑️',
        'graffiti': '🎨',
        'streetlight': '💡',
        'broken_sidewalk': '🚧',
        'damaged_sign': '🚸',
        'water_leak': '💧',
        'other': '📍'
    };
    return emojis[type] || '📍';
}

// Utility functions
function getImageUrl(imagePath) {
    if (!imagePath) return '';
    
    // Handle absolute paths (old format)
    if (imagePath.startsWith('/Users/') || imagePath.startsWith('C:\\')) {
        const filename = imagePath.split('/').pop();
        return `http://localhost:3000/uploads/${filename}`;
    }
    
    // Handle relative paths starting with uploads/ (new format)
    if (imagePath.startsWith('uploads/')) {
        return `http://localhost:3000/${imagePath}`;
    }
    
    // Handle paths without uploads/ prefix
    return `http://localhost:3000/uploads/${imagePath}`;
}

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
    // Simple error display - no bootstrap dependency
    console.error('Error:', message);
    alert('⚠️ Error: ' + message);
}
