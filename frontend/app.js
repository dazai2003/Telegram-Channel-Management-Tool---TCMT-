// State management
const state = {
  isAuthorized: false,
  user: null,
  config: null,
  dialogs: [],
  // Tab 1: Member Cross-Purge
  overlappingMembers: [],
  selectedUserIds: new Set(),
  currentSearchQuery: "",
  isScanning: false,
  isRemoving: false,
  lastScanData: null,
  // Tab 2: Join Requests Approver
  pendingRequests: [],
  selectedReqUserIds: new Set(),
  currentReqSearchQuery: "",
  isLoadingRequests: false,
  isApprovingRequests: false,
  sessionApprovedCount: 0,
  autopilotRunning: false,
  autopilotPollTimer: null,
  // Tab 3: Global Ban & Wipeout Shield
  blacklist: [],
  currentBlacklistSearchQuery: "",
  resolvedTargetUser: null,
  isNuking: false
};

// Theme Elements & Logic
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeToggleLabel = document.getElementById("themeToggleLabel");

function initTheme() {
  const savedTheme = localStorage.getItem("app_theme") || "aero";
  setTheme(savedTheme);
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("app_theme", theme);
  if (themeToggleLabel) {
    themeToggleLabel.textContent = theme === "aero" ? "Modern Dark" : "Frutiger Aero";
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "aero";
  const next = current === "aero" ? "dark" : "aero";
  setTheme(next);
}

// Navigation Tabs
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
const tabPendingBadge = document.getElementById("tabPendingBadge");
const tabBlacklistBadge = document.getElementById("tabBlacklistBadge");

function initTabs() {
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.targetTab;
      if (!targetId) return;

      tabButtons.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add("active");
      }
    });
  });
}

// Global DOM Elements
const authStatusBadge = document.getElementById("authStatusBadge");
const authStatusText = document.getElementById("authStatusText");
const authBtn = document.getElementById("authBtn");
const authBtnLabel = document.getElementById("authBtnLabel");
const authModal = document.getElementById("authModal");
const closeAuthModalBtn = document.getElementById("closeAuthModalBtn");

// Auth Form Elements
const authStep1 = document.getElementById("authStep1");
const authStep2 = document.getElementById("authStep2");
const authPhone = document.getElementById("authPhone");
const authApiId = document.getElementById("authApiId");
const authApiHash = document.getElementById("authApiHash");
const toggleApiCredsBtn = document.getElementById("toggleApiCredsBtn");
const apiCredsContainer = document.getElementById("apiCredsContainer");
const sendCodeBtn = document.getElementById("sendCodeBtn");
const authCode = document.getElementById("authCode");
const auth2FaPassword = document.getElementById("auth2FaPassword");
const verifyCodeBtn = document.getElementById("verifyCodeBtn");
const backToStep1Btn = document.getElementById("backToStep1Btn");
const authMessage = document.getElementById("authMessage");

// TAB 1 DOM: Member Purge
const paidChannelSelect = document.getElementById("paidChannelSelect");
const freeGroupSelect = document.getElementById("freeGroupSelect");
const refreshDialogsBtn = document.getElementById("refreshDialogsBtn");
const startScanBtn = document.getElementById("startScanBtn");
const scanBtnText = document.getElementById("scanBtnText");
const safeDelayInput = document.getElementById("safeDelay");

const paidCountVal = document.getElementById("paidCountVal");
const paidChannelTitleVal = document.getElementById("paidChannelTitleVal");
const freeCountVal = document.getElementById("freeCountVal");
const freeGroupTitleVal = document.getElementById("freeGroupTitleVal");
const overlapCountVal = document.getElementById("overlapCountVal");

const membersTableBody = document.getElementById("membersTableBody");
const tableSearch = document.getElementById("tableSearch");
const selectAllCheckbox = document.getElementById("selectAllCheckbox");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const removeAllBtn = document.getElementById("removeAllBtn");
const removeAllBtnText = document.getElementById("removeAllBtnText");
const bulkActionBar = document.getElementById("bulkActionBar");
const selectedCountBadge = document.getElementById("selectedCountBadge");
const removeSelectedBtn = document.getElementById("removeSelectedBtn");
const removeSelectedBtnText = document.getElementById("removeSelectedBtnText");
const deselectAllBtn = document.getElementById("deselectAllBtn");

// TAB 2 DOM: Join Requests Approver
const reqChannelSelect = document.getElementById("reqChannelSelect");
const refreshRequestsBtn = document.getElementById("refreshRequestsBtn");
const autopilotInterval = document.getElementById("autopilotInterval");
const toggleAutopilotBtn = document.getElementById("toggleAutopilotBtn");
const autopilotBtnLabel = document.getElementById("autopilotBtnLabel");
const autopilotDot = document.querySelector(".autopilot-dot");
const streamApproveBtn = document.getElementById("streamApproveBtn");
const turboApproveBtn = document.getElementById("turboApproveBtn");
const turboApproveBtnText = document.getElementById("turboApproveBtnText");

const reqPendingCountVal = document.getElementById("reqPendingCountVal");
const reqChannelTitleVal = document.getElementById("reqChannelTitleVal");
const reqApprovedCountVal = document.getElementById("reqApprovedCountVal");
const autopilotStatusVal = document.getElementById("autopilotStatusVal");
const autopilotSubtextVal = document.getElementById("autopilotSubtextVal");

const requestsTableSearch = document.getElementById("requestsTableSearch");
const exportRequestsCsvBtn = document.getElementById("exportRequestsCsvBtn");
const loadRequestsListBtn = document.getElementById("loadRequestsListBtn");
const selectAllReqCheckbox = document.getElementById("selectAllReqCheckbox");
const requestsTableBody = document.getElementById("requestsTableBody");

const bulkReqActionBar = document.getElementById("bulkReqActionBar");
const selectedReqCountBadge = document.getElementById("selectedReqCountBadge");
const deselectAllReqBtn = document.getElementById("deselectAllReqBtn");
const approveSelectedReqBtn = document.getElementById("approveSelectedReqBtn");
const approveSelectedReqBtnText = document.getElementById("approveSelectedReqBtnText");

// TAB 3 DOM: Global Ban & Total Wipeout Shield
const nukeTargetInput = document.getElementById("nukeTargetInput");
const resolveTargetBtn = document.getElementById("resolveTargetBtn");
const resolveTargetBtnText = document.getElementById("resolveTargetBtnText");
const targetPreviewCard = document.getElementById("targetPreviewCard");
const targetAvatar = document.getElementById("targetAvatar");
const targetFullName = document.getElementById("targetFullName");
const targetTypeBadge = document.getElementById("targetTypeBadge");
const targetUsername = document.getElementById("targetUsername");
const targetIdBadge = document.getElementById("targetIdBadge");

const optBanChats = document.getElementById("optBanChats");
const optPurgeMessages = document.getElementById("optPurgeMessages");
const optWipeDm = document.getElementById("optWipeDm");
const optBlockContact = document.getElementById("optBlockContact");
const optRotateLinks = document.getElementById("optRotateLinks");
const optBlacklist = document.getElementById("optBlacklist");

const executeNukeBtn = document.getElementById("executeNukeBtn");
const executeNukeBtnText = document.getElementById("executeNukeBtnText");

const blTotalCountVal = document.getElementById("blTotalCountVal");
const blProtectedChatsVal = document.getElementById("blProtectedChatsVal");
const blacklistSearch = document.getElementById("blacklistSearch");
const refreshBlacklistBtn = document.getElementById("refreshBlacklistBtn");
const blacklistTableBody = document.getElementById("blacklistTableBody");

