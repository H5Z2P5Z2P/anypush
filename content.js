// 内容脚本 - 用于在页面中获取选中文本
(function() {
  'use strict';
  
  // 监听来自background的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSelectedText') {
      const selectedText = window.getSelection().toString();
      sendResponse({ selectedText: selectedText });
    }
  });
  
})();