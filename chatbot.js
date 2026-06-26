// UTool AI Assistant - Chatbot Logic

let chatbotState = {
  geminiApiKey: localStorage.getItem("utool_gemini_key") || "",
  ttsEnabled: localStorage.getItem("utool_tts_enabled") === "true",
  isRecording: false,
  recognition: null
};

// Initialize Speech Recognition if supported
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Speech recognition is not supported in this browser.");
    return null;
  }
  
  const rec = new SpeechRecognition();
  rec.continuous = false;
  rec.lang = "en-US";
  rec.interimResults = false;
  
  rec.onstart = () => {
    chatbotState.isRecording = true;
    updateMicUI(true);
  };
  
  rec.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById("utool-chat-input-field").value = transcript;
    addChatMessage("user", transcript);
    processUserMessage(transcript);
  };
  
  rec.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    addChatMessage("bot", "Sorry, I couldn't hear that clearly. Please try again or type your request.");
  };
  
  rec.onend = () => {
    chatbotState.isRecording = false;
    updateMicUI(false);
  };
  
  return rec;
}

// Speak response if TTS is enabled
function speakText(text) {
  if (!chatbotState.ttsEnabled || !window.speechSynthesis) return;
  
  // Clean up message text (remove markdown or special symbols)
  const cleanText = text.replace(/[*#`_\-]/g, "").replace(/\[.*?\]/g, "");
  
  window.speechSynthesis.cancel(); // Stop any current speech
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

// Toggle Voice Recording
function toggleSpeech() {
  if (!chatbotState.recognition) {
    chatbotState.recognition = initSpeechRecognition();
  }
  
  if (!chatbotState.recognition) {
    alert("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.");
    return;
  }
  
  if (chatbotState.isRecording) {
    chatbotState.recognition.stop();
  } else {
    try {
      chatbotState.recognition.start();
    } catch (e) {
      console.error("Speech Recognition failed to start:", e);
    }
  }
}

function updateMicUI(isRecording) {
  const micBtn = document.getElementById("utool-chat-mic-btn");
  const inputField = document.getElementById("utool-chat-input-field");
  
  if (isRecording) {
    micBtn.classList.add("recording");
    micBtn.setAttribute("title", "Stop Listening");
    inputField.placeholder = "Listening... Speak now...";
    
    // Inject sound wave bars inside mic button
    micBtn.innerHTML = `
      <div class="utool-voice-wave-container">
        <div class="utool-wave-bar"></div>
        <div class="utool-wave-bar"></div>
        <div class="utool-wave-bar"></div>
        <div class="utool-wave-bar"></div>
        <div class="utool-wave-bar"></div>
      </div>
    `;
  } else {
    micBtn.classList.remove("recording");
    micBtn.setAttribute("title", "Click to Speak");
    inputField.placeholder = "Type your instruction here...";
    micBtn.innerHTML = `<i data-lucide="mic"></i>`;
    lucide.createIcons();
  }
}

// Add message bubble to chat window
function addChatMessage(sender, text) {
  const msgContainer = document.getElementById("utool-chat-msg-container");
  const msgRow = document.createElement("div");
  msgRow.className = `utool-msg-row ${sender}`;
  
  const bubble = document.createElement("div");
  bubble.className = "utool-msg-bubble";
  
  // Format basic lines/markdown
  let formattedText = escapeHTML(text)
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>");
    
  bubble.innerHTML = `
    ${formattedText}
    <span class="utool-msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
  `;
  
  msgRow.appendChild(bubble);
  msgContainer.appendChild(msgRow);
  
  // Scroll to bottom
  msgContainer.scrollTop = msgContainer.scrollHeight;
  
  if (sender === "bot") {
    speakText(text);
  }
}

// Initialize Chatbot UI and event listeners
function initChatbot() {
  // Inject chatbot toggle button and chatbot window
  const chatHTML = `
    <button class="utool-chat-toggle" id="utool-chat-toggle-btn" title="Ask UTool AI Assistant">
      <i data-lucide="bot"></i>
    </button>
    
    <div class="utool-chat-container" id="utool-chat-container">
      <div class="utool-chat-header">
        <div class="utool-chat-header-title">
          <i data-lucide="bot" style="color: var(--primary-orange); width:20px; height:20px;"></i>
          <div>
            <h3>UTool AI Assistant</h3>
            <span class="utool-chat-status">
              <span class="utool-chat-status-dot ${chatbotState.geminiApiKey ? 'active' : ''}" id="utool-chat-status-dot"></span>
              <span id="utool-chat-status-text">${chatbotState.geminiApiKey ? 'Gemini AI Active' : 'Offline NLP Mode'}</span>
            </span>
          </div>
        </div>
        <div class="utool-chat-header-actions">
          <button id="utool-chat-settings-btn" title="AI Settings">
            <i data-lucide="settings"></i>
          </button>
          <button id="utool-chat-close-btn" title="Minimize Panel">
            <i data-lucide="minus"></i>
          </button>
        </div>
      </div>
      
      <!-- Settings Panel -->
      <div class="utool-chat-settings-panel" id="utool-chat-settings-panel">
        <div class="utool-chat-settings-title">
          <i data-lucide="settings"></i> AI Configuration
        </div>
        
        <div class="utool-chat-settings-field">
          <label for="utool-gemini-key-input">Gemini API Key</label>
          <input type="password" id="utool-gemini-key-input" class="input-field" placeholder="Paste your Gemini API key here..." value="${chatbotState.geminiApiKey}">
          <span class="utool-chat-settings-desc">Enables free-form voice requests and natural language understanding. Keys are stored locally on your device.</span>
        </div>
        
        <div class="form-checkbox-group" style="margin-top: 0.5rem;">
          <input type="checkbox" id="utool-tts-toggle" ${chatbotState.ttsEnabled ? 'checked' : ''}>
          <label for="utool-tts-toggle" style="font-size:0.75rem; color:var(--text-main);">Enable Voice Feedback (TTS)</label>
        </div>
        
        <div style="margin-top: auto; display:flex; gap:0.5rem;">
          <button class="btn btn-secondary btn-sm" id="utool-settings-back-btn" style="flex:1;">Back to Chat</button>
          <button class="btn btn-primary btn-sm" id="utool-settings-save-btn" style="flex:1;">Save Settings</button>
        </div>
      </div>
      
      <!-- Messages List -->
      <div class="utool-chat-messages" id="utool-chat-msg-container">
        <div class="utool-msg-row bot">
          <div class="utool-msg-bubble">
            Welcome to <strong>UTool Assistant</strong>! 🛠️<br><br>
            You can <strong>speak</strong> (click microphone) or type directly. Try these commands:<br>
            • <em>"Create project Lakeview Cabin at 505 Forest Rd, budget 45000"</em><br>
            • <em>"Add 15 bundles of drywall to Lakeview Cabin"</em><br>
            • <em>"Set location of Lakeview Cabin to 77 Lakeview Ave"</em><br>
            • <em>"Set timeframe of Lakeview Cabin from July 1st to Aug 30th"</em>
            <span class="utool-msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
      
      <!-- Suggestion Chips -->
      <div class="utool-chat-suggestions">
        <span class="utool-chip" onclick="applySuggestion('Create project Beach House at 909 Coast Hwy')">New Beach House Project</span>
        <span class="utool-chip" onclick="applySuggestion('Add 20 bags of concrete mix')">Add 20 Concrete Bags</span>
      </div>
      
      <!-- Input Area -->
      <div class="utool-chat-input-area">
        <button class="utool-chat-btn-mic" id="utool-chat-mic-btn" title="Click to Speak">
          <i data-lucide="mic"></i>
        </button>
        <input type="text" class="utool-chat-input" id="utool-chat-input-field" placeholder="Type your instruction here..." autocomplete="off">
        <button class="utool-chat-btn-send" id="utool-chat-send-btn" title="Send Message">
          <i data-lucide="send"></i>
        </button>
      </div>
    </div>
  `;
  
  // Inject chatbot DOM element into the page
  const wrapper = document.createElement("div");
  wrapper.innerHTML = chatHTML;
  document.body.appendChild(wrapper);
  
  // Load Lucide icons inside injected elements
  lucide.createIcons();
  
  // Event listeners
  document.getElementById("utool-chat-toggle-btn").addEventListener("click", () => {
    document.getElementById("utool-chat-container").classList.toggle("active");
  });
  
  document.getElementById("utool-chat-close-btn").addEventListener("click", () => {
    document.getElementById("utool-chat-container").classList.remove("active");
  });
  
  document.getElementById("utool-chat-settings-btn").addEventListener("click", () => {
    document.getElementById("utool-chat-settings-panel").classList.add("active");
  });
  
  document.getElementById("utool-settings-back-btn").addEventListener("click", () => {
    document.getElementById("utool-chat-settings-panel").classList.remove("active");
  });
  
  document.getElementById("utool-settings-save-btn").addEventListener("click", saveChatSettings);
  
  document.getElementById("utool-chat-mic-btn").addEventListener("click", toggleSpeech);
  
  document.getElementById("utool-chat-send-btn").addEventListener("click", submitTextChat);
  
  document.getElementById("utool-chat-input-field").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      submitTextChat();
    }
  });

  // Init Speech Engine Reference
  chatbotState.recognition = initSpeechRecognition();
}