// Progress Modal
const progressModal = document.getElementById("progressModal");
const progressModalTitle = document.getElementById("progressModalTitle");
const progressModalSub = document.getElementById("progressModalSub");
const progressStatusLabel = document.getElementById("progressStatusLabel");
const progressPercentLabel = document.getElementById("progressPercentLabel");
const progressBarFill = document.getElementById("progressBarFill");
const progressCounts = document.getElementById("progressCounts");
const progressSuccessCount = document.getElementById("progressSuccessCount");
const progressFailCount = document.getElementById("progressFailCount");
const terminalLogBox = document.getElementById("terminalLogBox");
const closeProgressModalBtn = document.getElementById("closeProgressModalBtn");
const dismissProgressModalBtn = document.getElementById("dismissProgressModalBtn");

/* ==========================================================================
   Initialization & Auth Status
   ========================================================================== */
async function checkAuthStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    
    state.isAuthorized = data.is_authorized;
    state.user = data.user;
    state.config = data.config || {};

    if (state.config.phone && authPhone) {
      authPhone.value = state.config.phone;
    }
    if (state.config.api_id && authApiId) {
      authApiId.value = state.config.api_id;
    }
    if (state.config.api_hash && authApiHash) {
      authApiHash.value = state.config.api_hash;
    }
    if (state.config.safe_delay_seconds && safeDelayInput) {
      safeDelayInput.value = state.config.safe_delay_seconds;
    }

    updateAuthUI();
    if (state.isAuthorized) {
      await loadDialogs();
      loadLastScan();
      checkAutopilotStatus();
      loadBlacklist();
    }
  } catch (err) {
    console.error("Failed to check auth status:", err);
    if (authStatusText) authStatusText.textContent = "Backend Disconnected";
    if (authStatusBadge) authStatusBadge.className = "status-badge disconnected";
  }
}

function updateAuthUI() {
  if (state.isAuthorized && state.user) {
    const name = state.user.first_name || "User";
    const userTag = state.user.username ? `@${state.user.username}` : (state.user.phone || "");
    if (authStatusBadge) authStatusBadge.className = "status-badge connected";
    if (authStatusText) authStatusText.textContent = `Connected: ${name} (${userTag})`;
    if (authBtnLabel) authBtnLabel.textContent = "Switch Account";
    if (authBtn) authBtn.className = "btn btn-outline btn-sm";
  } else {
    if (authStatusBadge) authStatusBadge.className = "status-badge disconnected";
    if (authStatusText) authStatusText.textContent = "Telegram Not Connected";
    if (authBtnLabel) authBtnLabel.textContent = "Connect Telegram";
    if (authBtn) authBtn.className = "btn btn-primary btn-sm";
  }
}

/* ==========================================================================
   Dialogs Loader
   ========================================================================== */
async function loadDialogs() {
  if (!state.isAuthorized) return;

  if (paidChannelSelect) paidChannelSelect.innerHTML = '<option value="">Loading your channels & groups...</option>';
  if (freeGroupSelect) freeGroupSelect.innerHTML = '<option value="">Loading your channels & groups...</option>';
  if (reqChannelSelect) reqChannelSelect.innerHTML = '<option value="">Loading your channels & groups...</option>';

  try {
    const res = await fetch("/api/dialogs");
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch dialogs");
    }

    state.dialogs = data.dialogs || [];
    renderDialogOptions();

    // Update Tab 3 Protected Chats KPI
    const adminChats = state.dialogs.filter(d => d.is_admin || d.is_creator);
    if (blProtectedChatsVal) {
      blProtectedChatsVal.textContent = `${adminChats.length} Chats`;
    }

  } catch (err) {
    console.error("Error loading dialogs:", err);
    if (paidChannelSelect) paidChannelSelect.innerHTML = '<option value="">Failed to load. Click Refresh.</option>';
    if (freeGroupSelect) freeGroupSelect.innerHTML = '<option value="">Failed to load. Click Refresh.</option>';
    if (reqChannelSelect) reqChannelSelect.innerHTML = '<option value="">Failed to load. Click Refresh.</option>';
  }
}

function renderDialogOptions() {
  if (paidChannelSelect) paidChannelSelect.innerHTML = '<option value="">Select Paid Channel (Source Reference)...</option>';
  if (freeGroupSelect) freeGroupSelect.innerHTML = '<option value="">Select Free Group (Target to Purge)...</option>';
  if (reqChannelSelect) reqChannelSelect.innerHTML = '<option value="">Select Target Channel or Group with Requests...</option>';

  state.dialogs.forEach(d => {
    const countInfo = d.participants_count ? ` (${d.participants_count} members)` : "";
    const typeBadge = d.type === "channel" ? "[Channel]" : "[Group]";
    const label = `${typeBadge} ${d.title}${countInfo}`;

    if (paidChannelSelect) {
      const opt1 = document.createElement("option");
      opt1.value = d.id;
      opt1.textContent = label;
      if (state.config && String(state.config.last_paid_channel_id) === String(d.id)) {
        opt1.selected = true;
      }
      paidChannelSelect.appendChild(opt1);
    }

    if (freeGroupSelect) {
      const opt2 = document.createElement("option");
      opt2.value = d.id;
      opt2.textContent = label;
      if (state.config && String(state.config.last_free_group_id) === String(d.id)) {
        opt2.selected = true;
      }
      freeGroupSelect.appendChild(opt2);
    }

    if (reqChannelSelect) {
      const opt3 = document.createElement("option");
      opt3.value = d.id;
      opt3.textContent = label;
      reqChannelSelect.appendChild(opt3);
    }
  });

  if (reqChannelSelect && reqChannelSelect.options.length > 1 && !reqChannelSelect.value) {
    reqChannelSelect.selectedIndex = 1;
    loadPendingRequests(true);
  }
}

/* ==========================================================================
   TAB 1: Scan & Member Cross-Purge
   ========================================================================== */
