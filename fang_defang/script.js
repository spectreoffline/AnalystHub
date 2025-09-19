// Global configuration object
let config = null;

// DOM elements
const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const defangBtn = document.getElementById('defangBtn');
const undefangBtn = document.getElementById('undefangBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const defangRulesDiv = document.getElementById('defangRules');
const undefangRulesDiv = document.getElementById('undefangRules');

// Load configuration on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfiguration();
    setupEventListeners();
    displayRules();
});

// Load configuration from config.json
async function loadConfiguration() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        config = await response.json();
        console.log('Configuration loaded successfully');
    } catch (error) {
        console.error('Error loading configuration:', error);
        // Fallback configuration if file can't be loaded
        config = {
            defangRules: [
                { description: "Defang periods", pattern: "\\.", replacement: "[.]", flags: "g" },
                { description: "Defang colons", pattern: ":", replacement: "[:]", flags: "g" },
                { description: "Defang HTTPS", pattern: "https", replacement: "hxxps", flags: "gi" },
                { description: "Defang HTTP", pattern: "http", replacement: "hxxp", flags: "gi" }
            ],
            undefangRules: [
                { description: "Undefang periods", pattern: "\\[\\.]", replacement: ".", flags: "g" },
                { description: "Undefang colons", pattern: "\\[:\\]", replacement: ":", flags: "g" },
                { description: "Undefang HXXPS", pattern: "hxxps", replacement: "https", flags: "gi" },
                { description: "Undefang HXXP", pattern: "hxxp", replacement: "http", flags: "gi" }
            ]
        };
        showNotification('Using fallback configuration. Check if config.json is accessible.', 'warning');
    }
}

// Setup event listeners
function setupEventListeners() {
    defangBtn.addEventListener('click', () => processText('defang'));
    undefangBtn.addEventListener('click', () => processText('undefang'));
    clearBtn.addEventListener('click', clearText);
    copyBtn.addEventListener('click', copyToClipboard);
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'd':
                    e.preventDefault();
                    processText('defang');
                    break;
                case 'u':
                    e.preventDefault();
                    processText('undefang');
                    break;
                case 'k':
                    e.preventDefault();
                    clearText();
                    break;
            }
        }
    });
}

// Process text based on mode (defang or undefang)
function processText(mode) {
    if (!config) {
        showNotification('Configuration not loaded yet. Please wait.', 'error');
        return;
    }

    const text = inputText.value.trim();
    if (!text) {
        showNotification('Please enter some text to process.', 'warning');
        inputText.focus();
        return;
    }

    try {
        const rules = mode === 'defang' ? config.defangRules : config.undefangRules;
        let processedText = text;

        // Apply each rule in sequence
        rules.forEach(rule => {
            try {
                const regex = new RegExp(rule.pattern, rule.flags || 'g');
                processedText = processedText.replace(regex, rule.replacement);
            } catch (error) {
                console.error(`Error applying rule "${rule.description}":`, error);
                showNotification(`Error applying rule: ${rule.description}`, 'error');
            }
        });

        outputText.value = processedText;
        
        // Show success message with statistics
        const changesCount = countDifferences(text, processedText);
        const action = mode === 'defang' ? 'defanged' : 'undefanged';
        showNotification(`Successfully ${action}! ${changesCount} changes made.`, 'success');
        
        // Focus on output for easy selection
        outputText.focus();
        
    } catch (error) {
        console.error('Error processing text:', error);
        showNotification('An error occurred while processing the text.', 'error');
    }
}

// Count the number of differences between original and processed text
function countDifferences(original, processed) {
    if (original === processed) return 0;
    
    // Simple approach: count character differences
    let changes = 0;
    const maxLength = Math.max(original.length, processed.length);
    
    for (let i = 0; i < maxLength; i++) {
        if (original[i] !== processed[i]) {
            changes++;
        }
    }
    
    // Return a reasonable estimate
    return Math.floor(changes / 2);
}

// Clear all text
function clearText() {
    inputText.value = '';
    outputText.value = '';
    inputText.focus();
    showNotification('Text cleared.', 'info');
}

// Copy output to clipboard
async function copyToClipboard() {
    const text = outputText.value.trim();
    if (!text) {
        showNotification('No text to copy.', 'warning');
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        
        // Visual feedback
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓ Copied!';
        copyBtn.classList.add('copied');
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.classList.remove('copied');
        }, 2000);
        
        showNotification('Text copied to clipboard!', 'success');
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        
        // Fallback: select the text
        outputText.select();
        outputText.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            showNotification('Text copied to clipboard!', 'success');
        } catch (fallbackError) {
            showNotification('Please manually select and copy the text.', 'error');
        }
    }
}

// Display configuration rules in the UI
function displayRules() {
    if (!config) return;

    // Display defang rules
    defangRulesDiv.innerHTML = '';
    config.defangRules.forEach(rule => {
        const ruleElement = createRuleElement(rule);
        defangRulesDiv.appendChild(ruleElement);
    });

    // Display undefang rules
    undefangRulesDiv.innerHTML = '';
    config.undefangRules.forEach(rule => {
        const ruleElement = createRuleElement(rule);
        undefangRulesDiv.appendChild(ruleElement);
    });
}

// Create a rule element for display
function createRuleElement(rule) {
    const div = document.createElement('div');
    div.className = 'rule-item';
    
    div.innerHTML = `
        <div class="rule-description">${escapeHtml(rule.description)}</div>
        <div class="rule-pattern">
            Pattern: <code>${escapeHtml(rule.pattern)}</code> → 
            <code>${escapeHtml(rule.replacement)}</code>
            ${rule.flags ? `<em>(${rule.flags})</em>` : ''}
        </div>
    `;
    
    return div;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Show notification messages
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;

    // Set background color based on type
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Set text color for warning
    if (type === 'warning') {
        notification.style.color = '#212529';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);

    // Remove after delay
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 4000);
}

// Add some example text for demonstration
function addExampleText() {
    const examples = [
        "Visit https://malicious-site.com for more information.",
        "Contact us at admin@example.org or call 192.168.1.1:8080",
        "Check out http://suspicious-domain.net/malware.exe",
        "The server is located at 10.0.0.1:443 and uses HTTPS protocol."
    ];
    
    inputText.value = examples.join('\n\n');
}

// Add example button (optional, for testing)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const exampleBtn = document.createElement('button');
    exampleBtn.textContent = '📝 Add Example';
    exampleBtn.className = 'btn btn-outline btn-small';
    exampleBtn.style.margin = '10px 0';
    exampleBtn.onclick = addExampleText;
    
    const controls = document.querySelector('.controls');
    controls.appendChild(exampleBtn);
}
