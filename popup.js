// Popup脚本
document.addEventListener('DOMContentLoaded', async () => {
  const pushSelectedBtn = document.getElementById('pushSelectedBtn');
  const pushUrlBtn = document.getElementById('pushUrlBtn');
  const selectedTextContent = document.getElementById('selectedTextContent');
  const currentUrlContent = document.getElementById('currentUrlContent');
  const statusMessage = document.getElementById('statusMessage');
  const settingsLink = document.getElementById('settingsLink');
  
  // 获取当前页面信息
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // 显示当前URL
  currentUrlContent.textContent = tab.url;
  
  // 获取选中文本
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getSelectedText
    });
    
    const selectedText = results[0]?.result;
    if (selectedText && selectedText.trim()) {
      selectedTextContent.textContent = selectedText;
      selectedTextContent.style.display = 'block';
      pushSelectedBtn.disabled = false;
    }
  } catch (error) {
    console.log('无法获取选中文本:', error);
  }
  
  // 推送选中文本
  pushSelectedBtn.addEventListener('click', async () => {
    const selectedText = selectedTextContent.textContent;
    if (!selectedText) return;
    
    showStatus('正在推送选中文本...', 'loading');
    
    try {
      await chrome.runtime.sendMessage({
        action: 'pushText',
        text: selectedText,
        source: {
          url: tab.url,
          title: tab.title
        }
      });
      
      showStatus('文本推送成功！', 'success');
    } catch (error) {
      showStatus('推送失败: ' + error.message, 'error');
    }
  });
  
  // 推送当前链接
  pushUrlBtn.addEventListener('click', async () => {
    showStatus('正在推送当前链接...', 'loading');
    
    try {
      await chrome.runtime.sendMessage({
        action: 'pushUrl',
        url: tab.url,
        source: {
          url: tab.url,
          title: tab.title
        }
      });
      
      showStatus('链接推送成功！', 'success');
    } catch (error) {
      showStatus('推送失败: ' + error.message, 'error');
    }
  });
  
  // 打开设置页面
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    window.close();
  });
});

// 获取页面选中文本的函数
function getSelectedText() {
  return window.getSelection().toString();
}

// 显示状态消息
function showStatus(message, type) {
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
  statusMessage.style.display = 'block';
  
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 2000);
  }
}