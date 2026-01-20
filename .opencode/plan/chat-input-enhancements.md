# ChatInput 组件增强计划

## 项目背景
本项目是一个基于 React + TypeScript + Vite 的智能聊天机器人应用，需要对 `ChatInput.tsx` 组件进行以下功能增强：
1. 视频上传时提取第一帧作为封面
2. 附件上传过程中禁止发送消息
3. 点击发送时等待所有附件上传完成后再调用服务端接口

## 实施计划

### 阶段一：准备工作
**任务1.1：了解项目结构和现有代码**
- 查看项目根目录结构
- 分析现有 `ChatInput.tsx` 组件的实现
- 了解类型定义和相关接口

**任务1.2：确认技术栈和依赖**
- 确认项目使用的 React、TypeScript 版本
- 检查现有的 UI 组件库和工具函数

### 阶段二：核心功能实现

#### 2.1 视频第一帧提取功能
**任务2.1.1：实现视频第一帧提取函数**
```typescript
// 在 ChatInput.tsx 中添加
const extractVideoFirstFrame = (videoUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    
    video.addEventListener('loadeddata', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const coverUrl = canvas.toDataURL('image/jpeg');
          resolve(coverUrl);
        } else {
          reject(new Error('无法获取 canvas 上下文'));
        }
      } catch (error) {
        reject(error);
      }
    });
    
    video.addEventListener('error', reject);
  });
};
```

**任务2.1.2：更新类型定义**
```typescript
// 在 types.ts 中
export interface Attachment {
  id: string;
  type: 'image' | 'video';
  url: string; // Data URL or remote URL
  name: string;
  cover?: string; // 视频封面图片的 URL（可选，仅视频类型使用）
}

// 在 ChatInput.tsx 中
interface PendingAttachment extends Attachment {
  isLoading: boolean;
}
```

#### 2.2 文件处理流程优化
**任务2.2.1：重构 processFiles 函数**
```typescript
const processFiles = async (files: File[]) => {
  const newPendingAttachments: PendingAttachment[] = files.map(file => ({
    id: uuidv4(),
    type: file.type.startsWith('image/') ? 'image' : 'video',
    url: '',
    name: file.name,
    cover: undefined, // 视频封面
    isLoading: true
  }));

  setAttachments(prev => [...prev, ...newPendingAttachments]);

  await Promise.all(files.map(async (file, index) => {
      const att = newPendingAttachments[index];
      try {
          const base64Data = await readFileAsDataURL(file);
          
          // 视频文件提取第一帧
          if (att.type === 'video') {
            const coverUrl = await extractVideoFirstFrame(base64Data);
            setAttachments(prev => prev.map(p =>
              p.id === att.id ? { ...p, cover: coverUrl } : p
            ));
          }
          
          const serverUrl = await uploadFile(base64Data);
          setAttachments(prev => prev.map(p =>
              p.id === att.id ? { ...p, url: serverUrl, isLoading: false } : p
          ));
      } catch (error) {
          console.error("Failed to upload file", file.name, error);
          setAttachments(prev => prev.filter(p => p.id !== att.id));
      }
  }));
};
```

#### 2.3 发送功能优化
**任务2.3.1：修改发送按钮状态控制**
```typescript
<button
    onClick={handleSend}
    disabled={(!inputValue.trim() && attachments.length === 0) || isLoading || attachments.some(a => a.isLoading)}
    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm font-medium text-sm"
>
    <Send className="w-4 h-4" />
    <span>
      {attachments.some(a => a.isLoading) ? '上传中...' : 'Send'}
    </span>
</button>
```

**任务2.3.2：重构 handleSend 函数**
```typescript
const handleSend = async () => {
  if ((!inputValue.trim() && attachments.length === 0) || isLoading || attachments.some(a => a.isLoading)) return;

  onSendMessage(inputValue, attachments);

  setInputValue('');
  setAttachments([]);
  setIsExpanded(false);
};
```

### 阶段三：UI 优化
**任务3.1：更新附件列表显示**
```typescript
{att.isLoading ? (
  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
) : att.type === 'image' ? (
  <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
) : att.cover ? (
  // 显示视频封面
  <div className="relative w-full h-full">
    <img src={att.cover} alt={att.name} className="w-full h-full object-cover" />
    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
      <FileVideo className="w-8 h-8 text-white" />
    </div>
  </div>
) : (
  <FileVideo className="w-8 h-8 text-gray-400" />
)}
```

### 阶段四：测试验证

**任务4.1：功能测试**
- 测试单张图片上传
- 测试单个视频上传（检查封面显示）
- 测试多个文件同时上传
- 测试上传过程中发送按钮的禁用状态
- 测试上传完成后发送功能

**任务4.2：边界情况测试**
- 测试大文件上传
- 测试网络异常情况
- 测试取消上传功能

## 技术要点

### 视频第一帧提取原理
- 使用 HTML5 Video 元素加载视频
- 监听 `loadeddata` 事件获取第一帧
- 使用 Canvas API 绘制并转换为图片

### 状态管理
- 使用 React 状态管理附件列表
- 跟踪每个附件的加载状态
- 控制发送按钮的可用性

### 用户体验优化
- 实时显示上传状态
- 提供清晰的视觉反馈
- 确保操作的一致性和可靠性

## 预期成果

实现后，用户将体验到：
- 视频上传时自动显示第一帧作为封面
- 附件上传过程中无法发送消息
- 点击发送时等待所有附件上传完成后再提交
- 更好的视觉反馈和用户体验

## 风险评估

### 技术风险
- 视频格式兼容性问题
- 视频文件大小和处理时间
- Canvas 绘制性能

### 用户体验风险
- 上传过程中的等待时间
- 错误处理和反馈

### 解决方案
- 限制文件大小
- 添加上传进度提示
- 优化错误处理和用户反馈

## 总结

本计划详细描述了 ChatInput 组件增强的所有功能和实施步骤，确保了功能完整性和用户体验的提升。通过视频封面提取、发送状态控制和优化的文件处理流程，用户将获得更流畅的聊天体验。