async function runScan() {
  if (!state.isAuthorized) {
    showAuthModal();
    return;
  }

  const paidId = paidChannelSelect.value;
  const freeId = freeGroupSelect.value;

  if (!paidId || !freeId) {
    alert("Please select both your Paid Channel and your Free Group before scanning.");
    return;
  }

  if (paidId === freeId) {
    alert("Source Paid Channel and Target Free Group cannot be the same chat!");
    return;
  }

  state.isScanning = true;
  startScanBtn.disabled = true;
  scanBtnText.textContent = "Scanning & Comparing Members...";
  membersTableBody.innerHTML = `
    <tr class="empty-row">
      <td colspan="6">
        <div class="empty-state">
          <div class="empty-icon-svg pulse-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <h4>Fetching & Cross-Referencing Subscribers...</h4>
          <p>Please wait while we query Telegram MTProto for participant lists.</p>
        </div>
      </td>
    </tr>
  `;

  try {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid_channel_id: paidId, free_group_id: freeId })
    });
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.detail || data.error || "Scan failed");
    }

    applyScanResults(data);
  } catch (err) {
    alert(`Scan Error: ${err.message}`);
    membersTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-icon-svg" style="color: var(--danger);">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <h4 class="danger-text">Scan Failed</h4>
            <p>${err.message}</p>
          </div>
        </td>
      </tr>
    `;
  } finally {
    state.isScanning = false;
    startScanBtn.disabled = false;
    scanBtnText.textContent = "Scan & Compare Members";
  }
}

async function loadLastScan() {
  try {
    const res = await fetch("/api/scan/last");
    const data = await res.json();
    if (data.success) {
      applyScanResults(data);
    }
  } catch (err) {
    console.log("No previous scan available.");
  }
}

function applyScanResults(data) {
  state.lastScanData = data;
  paidCountVal.textContent = data.paid_channel?.total_members?.toLocaleString() || "0";
  paidChannelTitleVal.textContent = data.paid_channel?.title || "Paid Channel";

  freeCountVal.textContent = data.free_group?.total_members?.toLocaleString() || "0";
  freeGroupTitleVal.textContent = data.free_group?.title || "Free Group";

  overlapCountVal.textContent = data.overlap_count?.toLocaleString() || "0";

  state.overlappingMembers = data.overlapping_members || [];
  state.selectedUserIds.clear();
  selectAllCheckbox.checked = false;

  if (removeAllBtnText) {
    const count = state.overlappingMembers.length;
    removeAllBtnText.textContent = count > 0 ? `Remove All (${count})` : "Remove All Overlapping";
  }

  renderMembersTable();
  updateBulkActionBar();
}

function getFilteredMembers() {
  const q = state.currentSearchQuery.toLowerCase().trim();
  if (!q) return state.overlappingMembers;

  return state.overlappingMembers.filter(m => {
    const nameMatch = (m.name || "").toLowerCase().includes(q);
    const userMatch = (m.username || "").toLowerCase().includes(q);
    const idMatch = String(m.id).includes(q);
    return nameMatch || userMatch || idMatch;
  });
}

function renderMembersTable() {
  const list = getFilteredMembers();

  if (list.length === 0) {
    if (state.overlappingMembers.length > 0) {
      membersTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">
            <div class="empty-state">
              <div class="empty-icon-svg">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <h4>No Members Match "${escapeHtml(state.currentSearchQuery)}"</h4>
              <p>Try searching by a different name, username, or Telegram User ID.</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      membersTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">
            <div class="empty-state">
              <div class="empty-icon-svg" style="color: var(--success);">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h4 class="safe-text">Clean Segmentation</h4>
              <p>No paid members were found in your free group. Everything is in sync.</p>
            </div>
          </td>
        </tr>
      `;
    }
    return;
  }

  membersTableBody.innerHTML = list.map(m => {
    const isSelected = state.selectedUserIds.has(m.id);
    const initials = (m.first_name ? m.first_name[0] : "") + (m.last_name ? m.last_name[0] : "");
    const avatarLetter = (initials || m.name[0] || "U").toUpperCase();
    const usernameDisplay = m.username ? `@${m.username}` : `<span class="text-muted">None</span>`;

    return `
      <tr class="${isSelected ? 'selected' : ''}" data-user-id="${m.id}">
        <td class="col-check">
          <input type="checkbox" class="user-checkbox" data-user-id="${m.id}" ${isSelected ? 'checked' : ''} />
        </td>
        <td class="col-user">
          <div class="user-cell">
            <div class="user-avatar">${avatarLetter}</div>
            <div>
              <div class="user-info-name">${escapeHtml(m.name)}</div>
            </div>
          </div>
        </td>
        <td class="col-username">
          <span class="user-username">${usernameDisplay}</span>
        </td>
        <td class="col-id">
          <span class="user-id-badge" title="Click to copy ID" onclick="navigator.clipboard.writeText('${m.id}')">${m.id}</span>
        </td>
        <td class="col-status">
          <span class="overlap-status-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            In Both Channels
          </span>
        </td>
        <td class="col-action">
          <button class="btn btn-danger btn-sm single-remove-btn" data-user-id="${m.id}" data-user-name="${escapeHtml(m.name)}">
            Remove
          </button>
        </td>
      </tr>
    `;
  }).join("");

  attachTableEventListeners();
}

function attachTableEventListeners() {
  document.querySelectorAll(".user-checkbox").forEach(cb => {
    cb.addEventListener("change", (e) => {
      const uid = parseInt(e.target.dataset.userId, 10);
      if (e.target.checked) {
        state.selectedUserIds.add(uid);
      } else {
        state.selectedUserIds.delete(uid);
      }
      updateRowSelectedClass(uid, e.target.checked);
      updateBulkActionBar();
    });
  });

  document.querySelectorAll(".single-remove-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const uid = parseInt(e.currentTarget.dataset.userId, 10);
      const uname = e.currentTarget.dataset.userName;
      confirmAndRemove([uid], uname);
    });
  });
}

function updateRowSelectedClass(userId, isSelected) {
  const row = document.querySelector(`tr[data-user-id="${userId}"]`);
  if (row) {
    if (isSelected) row.classList.add("selected");
    else row.classList.remove("selected");
  }
}

function updateBulkActionBar() {
  const count = state.selectedUserIds.size;
  if (count > 0) {
    bulkActionBar.classList.remove("hidden");
    selectedCountBadge.textContent = count;
    removeSelectedBtnText.textContent = `Remove ${count} Selected Member${count > 1 ? 's' : ''}`;
  } else {
    bulkActionBar.classList.add("hidden");
  }

  const filtered = getFilteredMembers();
  selectAllCheckbox.checked = filtered.length > 0 && filtered.every(m => state.selectedUserIds.has(m.id));
}

function confirmAndRemove(userIds, singleUserName = null) {
  let freeId = freeGroupSelect?.value;
  if (!freeId && state.lastScanData?.free_group?.id) {
    freeId = state.lastScanData.free_group.id;
  }
  if (!freeId && state.config?.last_free_group_id) {
    freeId = state.config.last_free_group_id;
  }

  if (!userIds || userIds.length === 0) {
    alert("No users selected to remove.");
    return;
  }

  startRemovalProcess(freeId, userIds, singleUserName);
}

