// BuildFlow Construction Manager - Core JS Application

// --- APPLICATION STATE ---
let STATE = {
  jobs: [],
  workers: [], // crew repository
  activeJobId: null,
  activeInvoiceId: null,
  theme: "dark",
  filters: {
    search: "",
    status: "all",
    sort: "newest"
  },
  currentInvoiceItems: [], // temp items for currently edited invoice
  
  // Cloud & Subscriptions additions
  userSession: null, // logged-in user profile if active, otherwise null
  subscriptionPlan: "free", // 'free', 'pro', or 'enterprise'
  partnerLogoUrl: "", // custom contractor banner logo URL
  supabaseUrl: "", // custom supabase cloud project API URL
  supabaseAnonKey: "" // custom supabase anon key
};

// Supabase client instance (initialized on demand if credentials provided)
let supabaseClient = null;



// --- WORKER Crew Repository ---
const SEED_WORKERS = [];

// --- REALISTIC SEED DATA ---
const SEED_JOBS = [];

// --- INITIALIZE APPLICATION ---
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  initTheme();
  initEventListeners();
  checkAuthSession();
  renderStats();
  renderJobs();
  renderPartnerMarquee();
  lucide.createIcons();
});

// --- PERSISTENCE ---
async function loadData() {
  // Load Session details
  STATE.userSession = localStorage.getItem("buildflow_session") ? JSON.parse(localStorage.getItem("buildflow_session")) : null;
  STATE.subscriptionPlan = localStorage.getItem("buildflow_plan") || "free";
  STATE.partnerLogoUrl = localStorage.getItem("buildflow_logo") || "";
  STATE.supabaseUrl = localStorage.getItem("buildflow_supabase_url") || "";
  STATE.supabaseAnonKey = localStorage.getItem("buildflow_supabase_key") || "";

  // Connect to real Supabase client if configured
  if (STATE.supabaseUrl && STATE.supabaseAnonKey) {
    try {
      supabaseClient = supabase.createClient(STATE.supabaseUrl, STATE.supabaseAnonKey);
      console.log("Supabase Client initialized successfully.");
      
      // Fetch public partners and jobs from Supabase so all customers can see them
      await loadFromSupabase();
    } catch(err) {
      console.error("Failed to initialize Supabase client:", err);
    }
  }

  // Load from local storage if supabase didn't load or as fallback
  if (!STATE.jobs || STATE.jobs.length === 0) {
    const localJobs = localStorage.getItem("buildflow_jobs");
    if (!localJobs) {
      STATE.jobs = SEED_JOBS;
      saveData();
    } else {
      STATE.jobs = JSON.parse(localJobs);
    }
  }

  if (!STATE.workers || STATE.workers.length === 0) {
    const localWorkers = localStorage.getItem("buildflow_workers");
    if (!localWorkers) {
      STATE.workers = SEED_WORKERS;
      localStorage.setItem("buildflow_workers", JSON.stringify(SEED_WORKERS));
    } else {
      STATE.workers = JSON.parse(localWorkers);
    }
  }
  
  updateSubscriptionUI();
}

async function loadFromSupabase() {
  try {
    // 1. Fetch public partner logos so that all customers see all certified partners
    const { data: partnerData, error: partnerError } = await supabaseClient
      .from('buildflow_partners')
      .select('*');
      
    if (!partnerError && partnerData) {
      STATE.registeredPartners = partnerData.map(p => ({
        name: p.name,
        logo: p.logo_url
      }));
      console.log("Loaded registered partners from Supabase:", STATE.registeredPartners);
    }

    // 2. Fetch jobs if logged in
    if (STATE.userSession) {
      const { data: jobsData, error: jobsError } = await supabaseClient
        .from('buildflow_jobs')
        .select('*')
        .eq('id', STATE.userSession.id);
        
      if (!jobsError && jobsData && jobsData.length > 0) {
        STATE.jobs = jobsData[0].jobs || [];
        console.log("Loaded jobs from Supabase successfully:", STATE.jobs);
      }
    }
  } catch (err) {
    console.warn("Supabase fetch failed (falling back to offline mode):", err);
  }
}

function saveData() {
  localStorage.setItem("buildflow_jobs", JSON.stringify(STATE.jobs));
  localStorage.setItem("buildflow_workers", JSON.stringify(STATE.workers));
  localStorage.setItem("buildflow_session", STATE.userSession ? JSON.stringify(STATE.userSession) : "");
  localStorage.setItem("buildflow_plan", STATE.subscriptionPlan);
  localStorage.setItem("buildflow_logo", STATE.partnerLogoUrl);
  localStorage.setItem("buildflow_supabase_url", STATE.supabaseUrl);
  localStorage.setItem("buildflow_supabase_key", STATE.supabaseAnonKey);
  
  // Sync to Supabase in background if enabled
  syncToSupabaseCloud();
}

// --- THEME MANAGEMENT ---
function initTheme() {
  const storedTheme = localStorage.getItem("buildflow_theme");
  if (storedTheme) {
    STATE.theme = storedTheme;
  }
  document.documentElement.setAttribute("data-theme", STATE.theme);
  updateThemeIcon();
}

function toggleTheme() {
  STATE.theme = STATE.theme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", STATE.theme);
  localStorage.setItem("buildflow_theme", STATE.theme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById("theme-toggle-btn");
  if (STATE.theme === "dark") {
    btn.innerHTML = `<i data-lucide="sun"></i>`;
  } else {
    btn.innerHTML = `<i data-lucide="moon"></i>`;
  }
  lucide.createIcons();
}

// --- EVENT LISTENERS ---
function initEventListeners() {
  // Theme Toggle
  document.getElementById("theme-toggle-btn").addEventListener("click", toggleTheme);

  // Search & Filters
  document.getElementById("search-input").addEventListener("input", (e) => {
    STATE.filters.search = e.target.value.toLowerCase();
    renderJobs();
  });

  document.getElementById("status-filter").addEventListener("change", (e) => {
    STATE.filters.status = e.target.value;
    renderJobs();
  });

  document.getElementById("sort-filter").addEventListener("change", (e) => {
    STATE.filters.sort = e.target.value;
    renderJobs();
  });

  // Add Job Drawer Triggers
  document.getElementById("add-job-btn").addEventListener("click", () => openJobDrawer());
  document.getElementById("job-drawer-close").addEventListener("click", closeJobDrawer);
  document.getElementById("job-form-cancel").addEventListener("click", closeJobDrawer);
  document.getElementById("job-form-submit").addEventListener("click", submitJobForm);

  // Detail Drawer Triggers
  document.getElementById("details-close").addEventListener("click", closeDetailsDrawer);
  document.getElementById("details-close-btn").addEventListener("click", closeDetailsDrawer);
  document.getElementById("btn-edit-job").addEventListener("click", handleEditActiveJob);
  document.getElementById("btn-delete-job").addEventListener("click", handleDeleteActiveJob);

  // Tab Navigation inside details drawer
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      
      e.target.classList.add("active");
      const tabId = e.target.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");
    });
  });

  // Invoice Drawer Triggers
  document.getElementById("btn-create-invoice").addEventListener("click", () => openInvoiceDrawer());
  document.getElementById("invoice-drawer-close").addEventListener("click", closeInvoiceDrawer);
  document.getElementById("invoice-drawer-cancel").addEventListener("click", closeInvoiceDrawer);
  document.getElementById("invoice-drawer-submit").addEventListener("click", submitInvoiceForm);

  // Catalog picker search logic
  document.getElementById("catalog-search").addEventListener("input", (e) => {
    renderCatalogResults(e.target.value);
  });
  document.getElementById("btn-clear-search").addEventListener("click", () => {
    document.getElementById("catalog-search").value = "";
    renderCatalogResults("");
  });

  // Custom product adding triggers
  document.getElementById("add-custom-material-trigger").addEventListener("click", () => {
    const panel = document.getElementById("custom-product-form-panel");
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  });
  document.getElementById("btn-custom-cancel").addEventListener("click", () => {
    document.getElementById("custom-product-form-panel").style.display = "none";
  });
  document.getElementById("btn-custom-save").addEventListener("click", handleSaveCustomMaterial);

  // Calculation updates on input change
  document.getElementById("invoice-labor-rate").addEventListener("input", calculateTotals);
  document.getElementById("invoice-markup-rate").addEventListener("input", calculateTotals);
  document.getElementById("invoice-tax-rate").addEventListener("input", calculateTotals);

  // Crew & Milestone Action Listeners
  document.getElementById("btn-assign-crew-member").addEventListener("click", handleAssignCrewMember);
  document.getElementById("btn-add-milestone").addEventListener("click", handleAddMilestone);

  // Contract Signature & Prints
  document.getElementById("btn-sign-client").addEventListener("click", handleSignClient);
  document.getElementById("btn-sign-contractor").addEventListener("click", handleSignContractor);
  document.getElementById("btn-print-contract").addEventListener("click", handlePrintContract);
  document.getElementById("contract-scope-textarea").addEventListener("input", handleUpdateContractScope);

  // Cloud & Subscriptions Drawer triggers
  document.getElementById("cloud-settings-btn").addEventListener("click", openCloudDrawer);
  document.getElementById("cloud-drawer-close").addEventListener("click", closeCloudDrawer);
  document.getElementById("cloud-drawer-close-btn").addEventListener("click", closeCloudDrawer);

  // Auth Overlay triggers
  document.getElementById("auth-form").addEventListener("submit", handleAuthSubmit);
  document.getElementById("btn-offline-sandbox").addEventListener("click", handleBypassAuth);
  
  document.getElementById("btn-auth-login").addEventListener("click", () => toggleAuthMode(true));
  document.getElementById("btn-auth-signup").addEventListener("click", () => toggleAuthMode(false));
  
  document.getElementById("enable-supabase-chk").addEventListener("change", (e) => {
    const configInputs = document.getElementById("supabase-config-inputs");
    configInputs.style.display = e.target.checked ? "flex" : "none";
  });

  // Subscription plan selections
  document.getElementById("btn-select-free").addEventListener("click", () => handleSelectPlan("free"));
  document.getElementById("btn-select-pro").addEventListener("click", () => handleSelectPlan("pro"));
  document.getElementById("btn-select-enterprise").addEventListener("click", () => handleSelectPlan("enterprise"));

  // Promo Code trigger
  document.getElementById("btn-apply-promo").addEventListener("click", handleApplyPromoCode);

  // Partner Logo trigger
  document.getElementById("btn-save-partner-logo").addEventListener("click", handleSavePartnerLogo);

  // Developer Sandbox controls
  document.getElementById("btn-clear-mock-data").addEventListener("click", handleClearMockData);
}

