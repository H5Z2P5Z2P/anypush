// 后台脚本 - Service Worker

// 验证配置是否完整
function isConfigComplete(config, configType) {
  if (!config) return false;
  
  if (configType === 'pushServices') {
    return config.wechat && config.bark && 
           typeof config.wechat.name === 'string' && 
           typeof config.bark.name === 'string';
  }
  
  if (configType === 'pushSettings') {
    return config.textTemplate && config.urlTemplate &&
           typeof config.includeSource === 'boolean';
  }
  
  return false;
}

// 合并默认配置到现有配置
function mergeDefaultConfig(existingConfig, defaultConfig) {
  if (!existingConfig) return defaultConfig;
  
  const merged = { ...existingConfig };
  
  // 递归合并配置项
  for (const key in defaultConfig) {
    if (typeof defaultConfig[key] === 'object' && defaultConfig[key] !== null) {
      merged[key] = merged[key] ? { ...defaultConfig[key], ...merged[key] } : defaultConfig[key];
    } else if (merged[key] === undefined) {
      merged[key] = defaultConfig[key];
    }
  }
  
  return merged;
}

chrome.runtime.onInstalled.addListener(async () => {
  // 创建右键菜单
  chrome.contextMenus.create({
    id: "pushSelectedText",
    title: "推送选中文本",
    contexts: ["selection"]
  });
  
  // 优先使用云端配置，只有在云端无配置时才设置默认值
  try {
    const result = await chrome.storage.sync.get(['pushServices', 'pushSettings', 'syncConfig']);
    
    // 默认配置定义
    const defaultPushServices = {
      wechat: {
        name: "企业微信",
        enabled: false,
        webhook: ""
      },
      bark: {
        name: "Bark", 
        enabled: false,
        url: "",
        // Bark高级选项
        level: "active",
        badge: "",
        sound: "",
        group: "AnyPush",
        autoCopy: false,
        isArchive: true,
        volume: 5
      }
    };
    
    const defaultPushSettings = {
      includeSource: true,  // 是否包含来源信息
      sourceFormat: "full", // full: 完整信息, title: 仅标题, url: 仅链接, none: 不包含
      textTemplate: "{text}\n\n来源: {title}\n链接: {url}",
      urlTemplate: "{url}\n\n页面: {title}"
    };
    
    // 检查并合并pushServices配置
    if (!isConfigComplete(result.pushServices, 'pushServices')) {
      const mergedServices = mergeDefaultConfig(result.pushServices, defaultPushServices);
      await chrome.storage.sync.set({ pushServices: mergedServices });
    }
    
    // 检查并合并pushSettings配置
    if (!isConfigComplete(result.pushSettings, 'pushSettings')) {
      const mergedSettings = mergeDefaultConfig(result.pushSettings, defaultPushSettings);
      await chrome.storage.sync.set({ pushSettings: mergedSettings });
    }
    
    // 如果syncConfig不存在，设置默认的同步配置
    if (!result.syncConfig) {
      const defaultSyncConfig = {
        type: 'none',
        webdav: null
      };
      await chrome.storage.sync.set({ syncConfig: defaultSyncConfig });
    }
    
  } catch (error) {
    console.error('配置初始化失败:', error);
  }
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "pushSelectedText") {
    const selectedText = info.selectionText;
    const pageUrl = tab.url;
    const pageTitle = tab.title;
    
    await pushContent({
      type: "text",
      content: selectedText,
      source: {
        url: pageUrl,
        title: pageTitle
      }
    });
  }
});

// 监听来自popup和content script的消息
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "pushText") {
    await pushContent({
      type: "text",
      content: request.text,
      source: request.source
    });
  } else if (request.action === "pushUrl") {
    await pushContent({
      type: "url",
      content: request.url,
      source: request.source
    });
  }
  
  sendResponse({ success: true });
});