async function startRemovalProcess(freeGroupId, userIds, singleUserName = null) {
  state.isRemoving = true;
  progressModal.classList.remove("hidden");
  closeProgressModalBtn.classList.add("hidden");

  const total = userIds.length;
  let successful = 0;
  let failed = 0;
  const delay = parseFloat(safeDelayInput?.value) || 1.5;

  progressModalTitle.textContent = singleUserName 
    ? `Purging: ${singleUserName}` 
    : `Purging ${total} Overlapping Member${total > 1 ? 's' : ''}`;
  progressModalSub.textContent = "Safe member removal with Telegram FloodWait protection";
  progressStatusLabel.textContent = "Initializing removal task on server...";
  progressPercentLabel.textContent = "0%";
  progressBarFill.style.width = "0%";
  progressCounts.textContent = `Processed: 0 / ${total}`;
  progressSuccessCount.textContent = "Success: 0";
  progressFailCount.textContent = "Failed: 0";
  terminalLogBox.innerHTML = `<div class="log-line info">Preparing to purge ${total} users with ${delay}s rate-limiting delay...</div>`;

  try {
    const res = await fetch("/api/remove/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        free_group_id: freeGroupId,
        user_ids: userIds,
        delay: delay
      })
    });

    const initData = await res.json();
    if (!initData.success) {
      throw new Error(initData.detail || initData.error || "Server failed to initiate removal task");
    }

    appendLogLine(`Task created (ID: ${initData.task_id.substring(0, 8)}...). Connecting to live Telegram stream...`, "info");
    progressStatusLabel.textContent = "Connected. Purging members from Free Group...";

    const sseUrl = `/api/remove/stream?task_id=${encodeURIComponent(initData.task_id)}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.event === "start") {
          appendLogLine(`Target Free Group: ${data.group_title}`, "info");
        } else if (data.event === "progress") {
          const pct = Math.round((data.current / data.total) * 100);
          progressBarFill.style.width = `${pct}%`;
          progressPercentLabel.textContent = `${pct}%`;
          progressCounts.textContent = `Processed: ${data.current} / ${data.total}`;

          if (data.status === "success") {
            successful++;
            progressSuccessCount.textContent = `Success: ${successful}`;
            appendLogLine(data.message, "success");
          } else {
            failed++;
            progressFailCount.textContent = `Failed: ${failed}`;
            appendLogLine(data.message, "danger");
          }
        } else if (data.event === "flood_wait") {
          appendLogLine(`[RATE-LIMIT] ${data.message}`, "warning");
          progressStatusLabel.textContent = `Rate limiting active (Telegram FloodWait: ${data.wait_seconds}s)...`;
        } else if (data.event === "complete") {
          eventSource.close();
          state.isRemoving = false;
          progressStatusLabel.textContent = "Purge Complete";
          progressBarFill.style.width = "100%";
          progressPercentLabel.textContent = "100%";
          appendLogLine(`[SUCCESS] Completed! ${data.successful} members removed, ${data.failed} failed.`, "success");
          closeProgressModalBtn.classList.remove("hidden");

          const removedSet = new Set(userIds);
          state.overlappingMembers = state.overlappingMembers.filter(m => !removedSet.has(m.id));
          state.selectedUserIds.clear();
          overlapCountVal.textContent = state.overlappingMembers.length.toLocaleString();
          if (removeAllBtnText) {
            const count = state.overlappingMembers.length;
            removeAllBtnText.textContent = count > 0 ? `Remove All (${count})` : "Remove All Overlapping";
          }
          renderMembersTable();
          updateBulkActionBar();
        } else if (data.event === "error") {
          eventSource.close();
          state.isRemoving = false;
          appendLogLine(`[ERROR] ${data.message}`, "danger");
          closeProgressModalBtn.classList.remove("hidden");
        }
      } catch (err) {
        console.error("Error parsing SSE data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection Error:", err);
      eventSource.close();
      state.isRemoving = false;
      appendLogLine("Stream connection finished.", "info");
      closeProgressModalBtn.classList.remove("hidden");
    };

  } catch (err) {
    state.isRemoving = false;
    appendLogLine(`[ERROR] Execution Failed: ${err.message}`, "danger");
    progressStatusLabel.textContent = "Execution Failed";
    closeProgressModalBtn.classList.remove("hidden");
  }
}

/* ==========================================================================
   TAB 2: Auto Join Request Approver
   ========================================================================== */
async function loadPendingRequests(silent = false) {
  if (!state.isAuthorized) return;

  const channelId = reqChannelSelect?.value;
  if (!channelId) {
    if (!silent) alert("Please select a target channel/group first.");
    return;
  }

  state.isLoadingRequests = true;
  if (loadRequestsListBtn) loadRequestsListBtn.disabled = true;

  if (!silent && requestsTableBody) {
    requestsTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-icon-svg pulse-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <polyline points="17 11 19 13 23 9"></polyline>
              </svg>
            </div>
            <h4>Checking Telegram for Pending Join Requests...</h4>
            <p>Fetching applicants awaiting admin approval.</p>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetch(`/api/requests/list?channel_id=${encodeURIComponent(channelId)}&limit=300`);
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.detail || data.error || "Failed to fetch join requests");
    }

    state.pendingRequests = data.requests || [];
    const count = data.count !== undefined ? data.count : state.pendingRequests.length;

    if (reqPendingCountVal) reqPendingCountVal.textContent = count.toLocaleString();
    if (reqChannelTitleVal) reqChannelTitleVal.textContent = data.channel_title || "Target Channel";
    
    if (tabPendingBadge) {
      if (count > 0) {
        tabPendingBadge.textContent = count > 99 ? "99+" : count;
        tabPendingBadge.classList.remove("hidden");
      } else {
        tabPendingBadge.classList.add("hidden");
      }
    }

    state.selectedReqUserIds.clear();
    if (selectAllReqCheckbox) selectAllReqCheckbox.checked = false;

    renderRequestsTable();
    updateReqBulkActionBar();

  } catch (err) {
    console.error("Error fetching requests:", err);
    if (!silent) {
      alert(`Join Requests Error: ${err.message}`);
    }
  } finally {
    state.isLoadingRequests = false;
    if (loadRequestsListBtn) loadRequestsListBtn.disabled = false;
  }
}

function getFilteredRequests() {
  const q = state.currentReqSearchQuery.toLowerCase().trim();
  if (!q) return state.pendingRequests;

  return state.pendingRequests.filter(r => {
    const nameMatch = (r.name || "").toLowerCase().includes(q);
    const userMatch = (r.username || "").toLowerCase().includes(q);
    const idMatch = String(r.id).includes(q);
    const bioMatch = (r.about || "").toLowerCase().includes(q);
    return nameMatch || userMatch || idMatch || bioMatch;
  });
}

function renderRequestsTable() {
  const list = getFilteredRequests();

  if (list.length === 0) {
    if (state.pendingRequests.length > 0) {
      requestsTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">
            <div class="empty-state">
              <div class="empty-icon-svg">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <h4>No Applicants Match "${escapeHtml(state.currentReqSearchQuery)}"</h4>
              <p>Try a different keyword, name, @username, or User ID.</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      requestsTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">
            <div class="empty-state">
              <div class="empty-icon-svg" style="color: var(--success);">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h4 class="safe-text">Queue All Clear!</h4>
              <p>No pending join requests for this channel. All applicants have been processed.</p>
            </div>
          </td>
        </tr>
      `;
    }
    return;
  }

  requestsTableBody.innerHTML = list.map(r => {
    const isSelected = state.selectedReqUserIds.has(r.id);
    const initials = (r.first_name ? r.first_name[0] : "") + (r.last_name ? r.last_name[0] : "");
    const avatarLetter = (initials || r.name[0] || "U").toUpperCase();
    const usernameDisplay = r.username ? `@${r.username}` : `<span class="text-muted">None</span>`;
    const dateDisplay = r.requested_date ? r.requested_date.substring(0, 16) : "Recent";
    const bioDisplay = r.about ? `<div class="applicant-bio" title="${escapeHtml(r.about)}">${escapeHtml(r.about)}</div>` : "";

    return `
      <tr class="${isSelected ? 'selected' : ''}" data-req-user-id="${r.id}">
        <td class="col-check">
          <input type="checkbox" class="req-user-checkbox" data-user-id="${r.id}" ${isSelected ? 'checked' : ''} />
        </td>
        <td class="col-user">
          <div class="user-cell">
            <div class="user-avatar">${avatarLetter}</div>
            <div>
              <div class="user-info-name">${escapeHtml(r.name)}</div>
              ${bioDisplay}
            </div>
          </div>
        </td>
        <td class="col-username">
          <span class="user-username">${usernameDisplay}</span>
        </td>
        <td class="col-id">
          <span class="user-id-badge" title="Click to copy ID" onclick="navigator.clipboard.writeText('${r.id}')">${r.id}</span>
        </td>
        <td class="col-status">
          <span class="date-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${dateDisplay}
          </span>
        </td>
        <td class="col-action">
          <div class="row-actions-group">
            <button class="btn-approve-sm single-req-approve-btn" data-user-id="${r.id}" title="Approve Request">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Approve</span>
            </button>
            <button class="btn-dismiss-sm single-req-dismiss-btn" data-user-id="${r.id}" title="Dismiss / Reject">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  attachReqTableEventListeners();
}

function attachReqTableEventListeners() {
  document.querySelectorAll(".req-user-checkbox").forEach(cb => {
    cb.addEventListener("change", (e) => {
      const uid = parseInt(e.target.dataset.userId, 10);
      if (e.target.checked) {
        state.selectedReqUserIds.add(uid);
      } else {
        state.selectedReqUserIds.delete(uid);
      }
      updateReqRowSelectedClass(uid, e.target.checked);
      updateReqBulkActionBar();
    });
  });

  document.querySelectorAll(".single-req-approve-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const uid = parseInt(e.currentTarget.dataset.userId, 10);
      await handleSingleReqAction(uid, true);
    });
  });

  document.querySelectorAll(".single-req-dismiss-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const uid = parseInt(e.currentTarget.dataset.userId, 10);
      await handleSingleReqAction(uid, false);
    });
  });
}

function updateReqRowSelectedClass(userId, isSelected) {
  const row = document.querySelector(`tr[data-req-user-id="${userId}"]`);
  if (row) {
    if (isSelected) row.classList.add("selected");
    else row.classList.remove("selected");
  }
}

function updateReqBulkActionBar() {
  const count = state.selectedReqUserIds.size;
  if (count > 0) {
    bulkReqActionBar.classList.remove("hidden");
    selectedReqCountBadge.textContent = count;
    approveSelectedReqBtnText.textContent = `Approve ${count} Selected Applicant${count > 1 ? 's' : ''}`;
  } else {
    bulkReqActionBar.classList.add("hidden");
  }

  const filtered = getFilteredRequests();
  selectAllReqCheckbox.checked = filtered.length > 0 && filtered.every(r => state.selectedReqUserIds.has(r.id));
}

async function handleSingleReqAction(userId, approved) {
  const channelId = reqChannelSelect?.value;
  if (!channelId) return;

  try {
    const res = await fetch("/api/requests/approve-single", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel_id: channelId,
        user_id: userId,
        approved: approved
      })
    });
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.detail || data.error || "Action failed");
    }

    state.pendingRequests = state.pendingRequests.filter(r => r.id !== userId);
    state.selectedReqUserIds.delete(userId);

    if (approved) {
      state.sessionApprovedCount++;
      if (reqApprovedCountVal) reqApprovedCountVal.textContent = state.sessionApprovedCount.toLocaleString();
    }

    if (reqPendingCountVal) reqPendingCountVal.textContent = state.pendingRequests.length.toLocaleString();
    renderRequestsTable();
    updateReqBulkActionBar();

  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

/* ==========================================================================
   Turbo & Stream Approve All
   ========================================================================== */
async function runTurboApprove() {
  // Directly trigger the continuous live stream auto-approver for real-time progress
  runStreamApprove(null);
}

async function runStreamApprove(specificUserIds = null) {
  if (!state.isAuthorized) {
    showAuthModal();
    return;
  }

  const channelId = reqChannelSelect?.value;
  if (!channelId) {
    alert("Please select a target channel/group first.");
    return;
  }

  state.isApprovingRequests = true;
  progressModal.classList.remove("hidden");
  closeProgressModalBtn.classList.add("hidden");

  const total = specificUserIds ? specificUserIds.length : (state.pendingRequests.length || 0);
  let successful = 0;
  let failed = 0;

  progressModalTitle.textContent = specificUserIds 
    ? `Approving ${total} Selected Join Request${total > 1 ? 's' : ''}` 
    : `Turbo Approving ALL Join Requests`;
  progressModalSub.textContent = "Auto-looping batches with Telegram FloodWait rate-limit protection";
  progressStatusLabel.textContent = "Initiating multi-batch approval task...";
  progressPercentLabel.textContent = "0%";
  progressBarFill.style.width = "0%";
  progressCounts.textContent = `Processed: 0 / ${total > 0 ? total : '?'}`;
  progressSuccessCount.textContent = "Success: 0";
  progressFailCount.textContent = "Failed: 0";
  terminalLogBox.innerHTML = `<div class="log-line info">Starting join request approval stream...</div>`;

  try {
    const res = await fetch("/api/requests/stream/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel_id: channelId,
        user_ids: specificUserIds,
        delay: 0.8
      })
    });
    const initData = await res.json();

    if (!initData.success) {
      throw new Error(initData.detail || initData.error || "Failed to start approval stream");
    }

    appendLogLine(`Approval task started (ID: ${initData.task_id.substring(0, 8)}...). Streaming real-time updates...`, "info");
    progressStatusLabel.textContent = "Connected. Approving join requests...";

    const sseUrl = `/api/requests/stream?task_id=${encodeURIComponent(initData.task_id)}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.event === "start") {
          appendLogLine(`Target Chat: ${data.channel_title} (Pending: ${data.total})`, "info");
        } else if (data.event === "progress") {
          const currentTotal = data.total || total || 1;
          const pct = Math.min(100, Math.round((data.current / currentTotal) * 100));
          progressBarFill.style.width = `${pct}%`;
          progressPercentLabel.textContent = `${pct}%`;
          progressCounts.textContent = `Processed: ${data.current} / ${currentTotal}`;

          if (data.status === "success") {
            successful = data.current;
            state.sessionApprovedCount += 1;
            progressSuccessCount.textContent = `Approved: ${successful}`;
            if (reqApprovedCountVal) reqApprovedCountVal.textContent = state.sessionApprovedCount.toLocaleString();
            appendLogLine(data.message, "success");
          } else {
            failed++;
            progressFailCount.textContent = `Failed: ${failed}`;
            appendLogLine(data.message, "danger");
          }
        } else if (data.event === "flood_wait") {
          appendLogLine(`[RATE-LIMIT] ${data.message}`, "warning");
          progressStatusLabel.textContent = `Rate limiting active (Telegram FloodWait: ${data.wait_seconds}s)...`;
        } else if (data.event === "complete") {
          eventSource.close();
          state.isApprovingRequests = false;
          progressStatusLabel.textContent = "Approval Stream Complete";
          progressBarFill.style.width = "100%";
          progressPercentLabel.textContent = "100%";
          appendLogLine(`[SUCCESS] Completed! ${data.successful} requests approved, ${data.failed} failed.`, "success");
          closeProgressModalBtn.classList.remove("hidden");

          if (reqPendingCountVal) reqPendingCountVal.textContent = "0";
          if (tabPendingBadge) tabPendingBadge.classList.add("hidden");
          state.pendingRequests = [];
          state.selectedReqUserIds.clear();
          renderRequestsTable();
          updateReqBulkActionBar();
        } else if (data.event === "error") {
          eventSource.close();
          state.isApprovingRequests = false;
          appendLogLine(`[ERROR] ${data.message}`, "danger");
          closeProgressModalBtn.classList.remove("hidden");
        }
      } catch (err) {
        console.error("Error parsing SSE data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection Error:", err);
      eventSource.close();
      state.isApprovingRequests = false;
      appendLogLine("Stream finished.", "info");
      closeProgressModalBtn.classList.remove("hidden");
    };

  } catch (err) {
    state.isApprovingRequests = false;
    appendLogLine(`[ERROR] Execution Failed: ${err.message}`, "danger");
    progressStatusLabel.textContent = "Execution Failed";
    closeProgressModalBtn.classList.remove("hidden");
  }
}

