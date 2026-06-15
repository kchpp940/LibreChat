# File Metadata 域模块边界规则

## 架构分层

```
业务层 (api / client / packages)
    │  只能从 file-metadata 入口导入
    ▼
┌───────────────────────────────────┐
│  file-metadata/index.ts           │  公开 API 入口
│  ├── types.ts                     │  纯类型定义，无逻辑
│  ├── predicates.ts                │  语义判断函数
│  ├── serialize.ts                 │  唯一输出边界
│  └── normalize.ts                 │  唯一兼容 adapter（唯一允许读旧字段）
└───────────────────────────────────┘
```

## 核心规则

### 1. 旧字段只能在 normalize.ts 中读取

以下遗留字段**只允许**在 `normalize.ts` 中直接访问：

| 旧字段 | 统一语义 | 业务层应使用 |
|--------|----------|-------------|
| `file.embedded` | `indexingStatus` | `isIndexed(file)` / `getIndexingStatus(file)` |
| `file.context` | `purpose` | `getFilePurpose(file)` |
| `file.width` | `display.width` | `getDisplayWidth(file)` |
| `file.height` | `display.height` | `getDisplayHeight(file)` |
| `file.text` | `display.text` | `getDisplayText(file)` |
| `file.textFormat` | `display.textFormat` | `getDisplayTextFormat(file)` |

业务层代码**禁止**直接读取以上旧字段，必须通过语义函数间接访问。

### 2. 类型文件只导出类型，不导出函数

- `types/files.ts` 仅作为类型兼容壳存在，只 re-export 类型和枚举
- **禁止**从 `types/files` 导入 `normalizeFileMetadata`、`serializeFileMetadata` 或任何 `is*` / `get*` 函数
- 语义函数必须从 `file-metadata` 或 `librechat-data-provider` 入口导入

### 3. 输出必须经过 serialize 边界

所有对外返回的文件对象（API 响应、消息附件、上传结果等）必须经过 `serializeFileMetadata()` 处理，确保：
- 新旧字段双写保持向后兼容
- 内部字段（`__raw`、`__source` 等）被 strip
- 敏感内容按 `stripText` / `stripInternal` 选项处理

### 4. 语义判断必须先 normalize

所有 `is*` / `get*` 谓词函数内部必须先调用 `normalizeFileMetadata()`，再基于统一字段判断。
业务层直接调用语义函数即可，不需要手动 normalize。

## 允许的例外文件

以下文件可以直接访问旧字段（已在扫描脚本白名单中）：

- `packages/data-provider/src/file-metadata/normalize.ts` — 兼容 adapter 本身
- `packages/data-provider/src/file-metadata/types.ts` — 类型定义
- `packages/data-provider/src/types/files.ts` — 类型兼容壳

## 边界检查

运行边界扫描脚本验证所有规则：

```bash
# 根目录
npm run check:file-metadata-boundaries

# data-provider 包内
cd packages/data-provider
npm run check:boundaries
```

也可以通过统一 check 命令一次性运行所有质量检查：

```bash
npm run check
```

脚本会检测：
- 直接访问 `file.embedded` / `file.context` / `file.width` / `file.height` / `file.text` / `file.textFormat`
- 从 `types/files` 路径导入语义函数

## 迁移指南

### 旧代码
```typescript
if (file.embedded) {
  // ...
}
const width = file.width;
```

### 新代码
```typescript
import { isIndexed, getDisplayWidth } from 'librechat-data-provider';

if (isIndexed(file)) {
  // ...
}
const width = getDisplayWidth(file);
```

### 旧导入（禁止）
```typescript
import { normalizeFileMetadata, isImageFile } from 'librechat-data-provider/types/files';
```

### 新导入（正确）
```typescript
import { normalizeFileMetadata, isImageFile } from 'librechat-data-provider';
// 或
import { isImageFile } from 'librechat-data-provider/file-metadata';
```