function applySuggestion(text) {
  document.getElementById("utool-chat-input-field").value = text;
  addChatMessage("user", text);
  processUserMessage(text);
}

// Save API Key and TTS Options
function saveChatSettings() {
  const key = document.getElementById("utool-gemini-key-input").value.trim();
  const tts = document.getElementById("utool-tts-toggle").checked;
  
  chatbotState.geminiApiKey = key;
  chatbotState.ttsEnabled = tts;
  
  localStorage.setItem("utool_gemini_key", key);
  localStorage.setItem("utool_tts_enabled", tts);
  
  const statusDot = document.getElementById("utool-chat-status-dot");
  const statusText = document.getElementById("utool-chat-status-text");
  
  if (key) {
    statusDot.classList.add("active");
    statusText.textContent = "Gemini AI Active";
  } else {
    statusDot.classList.remove("active");
    statusText.textContent = "Offline NLP Mode";
  }
  
  document.getElementById("utool-chat-settings-panel").classList.remove("active");
  addChatMessage("bot", "Settings saved successfully! " + (key ? "Gemini Online mode activated." : "Offline NLP mode activated."));
}

function submitTextChat() {
  const input = document.getElementById("utool-chat-input-field");
  const text = input.value.trim();
  if (!text) return;
  
  addChatMessage("user", text);
  input.value = "";
  processUserMessage(text);
}