/* ==========================================================================
   Auto-Pilot Daemon
   ========================================================================== */
async function toggleAutopilot() {
  if (!state.isAuthorized) {
    showAuthModal();
    return;
  }

  if (state.autopilotRunning) {
    try {
      const res = await fetch("/api/requests/autopilot/stop", { method: "POST" });
      const data = await res.json();
      state.autopilotRunning = false;
      updateAutopilotUI(data);
    } catch (err) {
      alert(`Failed to stop auto-pilot: ${err.message}`);
    }
  } else {
    const channelId = reqChannelSelect?.value;
    if (!channelId) {
      alert("Please select a target channel/group for Auto-Pilot approval.");
      return;
    }

    const interval = parseInt(autopilotInterval?.value || "30", 10);
    try {
      const res = await fetch("/api/requests/autopilot/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_id: channelId, interval_seconds: interval })
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.detail || data.error || "Failed to start auto-pilot");
      }

      state.autopilotRunning = true;
      updateAutopilotUI(data);
      startAutopilotPolling();
    } catch (err) {
      alert(`Auto-Pilot Error: ${err.message}`);
    }
  }
}

async function checkAutopilotStatus() {
  try {
    const res = await fetch("/api/requests/autopilot/status");
    const data = await res.json();
    state.autopilotRunning = !!(data.is_active || data.active);
    updateAutopilotUI(data);
    if (state.autopilotRunning) {
      startAutopilotPolling();
    }
  } catch (err) {
    console.error("Failed to check auto-pilot status:", err);
  }
}

