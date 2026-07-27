# shadcn 主题化规范

> ⚠️ **禁止硬编码**：所有样式必须使用主题变量，修改 `src/index.css` 即可全局调整风格。
>
> **kesi-frontend 注意**：在 `self-loop` 模式下实现 UI 时必须遵循本规范。

## 快速对照表

| ❌ 禁止 | ✅ 正确 | 说明 |
|--------|---------|------|
| `#ffffff` / `rgb()` | `bg-background` / `var(--background)` | 颜色变量 |
| `bg-red-500` / `text-green-500` | `bg-destructive` / `text-primary` | 语义化颜色 |
| `rounded-[8px]` | `rounded-lg` / `rounded-xl` | 圆角变量 |
| `style={{ color: '#000' }}` | `style={{ color: 'var(--foreground)' }}` | CSS 变量 |

## 可用变量

### 颜色
```
background, foreground           # 背景/前景
primary, primary-foreground      # 主色
secondary, secondary-foreground  # 次要色
muted, muted-foreground          # 柔和色
accent, accent-foreground        # 强调色
destructive, destructive-foreground  # 错误/删除
border, input, ring              # 边框/焦点
chart-1 ~ chart-5                # 图表色
```

### 圆角（基于 `--radius`）
```
rounded-sm, rounded-md, rounded-lg
rounded-xl, rounded-2xl, rounded-3xl, rounded-4xl
```

### 字体
```
font-sans, font-heading
```

## 代码示例

### ❌ 错误用法

```tsx
// 硬编码颜色
<div style={{ backgroundColor: '#ffffff', color: '#000000' }}>
<div style={{ backgroundColor: 'rgb(255, 255, 255)' }}>
<div className="bg-[#f5f5f5] text-[#333]">

// 非主题化的 Tailwind 颜色
<button className="bg-red-500 text-white">
<span className={status === 'online' ? 'text-green-500' : 'text-red-500'}>

// 硬编码圆角
<div style={{ borderRadius: '8px' }} className="rounded-[0.5rem]">

// 状态颜色硬编码
const colors = { success: '#22c55e', error: '#ef4444' }
<span style={{ color: colors[status] }}>
```

### ✅ 正确用法

```tsx
// 使用主题类名
<div className="bg-background text-foreground">
<button className="bg-primary text-primary-foreground hover:bg-primary/90">

// 使用 CSS 变量
<div style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
<div style={{ borderColor: active ? 'var(--primary)' : 'var(--border)' }}>

// 语义化圆角
<div className="rounded-lg rounded-xl">

// 状态颜色映射
const statusStyles = {
  online: 'text-primary',
  offline: 'text-muted-foreground',
  error: 'text-destructive',
}
<span className={statusStyles[status]}>

// 卡片组件
<div className="bg-card border border-border rounded-lg p-4">
  <h3 className="text-muted-foreground text-sm">标题</h3>
  <p className="text-foreground text-2xl">内容</p>
</div>

// 图表颜色
const chartColors = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)',
]

// 表格斑马纹
<tr className={index % 2 === 0 ? 'bg-muted/50' : ''}>
```

## 常见模式

### 状态指示器
```tsx
// ❌ 错误
const BadIndicator = ({ status }) => {
  const colors = { success: '#22c55e', error: '#ef4444' }
  return <span style={{ color: colors[status] }}>●</span>
}

// ✅ 正确
const GoodIndicator = ({ status }) => {
  const colors = {
    success: 'text-primary',
    error: 'text-destructive',
    warning: 'text-accent-foreground',
  }
  return <span className={colors[status]}>●</span>
}
```

### 条件边框
```tsx
// ✅ 使用主题变量
<div
  style={{
    borderColor: active ? 'var(--primary)' : 'var(--border)',
    borderWidth: active ? '2px' : '1px',
  }}
>
```

### 动态背景
```tsx
// ✅ 使用 CSS 变量
<div style={{ backgroundColor: `var(${bgColor || '--background'})` }}>
```

---

> 💡 记住：改一个 CSS 变量，全站样式跟着变。不要破坏这个能力。