// Main logic router: Send to Gemini if Key present, otherwise use offline regex parser
async function processUserMessage(text) {
  if (chatbotState.geminiApiKey) {
    try {
      await processWithGemini(text);
      return;
    } catch (err) {
      console.warn("Gemini API call failed, falling back to Offline NLP parser:", err);
      addChatMessage("bot", "*(Connection issue. Falling back to local offline parser...)*");
    }
  }
  
  // Offline NLP Fallback
  processOffline(text);
}

/* =========================================================================
   1. GEMINI ONLINE AI PARSER
   ========================================================================= */
async function processWithGemini(text) {
  const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${chatbotState.geminiApiKey}`;
  
  // Assemble context information about active projects and catalog
  const projectsList = STATE.jobs.map(j => ({
    id: j.id,
    title: j.title,
    address: j.address,
    dates: j.dates,
    budget: j.budget,
    activeInvoiceCount: j.invoices ? j.invoices.length : 0
  }));
  
  const catalog = getCatalog().map(c => ({
    id: c.id,
    name: c.name,
    basePrice: c.basePrice,
    unit: c.unit
  }));
  
  const systemPrompt = `
You are the AI Assistant for UTool, a Premium Construction Job, Crew & Billing Manager.
The current date is ${new Date().toDateString()}.
Here are the existing active construction projects in the system:
${JSON.stringify(projectsList)}

Here are the registered materials in the supplies catalog:
${JSON.stringify(catalog)}

Analyze the contractor's speech transcript or typed text. Convert their commands into a structured JSON array of operations.
Supported operations:
1. {"command": "create_project", "params": {"title": "Project Name", "address": "Site Address", "budget": 10000, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}}
2. {"command": "add_material", "params": {"projectTitle": "Project Title Match", "qty": 10, "materialName": "Name", "unit": "bags", "rate": 7.50}}
3. {"command": "set_location", "params": {"projectTitle": "Project Title Match", "address": "New Location Address"}}
4. {"command": "set_timeframe", "params": {"projectTitle": "Project Title Match", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}}
5. {"command": "chat_reply", "params": {"text": "Your helpful response explaining what you did or chatting with the user"}}

Rules:
- For 'add_material', search for the closest matching materialName in the catalog. If a material is not found in the catalog, generate parameters for a custom material (unit: "units", rate: 0.00, or estimate rate if inferred from speech).
- If a project is not specified in the speech, but you need one (e.g. for adding materials/changing location), check if there is an active project or default to the most recently created project.
- You can return multiple commands. Always include a 'chat_reply' command explaining what you did in a friendly contractor tone.
- Output ONLY the JSON array, with no Markdown wrapping or code fence. If you must use Markdown, output pure text that can be JSON-parsed. Do not write \`\`\`json.
`;

  const response = await fetch(apiURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: systemPrompt },
          { text: `User requested: "${text}"` }
        ]
      }]
    })
  });
  
  if (!response.ok) {
    throw new Error("HTTP status " + response.status);
  }
  
  const data = await response.json();
  let responseText = data.candidates[0].content.parts[0].text.trim();
  
  // Clean potential markdown blocks
  if (responseText.startsWith("```json")) {
    responseText = responseText.substring(7);
  }
  if (responseText.endsWith("```")) {
    responseText = responseText.substring(0, responseText.length - 3);
  }
  responseText = responseText.trim();
  
  let commands = JSON.parse(responseText);
  if (!Array.isArray(commands)) {
    commands = [commands];
  }
  
  let chatReply = "";
  for (const cmd of commands) {
    if (cmd.command === "chat_reply") {
      chatReply = cmd.params.text;
    } else {
      executeAction(cmd.command, cmd.params);
    }
  }
  
  if (chatReply) {
    addChatMessage("bot", chatReply);
  } else {
    addChatMessage("bot", "Command processed successfully!");
  }
}