function startAutopilotPolling() {
  if (state.autopilotPollTimer) clearInterval(state.autopilotPollTimer);
  state.autopilotPollTimer = setInterval(async () => {
    if (!state.autopilotRunning) {
      clearInterval(state.autopilotPollTimer);
      return;
    }
    await checkAutopilotStatus();
    loadPendingRequests(true);
  }, 5000);
}

function updateAutopilotUI(data) {
  const isActive = !!(data.is_active || data.active);
  state.autopilotRunning = isActive;

  if (isActive) {
    if (autopilotBtnLabel) autopilotBtnLabel.textContent = "Stop Auto-Pilot Daemon";
    if (toggleAutopilotBtn) {
      toggleAutopilotBtn.className = "btn btn-danger";
    }
    if (autopilotDot) autopilotDot.classList.add("running");
    if (autopilotStatusVal) {
      autopilotStatusVal.textContent = "RUNNING";
      autopilotStatusVal.className = "kpi-value safe-text font-mono";
    }
    if (autopilotSubtextVal) {
      autopilotSubtextVal.textContent = `Auto-approving every ${data.interval_seconds || 30}s in background`;
    }
    if (data.approved_count !== undefined && reqApprovedCountVal) {
      reqApprovedCountVal.textContent = data.approved_count.toLocaleString();
    }
  } else {
    if (autopilotBtnLabel) autopilotBtnLabel.textContent = "Start Auto-Pilot Daemon";
    if (toggleAutopilotBtn) {
      toggleAutopilotBtn.className = "btn btn-secondary";
    }
    if (autopilotDot) autopilotDot.classList.remove("running");
    if (autopilotStatusVal) {
      autopilotStatusVal.textContent = "IDLE";
      autopilotStatusVal.className = "kpi-value font-mono";
    }
    if (autopilotSubtextVal) {
      autopilotSubtextVal.textContent = "Background daemon inactive";
    }
  }
}

/* ==========================================================================
   TAB 3: Global Ban & Total Digital Wipeout Shield
   ========================================================================== */
async function resolveTargetUser() {
  if (!state.isAuthorized) {
    showAuthModal();
    return;
  }

  const query = nukeTargetInput?.value?.trim();
  if (!query) {
    alert("Please enter a Telegram @username, numeric User ID, or phone number.");
    return;
  }

  resolveTargetBtn.disabled = true;
  resolveTargetBtnText.textContent = "Inspecting...";
  targetPreviewCard.classList.add("hidden");

  try {
    const res = await fetch(`/api/nuke/resolve?query=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.detail || data.error || "Failed to resolve target");
    }

    const u = data.user;
    state.resolvedTargetUser = u;

    // Render Target Card
    const initials = (u.first_name ? u.first_name[0] : "") + (u.last_name ? u.last_name[0] : "");
    targetAvatar.textContent = (initials || u.name[0] || "U").toUpperCase();
    targetFullName.textContent = u.name;
    targetTypeBadge.textContent = u.is_bot ? "Bot Account" : "User Profile";
    targetUsername.textContent = u.username ? `@${u.username}` : (u.phone || "No Username");
    targetIdBadge.textContent = `ID: ${u.id}`;

    targetPreviewCard.classList.remove("hidden");

  } catch (err) {
    state.resolvedTargetUser = null;
    alert(`Target Lookup Error: ${err.message}`);
  } finally {
    resolveTargetBtn.disabled = false;
    resolveTargetBtnText.textContent = "Resolve & Inspect";
  }
}

async function executeTotalWipeout() {
  if (!state.isAuthorized) {
    showAuthModal();
    return;
  }

  const query = nukeTargetInput?.value?.trim();
  if (!query && !state.resolvedTargetUser) {
    alert("Please enter and resolve a target user before executing wipeout.");
    return;
  }

  const targetIdentifier = state.resolvedTargetUser?.id ? String(state.resolvedTargetUser.id) : query;
  const targetDisplayName = state.resolvedTargetUser?.name || targetIdentifier;

  // Gather options
  const options = {
    ban_from_chats: optBanChats?.checked ?? true,
    purge_messages: optPurgeMessages?.checked ?? true,
    wipe_private_chat: optWipeDm?.checked ?? true,
    block_contact: optBlockContact?.checked ?? true,
    rotate_invite_links: optRotateLinks?.checked ?? false,
    add_to_blacklist: optBlacklist?.checked ?? true,
    reason: "Bad Actor / Digital Wipeout Action"
  };

  const confirmed = confirm(
    `[SECURITY WARNING] Are you sure you want to execute a TOTAL DIGITAL WIPEOUT against:\n\nTarget: ${targetDisplayName} (${targetIdentifier})\n\nThis will permanently ban them from all your owned/admin channels and groups, wipe private DMs, block on Telegram, and register in Blacklist Sentinel.\n\nProceed?`
  );

  if (!confirmed) return;

  state.isNuking = true;
  progressModal.classList.remove("hidden");
  closeProgressModalBtn.classList.add("hidden");

  progressModalTitle.textContent = `Wiping Out: ${targetDisplayName}`;
  progressModalSub.textContent = "Coordinated multi-layer digital exclusion & privacy hardening";
  progressStatusLabel.textContent = "Initializing wipeout engine on server...";
  progressPercentLabel.textContent = "0%";
  progressBarFill.style.width = "0%";
  progressCounts.textContent = "Starting...";
  progressSuccessCount.textContent = "Actions: 0";
  progressFailCount.textContent = "Errors: 0";
  terminalLogBox.innerHTML = `<div class="log-line info">Starting coordinated digital wipeout against target ${targetDisplayName}...</div>`;

  try {
    const res = await fetch("/api/nuke/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_query: targetIdentifier,
        options: options
      })
    });
    const initData = await res.json();

    if (!initData.success) {
      throw new Error(initData.detail || initData.error || "Failed to initiate wipeout");
    }

    appendLogLine(`Wipeout task initialized (Task ID: ${initData.task_id.substring(0, 8)}...). Streaming live actions...`, "info");
    progressStatusLabel.textContent = "Connected. Executing multi-layer exclusion...";

    const sseUrl = `/api/nuke/stream?task_id=${encodeURIComponent(initData.task_id)}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.event === "start") {
          appendLogLine(`Target Verified: ${data.target_name} (${data.target_username})`, "info");
          appendLogLine(`Owned & Admin Chats Discovered: ${data.total_chats}`, "info");
        } else if (data.event === "progress") {
          const currentTotal = data.total || 1;
          const pct = Math.min(100, Math.round((data.current / currentTotal) * 100));
          progressBarFill.style.width = `${pct}%`;
          progressPercentLabel.textContent = `${pct}%`;
          progressCounts.textContent = `Progress: ${data.current} / ${currentTotal}`;

          if (data.status === "success") {
            appendLogLine(data.message, "success");
          } else if (data.status === "warning") {
            appendLogLine(data.message, "warning");
          } else {
            appendLogLine(data.message, "info");
          }
        } else if (data.event === "flood_wait") {
          appendLogLine(`[RATE-LIMIT] ${data.message}`, "warning");
          progressStatusLabel.textContent = `Rate limiting active (Telegram FloodWait: ${data.wait_seconds}s)...`;
        } else if (data.event === "complete") {
          eventSource.close();
          state.isNuking = false;
          progressStatusLabel.textContent = "Wipeout Complete";
          progressBarFill.style.width = "100%";
          progressPercentLabel.textContent = "100%";
          appendLogLine(data.message, "success");
          closeProgressModalBtn.classList.remove("hidden");

          loadBlacklist();
          nukeTargetInput.value = "";
          targetPreviewCard.classList.add("hidden");
          state.resolvedTargetUser = null;
        } else if (data.event === "error") {
          eventSource.close();
          state.isNuking = false;
          appendLogLine(`[ERROR] ${data.message}`, "danger");
          closeProgressModalBtn.classList.remove("hidden");
        }
      } catch (err) {
        console.error("Error parsing SSE data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection Error:", err);
      eventSource.close();
      state.isNuking = false;
      appendLogLine("Stream finished.", "info");
      closeProgressModalBtn.classList.remove("hidden");
    };

  } catch (err) {
    state.isNuking = false;
    appendLogLine(`[ERROR] Execution Failed: ${err.message}`, "danger");
    progressStatusLabel.textContent = "Execution Failed";
    closeProgressModalBtn.classList.remove("hidden");
  }
}

