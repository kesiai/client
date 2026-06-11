# 认证模块

## 用户登录

```typescript
import { useLogin } from '@kesi/client'

function LoginForm() {
  const { onLogin, showCode, showExtra, resetVerifyCode } = useLogin()

  const handleLogin = async () => {
    try {
      const result = await onLogin({
        username: 'admin',
        password: 'password123',
        verifyCode: '123456',  // 当 showCode 为 true 时必填
        remember: true          // 使用 localStorage 而非 sessionStorage
      })

      if (result?.needChangePwd) {
        // 跳转到修改密码页面
      }
    } catch (err) {
      console.error('登录失败：', err)
    }
  }

  return <button onClick={handleLogin}>登录</button>
}
```

**返回值：** `onLogin`（登录函数）、`showCode`（是否需要验证码）、`showExtra`（额外字段）、`resetVerifyCode`（重置验证码）

## 获取用户信息

```typescript
import { useUser } from '@kesi/client'

function UserProfile() {
  const { user, setUser, loadUser, storageKey } = useUser()

  useEffect(() => {
    loadUser()  // 从 localStorage/sessionStorage 加载用户信息
  }, [])

  return (
    <div>
      <p>用户名：{user?.username}</p>
      <p>邮箱：{user?.email}</p>
    </div>
  )
}
```

## 用户登出

```typescript
import { useLogout } from '@kesi/client'

function LogoutButton() {
  const { onLogout } = useLogout()
  return <button onClick={onLogout}>登出</button>
}
```

## 用户注册

```typescript
import { useUserReg } from '@kesi/client'

function RegisterForm() {
  const { onUserReg } = useUserReg()

  const handleRegister = async () => {
    try {
      await onUserReg({
        username: 'newuser',
        password: 'password123',
        email: 'newuser@example.com'
      })
    } catch (err) {
      console.error('注册失败：', err)
    }
  }

  return <button onClick={handleRegister}>注册</button>
}
```