/* =========================================================================
   2. OFFLINE NLP FALLBACK PARSER (Regex & Keywords)
   ========================================================================= */
function processOffline(text) {
  const txt = text.toLowerCase();
  
  // A. Create Project
  // Matches: "create project X", "make new project X", "new project X", "add project X"
  if (txt.includes("project") && (txt.includes("create") || txt.includes("make") || txt.includes("new") || txt.includes("add"))) {
    // Attempt parsing details
    let title = "New Construction Project";
    let address = "TBD Address";
    let budget = 0;
    let startDate = getRelativeDateString(0); // Today
    let endDate = getRelativeDateString(30); // 30 days later
    
    // Extract title: e.g. "named X" or "called X" or "project X"
    let titleMatch = text.match(/(?:named|called|project)\s+([a-zA-Z0-9\s'"]+?)(?:\s+(?:at|located|budget|from|starting|with)|$)/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    } else {
      // Fallback: search for words after project
      let altMatch = text.match(/(?:project|create)\s+([a-zA-Z0-9\s'"]+)/i);
      if (altMatch && altMatch[1]) title = altMatch[1].trim();
    }
    
    // Extract address: "at [address]" or "located at [address]"
    let addrMatch = text.match(/(?:at|located at)\s+([a-zA-Z0-9\s,.-]+?)(?:\s+(?:budget|from|starting|for)|$)/i);
    if (addrMatch) address = addrMatch[1].trim();
    
    // Extract budget: "budget [number]" or "budget of [number]"
    let budgetMatch = text.match(/budget\s*(?:of)?\s*\$?([0-9,]+)/i);
    if (budgetMatch) budget = parseFloat(budgetMatch[1].replace(/,/g, ""));
    
    // Extract timeframe durations or dates
    if (txt.includes("starting") || txt.includes("starts") || txt.includes("from")) {
      let startMatch = text.match(/(?:starting|starts|from)\s+([a-zA-Z0-9\s,.-]+?)(?:\s+(?:to|ends|ending|for)|$)/i);
      if (startMatch) {
        const parsedStart = parseSimpleDate(startMatch[1].trim());
        if (parsedStart) startDate = parsedStart;
      }
    }
    
    if (txt.includes("to") || txt.includes("ends") || txt.includes("ending")) {
      let endMatch = text.match(/(?:to|ends|ending)\s+([a-zA-Z0-9\s,.-]+?)(?:\s+(?:budget|at)|$)/i);
      if (endMatch) {
        const parsedEnd = parseSimpleDate(endMatch[1].trim());
        if (parsedEnd) endDate = parsedEnd;
      }
    }
    
    // Duration in months check: "for X months"
    let monthMatch = text.match(/for\s+(\d+)\s+month/i);
    if (monthMatch) {
      const months = parseInt(monthMatch[1]);
      const sDate = new Date(startDate);
      sDate.setMonth(sDate.getMonth() + months);
      endDate = sDate.toISOString().split("T")[0];
    }
    
    executeAction("create_project", { title, address, budget, startDate, endDate });
    addChatMessage("bot", `I've created the project **"${title}"** located at **${address}** with a budget of **${formatCurrency(budget)}** (Schedule: ${startDate} to ${endDate}).`);
    return;
  }
  
  // B. Add Materials
  // Matches: "add 15 bags of concrete mix", "add 5 studs", "add concrete to project X"
  if (txt.includes("add") && (txt.includes("material") || txt.includes("catalog") || txt.includes("mix") || txt.includes("concrete") || txt.includes("lumber") || txt.includes("stud") || txt.includes("drywall") || txt.includes("paint") || txt.includes("pipe") || txt.includes("wire") || txt.includes("nails") || txt.includes("screws") || txt.includes("tile") || txt.includes("insulation") || txt.includes("pex"))) {
    let qty = 1;
    let materialName = "";
    let projectTitle = "";
    
    // Parse quantity
    let qtyMatch = text.match(/add\s+(\d+)/i);
    if (qtyMatch) qty = parseInt(qtyMatch[1]);
    
    // Parse material name
    // Match "add X of Y" or "add X Y"
    let matMatch = text.match(/add\s+(?:\d+)?\s*(?:of)?\s*([a-zA-Z0-9\s]+?)(?:\s+to\s+project|\s+to\s+|$)/i);
    if (matMatch) {
      materialName = matMatch[1].trim().replace(/(bags|pieces|sheets|rolls|boxes|packs|gallons|sq ft)/gi, "").trim();
    }
    
    // Parse project title: "to project X" or "to X"
    let projMatch = text.match(/to\s+(?:project\s+)?([a-zA-Z0-9\s]+)/i);
    if (projMatch) projectTitle = projMatch[1].trim();
    
    // Locate the catalog match
    const catalog = getCatalog();
    let matchedItem = catalog.find(item => item.name.toLowerCase().includes(materialName.toLowerCase()));
    
    let rate = 0;
    let unit = "units";
    let displayName = materialName;
    
    if (matchedItem) {
      displayName = matchedItem.name;
      rate = matchedItem.basePrice;
      unit = matchedItem.unit;
    } else {
      // Create as custom item
      const customItem = addCustomCatalogProduct(materialName, "Other", "units", 0.00);
      displayName = customItem.name;
      rate = customItem.basePrice;
      unit = customItem.unit;
    }
    
    executeAction("add_material", { projectTitle, qty, materialName: displayName, unit, rate });
    addChatMessage("bot", `Added **${qty} ${unit}** of **"${displayName}"** to the project invoice.`);
    return;
  }
  
  // C. Set Location
  // Matches: "set location of X to Y", "set project location to Y"
  if (txt.includes("location") || txt.includes("address")) {
    let projectTitle = "";
    let address = "";
    
    let locMatch = text.match(/(?:location|address)\s+(?:of\s+([a-zA-Z0-9\s]+?)\s+)?to\s+([a-zA-Z0-9\s,.-]+)/i);
    if (locMatch) {
      projectTitle = locMatch[1] ? locMatch[1].trim() : "";
      address = locMatch[2].trim();
      
      executeAction("set_location", { projectTitle, address });
      addChatMessage("bot", `Updated project location to **${address}**.`);
      return;
    }
  }
  
  // D. Set Timeframe
  // Matches: "set timeframe of X to Y", "change dates of X to start to end"
  if (txt.includes("timeframe") || txt.includes("time frame") || txt.includes("date")) {
    let projectTitle = "";
    let startDate = "";
    let endDate = "";
    
    let dateMatch = text.match(/(?:timeframe|time frame|dates)\s+(?:of\s+([a-zA-Z0-9\s]+?)\s+)?(?:from\s+([a-zA-Z0-9\s,-]+?)\s+to\s+([a-zA-Z0-9\s,-]+))/i);
    if (dateMatch) {
      projectTitle = dateMatch[1] ? dateMatch[1].trim() : "";
      startDate = parseSimpleDate(dateMatch[2].trim()) || getRelativeDateString(0);
      endDate = parseSimpleDate(dateMatch[3].trim()) || getRelativeDateString(30);
      
      executeAction("set_timeframe", { projectTitle, startDate, endDate });
      addChatMessage("bot", `Updated project schedule to **${startDate} to ${endDate}**.`);
      return;
    }
  }
  
  // Chat fallback
  addChatMessage("bot", "I heard you, but I couldn't map that to an action. You can tell me to: 'Create project Oak Rd', 'Add 10 bags of concrete mix', 'Set location to 123 Main St', or 'Set timeframe from tomorrow to next month'.");
}

/* =========================================================================
   3. OPERATIONS EXECUTION ON STATE
   ========================================================================= */
function executeAction(command, params) {
  console.log("AI executing:", command, params);
  
  switch(command) {
    case "create_project":
      executeCreateProject(params);
      break;
    case "add_material":
      executeAddMaterial(params);
      break;
    case "set_location":
      executeSetLocation(params);
      break;
    case "set_timeframe":
      executeSetTimeframe(params);
      break;
  }
}

function executeCreateProject(p) {
  // Enforce Free plan project limit
  if (STATE.subscriptionPlan === "free" && STATE.jobs.length >= 1) {
    alert("Free Sandbox tier project limit reached. Upgrade in Cloud settings to create unlimited projects!");
    return;
  }
  
  const newJob = {
    id: "job_" + Date.now(),
    title: p.title || "New Project",
    description: p.description || "Created via UTool AI Assistant voice command",
    address: p.address || "TBD Address",
    status: "planned",
    budget: parseFloat(p.budget || 0),
    client: { name: "Client TBD", email: "client@example.com", phone: "" },
    dates: { start: p.startDate || getRelativeDateString(0), end: p.endDate || getRelativeDateString(30) },
    assignedCrew: [],
    milestones: [
      { id: "m_" + Date.now() + "_1", title: "Project Initialized by AI", date: p.startDate || getRelativeDateString(0), status: "completed" }
    ],
    contract: {
      scope: p.description || "Created via UTool AI Assistant voice command",
      clientSigned: "",
      contractorSigned: "",
      signedDate: ""
    },
    invoices: []
  };
  
  STATE.jobs.push(newJob);
  STATE.activeJobId = newJob.id; // Make it active
  
  saveData();
  renderStats();
  renderJobs();
  
  // Open the project details view automatically!
  openDetailsDrawer(newJob.id);
}

function executeAddMaterial(p) {
  let job = null;
  
  // Find project by title match, or default to activeJobId
  if (p.projectTitle) {
    job = STATE.jobs.find(j => j.title.toLowerCase().includes(p.projectTitle.toLowerCase()));
  }
  if (!job && STATE.activeJobId) {
    job = STATE.jobs.find(j => j.id === STATE.activeJobId);
  }
  if (!job && STATE.jobs.length > 0) {
    job = STATE.jobs[STATE.jobs.length - 1]; // Fallback to last created project
  }
  
  if (!job) {
    alert("Please create a project first before adding materials!");
    return;
  }
  
  // Ensure the invoices array exists
  if (!job.invoices) job.invoices = [];
  
  // Find a draft invoice or create one
  let activeInvoice = job.invoices.find(i => i.status === "draft");
  if (!activeInvoice) {
    activeInvoice = {
      id: "inv_" + Date.now(),
      invoiceNum: "INV-" + Math.floor(1000 + Math.random() * 9000),
      status: "draft",
      date: getRelativeDateString(0),
      items: [],
      labor: 120, // defaults
      markup: 15,
      tax: 8
    };
    job.invoices.push(activeInvoice);
  }
  
  // Check if item is already added to invoice
  const existing = activeInvoice.items.find(item => item.name.toLowerCase() === p.materialName.toLowerCase());
  if (existing) {
    existing.qty += parseInt(p.qty || 1);
  } else {
    activeInvoice.items.push({
      name: p.materialName,
      qty: parseInt(p.qty || 1),
      rate: parseFloat(p.rate || 0),
      unit: p.unit || "units"
    });
  }
  
  // Sync details drawer UI if open
  STATE.activeJobId = job.id;
  
  saveData();
  renderStats();
  renderJobs();
  
  // If the details drawer is open, refresh it and switch to the Invoices tab
  const detailsBackdrop = document.getElementById("details-drawer-backdrop");
  if (detailsBackdrop && detailsBackdrop.classList.contains("active")) {
    openDetailsDrawer(job.id);
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    document.getElementById("tab-invoices-btn").classList.add("active");
    document.getElementById("tab-invoices").classList.add("active");
  }
}

function executeSetLocation(p) {
  let job = null;
  if (p.projectTitle) {
    job = STATE.jobs.find(j => j.title.toLowerCase().includes(p.projectTitle.toLowerCase()));
  }
  if (!job && STATE.activeJobId) {
    job = STATE.jobs.find(j => j.id === STATE.activeJobId);
  }
  
  if (!job) return;
  
  job.address = p.address;
  saveData();
  renderJobs();
  
  // Refresh detail views if active
  const detailsBackdrop = document.getElementById("details-drawer-backdrop");
  if (detailsBackdrop && detailsBackdrop.classList.contains("active") && STATE.activeJobId === job.id) {
    openDetailsDrawer(job.id);
  }
}

function executeSetTimeframe(p) {
  let job = null;
  if (p.projectTitle) {
    job = STATE.jobs.find(j => j.title.toLowerCase().includes(p.projectTitle.toLowerCase()));
  }
  if (!job && STATE.activeJobId) {
    job = STATE.jobs.find(j => j.id === STATE.activeJobId);
  }
  
  if (!job) return;
  
  if (p.startDate) job.dates.start = p.startDate;
  if (p.endDate) job.dates.end = p.endDate;
  
  saveData();
  renderJobs();
  
  // Refresh detail views if active
  const detailsBackdrop = document.getElementById("details-drawer-backdrop");
  if (detailsBackdrop && detailsBackdrop.classList.contains("active") && STATE.activeJobId === job.id) {
    openDetailsDrawer(job.id);
  }
}

/* =========================================================================
   4. UTILITY HELPERS
   ========================================================================= */
function getRelativeDateString(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

function parseSimpleDate(text) {
  const clean = text.toLowerCase().trim();
  if (clean === "today") return getRelativeDateString(0);
  if (clean === "tomorrow") return getRelativeDateString(1);
  if (clean === "next week") return getRelativeDateString(7);
  if (clean === "next month") return getRelativeDateString(30);
  
  // Check for textual months: "July 1st", "August 30", etc.
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }
  return null;
}

// Auto-run init on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatbot);
} else {
  initChatbot();
}