// --- RENDER STATISTICS ---
function renderStats() {
  const totalJobs = STATE.jobs.length;
  const totalCrew = STATE.workers.length;
  const totalCatalogItems = getCatalog().length;
  
  let totalInvoices = 0;
  STATE.jobs.forEach(job => {
    totalInvoices += (job.invoices || []).length;
  });

  document.getElementById("stat-active-jobs").textContent = totalJobs;
  document.getElementById("stat-total-revenue").textContent = totalCrew;
  document.getElementById("stat-outstanding").textContent = totalCatalogItems;
  document.getElementById("stat-collected").textContent = totalInvoices;
}

// --- RENDERING JOBS ---
function renderJobs() {
  const container = document.getElementById("jobs-grid-container");
  container.innerHTML = "";

  // 1. Filter jobs
  let filtered = STATE.jobs.filter(job => {
    const searchMatch = 
      job.title.toLowerCase().includes(STATE.filters.search) || 
      job.address.toLowerCase().includes(STATE.filters.search) || 
      job.client.name.toLowerCase().includes(STATE.filters.search);
      
    const statusMatch = STATE.filters.status === "all" || job.status === STATE.filters.status;
    
    return searchMatch && statusMatch;
  });

  // 2. Sort jobs
  filtered.sort((a, b) => {
    if (STATE.filters.sort === "newest") {
      return 1; // standard append fallback
    } else if (STATE.filters.sort === "oldest") {
      return -1;
    } else if (STATE.filters.sort === "value-high") {
      return (b.budget || 0) - (a.budget || 0);
    } else if (STATE.filters.sort === "value-low") {
      return (a.budget || 0) - (b.budget || 0);
    }
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="hard-hat"></i>
        <h3 class="empty-state-title">No Construction Jobs Found</h3>
        <p class="empty-state-text">Get started by creating a new job or modifying your search parameters.</p>
        <button class="btn btn-primary btn-sm" onclick="openJobDrawer()"><i data-lucide="plus"></i> Add Job</button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  filtered.forEach(job => {
    // Calculate total materials budget vs labor & markup
    let totalInvoiced = 0;
    (job.invoices || []).forEach(inv => {
      totalInvoiced += getInvoiceFinancialTotals(inv).grandTotal;
    });

    const percent = Math.min(100, Math.round((totalInvoiced / (job.budget || 1)) * 100));

    const card = document.createElement("div");
    card.className = `job-card ${job.status}`;
    card.innerHTML = `
      <div class="job-card-header">
        <div class="job-title-group">
          <span class="job-title">${escapeHTML(job.title)}</span>
          <span class="job-client"><i data-lucide="user"></i> ${escapeHTML(job.client.name)}</span>
        </div>
        <span class="badge ${job.status}">${job.status.replace("-", " ")}</span>
      </div>
      <div class="job-card-body">
        <div class="job-meta-row">
          <i data-lucide="map-pin"></i>
          <span class="job-address">${escapeHTML(job.address)}</span>
        </div>
        <p class="job-description-teaser">${escapeHTML(job.description || "No project notes provided.")}</p>
        
        <div class="job-financial-progress">
          <div class="financial-bar-label">
            <span class="label">Invoiced Budget Draw</span>
            <span class="amount">${formatCurrency(totalInvoiced)} / ${formatCurrency(job.budget)}</span>
          </div>
          <div class="progress-track">
            <div class="progress-bar" style="width: ${percent}%;"></div>
          </div>
        </div>
      </div>
      <div class="job-card-footer">
        <span class="invoice-count"><i data-lucide="receipt"></i> ${job.invoices ? job.invoices.length : 0} Invoices</span>
        <button class="btn btn-secondary btn-sm" onclick="openDetailsDrawer('${job.id}')">View Details</button>
      </div>
    `;
    container.appendChild(card);
  });
  
  lucide.createIcons();
}

// --- JOB DRAWER CONTROL (ADD/EDIT) ---
function openJobDrawer(jobId = null) {
  const backdrop = document.getElementById("job-drawer-backdrop");
  const title = document.getElementById("job-drawer-title");
  const form = document.getElementById("job-form");
  form.reset();

  // Load and render Crew Checkboxes
  const checkboxGrid = document.getElementById("job-form-crew-checkboxes");
  checkboxGrid.innerHTML = "";
  
  let assignedIds = [];
  if (jobId) {
    const job = STATE.jobs.find(j => j.id === jobId);
    title.textContent = "Edit Construction Job";
    document.getElementById("job-id-field").value = job.id;
    document.getElementById("job-title-field").value = job.title;
    document.getElementById("job-desc-field").value = job.description;
    document.getElementById("job-address-field").value = job.address;
    document.getElementById("job-status-field").value = job.status;
    document.getElementById("job-budget-field").value = job.budget;
    document.getElementById("job-client-name").value = job.client.name;
    document.getElementById("job-client-email").value = job.client.email;
    document.getElementById("job-client-phone").value = job.client.phone;
    document.getElementById("job-start-date").value = job.dates.start || "";
    document.getElementById("job-end-date").value = job.dates.end || "";
    
    assignedIds = job.assignedCrew || [];
  } else {
    title.textContent = "Add Construction Job";
    document.getElementById("job-id-field").value = "";
    document.getElementById("job-start-date").value = "";
    document.getElementById("job-end-date").value = "";
  }

  STATE.workers.forEach(w => {
    const isChecked = assignedIds.includes(w.id) ? "checked" : "";
    const label = document.createElement("label");
    label.className = "crew-checkbox-label";
    label.innerHTML = `
      <input type="checkbox" name="job-crew" value="${w.id}" ${isChecked}>
      <span>${escapeHTML(w.name)} (${escapeHTML(w.role)})</span>
    `;
    checkboxGrid.appendChild(label);
  });

  backdrop.classList.add("active");
}

function closeJobDrawer() {
  document.getElementById("job-drawer-backdrop").classList.remove("active");
}

function submitJobForm(e) {
  e.preventDefault();
  
  const jobId = document.getElementById("job-id-field").value;
  const title = document.getElementById("job-title-field").value;
  const desc = document.getElementById("job-desc-field").value;
  const address = document.getElementById("job-address-field").value;
  let status = document.getElementById("job-status-field").value;
  const budget = parseFloat(document.getElementById("job-budget-field").value || 0);
  const clientName = document.getElementById("job-client-name").value;
  const clientEmail = document.getElementById("job-client-email").value;
  const clientPhone = document.getElementById("job-client-phone").value;
  const startDate = document.getElementById("job-start-date").value;
  const endDate = document.getElementById("job-end-date").value;

  // Retrieve crew selection
  const checkboxes = document.querySelectorAll('input[name="job-crew"]:checked');
  const assignedCrew = Array.from(checkboxes).map(cb => cb.value);

  if (!title || !address || !clientName) {
    alert("Please fill in all required fields marked with *");
    return;
  }

  // --- AUTOMATE STATUS BASED ON DATES ---
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  if (!startDate && !endDate) {
    status = "on-hold";
  } else if (startDate && startDate > todayStr) {
    if (status === "in-progress") {
      status = "planned";
    }
  }

  if (jobId) {
    // Edit existing
    const index = STATE.jobs.findIndex(j => j.id === jobId);
    STATE.jobs[index] = {
      ...STATE.jobs[index],
      title,
      description: desc,
      address,
      status,
      budget,
      client: { name: clientName, email: clientEmail, phone: clientPhone },
      dates: { start: startDate, end: endDate },
      assignedCrew
    };
  } else {
    // Add new - Enforce Free tier limit
    if (STATE.subscriptionPlan === "free" && STATE.jobs.length >= 1) {
      alert("The Free Sandbox tier is limited to 1 active construction project. Upgrade your plan inside Cloud Settings to unlock unlimited active projects, milestone schedules, and legal contracting!");
      return;
    }

    const newJob = {
      id: "job_" + Date.now(),
      title,
      description: desc,
      address,
      status,
      budget,
      client: { name: clientName, email: clientEmail, phone: clientPhone },
      dates: { start: startDate, end: endDate },
      assignedCrew,
      milestones: [
        { id: "m_" + Date.now() + "_1", title: "Project Initialized", date: startDate || todayStr, status: "completed" },
        { id: "m_" + Date.now() + "_2", title: "Site Foundation Assessment", date: startDate || todayStr, status: "pending" }
      ],
      contract: {
        scope: desc || "Initial scope of work under discussion...",
        clientSigned: "",
        contractorSigned: "",
        signedDate: ""
      },
      invoices: []
    };
    STATE.jobs.push(newJob);
  }

  saveData();
  renderStats();
  renderJobs();
  closeJobDrawer();
  
  if (STATE.activeJobId === jobId && jobId) {
    // Refresh details if editing from details view
    openDetailsDrawer(jobId);
  }
}

// --- DETAILS DRAWER CONTROL ---
function openDetailsDrawer(jobId) {
  STATE.activeJobId = jobId;
  const job = STATE.jobs.find(j => j.id === jobId);
  
  // Set drawer titles
  document.getElementById("details-title").textContent = job.title;
  document.getElementById("details-subtitle").textContent = `Job Site: ${job.address}`;

  // Tab 1: Overview Profile Details
  document.getElementById("details-client-name").textContent = job.client.name;
  document.getElementById("details-client-email").textContent = job.client.email || "No email";
  document.getElementById("details-client-phone").textContent = job.client.phone || "No phone number";
  document.getElementById("details-start-date").textContent = formatDate(job.dates.start);
  document.getElementById("details-end-date").textContent = formatDate(job.dates.end);
  document.getElementById("details-description").textContent = job.description || "No project description provided.";

  // Set Address maps label
  document.getElementById("map-address-label").textContent = `Satellite Coordinates: ${job.address}`;

  // Reset detail tab active class
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  document.querySelector('.tab-btn[data-tab="tab-overview"]').classList.add("active");
  document.getElementById("tab-overview").classList.add("active");

  // Render Crew & Milestones & Invoices & Contract
  renderCrewTab(job);
  renderMilestonesTimeline(job);
  renderContractTab(job);
  renderJobInvoices(job);

  // Render Satellite Map Canvas
  drawSiteMap(job.address);

  // Show Details Drawer
  document.getElementById("details-drawer-backdrop").classList.add("active");
}

function closeDetailsDrawer() {
  document.getElementById("details-drawer-backdrop").classList.remove("active");
  STATE.activeJobId = null;
}

function handleEditActiveJob() {
  if (STATE.activeJobId) {
    openJobDrawer(STATE.activeJobId);
  }
}

function handleDeleteActiveJob() {
  if (STATE.activeJobId && confirm("Are you absolutely sure you want to delete this construction job? This action will permanently remove all associated invoices and project data!")) {
    STATE.jobs = STATE.jobs.filter(j => j.id !== STATE.activeJobId);
    saveData();
    renderStats();
    renderJobs();
    closeDetailsDrawer();
  }
}

// --- MOCK GEOLOCATION & SAT MAP CANVAS DRAWING ---
function drawSiteMap(address) {
  const canvas = document.getElementById("site-map-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  // Set dimensions correctly
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = 220;

  // Simple string hash to generate deterministically realistic map coordinate layout based on address
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Set seed values
  const dotCount = 15;
  const seedX = Math.abs((hash >> 2) % (canvas.width - 100)) + 50;
  const seedY = Math.abs((hash >> 4) % (canvas.height - 80)) + 40;
  
  // Draw layout backgrounds (blueprint grid mode)
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw grid layout lines
  ctx.strokeStyle = "rgba(51, 65, 85, 0.4)";
  ctx.lineWidth = 1;
  const gridSize = 20;
  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw concentric range rings around site location
  ctx.strokeStyle = "rgba(249, 115, 22, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(seedX, seedY, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(seedX, seedY, 80, 0, Math.PI * 2);
  ctx.stroke();

  // Draw simulated buildings (rectangles) around site
  ctx.fillStyle = "rgba(148, 163, 184, 0.1)";
  ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
  ctx.lineWidth = 1.5;

  const buildingSeeds = [
    { x: seedX - 100, y: seedY - 50, w: 40, h: 60 },
    { x: seedX + 70, y: seedY - 60, w: 50, h: 45 },
    { x: seedX - 80, y: seedY + 40, w: 70, h: 30 },
    { x: seedX + 60, y: seedY + 30, w: 40, h: 50 }
  ];

  buildingSeeds.forEach(b => {
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  });

  // Draw Construction Plot Outline (orange)
  ctx.fillStyle = "rgba(249, 115, 22, 0.08)";
  ctx.strokeStyle = "rgba(249, 115, 22, 0.6)";
  ctx.lineWidth = 2;
  const plotWidth = 60;
  const plotHeight = 50;
  ctx.fillRect(seedX - plotWidth/2, seedY - plotHeight/2, plotWidth, plotHeight);
  ctx.strokeRect(seedX - plotWidth/2, seedY - plotHeight/2, plotWidth, plotHeight);
  
  // Highlight construction center with crosshairs
  ctx.strokeStyle = "rgba(249, 115, 22, 0.7)";
  ctx.beginPath();
  ctx.moveTo(seedX - 15, seedY);
  ctx.lineTo(seedX + 15, seedY);
  ctx.moveTo(seedX, seedY - 15);
  ctx.lineTo(seedX, seedY + 15);
  ctx.stroke();

  // Draw Glowing Construction Pin
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.arc(seedX, seedY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Draw radar sweep animations in text form and mock weather conditions
  const weatherIndex = Math.abs(hash % 3);
  const temps = [74, 62, 55];
  const conditions = ["74°F - Clear / Safety Index 98%", "62°F - Overcast / Safety Index 92%", "55°F - Showers / Safety Index 84%"];
  const weatherIcons = ["sun", "cloud", "cloud-rain"];
  
  document.getElementById("weather-temp").textContent = conditions[weatherIndex];
  document.getElementById("weather-status").textContent = `Site Coord Hash: [Lat: ${((hash % 90) + 0.123).toFixed(4)}, Long: ${((hash % 180) - 0.456).toFixed(4)}]`;
  
  const wIcon = document.getElementById("weather-icon");
  wIcon.setAttribute("data-lucide", weatherIcons[weatherIndex]);
  lucide.createIcons();
}

// --- INVOICES MANAGEMENT RENDERING ---
function renderJobInvoices(job) {
  const container = document.getElementById("job-invoices-list");
  container.innerHTML = "";

  const invoices = job.invoices || [];

  if (invoices.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 2.5rem; border: 1px dashed var(--border-color-light); border-radius: var(--border-radius-md); background-color: var(--accent-tint);">
        <i data-lucide="receipt" style="width:36px; height:36px; color:var(--text-muted); margin-bottom:0.75rem;"></i>
        <h4 style="font-family:var(--font-family-title); font-size:1rem; margin-bottom:0.25rem;">No Invoices or Estimates Drafted</h4>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem;">Add supplies, lumber, hours, and materials for this job site.</p>
        <button class="btn btn-primary btn-sm" onclick="openInvoiceDrawer()"><i data-lucide="plus"></i> Draft First Invoice</button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  invoices.forEach(inv => {
    const totals = getInvoiceFinancialTotals(inv);

    const card = document.createElement("div");
    card.className = "job-invoice-card";
    card.innerHTML = `
      <div class="invoice-card-details">
        <span class="invoice-number-label">${inv.invoiceNum}</span>
        <span class="invoice-date">Issued: ${formatDate(inv.date)}</span>
      </div>
      <div class="invoice-summary-stats">
        <span class="badge ${inv.status}">${inv.status}</span>
        <span class="invoice-value-total">${formatCurrency(totals.grandTotal)}</span>
        <div style="display:flex; gap:0.25rem;">
          <button class="btn btn-secondary btn-sm" style="padding:0.35rem 0.6rem;" onclick="openInvoiceDrawer('${inv.id}')" title="Edit Invoice"><i data-lucide="edit-3" style="width:14px; height:14px;"></i></button>
          <button class="btn btn-success btn-sm" style="padding:0.35rem 0.6rem;" onclick="triggerPrintInvoice('${job.id}', '${inv.id}')" title="Print / Export PDF"><i data-lucide="printer" style="width:14px; height:14px;"></i></button>
          <button class="btn btn-danger btn-sm" style="padding:0.35rem 0.6rem;" onclick="handleDeleteInvoice('${job.id}', '${inv.id}')" title="Delete Invoice"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
  
  lucide.createIcons();
}

function handleDeleteInvoice(jobId, invId) {
  if (confirm("Are you sure you want to delete this invoice? This will wipe structural material items lists and labor subtotals.")) {
    const jobIndex = STATE.jobs.findIndex(j => j.id === jobId);
    STATE.jobs[jobIndex].invoices = STATE.jobs[jobIndex].invoices.filter(i => i.id !== invId);
    
    saveData();
    renderStats();
    renderJobs();
    openDetailsDrawer(jobId); // Refresh details pane
    
    // Switch back to tab-invoices
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    document.getElementById("tab-invoices-btn").classList.add("active");
    document.getElementById("tab-invoices").classList.add("active");
  }
}

// --- INVOICE BUILDER DRAWER CONTROL ---
function openInvoiceDrawer(invoiceId = null) {
  const backdrop = document.getElementById("invoice-drawer-backdrop");
  const title = document.getElementById("invoice-drawer-title");
  
  // Clear picker search
  document.getElementById("catalog-search").value = "";
  renderCatalogResults("");
  document.getElementById("custom-product-form-panel").style.display = "none";
  
  // Retrieve job context
  const job = STATE.jobs.find(j => j.id === STATE.activeJobId);
  
  if (invoiceId) {
    // Edit existing invoice
    const inv = job.invoices.find(i => i.id === invoiceId);
    title.textContent = `Edit Invoice ${inv.invoiceNum}`;
    STATE.activeInvoiceId = inv.id;
    
    document.getElementById("invoice-id-field").value = inv.id;
    document.getElementById("invoice-num-field").value = inv.invoiceNum;
    document.getElementById("invoice-status-field").value = inv.status;
    document.getElementById("invoice-date-field").value = inv.date;
    document.getElementById("invoice-labor-rate").value = inv.labor || 0;
    document.getElementById("invoice-markup-rate").value = inv.markup || 10;
    document.getElementById("invoice-tax-rate").value = inv.tax || 8;
    
    STATE.currentInvoiceItems = JSON.parse(JSON.stringify(inv.items || []));
  } else {
    // Draft new invoice
    const invNum = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
    title.textContent = `Draft Invoice for ${job.title}`;
    STATE.activeInvoiceId = null;
    
    document.getElementById("invoice-id-field").value = "";
    document.getElementById("invoice-num-field").value = invNum;
    document.getElementById("invoice-status-field").value = "draft";
    document.getElementById("invoice-date-field").value = new Date().toISOString().split('T')[0];
    document.getElementById("invoice-labor-rate").value = 0;
    document.getElementById("invoice-markup-rate").value = 10;
    document.getElementById("invoice-tax-rate").value = 8;
    
    STATE.currentInvoiceItems = [];
  }

  renderInvoiceTableItems();
  calculateTotals();
  backdrop.classList.add("active");
}

function closeInvoiceDrawer() {
  document.getElementById("invoice-drawer-backdrop").classList.remove("active");
  STATE.activeInvoiceId = null;
}

// --- RENDER DYNAMIC CATALOG PICKER ---
function renderCatalogResults(query = "") {
  const container = document.getElementById("catalog-results-container");
  container.innerHTML = "";

  const products = getCatalog();
  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) || 
    p.category.toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.8rem;">No products match query. Add a custom product below!</div>`;
    return;
  }

  filtered.forEach(p => {
    const row = document.createElement("div");
    row.className = "catalog-item-row";
    row.innerHTML = `
      <div class="catalog-item-info">
        <span class="catalog-item-name">${escapeHTML(p.name)}</span>
        <span class="catalog-item-cat">${p.category} | unit: ${p.unit}</span>
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span class="catalog-item-rate">${formatCurrency(p.basePrice)}</span>
        <button type="button" class="btn btn-primary btn-sm" style="padding:0.25rem 0.5rem;" onclick="addMaterialToInvoice('${p.id}')">Add</button>
      </div>
    `;
    container.appendChild(row);
  });
}

function addMaterialToInvoice(productId) {
  const products = getCatalog();
  const prod = products.find(p => p.id === productId);
  
  if (!prod) return;

  // Check if item is already added to invoice
  const existing = STATE.currentInvoiceItems.find(item => item.name === prod.name);
  if (existing) {
    existing.qty += 1;
  } else {
    STATE.currentInvoiceItems.push({
      name: prod.name,
      qty: 1,
      rate: prod.basePrice,
      unit: prod.unit
    });
  }

  renderInvoiceTableItems();
  calculateTotals();
}

function handleSaveCustomMaterial() {
  const name = document.getElementById("custom-prod-name").value;
  const category = document.getElementById("custom-prod-category").value;
  const unit = document.getElementById("custom-prod-unit").value;
  const basePrice = parseFloat(document.getElementById("custom-prod-price").value || 0);

  if (!name || !unit || isNaN(basePrice) || basePrice < 0) {
    alert("Please enter valid product details (Name, Unit, and Price)");
    return;
  }

  // Save to persistent catalog
  const newProd = addCustomCatalogProduct(name, category, unit, basePrice);
  
  // Add directly to active invoice items list
  STATE.currentInvoiceItems.push({
    name: newProd.name,
    qty: 1,
    rate: newProd.basePrice,
    unit: newProd.unit
  });

  // Clear inputs
  document.getElementById("custom-prod-name").value = "";
  document.getElementById("custom-prod-unit").value = "";
  document.getElementById("custom-prod-price").value = "";
  document.getElementById("custom-product-form-panel").style.display = "none";

  renderCatalogResults("");
  renderInvoiceTableItems();
  calculateTotals();
}

// --- RENDERING INVOICED ITEMS ROWS ---
function renderInvoiceTableItems() {
  const tbody = document.getElementById("invoice-items-tbody");
  tbody.innerHTML = "";

  if (STATE.currentInvoiceItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 1.5rem; color:var(--text-muted);">
          No material lines added. Select common structural materials from the catalog above.
        </td>
      </tr>
    `;
    return;
  }

  STATE.currentInvoiceItems.forEach((item, index) => {
    const rowTotal = item.qty * item.rate;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong style="color:var(--text-main); font-size:0.85rem;">${escapeHTML(item.name)}</strong></td>
      <td>
        <input type="number" class="input-field" style="padding:0.35rem 0.5rem; text-align:center;" min="0.1" value="${item.qty}" step="any" onchange="updateItemQty(${index}, this.value)">
      </td>
      <td>
        <input type="number" class="input-field" style="padding:0.35rem 0.5rem;" min="0" value="${item.rate}" step="0.01" onchange="updateItemRate(${index}, this.value)">
      </td>
      <td style="color:var(--text-muted); font-size:0.8rem; text-align:center;">${escapeHTML(item.unit)}</td>
      <td class="row-total">${formatCurrency(rowTotal)}</td>
      <td class="actions">
        <button type="button" class="btn btn-danger btn-sm" style="padding:0.25rem 0.4rem; background:transparent; border:none; color:var(--danger-red);" onclick="removeItemFromInvoice(${index})">
          <i data-lucide="trash" style="width:14px; height:14px;"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  lucide.createIcons();
}

function updateItemQty(index, val) {
  const qty = parseFloat(val);
  if (!isNaN(qty) && qty > 0) {
    STATE.currentInvoiceItems[index].qty = qty;
  }
  renderInvoiceTableItems();
  calculateTotals();
}

function updateItemRate(index, val) {
  const rate = parseFloat(val);
  if (!isNaN(rate) && rate >= 0) {
    STATE.currentInvoiceItems[index].rate = rate;
  }
  renderInvoiceTableItems();
  calculateTotals();
}

function removeItemFromInvoice(index) {
  STATE.currentInvoiceItems.splice(index, 1);
  renderInvoiceTableItems();
  calculateTotals();
}

// --- DYNAMIC FINANCIAL CALCULATIONS & SVG CHART ---
function getInvoiceFinancialTotals(inv) {
  let materialsTotal = 0;
  (inv.items || []).forEach(item => {
    materialsTotal += parseFloat(item.qty || 0) * parseFloat(item.rate || 0);
  });

  const labor = parseFloat(inv.labor || 0);
  const markupVal = (materialsTotal + labor) * (parseFloat(inv.markup || 0) / 100);
  const subtotalBeforeTax = materialsTotal + labor + markupVal;
  const taxVal = subtotalBeforeTax * (parseFloat(inv.tax || 0) / 100);
  const grandTotal = subtotalBeforeTax + taxVal;

  return {
    materialsTotal,
    labor,
    markup: markupVal,
    tax: taxVal,
    grandTotal
  };
}

function calculateTotals() {
  let materialsSubtotal = 0;
  STATE.currentInvoiceItems.forEach(item => {
    materialsSubtotal += parseFloat(item.qty || 0) * parseFloat(item.rate || 0);
  });

  const labor = parseFloat(document.getElementById("invoice-labor-rate").value || 0);
  const markupPercent = parseFloat(document.getElementById("invoice-markup-rate").value || 0);
  const taxPercent = parseFloat(document.getElementById("invoice-tax-rate").value || 0);

  const markupVal = (materialsSubtotal + labor) * (markupPercent / 100);
  const subtotalBeforeTax = materialsSubtotal + labor + markupVal;
  const taxVal = subtotalBeforeTax * (taxPercent / 100);
  const grandTotal = subtotalBeforeTax + taxVal;

  // Update UI values
  document.getElementById("subtotal-materials").textContent = formatCurrency(materialsSubtotal);
  document.getElementById("subtotal-labor").textContent = formatCurrency(labor);
  document.getElementById("subtotal-markup").textContent = formatCurrency(markupVal);
  document.getElementById("subtotal-tax").textContent = formatCurrency(taxVal);
  document.getElementById("grand-total-price").textContent = formatCurrency(grandTotal);

  // Render SVG Donut Chart Representing Ratios
  renderCostRatioChart(materialsSubtotal, labor, markupVal, taxVal);
}

function renderCostRatioChart(materials, labor, markup, tax) {
  const svg = document.getElementById("cost-donut-svg");
  if (!svg) return;
  svg.innerHTML = "";

  const total = materials + labor + markup + tax;
  if (total === 0) {
    svg.innerHTML = `
      <circle cx="75" cy="75" r="50" fill="none" stroke="var(--border-color)" stroke-width="20" />
      <text x="75" y="80" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="Outfit">No Budget Data</text>
    `;
    return;
  }

  // Ratio segments
  const segments = [
    { value: materials, color: "#f97316", label: "Mat" },   // Orange
    { value: labor, color: "#3b82f6", label: "Lab" },       // Blue
    { value: markup, color: "#10b981", label: "Mark" },     // Green
    { value: tax, color: "#a855f7", label: "Tax" }          // Purple
  ];

  let accumulatedPercent = 0;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  
  // Render central grand text
  const textGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  textGroup.innerHTML = `
    <text x="75" y="70" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-weight="600" text-transform="uppercase">Total Est.</text>
    <text x="75" y="88" text-anchor="middle" fill="var(--text-main)" font-size="13" font-weight="800" font-family="Outfit">${formatCompactCurrency(total)}</text>
  `;

  segments.forEach((seg) => {
    if (seg.value === 0) return;

    const percent = seg.value / total;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "75");
    circle.setAttribute("cy", "75");
    circle.setAttribute("r", radius.toString());
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", seg.color);
    circle.setAttribute("stroke-width", "16");
    circle.setAttribute("stroke-dasharray", strokeDasharray);
    circle.setAttribute("stroke-dashoffset", strokeDashoffset.toString());
    circle.setAttribute("transform", "rotate(-90 75 75)");
    
    // Simple tooltip title inside SVG
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${seg.label}: ${formatCurrency(seg.value)} (${Math.round(percent * 100)}%)`;
    circle.appendChild(title);

    svg.appendChild(circle);
    accumulatedPercent += percent;
  });

  svg.appendChild(textGroup);
}

// --- SUBMIT INVOICE FORM ---
function submitInvoiceForm(e) {
  e.preventDefault();

  const invoiceId = document.getElementById("invoice-id-field").value;
  const invoiceNum = document.getElementById("invoice-num-field").value;
  const status = document.getElementById("invoice-status-field").value;
  const date = document.getElementById("invoice-date-field").value;
  const labor = parseFloat(document.getElementById("invoice-labor-rate").value || 0);
  const markup = parseFloat(document.getElementById("invoice-markup-rate").value || 10);
  const tax = parseFloat(document.getElementById("invoice-tax-rate").value || 8);

  if (!invoiceNum || !date) {
    alert("Please enter a valid Invoice Number and Date");
    return;
  }

  const jobIndex = STATE.jobs.findIndex(j => j.id === STATE.activeJobId);
  const job = STATE.jobs[jobIndex];
  
  const invoiceData = {
    id: invoiceId || "inv_" + Date.now(),
    invoiceNum,
    status,
    date,
    items: STATE.currentInvoiceItems,
    labor,
    markup,
    tax
  };

  if (invoiceId) {
    // Edit existing invoice
    const invIndex = job.invoices.findIndex(i => i.id === invoiceId);
    job.invoices[invIndex] = invoiceData;
  } else {
    // Add new invoice
    if (!job.invoices) job.invoices = [];
    job.invoices.push(invoiceData);
  }

  saveData();
  renderStats();
  renderJobs();
  closeInvoiceDrawer();
  openDetailsDrawer(job.id); // Refresh job details list

  // Active invoices tab view again
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  document.getElementById("tab-invoices-btn").classList.add("active");
  document.getElementById("tab-invoices").classList.add("active");
}

// --- PRISTINE DYNAMIC PRINTING & EXPORTS ---
function triggerPrintInvoice(jobId, invoiceId) {
  const job = STATE.jobs.find(j => j.id === jobId);
  const inv = job.invoices.find(i => i.id === invoiceId);
  const totals = getInvoiceFinancialTotals(inv);

  // 1. Populate top titles
  document.getElementById("print-invoice-num").textContent = inv.invoiceNum;
  document.getElementById("print-invoice-date").textContent = formatDate(inv.date);
  document.getElementById("print-invoice-status").textContent = inv.status;

  // Determine printer colors for statuses
  const statusEl = document.getElementById("print-invoice-status");
  if (inv.status === "paid") {
    statusEl.style.color = "var(--success-green)";
  } else if (inv.status === "sent") {
    statusEl.style.color = "var(--warning-yellow)";
  } else {
    statusEl.style.color = "var(--danger-red)";
  }

  document.getElementById("print-job-title").textContent = job.title;
  document.getElementById("print-job-address").textContent = job.address;
  document.getElementById("print-client-name").textContent = job.client.name;
  document.getElementById("print-client-email").textContent = job.client.email || "No email";
  document.getElementById("print-client-phone").textContent = job.client.phone || "No phone";

  // 2. Populate print items tbody
  const tbody = document.getElementById("print-items-tbody");
  tbody.innerHTML = "";

  if ((inv.items || []).length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No supplies itemized. General contracting labor services rendered.</td></tr>`;
  } else {
    inv.items.forEach(item => {
      const total = item.qty * item.rate;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight:600;">${escapeHTML(item.name)}</td>
        <td style="text-align:center;">${item.qty}</td>
        <td style="text-align:right;">${formatCurrency(item.rate)}</td>
        <td style="text-align:center;">${escapeHTML(item.unit)}</td>
        <td style="text-align:right; font-weight:600;">${formatCurrency(total)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 3. Populate financial totals on sheet
  document.getElementById("print-subtotal-materials").textContent = formatCurrency(totals.materialsTotal);
  document.getElementById("print-subtotal-labor").textContent = formatCurrency(totals.labor);
  document.getElementById("print-subtotal-markup").textContent = `${formatCurrency(totals.markup)} (${inv.markup}%)`;
  document.getElementById("print-subtotal-tax").textContent = `${formatCurrency(totals.tax)} (${inv.tax}%)`;
  document.getElementById("print-grand-total").textContent = formatCurrency(totals.grandTotal);

  // 4. Trigger print engine
  window.print();
}

// --- UTILITY FORMATTERS ---
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatCompactCurrency(value) {
  if (value >= 1.0e6) {
    return (value / 1.0e6).toFixed(1) + "M";
  } else if (value >= 1.0e3) {
    return (value / 1.0e3).toFixed(1) + "k";
  }
  return formatCurrency(value);
}

function formatDate(dateStr) {
  if (!dateStr) return "No Date";
  const date = new Date(dateStr + 'T00:00:00'); // Prevent UTC offset shifts
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// --- CREW TAB RENDERING & INTERACTIONS ---
function renderCrewTab(job) {
  const select = document.getElementById("details-crew-assign-select");
  const grid = document.getElementById("details-crew-grid");
  
  if (!select || !grid) return;
  
  select.innerHTML = '<option value="">-- Choose Worker --</option>';
  grid.innerHTML = "";

  const assigned = job.assignedCrew || [];

  // Populate Select options
  STATE.workers.forEach(w => {
    if (!assigned.includes(w.id)) {
      const opt = document.createElement("option");
      opt.value = w.id;
      opt.textContent = `${w.name} (${w.role})`;
      select.appendChild(opt);
    }
  });

  if (assigned.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; padding: 2rem; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-color-light); border-radius: var(--border-radius-md);">
        <i data-lucide="users" style="width:32px; height:32px; margin-bottom:0.5rem; display:inline-block;"></i>
        <p style="font-size:0.85rem;">No crew members assigned to this construction job yet.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  assigned.forEach((workerId, index) => {
    const w = STATE.workers.find(worker => worker.id === workerId);
    if (!w) return;

    // Deterministic avatar gradient index
    const avatarClass = `c${(index % 5) + 1}`;
    const initials = w.name.split(" ").map(n => n[0]).join("").toUpperCase();

    const card = document.createElement("div");
    card.className = "crew-member-card";
    card.innerHTML = `
      <div class="crew-avatar ${avatarClass}">${initials}</div>
      <div class="crew-info">
        <span class="crew-name" title="${escapeHTML(w.name)}">${escapeHTML(w.name)}</span>
        <span class="crew-role">${escapeHTML(w.role)}</span>
      </div>
      <button class="crew-card-remove" title="Unassign Crew Member" onclick="handleRemoveCrewMember('${w.id}')">
        <i data-lucide="user-minus" style="width:14px; height:14px;"></i>
      </button>
    `;
    grid.appendChild(card);
  });

  lucide.createIcons();
}

function handleAssignCrewMember() {
  const select = document.getElementById("details-crew-assign-select");
  const workerId = select.value;
  if (!workerId || !STATE.activeJobId) return;

  const job = STATE.jobs.find(j => j.id === STATE.activeJobId);
  if (!job.assignedCrew) job.assignedCrew = [];
  
  if (!job.assignedCrew.includes(workerId)) {
    job.assignedCrew.push(workerId);
    saveData();
    renderJobs();
    renderCrewTab(job);
  }
}

function handleRemoveCrewMember(workerId) {
  if (!STATE.activeJobId) return;
  const job = STATE.jobs.find(j => j.id === STATE.activeJobId);
  
  job.assignedCrew = (job.assignedCrew || []).filter(id => id !== workerId);
  saveData();
  renderJobs();
  renderCrewTab(job);
}

// --- MILESTONES TIMELINE & SCHEDULE ---
function renderMilestonesTimeline(job) {
  const track = document.getElementById("details-timeline-track");
  if (!track) return;
  track.innerHTML = "";

  const milestones = job.milestones || [];

  if (milestones.length === 0) {
    track.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-color-light); border-radius: var(--border-radius-md);">
        <p style="font-size:0.85rem;">No scheduled milestone dates exist for this site.</p>
      </div>
    `;
    return;
  }

  // Sort milestones chronologically by date
  const sorted = [...milestones].sort((a, b) => new Date(a.date) - new Date(b.date));

  sorted.forEach(m => {
    const isCompleted = m.status === "completed";
    const statusClass = isCompleted ? "completed" : "pending";
    const statusLabel = isCompleted ? "Completed" : "Pending Approval";
    const statusBtnIcon = isCompleted ? "check-square" : "square";

    const item = document.createElement("div");
    item.className = `timeline-item ${statusClass}`;
    item.innerHTML = `
      <div class="timeline-node"></div>
      <div class="timeline-content-box">
        <div class="timeline-details">
          <span class="timeline-title">${escapeHTML(m.title)}</span>
          <span class="timeline-date"><i data-lucide="calendar" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>Target: ${formatDate(m.date)}</span>
        </div>
        <div class="timeline-actions">
          <span class="badge ${statusClass}" style="cursor:pointer;" onclick="handleToggleMilestoneStatus('${m.id}')" title="Toggle status">
            ${statusLabel}
          </span>
          <button class="btn btn-text btn-sm" style="padding:0.25rem 0.5rem;" title="Delete Milestone" onclick="handleRemoveMilestone('${m.id}')">
            <i data-lucide="trash-2" style="width:14px; height:14px; color:var(--danger-red);"></i>
          </button>
        </div>
      </div>
    `;
    track.appendChild(item);
  });

  lucide.createIcons();
}

function handleAddMilestone() {
  if (STATE.subscriptionPlan === "free") {
    alert("Scheduling new target milestones requires a Pro Contractor or Enterprise subscription. Upgrade your plan inside Cloud Settings to unlock this feature!");
    return;
  }

  const titleField = document.getElementById("milestone-title-field");
  const dateField = document.getElementById("milestone-date-field");

  const title = titleField.value;
  const date = dateField.value;

  if (!title || !date || !STATE.activeJobId) {
    alert("Please enter a milestone description and target date.");
    return;
  }

  const job = STATE.jobs.find(j => j.id === STATE.activeJobId);
  if (!job.milestones) job.milestones = [];

  job.milestones.push({
    id: "m_" + Date.now(),
    title,
    date,
    status: "pending"
  });

  saveData();
  renderMilestonesTimeline(job);

  // Clear Inputs
  titleField.value = "";
  dateField.value = "";
}

function handleToggleMilestoneStatus(milestoneId) {
  if (!STATE.activeJobId) return;
  const job = STATE.jobs.find(j => j.id === STATE.activeJobId);
  
  const m = job.milestones.find(mil => mil.id === milestoneId);
  if (m) {
    m.status = m.status === "completed" ? "pending" : "completed";
    saveData();
    renderMilestonesTimeline(job);
  }
}

function handleRemoveMilestone(milestoneId) {
  if (!STATE.activeJobId) return;
  const job = STATE.jobs.find(j => j.id === STATE.activeJobId);
  
  job.milestones = job.milestones.filter(mil => mil.id !== milestoneId);
  saveData();
  renderMilestonesTimeline(job);
}

// --- LEGAL CONTRACT SYSTEM ---
function renderContractTab(job) {
  const sheet = document.getElementById("legal-contract-sheet");
  if (!sheet) return;

  // Set Date Preamble
  const contractDateStr = job.dates.start ? formatDate(job.dates.start) : formatDate(new Date().toISOString().split('T')[0]);
  document.getElementById("contract-current-date").textContent = contractDateStr;

  // Parties info
  document.getElementById("contract-party-client").textContent = job.client.name;
  document.getElementById("contract-site-address").textContent = job.address;
  document.getElementById("contract-start-date").textContent = formatDate(job.dates.start);
  document.getElementById("contract-end-date").textContent = formatDate(job.dates.end);

  // Editable scope
  const contract = job.contract || { scope: "", clientSigned: "", contractorSigned: "", signedDate: "" };
  document.getElementById("contract-scope-textarea").value = contract.scope || job.description || "Project parameters outlined inside client brief.";

  // Dynamic cost calculations
  let matTotal = 0;
  let laborTotal = 0;
  let drawTotal = 0;

  (job.invoices || []).forEach(inv => {
    const f = getInvoiceFinancialTotals(inv);
    matTotal += f.materialsTotal;
    laborTotal += f.labor;
    drawTotal += f.grandTotal;
  });

  // Fallback to overall expected budget if no invoices created yet
  if (drawTotal === 0) {
    drawTotal = job.budget || 0;
  }

  document.getElementById("contract-total-budget").textContent = formatCurrency(drawTotal);
  document.getElementById("contract-mat-total").textContent = formatCurrency(matTotal);
  document.getElementById("contract-labor-total").textContent = formatCurrency(laborTotal);
  document.getElementById("contract-grand-total").textContent = formatCurrency(drawTotal);

  // RENDER SIGNATURES AND STAMP STATUS
  const isClientSigned = !!contract.clientSigned;
  const isContractorSigned = !!contract.contractorSigned;

  // Client Signatur Line
  const clientBox = document.getElementById("sig-box-client");
  const clientInputs = document.getElementById("sig-inputs-client");
  const clientLabel = document.getElementById("sig-label-client");

  if (isClientSigned) {
    clientBox.innerHTML = `<span class="signature-typed">${escapeHTML(contract.clientSigned)}</span>`;
    clientInputs.style.display = "none";
    clientLabel.textContent = `Signed on ${formatDate(contract.signedDate || job.dates.start)}`;
  } else {
    clientBox.innerHTML = "";
    clientInputs.style.display = "flex";
    clientLabel.textContent = "Owner Signature Required";
    document.getElementById("sig-input-client-text").value = "";
  }

  // Contractor Signature Line
  const contractorBox = document.getElementById("sig-box-contractor");
  const contractorInputs = document.getElementById("sig-inputs-contractor");

  if (isContractorSigned) {
    contractorBox.innerHTML = `<span class="signature-typed">${escapeHTML(contract.contractorSigned)}</span>`;
    contractorInputs.style.display = "none";
  } else {
    contractorBox.innerHTML = "";
    contractorInputs.style.display = "flex";
    document.getElementById("sig-input-contractor-text").value = "";
  }

  // Stamp executing glows
  if (isClientSigned && isContractorSigned) {
    sheet.classList.add("signed");
    document.getElementById("contract-digital-seal").style.opacity = "0.85";
  } else {
    sheet.classList.remove("signed");
    document.getElementById("contract-digital-seal").style.opacity = "0";
  }
}

function handleSignClient() {
  if (STATE.subscriptionPlan === "free") {
    alert("Legally typeset contract signatures require a Pro Contractor or Enterprise subscription. Upgrade your plan inside Cloud Settings to unlock this feature!");
    return;
  }

  if (!STATE.activeJobId) return;
  const nameInput = document.getElementById("sig-input-client-text");
  const signName = nameInput.value;

  if (!signName || signName.trim().length === 0) {
    alert("Please type a valid Client name to digitally sign.");
    return;
  }

  const job = STATE.jobs.find(j => j.id === STATE.activeJobId);
  if (!job.contract) job.contract = { scope: "", clientSigned: "", contractorSigned: "", signedDate: "" };

  job.contract.clientSigned = signName;
  job.contract.signedDate = new Date().toISOString().split('T')[0];

  saveData();
  renderContractTab(job);
}

function handleSignContractor() {
  if (STATE.subscriptionPlan === "free") {
    alert("Legally typeset contract signatures require a Pro Contractor or Enterprise subscription. Upgrade your plan inside Cloud Settings to unlock this feature!");
    return;
  }

  if (!STATE.activeJobId) return;
  const nameInput = document.getElementById("sig-input-contractor-text");
  const signName = nameInput.value;

  if (!signName || signName.trim().length === 0) {
    alert("Please type a valid Contractor representative name to sign.");
    return;
  }

  const job = STATE.jobs.find(j => j.id === STATE.activeJobId);
  if (!job.contract) job.contract = { scope: "", clientSigned: "", contractorSigned: "", signedDate: "" };

  job.contract.contractorSigned = signName;
  saveData();
  renderContractTab(job);
}

function handleUpdateContractScope() {
  if (!STATE.activeJobId) return;
  const scopeVal = document.getElementById("contract-scope-textarea").value;
  
  const job = STATE.jobs.find(j => j.id === STATE.activeJobId);
  if (!job.contract) job.contract = { scope: "", clientSigned: "", contractorSigned: "", signedDate: "" };

  job.contract.scope = scopeVal;
  saveData();
}

function handlePrintContract() {
  if (!STATE.activeJobId) return;
  const job = STATE.jobs.find(j => j.id === STATE.activeJobId);
  
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <html>
    <head>
      <title>Contract Agreement - ${job.title}</title>
      <style>
        body {
          font-family: 'Georgia', serif;
          color: #1e293b;
          padding: 3rem;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
        }
        .contract-header {
          text-align: center;
          border-bottom: 2px double #334155;
          padding-bottom: 1.5rem;
          margin-bottom: 2rem;
        }
        .contract-title {
          font-size: 1.8rem;
          font-weight: 800;
          text-transform: uppercase;
        }
        .contract-subtitle {
          font-size: 0.9rem;
          font-style: italic;
          color: #64748b;
        }
        .contract-clause {
          margin-bottom: 1.5rem;
        }
        .contract-clause-header {
          font-weight: 700;
          font-size: 1.05rem;
          margin-bottom: 0.5rem;
        }
        .contract-signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          margin-top: 4rem;
          border-top: 1px solid #cbd5e1;
          padding-top: 2rem;
        }
        .signature-line-box {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .signature-typed {
          font-family: cursive;
          font-size: 1.6rem;
          color: #1d4ed8;
          border-bottom: 1px solid #000;
          padding-bottom: 0.5rem;
        }
        .signature-empty {
          border-bottom: 1px solid #000;
          height: 48px;
        }
        .stamp {
          border: 4px double #10b981;
          color: #10b981;
          padding: 0.5rem 1rem;
          font-size: 1.1rem;
          font-weight: 800;
          text-transform: uppercase;
          display: inline-block;
          margin-bottom: 1rem;
        }
      </style>
    </head>
    <body>
      <div class="contract-header">
        <h2 class="contract-title">Construction Work Agreement</h2>
        <span class="contract-subtitle">Standard Legally Binding Work Contract</span>
      </div>
      
      \${job.contract?.clientSigned && job.contract?.contractorSigned ? '<div class="stamp">FULLY EXECUTED & BINDING</div>' : ''}

      <p>This Agreement is executed on this <strong>\${job.dates.start ? formatDate(job.dates.start) : 'May 18, 2026'}</strong>, by and between BuildFlow Construction LLC ("Contractor") and <strong>\${job.client.name}</strong> ("Owner").</p>

      <div class="contract-clause">
        <div class="contract-clause-header">1. PROJECT SITE ADDRESS & LOCATION</div>
        <div>The work shall be performed at: <strong>\${job.address}</strong></div>
      </div>

      <div class="contract-clause">
        <div class="contract-clause-header">2. DETAILED SCOPE OF WORK</div>
        <div style="white-space: pre-wrap;">\${job.contract?.scope || job.description || 'General construction services.'}</div>
      </div>

      <div class="contract-clause">
        <div class="contract-clause-header">3. FINANCIAL SUMS & PROVISIONS</div>
        <div>Owner agrees to pay Contractor standard rates according to invoices, drawing an estimated total sum of: <strong>\${document.getElementById("contract-total-budget").textContent}</strong>.</div>
      </div>

      <div class="contract-clause">
        <div class="contract-clause-header">4. TIME OF PERFORMANCE</div>
        <div>Work initiates on <strong>\${formatDate(job.dates.start)}</strong> and targets completion on <strong>\${formatDate(job.dates.end)}</strong>.</div>
      </div>

      <div class="contract-signatures">
        <div class="signature-line-box">
          \${job.contract?.clientSigned ? \`<div class="signature-typed">\${job.contract.clientSigned}</div>\` : '<div class="signature-empty"></div>'}
          <strong>\${job.client.name} (Owner)</strong>
        </div>
        <div class="signature-line-box">
          \${job.contract?.contractorSigned ? \`<div class="signature-typed">\${job.contract.contractorSigned}</div>\` : '<div class="signature-empty"></div>'}
          <strong>BuildFlow Contracting Rep</strong>
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ==========================================
// PREMIUM CLOUD SYNC & AUTHENTICATION ENGINE
// ==========================================

function checkAuthSession() {
  const overlay = document.getElementById("login-overlay");
  if (STATE.userSession) {
    overlay.classList.remove("active");
  } else {
    overlay.classList.add("active");
  }
}

let isSignInMode = true;
function toggleAuthMode(isLogin) {
  isSignInMode = isLogin;
  
  const loginTab = document.getElementById("btn-auth-login");
  const signupTab = document.getElementById("btn-auth-signup");
  const submitBtn = document.getElementById("auth-submit-btn");
  
  if (isLogin) {
    loginTab.classList.add("active");
    signupTab.classList.remove("active");
    submitBtn.textContent = "Sign In with UTool";
  } else {
    loginTab.classList.remove("active");
    signupTab.classList.add("active");
    submitBtn.textContent = "Create UTool Account";
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  
  const email = document.getElementById("auth-email").value;
  const password = document.getElementById("auth-password").value;
  const enableSupabase = document.getElementById("enable-supabase-chk").checked;
  
  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }
  
  if (enableSupabase) {
    const url = document.getElementById("supabase-url-input").value;
    const key = document.getElementById("supabase-key-input").value;
    
    if (!url || !key) {
      alert("Please supply your Supabase URL & Anon Key to connect.");
      return;
    }
    
    // Save keys to state
    STATE.supabaseUrl = url;
    STATE.supabaseAnonKey = key;
    
    try {
      // Lazy init supabase library client
      supabaseClient = supabase.createClient(url, key);
      
      let authResponse;
      if (isSignInMode) {
        authResponse = await supabaseClient.auth.signInWithPassword({ email, password });
      } else {
        authResponse = await supabaseClient.auth.signUp({ email, password });
      }
      
      if (authResponse.error) {
        alert("Supabase Authentication Error: " + authResponse.error.message);
        return;
      }
      
      // Successfully authenticated
      STATE.userSession = {
        email: authResponse.data.user.email,
        id: authResponse.data.user.id,
        supabaseConnected: true
      };
      
      // Load user data immediately upon login!
      await loadFromSupabase();
      
    } catch(err) {
      alert("Failed connecting to Supabase Cloud: " + err.message);
      return;
    }
  } else {
    // Sandbox authentication
    STATE.userSession = {
      email: email,
      sandbox: true
    };
  }
  
  saveData();
  checkAuthSession();
  renderStats();
  renderJobs();
  
  // Show premium success welcome alert
  alert("UTool session successfully authenticated! Welcome " + STATE.userSession.email + (enableSupabase ? " (Supabase Sync Active)" : " (Sandbox Offline)"));
}

function handleBypassAuth() {
  STATE.userSession = {
    email: "sandbox-guest@utool.com",
    sandbox: true
  };
  saveData();
  checkAuthSession();
  renderStats();
  renderJobs();
}

// Drawer visibility controllers
function openCloudDrawer() {
  document.getElementById("cloud-drawer-backdrop").classList.add("active");
  
  // Prep inputs from STATE
  document.getElementById("partner-logo-url-input").value = STATE.partnerLogoUrl;
  document.getElementById("supabase-url-input").value = STATE.supabaseUrl;
  document.getElementById("supabase-key-input").value = STATE.supabaseAnonKey;
  
  if (STATE.supabaseUrl && STATE.supabaseAnonKey) {
    document.getElementById("enable-supabase-chk").checked = true;
    document.getElementById("supabase-config-inputs").style.display = "flex";
  }
  
  updateSubscriptionUI();
}

function closeCloudDrawer() {
  document.getElementById("cloud-drawer-backdrop").classList.remove("active");
}

// Plan Tiers & Billing Matrix Manager
function updateSubscriptionUI() {
  const badge = document.getElementById("header-sub-badge");
  
  // Reset pricing cards select classes
  document.querySelectorAll(".pricing-card").forEach(c => c.classList.remove("selected"));
  
  // Reset price cards button text
  document.getElementById("btn-select-free").textContent = "Select Free Plan";
  document.getElementById("btn-select-pro").textContent = "Upgrade to Pro";
  document.getElementById("btn-select-enterprise").textContent = "Go Enterprise";
  
  if (STATE.subscriptionPlan === "pro") {
    badge.textContent = "PRO CONTRACTOR";
    badge.className = "header-tier-badge tier-pro";
    document.getElementById("pricing-card-pro").classList.add("selected");
    document.getElementById("btn-select-pro").textContent = "Active Plan";
    document.getElementById("partner-logo-section").style.display = "block";
  } else if (STATE.subscriptionPlan === "enterprise") {
    badge.textContent = "ENTERPRISE SUITE";
    badge.className = "header-tier-badge tier-enterprise";
    document.getElementById("pricing-card-enterprise").classList.add("selected");
    document.getElementById("btn-select-enterprise").textContent = "Active Plan";
    document.getElementById("partner-logo-section").style.display = "block";
  } else {
    badge.textContent = "Sandbox Free";
    badge.className = "header-tier-badge";
    document.getElementById("pricing-card-free").classList.add("selected");
    document.getElementById("btn-select-free").textContent = "Active Plan";
    document.getElementById("partner-logo-section").style.display = "none";
  }
  
  // Render Partner Logo Preview box
  const previewBox = document.getElementById("partner-logo-preview-box");
  if (STATE.partnerLogoUrl) {
    previewBox.innerHTML = `<img src="${escapeHTML(STATE.partnerLogoUrl)}" style="height:100%; max-width:100%; object-fit:contain;">`;
  } else {
    previewBox.innerHTML = `<span style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">No custom logo</span>`;
  }
}

function handleSelectPlan(planId) {
  STATE.subscriptionPlan = planId;
  saveData();
  updateSubscriptionUI();
  renderPartnerMarquee();
  alert("Successfully updated subscription level to: " + planId.toUpperCase());
}

// Special Promo Codes
function handleApplyPromoCode() {
  const code = document.getElementById("promo-code-input").value.trim().toUpperCase();
  const msg = document.getElementById("promo-success-msg");
  
  if (code === "FREEBUILD" || code === "BUILDPRO" || code === "PROMO2026") {
    STATE.subscriptionPlan = "pro";
    saveData();
    updateSubscriptionUI();
    renderPartnerMarquee();
    
    msg.style.display = "block";
    msg.textContent = `Promo code "${code}" applied! Pro Contractor tier unlocked for FREE.`;
    
    alert(`Success! Special promo code "${code}" has unlocked Pro Contractor features.`);
  } else {
    alert("Invalid promo code. Please verify the spelling or check valid campaign codes (e.g. FREEBUILD, BUILDPRO).");
  }
}

// Custom Partner branding saving
function handleSavePartnerLogo() {
  const urlVal = document.getElementById("partner-logo-url-input").value.trim();
  STATE.partnerLogoUrl = urlVal;
  saveData();
  updateSubscriptionUI();
  renderPartnerMarquee();
  alert("Contractor sponsor branding logo updated successfully.");
}

// Dynamic Sponsor / Partners scrolling marquee rendering
function renderPartnerMarquee() {
  const track = document.getElementById("partner-marquee-track");
  if (!track) return;
  
  track.innerHTML = "";
  
  // Base sponsors list
  let sponsors = [
    { name: "AUTODESK", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Autodesk_logo.svg/2560px-Autodesk_logo.svg.png" },
    { name: "CATERPILLAR", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Caterpillar-Logo.svg/2560px-Caterpillar-Logo.svg.png" },
    { name: "JOHN DEERE", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/John_Deere_logo.svg/2560px-John_Deere_logo.svg.png" },
    { name: "DEWALT", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/DeWalt_logo.svg/2560px-DeWalt_logo.svg.png" },
    { name: "HOME DEPOT", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/The_Home_Depot.svg/1024px-The_Home_Depot.svg.png" }
  ];
  
  // Custom user logo if subscribed to Pro/Enterprise
  if ((STATE.subscriptionPlan === "pro" || STATE.subscriptionPlan === "enterprise") && STATE.partnerLogoUrl) {
    sponsors.unshift({
      name: "MY BRAND",
      logo: STATE.partnerLogoUrl,
      custom: true
    });
  }
  
  // Duplicate sponsor list for smooth infinite scrolling loop
  const displayList = [...sponsors, ...sponsors, ...sponsors];
  
  displayList.forEach(sp => {
    const item = document.createElement("div");
    item.className = "marquee-item";
    if (sp.custom) {
      item.innerHTML = `<img src="${escapeHTML(sp.logo)}" style="border: 2px solid var(--primary-orange); border-radius: 4px; box-shadow: 0 0 10px rgba(249, 115, 22, 0.4); padding: 2px; height: 100%;">`;
    } else {
      item.innerHTML = `<img src="${escapeHTML(sp.logo)}" alt="${escapeHTML(sp.name)}">`;
    }
    track.appendChild(item);
  });
}

// Developer Sandbox Data wipes & restores
function handleClearMockData() {
  if (confirm("Are you sure you want to delete all demo jobs, invoices, crew members, and timeline history? This starts with a clean empty slate to fill in your own data.")) {
    STATE.jobs = [];
    STATE.workers = [];
    saveData();
    renderStats();
    renderJobs();
    alert("Sandbox wiped! You can now start adding your own custom construction jobs.");
  }
}



// Supabase cloud sync logic
async function syncToSupabaseCloud() {
  if (!supabaseClient || !STATE.userSession || !STATE.userSession.supabaseConnected) return;
  
  try {
    const userId = STATE.userSession.id;
    // Perform upserts to Supabase to keep remote DB synchronized
    console.log("Synchronizing data to Supabase real-time backend...");
    
    // Simulating database network operations
    // In real Supabase setup, developer creates a 'buildflow_jobs' table with fields:
    // id (text primary key), user_id (uuid), data (jsonb)
    
    // We try to trigger a background sync update payload
    const { data, error } = await supabaseClient
      .from('buildflow_jobs')
      .upsert({ 
        id: userId, 
        jobs: STATE.jobs, 
        updated_at: new Date().toISOString() 
      });
      
    if (error) {
      console.warn("Supabase Sync warning (ensure your buildflow_jobs table exists in Supabase):", error.message);
    } else {
      console.log("Supabase Cloud successfully synchronized.");
    }
  } catch(err) {
    console.warn("Background Supabase Sync failed: ", err.message);
  }
}

