(function() {
    // Inject Styles
    const style = document.createElement('style');
    style.textContent = `
        #mbx-settings-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            background: #6045a0;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-family: 'Ubuntu', sans-serif;
            font-weight: bold;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            transition: transform 0.2s;
        }
        #mbx-settings-btn:hover {
            transform: scale(1.05);
            background: #7a5bc5;
        }
        #mbx-modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            justify-content: center;
            align-items: center;
        }
        #mbx-modal {
            background: #1a1a1a;
            color: #eee;
            width: 400px;
            max-width: 90%;
            padding: 20px;
            border-radius: 10px;
            font-family: 'Ubuntu', sans-serif;
            border: 1px solid #6045a0;
            box-shadow: 0 0 20px rgba(96, 69, 160, 0.5);
            max-height: 90vh;
            overflow-y: auto;
        }
        #mbx-modal h2 {
            margin-top: 0;
            color: #6045a0;
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
        }
        .mbx-group {
            margin-bottom: 15px;
            background: #252525;
            padding: 10px;
            border-radius: 5px;
        }
        .mbx-group h3 {
            margin: 0 0 10px 0;
            font-size: 16px;
            color: #aaa;
        }
        .mbx-field {
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .mbx-field label {
            flex: 1;
            font-size: 14px;
        }
        .mbx-field input[type="text"] {
            background: #333;
            border: 1px solid #444;
            color: white;
            padding: 5px;
            border-radius: 3px;
            width: 60%;
        }
        .mbx-field input[type="color"] {
            background: none;
            border: none;
            height: 30px;
            width: 40px;
        }
        .mbx-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
        }
        .mbx-btn {
            padding: 8px 16px;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            font-weight: bold;
        }
        .mbx-btn-save {
            background: #4CAF50;
            color: white;
        }
        .mbx-btn-close {
            background: #f44336;
            color: white;
        }
    `;
    document.head.appendChild(style);

    // Create Button
    const btn = document.createElement('button');
    btn.id = 'mbx-settings-btn';
    btn.textContent = 'Mod Settings';
    document.body.appendChild(btn);

    // Create Modal
    const modal = document.createElement('div');
    modal.id = 'mbx-modal-overlay';
    modal.innerHTML = `
        <div id="mbx-modal">
            <h2>Custom Usernames</h2>
            
            <div class="mbx-group">
                <h3>General</h3>
                <div class="mbx-field">
                    <label>Enable Mod</label>
                    <input type="checkbox" id="mbx-enabled">
                </div>
                <div class="mbx-field">
                    <label>Old Username (Regex)</label>
                    <input type="text" id="mbx-oldName" placeholder="e.g. Player">
                </div>
                <div class="mbx-field">
                    <label>New Username</label>
                    <input type="text" id="mbx-newName" placeholder="e.g. ProGamer">
                </div>
            </div>

            <div class="mbx-group">
                <h3>Profile Picture</h3>
                <div class="mbx-field">
                    <label>Enable PFP</label>
                    <input type="checkbox" id="mbx-pfpEnabled">
                </div>
                <div class="mbx-field">
                    <label>Image URL</label>
                    <input type="text" id="mbx-pfpUrl" placeholder="https://...">
                </div>
                <div class="mbx-field">
                    <label>Enable Border</label>
                    <input type="checkbox" id="mbx-pfpBorderEnabled">
                </div>
                <div class="mbx-field">
                    <label>Border Color</label>
                    <input type="color" id="mbx-pfpBorderColor" value="#FFD400">
                </div>
            </div>

            <div class="mbx-group">
                <h3>Text Style Rule</h3>
                <div class="mbx-field">
                    <label>Target Text</label>
                    <input type="text" id="mbx-style-text" placeholder="Text to style">
                </div>
                <div class="mbx-field">
                    <label>Color</label>
                    <input type="color" id="mbx-style-color" value="#FFFFFF">
                </div>
                <div class="mbx-field">
                    <label>Bold</label>
                    <input type="checkbox" id="mbx-style-bold">
                </div>
                <div class="mbx-field">
                    <label>Glow</label>
                    <input type="checkbox" id="mbx-style-glow">
                </div>
                <div class="mbx-field">
                    <label>Enable Style</label>
                    <input type="checkbox" id="mbx-style-enabled">
                </div>
            </div>

            <div class="mbx-actions">
                <button class="mbx-btn mbx-btn-close" id="mbx-close">Close</button>
                <button class="mbx-btn mbx-btn-save" id="mbx-save">Save & Apply</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Logic
    const USER_CFG_KEY = "mbx_username_config";
    const STYLE_CFG_KEY = "mbx_text_styles";

    const getEl = (id) => document.getElementById(id);

    function loadSettings() {
        if (typeof MBX_STORAGE === 'undefined') return;
        MBX_STORAGE.local.get([USER_CFG_KEY, STYLE_CFG_KEY], (data) => {
            const user = data[USER_CFG_KEY] || {};
            const styles = data[STYLE_CFG_KEY] || [];
            const style = styles[0] || {}; // We only support 1 rule in UI for now

            getEl('mbx-enabled').checked = user.enabled !== false;
            getEl('mbx-oldName').value = user.oldName || '';
            getEl('mbx-newName').value = user.newName || '';
            getEl('mbx-pfpEnabled').checked = !!user.pfpEnabled;
            getEl('mbx-pfpUrl').value = user.pfpUrl || '';
            getEl('mbx-pfpBorderEnabled').checked = !!user.pfpBorderEnabled;
            getEl('mbx-pfpBorderColor').value = user.pfpBorderColor || '#FFD400';

            getEl('mbx-style-text').value = style.text || '';
            getEl('mbx-style-color').value = style.color || '#FFFFFF';
            getEl('mbx-style-bold').checked = !!style.bold;
            getEl('mbx-style-glow').checked = !!style.glow;
            getEl('mbx-style-enabled').checked = style.enabled !== false;
        });
    }

    function saveSettings() {
        const enabled = getEl('mbx-enabled').checked;
        const oldName = getEl('mbx-oldName').value;

        if (enabled && !oldName.trim()) {
            alert('Please enter your "Old Username" (the name currently shown in game) so the mod knows what to replace.');
            getEl('mbx-oldName').focus();
            return;
        }

        const user = {
            enabled: enabled,
            oldName: oldName,
            newName: getEl('mbx-newName').value,
            pfpEnabled: getEl('mbx-pfpEnabled').checked,
            pfpUrl: getEl('mbx-pfpUrl').value,
            pfpBorderEnabled: getEl('mbx-pfpBorderEnabled').checked,
            pfpBorderColor: getEl('mbx-pfpBorderColor').value,
        };

        const style = {
            text: getEl('mbx-style-text').value,
            color: getEl('mbx-style-color').value,
            bold: getEl('mbx-style-bold').checked,
            glow: getEl('mbx-style-glow').checked,
            enabled: getEl('mbx-style-enabled').checked,
        };

        if (typeof MBX_STORAGE !== 'undefined') {
            MBX_STORAGE.local.set({
                [USER_CFG_KEY]: user,
                [STYLE_CFG_KEY]: [style] // Array as per code expectation
            }, () => {
                alert('Settings Saved! Refresh may be required for some changes.');
                modal.style.display = 'none';
            });
        }
    }

    btn.addEventListener('click', () => {
        loadSettings();
        modal.style.display = 'flex';
    });

    getEl('mbx-close').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    getEl('mbx-save').addEventListener('click', saveSettings);

    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

})();