/* ==========================================================================
   Blacklist Sentinel CRUD
   ========================================================================== */
async function loadBlacklist() {
  if (!state.isAuthorized) return;

  try {
    const res = await fetch("/api/blacklist/list");
    const data = await res.json();
    state.blacklist = data.blacklist || [];

    if (blTotalCountVal) {
      blTotalCountVal.textContent = state.blacklist.length.toLocaleString();
    }

    if (tabBlacklistBadge) {
      if (state.blacklist.length > 0) {
        tabBlacklistBadge.textContent = state.blacklist.length;
        tabBlacklistBadge.classList.remove("hidden");
      } else {
        tabBlacklistBadge.classList.add("hidden");
      }
    }

    renderBlacklistTable();
  } catch (err) {
    console.error("Failed to load blacklist:", err);
  }
}

function getFilteredBlacklist() {
  const q = state.currentBlacklistSearchQuery.toLowerCase().trim();
  if (!q) return state.blacklist;

  return state.blacklist.filter(b => {
    const nameMatch = (b.name || "").toLowerCase().includes(q);
    const userMatch = (b.username || "").toLowerCase().includes(q);
    const idMatch = String(b.id).includes(q);
    const reasonMatch = (b.reason || "").toLowerCase().includes(q);
    return nameMatch || userMatch || idMatch || reasonMatch;
  });
}

function renderBlacklistTable() {
  const list = getFilteredBlacklist();

  if (list.length === 0) {
    if (state.blacklist.length > 0) {
      blacklistTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">
            <div class="empty-state">
              <div class="empty-icon-svg">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <h4>No Blacklisted Bad Actors Match "${escapeHtml(state.currentBlacklistSearchQuery)}"</h4>
              <p>Try searching by a different name, username, or User ID.</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      blacklistTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">
            <div class="empty-state">
              <div class="empty-icon-svg" style="color: var(--success);">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  <polyline points="9 12 12 15 15 9"></polyline>
                </svg>
              </div>
              <h4 class="safe-text">Blacklist Sentinel is Clear</h4>
              <p>No bad actors are currently registered. Target any abusive user above to execute total wipeout.</p>
            </div>
          </td>
        </tr>
      `;
    }
    return;
  }

  blacklistTableBody.innerHTML = list.map(b => {
    const avatarLetter = (b.name ? b.name[0] : "U").toUpperCase();
    const usernameDisplay = b.username ? `@${b.username}` : `<span class="text-muted">None</span>`;
    const dateDisplay = b.banned_at || "Recent";
    const reasonDisplay = b.reason || "Bad Actor / Spammer";
    const bannedChatsInfo = b.chats_banned_count ? ` (${b.chats_banned_count} chats)` : "";

    return `
      <tr>
        <td class="col-user">
          <div class="user-cell">
            <div class="user-avatar" style="background: linear-gradient(135deg, #ef4444, #b91c1c);">${avatarLetter}</div>
            <div>
              <div class="user-info-name">${escapeHtml(b.name)}</div>
            </div>
          </div>
        </td>
        <td class="col-username">
          <span class="user-username font-mono">${usernameDisplay}</span>
        </td>
        <td class="col-id">
          <span class="user-id-badge" title="Click to copy ID" onclick="navigator.clipboard.writeText('${b.id}')">${b.id}</span>
        </td>
        <td class="col-status">
          <span class="overlap-status-pill danger-text" style="background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.35);">
            ${escapeHtml(reasonDisplay)}${bannedChatsInfo}
          </span>
        </td>
        <td class="col-status">
          <span class="date-badge">${dateDisplay}</span>
        </td>
        <td class="col-action">
          <button class="btn btn-outline btn-sm remove-bl-btn" data-user-id="${b.id}" title="Remove from blacklist">
            <span>Unban / Clear</span>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll(".remove-bl-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const uid = parseInt(e.currentTarget.dataset.userId, 10);
      if (confirm(`Remove User ID ${uid} from Blacklist Sentinel?`)) {
        await removeBlacklistEntry(uid);
      }
    });
  });
}

