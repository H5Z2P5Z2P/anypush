// 配置页面脚本
document.addEventListener('DOMContentLoaded', async () => {
  // 元素引用
  const elements = {
    // 推送设置
    includeSource: document.getElementById('includeSource'),
    sourceOptions: document.getElementById('sourceOptions'),
    textTemplate: document.getElementById('textTemplate'),
    urlTemplate: document.getElementById('urlTemplate'),
    
    // 企业微信
    wechatEnabled: document.getElementById('wechatEnabled'),
    wechatWebhook: document.getElementById('wechatWebhook'),
    testWechat: document.getElementById('testWechat'),
    
    // Bark基础配置
    barkEnabled: document.getElementById('barkEnabled'),
    barkUrl: document.getElementById('barkUrl'),
    testBark: document.getElementById('testBark'),
    
    // Bark高级选项
    barkAdvanced: document.getElementById('barkAdvanced'),
    barkLevel: document.getElementById('barkLevel'),
    barkGroup: document.getElementById('barkGroup'),
    barkBadge: document.getElementById('barkBadge'),
    barkSound: document.getElementById('barkSound'),
    barkVolume: document.getElementById('barkVolume'),
    barkVolumeGroup: document.getElementById('barkVolumeGroup'),
    barkAutoCopy: document.getElementById('barkAutoCopy'),
    barkArchive: document.getElementById('barkArchive'),
    
    // 同步配置
    syncNone: document.getElementById('syncNone'),
    syncGoogle: document.getElementById('syncGoogle'),
    syncWebdav: document.getElementById('syncWebdav'),
    webdavConfig: document.getElementById('webdavConfig'),
    webdavUrl: document.getElementById('webdavUrl'),
    webdavUsername: document.getElementById('webdavUsername'),
    webdavPassword: document.getElementById('webdavPassword'),
    
    // 操作按钮
    saveBtn: document.getElementById('saveBtn'),
    resetBtn: document.getElementById('resetBtn'),
    exportConfig: document.getElementById('exportConfig'),
    importConfig: document.getElementById('importConfig'),
    statusMessage: document.getElementById('statusMessage')
  };
  
  // 加载配置
  await loadConfig();
  
  // 事件监听
  // 推送设置
  elements.includeSource.addEventListener('change', toggleSourceOptions);
  
  // 服务配置
  elements.wechatEnabled.addEventListener('change', toggleWechatConfig);
  elements.barkEnabled.addEventListener('change', toggleBarkConfig);
  elements.testWechat.addEventListener('click', () => testPushService('wechat'));
  elements.testBark.addEventListener('click', () => testPushService('bark'));
  
  // Bark高级选项
  elements.barkLevel.addEventListener('change', toggleBarkVolumeOption);
  
  // 同步配置
  elements.syncWebdav.addEventListener('change', toggleWebdavConfig);
  elements.syncNone.addEventListener('change', toggleWebdavConfig);
  elements.syncGoogle.addEventListener('change', toggleWebdavConfig);
  
  // 操作按钮
  elements.saveBtn.addEventListener('click', saveConfig);
  elements.resetBtn.addEventListener('click', resetConfig);
  elements.exportConfig.addEventListener('click', exportConfig);
  elements.importConfig.addEventListener('click', importConfig);
  
  // 加载已保存的配置
  async function loadConfig() {
    try {
      const result = await chrome.storage.sync.get(['pushServices', 'pushSettings', 'syncConfig']);
      
      // 推送设置
      if (result.pushSettings) {
        const settings = result.pushSettings;
        elements.includeSource.checked = settings.includeSource !== false;
        elements.textTemplate.value = settings.textTemplate || '{text}\n\n来源: {title}\n链接: {url}';
        elements.urlTemplate.value = settings.urlTemplate || '{url}\n\n页面: {title}';
      }
      
      if (result.pushServices) {
        const services = result.pushServices;
        
        // 企业微信配置
        if (services.wechat) {
          elements.wechatEnabled.checked = services.wechat.enabled || false;
          elements.wechatWebhook.value = services.wechat.webhook || '';
        }
        
        // Bark配置
        if (services.bark) {
          elements.barkEnabled.checked = services.bark.enabled || false;
          elements.barkUrl.value = services.bark.url || '';
          
          // Bark高级选项
          elements.barkLevel.value = services.bark.level || 'active';
          elements.barkGroup.value = services.bark.group || 'AnyPush';
          elements.barkBadge.value = services.bark.badge || '';
          elements.barkSound.value = services.bark.sound || '';
          elements.barkVolume.value = services.bark.volume || 5;
          elements.barkAutoCopy.checked = services.bark.autoCopy || false;
          elements.barkArchive.checked = services.bark.isArchive !== false;
        }
      }
      
      if (result.syncConfig) {
        const syncConfig = result.syncConfig;
        document.querySelector(`input[name="syncType"][value="${syncConfig.type || 'none'}"]`).checked = true;
        
        if (syncConfig.webdav) {
          elements.webdavUrl.value = syncConfig.webdav.url || '';
          elements.webdavUsername.value = syncConfig.webdav.username || '';
          elements.webdavPassword.value = syncConfig.webdav.password || '';
        }
      }
      
      // 更新UI状态
      toggleSourceOptions();
      toggleWechatConfig();
      toggleBarkConfig();
      toggleBarkVolumeOption();
      toggleWebdavConfig();
      
    } catch (error) {
      showStatus('加载配置失败: ' + error.message, 'error');
    }
  }
  
  // 保存配置
  async function saveConfig() {
    try {
      // 推送设置
      const pushSettings = {
        includeSource: elements.includeSource.checked,
        textTemplate: elements.textTemplate.value.trim() || '{text}\n\n来源: {title}\n链接: {url}',
        urlTemplate: elements.urlTemplate.value.trim() || '{url}\n\n页面: {title}'
      };
      
      const pushServices = {
        wechat: {
          name: "企业微信",
          enabled: elements.wechatEnabled.checked,
          webhook: elements.wechatWebhook.value.trim()
        },
        bark: {
          name: "Bark",
          enabled: elements.barkEnabled.checked,
          url: elements.barkUrl.value.trim(),
          // Bark高级选项
          level: elements.barkLevel.value,
          group: elements.barkGroup.value.trim() || 'AnyPush',
          badge: elements.barkBadge.value.trim(),
          sound: elements.barkSound.value,
          volume: parseInt(elements.barkVolume.value) || 5,
          autoCopy: elements.barkAutoCopy.checked,
          isArchive: elements.barkArchive.checked
        }
      };
      
      const syncType = document.querySelector('input[name="syncType"]:checked').value;
      const syncConfig = {
        type: syncType,
        webdav: syncType === 'webdav' ? {
          url: elements.webdavUrl.value.trim(),
          username: elements.webdavUsername.value.trim(),
          password: elements.webdavPassword.value.trim()
        } : null
      };
      
      // 验证配置
      if (pushServices.wechat.enabled && !pushServices.wechat.webhook) {
        throw new Error('请填写企业微信Webhook URL');
      }
      
      if (pushServices.bark.enabled && !pushServices.bark.url) {
        throw new Error('请填写Bark推送地址');
      }
      
      if (syncType === 'webdav') {
        if (!syncConfig.webdav.url || !syncConfig.webdav.username || !syncConfig.webdav.password) {
          throw new Error('请完整填写WebDAV配置信息');
        }
      }
      
      await chrome.storage.sync.set({ pushSettings, pushServices, syncConfig });
      
      // 如果启用了同步，上传配置
      if (syncType !== 'none') {
        await syncConfigToCloud({ pushSettings, pushServices }, syncConfig);
      }
      
      showStatus('配置保存成功！', 'success');
      
    } catch (error) {
      showStatus('保存失败: ' + error.message, 'error');
    }
  }
  
  // 重置配置
  async function resetConfig() {
    if (!confirm('确定要重置所有配置吗？此操作不可撤销。')) {
      return;
    }
    
    try {
      await chrome.storage.sync.clear();
      await loadConfig();
      showStatus('配置已重置', 'success');
    } catch (error) {
      showStatus('重置失败: ' + error.message, 'error');
    }
  }
  
  // 测试推送服务
  async function testPushService(serviceType) {
    try {
      const testData = {
        type: 'text',
        content: '这是一条测试消息 🚀',
        source: {
          url: 'https://example.com',
          title: 'AnyPush 测试'
        }
      };
      
      if (serviceType === 'wechat') {
        const webhook = elements.wechatWebhook.value.trim();
        if (!webhook) {
          throw new Error('请先填写Webhook URL');
        }
        
        await testWechatPush(testData, webhook);
        showStatus('企业微信测试推送成功！', 'success');
        
      } else if (serviceType === 'bark') {
        const url = elements.barkUrl.value.trim();
        if (!url) {
          throw new Error('请先填写Bark URL');
        }
        
        await testBarkPush(testData, url);
        showStatus('Bark测试推送成功！', 'success');
      }
      
    } catch (error) {
      showStatus('测试失败: ' + error.message, 'error');
    }
  }
  
  // 企业微信测试推送 - 只推送纯内容，不添加前缀
  async function testWechatPush(data, webhook) {
    const message = `${data.content}\n\n来源: ${data.source.title}`;
    
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        msgtype: "text",
        text: {
          content: message
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    if (result.errcode !== 0) {
      throw new Error(result.errmsg || '推送失败');
    }
  }
  
  // Bark测试推送 - 使用GET请求
  async function testBarkPush(data, barkUrl) {
    // 从URL中提取device_key
    const urlMatch = barkUrl.match(/https?:\/\/[^\/]+\/([^\/]+)\/?$/);
    const deviceKey = urlMatch ? urlMatch[1] : null;
    
    if (!deviceKey) {
      throw new Error('无法从Bark URL中提取device_key，请检查URL格式');
    }
    
    const barkConfig = {
      level: elements.barkLevel.value,
      group: elements.barkGroup.value.trim() || 'AnyPush',
      badge: elements.barkBadge.value.trim(),
      sound: elements.barkSound.value,
      volume: parseInt(elements.barkVolume.value) || 5,
      autoCopy: elements.barkAutoCopy.checked,
      isArchive: elements.barkArchive.checked
    };
    
    // 使用GET请求格式：/:key/:body
    const serverUrl = barkUrl.match(/(https?:\/\/[^\/]+)/)[1];
    const testMessage = `${data.content}\n\n来源: ${data.source.title}`;
    const encodedBody = encodeURIComponent(testMessage);
    
    let requestUrl = `${serverUrl}/${deviceKey}/${encodedBody}`;
    
    // 添加查询参数
    const params = new URLSearchParams();
    params.set('level', barkConfig.level);
    params.set('group', barkConfig.group);
    params.set('isArchive', barkConfig.isArchive ? '1' : '0');
    
    if (barkConfig.badge) {
      params.set('badge', barkConfig.badge);
    }
    
    if (barkConfig.sound) {
      params.set('sound', barkConfig.sound);
    }
    
    if (barkConfig.autoCopy) {
      params.set('autoCopy', '1');
    }
    
    if (barkConfig.level === 'critical') {
      params.set('volume', barkConfig.volume.toString());
    }
    
    requestUrl += '?' + params.toString();
    
    const response = await fetch(requestUrl, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    if (result.code !== 200) {
      throw new Error(result.message || '推送失败');
    }
  }
  
  // 导出配置
  async function exportConfig() {
    try {
      const result = await chrome.storage.sync.get();
      const configData = JSON.stringify(result, null, 2);
      
      const blob = new Blob([configData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `anypush-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      showStatus('配置导出成功', 'success');
      
    } catch (error) {
      showStatus('导出失败: ' + error.message, 'error');
    }
  }
  
  // 导入配置
  async function importConfig() {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
          const text = await file.text();
          const config = JSON.parse(text);
          
          await chrome.storage.sync.set(config);
          await loadConfig();
          
          showStatus('配置导入成功', 'success');
        } catch (error) {
          showStatus('导入失败: ' + error.message, 'error');
        }
      };
      
      input.click();
      
    } catch (error) {
      showStatus('导入失败: ' + error.message, 'error');
    }
  }
  
  // 配置云同步
  async function syncConfigToCloud(pushServices, syncConfig) {
    if (syncConfig.type === 'google') {
      // Google账户同步 - 已经使用chrome.storage.sync
      return;
    } else if (syncConfig.type === 'webdav') {
      // WebDAV同步
      await syncToWebDAV(pushServices, syncConfig.webdav);
    }
  }
  
  // WebDAV同步
  async function syncToWebDAV(config, webdavConfig) {
    const configData = JSON.stringify(config, null, 2);
    const fileName = 'anypush-config.json';
    const url = webdavConfig.url + fileName;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + btoa(webdavConfig.username + ':' + webdavConfig.password),
        'Content-Type': 'application/json'
      },
      body: configData
    });
    
    if (!response.ok) {
      throw new Error(`WebDAV同步失败: ${response.status}`);
    }
  }
  
  // UI控制函数
  function toggleSourceOptions() {
    const includeSource = elements.includeSource.checked;
    elements.sourceOptions.style.display = includeSource ? 'block' : 'none';
  }
  
  function toggleWechatConfig() {
    elements.wechatWebhook.disabled = !elements.wechatEnabled.checked;
    elements.testWechat.disabled = !elements.wechatEnabled.checked;
  }
  
  function toggleBarkConfig() {
    const enabled = elements.barkEnabled.checked;
    elements.barkUrl.disabled = !enabled;
    elements.testBark.disabled = !enabled;
    elements.barkAdvanced.style.display = enabled ? 'block' : 'none';
    
    // 禁用/启用所有Bark高级选项
    const advancedElements = [
      elements.barkLevel, elements.barkGroup, elements.barkBadge,
      elements.barkSound, elements.barkVolume, elements.barkAutoCopy,
      elements.barkArchive
    ];
    
    advancedElements.forEach(el => {
      if (el) el.disabled = !enabled;
    });
  }
  
  function toggleBarkVolumeOption() {
    const isCritical = elements.barkLevel.value === 'critical';
    elements.barkVolumeGroup.style.display = isCritical ? 'block' : 'none';
  }
  
  function toggleWebdavConfig() {
    const isWebdav = elements.syncWebdav.checked;
    elements.webdavConfig.style.display = isWebdav ? 'block' : 'none';
  }
  
  // 显示状态消息
  function showStatus(message, type) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message status-${type}`;
    elements.statusMessage.style.display = 'block';
    
    setTimeout(() => {
      elements.statusMessage.style.display = 'none';
    }, 3000);
  }
});