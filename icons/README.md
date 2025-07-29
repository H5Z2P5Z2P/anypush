# 图标文件

此目录包含AnyPush Chrome插件的所有图标文件：

- icon16.png (16x16像素) - 工具栏小图标
- icon32.png (32x32像素) - 扩展管理页面图标
- icon48.png (48x48像素) - 扩展详情页面图标
- icon128.png (128x128像素) - Chrome网上应用店图标

## 设计说明

图标采用Material Design风格设计：
- 主色调：蓝色 (#1a73e8)
- 设计元素：圆形背景 + 向上箭头（表示推送）+ 装饰点（表示数据传输）
- 风格：简洁现代，符合Chrome插件设计规范

## 生成方式

图标通过Python脚本 `create_icons.py` 自动生成，使用Pillow库绘制矢量图形，确保各尺寸清晰度。