// 核心推送函数
async function pushContent(data) {
  try {
    const { pushServices, pushSettings } = await chrome.storage.sync.get(['pushServices', 'pushSettings']);
    
    if (!pushServices) {
      showNotification("错误", "请先配置推送服务");
      return;
    }
    
    // 格式化消息内容
    const formattedData = formatMessage(data, pushSettings || {});
    
    const promises = [];
    
    // 企业微信推送
    if (pushServices.wechat && pushServices.wechat.enabled) {
      promises.push(pushToWechat(formattedData, pushServices.wechat));
    }
    
    // Bark推送
    if (pushServices.bark && pushServices.bark.enabled) {
      promises.push(pushToBark(formattedData, pushServices.bark));
    }
    
    if (promises.length === 0) {
      showNotification("提醒", "没有启用的推送服务");
      return;
    }
    
    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.length - successCount;
    
    if (successCount > 0) {
      showNotification("推送成功", `成功推送到 ${successCount} 个服务`);
    }
    
    if (failureCount > 0) {
      showNotification("推送失败", `${failureCount} 个服务推送失败`);
    }
    
  } catch (error) {
    console.error('推送失败:', error);
    showNotification("推送失败", error.message);
  }
}

// 企业微信推送
async function pushToWechat(data, config) {
  const message = formatMessageForWechat(data);
  
  const requestBody = {
    msgtype: "text",
    text: {
      content: message
    }
  };
  
  const response = await fetch(config.webhook, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    throw new Error(`企业微信推送失败: ${response.status}`);
  }
  
  const result = await response.json();
  if (result.errcode !== 0) {
    throw new Error(`企业微信推送失败: ${result.errmsg}`);
  }
}

// Bark推送 - 使用GET请求，只推送内容不带标题
async function pushToBark(data, config) {
  // 从URL中提取device_key
  const urlMatch = config.url.match(/https?:\/\/[^\/]+\/([^\/]+)\/?$/);
  const deviceKey = urlMatch ? urlMatch[1] : null;
  
  if (!deviceKey) {
    throw new Error('无法从Bark URL中提取device_key，请检查URL格式');
  }
  
  // 使用GET请求格式：/:key/:body，直接推送内容作为body
  const serverUrl = config.url.match(/(https?:\/\/[^\/]+)/)[1];
  const encodedBody = encodeURIComponent(data.content);
  
  // 构建GET请求URL：/:key/:body 格式
  let requestUrl = `${serverUrl}/${deviceKey}/${encodedBody}`;
  
  // 添加查询参数
  const params = new URLSearchParams();
  
  params.set('level', config.level || 'active');
  params.set('group', config.group || 'AnyPush');
  params.set('isArchive', config.isArchive !== false ? '1' : '0');
  
  if (config.badge && config.badge.trim()) {
    params.set('badge', config.badge);
  }
  
  if (config.sound && config.sound.trim()) {
    params.set('sound', config.sound);
  }
  
  if (config.autoCopy) {
    params.set('autoCopy', '1');
  }
  
  if (config.level === 'critical' && config.volume) {
    params.set('volume', config.volume.toString());
  }
  
  requestUrl += '?' + params.toString();
  
  const response = await fetch(requestUrl, {
    method: 'GET'
  });
  
  if (!response.ok) {
    throw new Error(`Bark推送失败: ${response.status}`);
  }
  
  const result = await response.json();
  if (result.code !== 200) {
    throw new Error(`Bark推送失败: ${result.message || 'Unknown error'}`);
  }
}

// 格式化消息内容 - 根据设置决定是否包含来源信息
function formatMessage(data, settings) {
  const includeSource = settings.includeSource !== false; // 默认包含来源
  
  // 添加标记，用于后续判断是否为纯原始内容
  const processedData = {
    ...data,
    isPureContent: !includeSource, // 标记是否为纯内容
    originalUrl: data.type === 'url' ? data.content : data.source.url
  };
  
  if (!includeSource) {
    // 不包含来源信息，返回纯原始内容
    processedData.content = data.content; // 保持原始内容不变
    return processedData;
  }
  
  // 根据模板格式化消息
  let template = data.type === 'url' ? settings.urlTemplate : settings.textTemplate;
  
  // 使用默认模板如果没有配置
  if (!template) {
    if (data.type === 'url') {
      template = "{url}\n\n页面: {title}";
    } else {
      template = "{text}\n\n来源: {title}\n链接: {url}";
    }
  }
  
  // 替换模板变量
  const formattedContent = template
    .replace('{text}', data.content)
    .replace('{url}', data.source.url)
    .replace('{title}', data.source.title);
    
  processedData.content = formattedContent;
  return processedData;
}

// 格式化企业微信消息 - 只推送纯内容，不添加任何前缀
function formatMessageForWechat(data) {
  return data.content;
}

// 格式化Bark消息  
function formatMessageForBark(data) {
  return data.content;
}

// 显示通知
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: title,
    message: message
  });
}