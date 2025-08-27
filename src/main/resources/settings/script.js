(function() {
    const settingsApiRoot = '/api/settings';
    
    // DOM elements
    const loadingOverlay = document.getElementById('loadingOverlay');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const settingsForm = document.getElementById('settingsForm');
    const saveBtn = document.getElementById('saveBtn');
    const reloadBtn = document.getElementById('reloadBtn');
    
    // State
    let currentSettings = [];
    let originalSettings = [];
    
    // Utility functions
    function showLoading(show = true) {
        loadingOverlay.classList.toggle('show', show);
    }
    
    function clearMessages() {
        errorMessage.classList.remove('show');
        successMessage.classList.remove('show');
        errorMessage.textContent = '';
        successMessage.textContent = '';
    }
    
    function showError(message) {
        clearMessages();
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
    }
    
    function showSuccess(message) {
        clearMessages();
        successMessage.textContent = message;
        successMessage.classList.add('show');
    }
    
    function setButtonLoading(button, loading) {
        if (loading) {
            button.disabled = true;
            if (!button.dataset.originalText) {
                button.dataset.originalText = button.textContent;
            }
            button.innerHTML = '<div class="spinner"></div>';
        } else {
            button.disabled = false;
            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    }
    
    // API functions
    async function fetchSettings() {
        try {
            showLoading(true);
            clearMessages();
            
            const response = await fetch(settingsApiRoot);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const settings = await response.json();
            currentSettings = [...settings];
            originalSettings = JSON.parse(JSON.stringify(settings));
            renderSettings(settings);
            
        } catch (error) {
            console.error('Error fetching settings:', error);
            showError('Ошибка загрузки настроек: ' + error.message);
        } finally {
            showLoading(false);
        }
    }
    
    async function updateSetting(name, value) {
        try {
            const response = await fetch(settingsApiRoot, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, value })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
            }
            
            return true;
        } catch (error) {
            console.error('Error updating setting:', error);
            throw error;
        }
    }
    
    // UI rendering
    function renderSettings(settings) {
        settingsForm.innerHTML = '';
        
        settings.forEach(setting => {
            const settingDiv = document.createElement('div');
            settingDiv.className = 'setting-item';
            settingDiv.dataset.name = setting.name;
            
            const isBoolean = setting.value === 'true' || setting.value === 'false';
            const isNumber = !isBoolean && !isNaN(Number(setting.value));
            
            let controlHtml;
            if (isBoolean) {
                controlHtml = `
                    <div class="checkbox-wrapper">
                        <input type="checkbox" id="setting_${setting.name}" ${setting.value === 'true' ? 'checked' : ''}>
                        <label class="checkbox-label" for="setting_${setting.name}">
                            ${setting.value === 'true' ? 'Включено' : 'Отключено'}
                        </label>
                    </div>
                `;
            } else if (isNumber) {
                controlHtml = `
                    <input type="number" id="setting_${setting.name}" value="${setting.value}" min="0" step="1">
                    <span style="font-size:.7rem; color:#6b7280;">мс</span>
                `;
            } else {
                controlHtml = `
                    <input type="text" id="setting_${setting.name}" value="${setting.value}">
                `;
            }
            
            settingDiv.innerHTML = `
                <div class="setting-header">
                    <div class="setting-name">${getSettingDisplayName(setting.name)}</div>
                </div>
                <div class="setting-comment">${setting.comment}</div>
                <div class="setting-control">
                    ${controlHtml}
                </div>
            `;
            
            settingsForm.appendChild(settingDiv);
            
            // Add event listeners
            const input = settingDiv.querySelector('input');
            if (input.type === 'checkbox') {
                input.addEventListener('change', function() {
                    const label = settingDiv.querySelector('.checkbox-label');
                    label.textContent = this.checked ? 'Включено' : 'Отключено';
                    updateCurrentSetting(setting.name, this.checked.toString());
                });
            } else {
                input.addEventListener('input', function() {
                    updateCurrentSetting(setting.name, this.value);
                });
            }
        });
    }
    
    function getSettingDisplayName(name) {
        const names = {
            'close_delay_ms': 'Задержка закрытия двери',
            'save_detection': 'Сохранение изображений',
            'use_arduino': 'Использование Arduino'
        };
        return names[name] || name;
    }
    
    function updateCurrentSetting(name, value) {
        const setting = currentSettings.find(s => s.name === name);
        if (setting) {
            setting.value = value;
        }
    }
    
    function getChangedSettings() {
        const changed = [];
        currentSettings.forEach(current => {
            const original = originalSettings.find(o => o.name === current.name);
            if (original && original.value !== current.value) {
                changed.push({
                    name: current.name,
                    value: current.value,
                    originalValue: original.value
                });
            }
        });
        return changed;
    }
    
    // Event handlers
    async function handleSave() {
        const changedSettings = getChangedSettings();
        
        if (changedSettings.length === 0) {
            showSuccess('Нет изменений для сохранения');
            return;
        }
        
        setButtonLoading(saveBtn, true);
        clearMessages();
        
        try {
            for (const setting of changedSettings) {
                await updateSetting(setting.name, setting.value);
            }
            
            // Update original settings to reflect saved state
            originalSettings = JSON.parse(JSON.stringify(currentSettings));
            
            showSuccess(`Сохранено ${changedSettings.length} настройки(ек)`);
            
        } catch (error) {
            showError('Ошибка сохранения: ' + error.message);
        } finally {
            setButtonLoading(saveBtn, false);
        }
    }
    
    async function handleReload() {
        setButtonLoading(reloadBtn, true);
        await fetchSettings();
        setButtonLoading(reloadBtn, false);
    }
    
    // Event listeners
    saveBtn.addEventListener('click', handleSave);
    reloadBtn.addEventListener('click', handleReload);
    
    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        fetchSettings();
    });
    
})();