async function removeBlacklistEntry(userId) {
  try {
    const res = await fetch(`/api/blacklist/remove?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE"
    });
    const data = await res.json();
    if (data.success) {
      loadBlacklist();
    }
  } catch (err) {
    alert(`Failed to remove: ${err.message}`);
  }
}

/* ==========================================================================
   Telegram Auth Flow
   ========================================================================== */
function showAuthModal() {
  authModal.classList.remove("hidden");
  authStep1.classList.remove("hidden");
  authStep2.classList.add("hidden");
  authMessage.className = "status-msg hidden";
}

function closeAuthModal() {
  authModal.classList.add("hidden");
}

async function handleSendCode() {
  const phone = authPhone.value.trim();
  const apiId = authApiId.value.trim();
  const apiHash = authApiHash.value.trim();

  if (!phone) {
    showAuthError("Please enter your Telegram phone number.");
    return;
  }

  sendCodeBtn.disabled = true;
  sendCodeBtn.textContent = "Sending Verification Code...";
  authMessage.className = "status-msg hidden";

  try {
    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone,
        api_id: apiId ? parseInt(apiId, 10) : undefined,
        api_hash: apiHash || undefined
      })
    });
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.detail || data.error || "Failed to send code");
    }

    authStep1.classList.add("hidden");
    authStep2.classList.remove("hidden");
    authCode.focus();
  } catch (err) {
    showAuthError(err.message);
  } finally {
    sendCodeBtn.disabled = false;
    sendCodeBtn.textContent = "Send Telegram Verification Code";
  }
}

async function handleVerifyCode() {
  const code = authCode.value.trim();
  const password = auth2FaPassword.value.trim();

  if (!code) {
    showAuthError("Please enter the verification code.");
    return;
  }

  verifyCodeBtn.disabled = true;
  verifyCodeBtn.textContent = "Signing In...";
  authMessage.className = "status-msg hidden";

  try {
    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code, password: password || undefined })
    });
    const data = await res.json();

    if (!data.success) {
      if (data.requires_2fa) {
        showAuthError("2FA Password Required. Please enter your 2FA password below.");
        auth2FaPassword.focus();
      } else {
        throw new Error(data.error || "Verification failed");
      }
      return;
    }

    showAuthSuccess(`Signed in successfully as ${data.user?.first_name}!`);
    setTimeout(() => {
      closeAuthModal();
      checkAuthStatus();
    }, 1200);

  } catch (err) {
    showAuthError(err.message);
  } finally {
    verifyCodeBtn.disabled = false;
    verifyCodeBtn.textContent = "Verify & Sign In";
  }
}

function showAuthError(msg) {
  authMessage.className = "status-msg error";
  authMessage.textContent = msg;
  authMessage.classList.remove("hidden");
}

function showAuthSuccess(msg) {
  authMessage.className = "status-msg success";
  authMessage.textContent = msg;
  authMessage.classList.remove("hidden");
}

/* ==========================================================================
   Utilities
   ========================================================================== */
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function appendLogLine(text, type = "info") {
  const line = document.createElement("div");
  line.className = `log-line ${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  terminalLogBox.appendChild(line);
  terminalLogBox.scrollTop = terminalLogBox.scrollHeight;
}

/* ==========================================================================
   Event Listeners Wire-Up
   ========================================================================== */
// Theme
if (themeToggleBtn) themeToggleBtn.addEventListener("click", toggleTheme);

// Auth
if (authBtn) authBtn.addEventListener("click", showAuthModal);
if (closeAuthModalBtn) closeAuthModalBtn.addEventListener("click", closeAuthModal);
if (toggleApiCredsBtn) toggleApiCredsBtn.addEventListener("click", () => apiCredsContainer.classList.toggle("hidden"));
if (sendCodeBtn) sendCodeBtn.addEventListener("click", handleSendCode);
if (verifyCodeBtn) verifyCodeBtn.addEventListener("click", handleVerifyCode);
if (backToStep1Btn) backToStep1Btn.addEventListener("click", () => {
  authStep2.classList.add("hidden");
  authStep1.classList.remove("hidden");
});

// TAB 1 Controls
if (refreshDialogsBtn) refreshDialogsBtn.addEventListener("click", loadDialogs);
if (startScanBtn) startScanBtn.addEventListener("click", runScan);

if (tableSearch) {
  tableSearch.addEventListener("input", (e) => {
    state.currentSearchQuery = e.target.value;
    renderMembersTable();
    updateBulkActionBar();
  });
}

if (selectAllCheckbox) {
  selectAllCheckbox.addEventListener("change", (e) => {
    const filtered = getFilteredMembers();
    if (e.target.checked) {
      filtered.forEach(m => state.selectedUserIds.add(m.id));
    } else {
      filtered.forEach(m => state.selectedUserIds.delete(m.id));
    }
    renderMembersTable();
    updateBulkActionBar();
  });
}

if (deselectAllBtn) {
  deselectAllBtn.addEventListener("click", () => {
    state.selectedUserIds.clear();
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    renderMembersTable();
    updateBulkActionBar();
  });
}

if (removeSelectedBtn) {
  removeSelectedBtn.addEventListener("click", () => {
    const ids = Array.from(state.selectedUserIds);
    if (ids.length === 0) return;
    confirmAndRemove(ids);
  });
}

if (removeAllBtn) {
  removeAllBtn.addEventListener("click", () => {
    if (state.overlappingMembers.length === 0) {
      alert("No overlapping members found to remove.");
      return;
    }
    const allIds = state.overlappingMembers.map(m => m.id);
    confirmAndRemove(allIds);
  });
}

if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", () => {
    if (state.overlappingMembers.length === 0) {
      alert("No overlapping members to export.");
      return;
    }
    window.location.href = "/api/export/csv";
  });
}

// TAB 2 Controls
if (reqChannelSelect) {
  reqChannelSelect.addEventListener("change", () => {
    loadPendingRequests(true);
  });
}

if (refreshRequestsBtn) refreshRequestsBtn.addEventListener("click", () => loadPendingRequests(false));
if (loadRequestsListBtn) loadRequestsListBtn.addEventListener("click", () => loadPendingRequests(false));
if (turboApproveBtn) turboApproveBtn.addEventListener("click", runTurboApprove);
if (streamApproveBtn) streamApproveBtn.addEventListener("click", () => runStreamApprove());
if (toggleAutopilotBtn) toggleAutopilotBtn.addEventListener("click", toggleAutopilot);

if (requestsTableSearch) {
  requestsTableSearch.addEventListener("input", (e) => {
    state.currentReqSearchQuery = e.target.value;
    renderRequestsTable();
    updateReqBulkActionBar();
  });
}

if (selectAllReqCheckbox) {
  selectAllReqCheckbox.addEventListener("change", (e) => {
    const filtered = getFilteredRequests();
    if (e.target.checked) {
      filtered.forEach(r => state.selectedReqUserIds.add(r.id));
    } else {
      filtered.forEach(r => state.selectedReqUserIds.delete(r.id));
    }
    renderRequestsTable();
    updateReqBulkActionBar();
  });
}

if (deselectAllReqBtn) {
  deselectAllReqBtn.addEventListener("click", () => {
    state.selectedReqUserIds.clear();
    if (selectAllReqCheckbox) selectAllReqCheckbox.checked = false;
    renderRequestsTable();
    updateReqBulkActionBar();
  });
}

if (approveSelectedReqBtn) {
  approveSelectedReqBtn.addEventListener("click", () => {
    const ids = Array.from(state.selectedReqUserIds);
    if (ids.length === 0) return;
    runStreamApprove(ids);
  });
}

if (exportRequestsCsvBtn) {
  exportRequestsCsvBtn.addEventListener("click", () => {
    const channelId = reqChannelSelect?.value;
    if (!channelId) {
      alert("Please select a target channel to export requests.");
      return;
    }
    window.location.href = `/api/requests/export/csv?channel_id=${encodeURIComponent(channelId)}`;
  });
}

// TAB 3 Controls (Global Ban & Wipeout Shield)
if (resolveTargetBtn) resolveTargetBtn.addEventListener("click", resolveTargetUser);
if (nukeTargetInput) {
  nukeTargetInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") resolveTargetUser();
  });
}
if (executeNukeBtn) executeNukeBtn.addEventListener("click", executeTotalWipeout);
if (refreshBlacklistBtn) refreshBlacklistBtn.addEventListener("click", loadBlacklist);
if (blacklistSearch) {
  blacklistSearch.addEventListener("input", (e) => {
    state.currentBlacklistSearchQuery = e.target.value;
    renderBlacklistTable();
  });
}

// Progress Modal Close Buttons
if (closeProgressModalBtn) closeProgressModalBtn.addEventListener("click", () => progressModal.classList.add("hidden"));
if (dismissProgressModalBtn) dismissProgressModalBtn.addEventListener("click", () => progressModal.classList.add("hidden"));

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initTabs();
  checkAuthStatus();
});
