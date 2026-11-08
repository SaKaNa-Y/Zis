import { Text } from '@/lib/i18n/context'
import { ZisBrand } from '../destinations'
import { login } from './actions'

export const metadata = { title: 'Sign in — Zis' }

export default function LoginPage() {
  return (
    <div className="publication-shell">
      <header className="publication-header"><ZisBrand /></header>
      <main className="publication-login">
        <h1 className="publication-title"><Text en="Reader access" zh="进入阅读空间" /></h1>
        <p><Text en="Enter your passphrase to read Zis." zh="输入口令即可阅读 Zis 的文章。" /></p>
        <form action={login}>
          <label htmlFor="passphrase"><Text en="Passphrase" zh="口令" /></label>
          <input id="passphrase" name="passphrase" type="password" required autoComplete="current-password" autoCapitalize="none" spellCheck={false} />
          <button type="submit"><Text en="Sign in" zh="登录" /></button>
        </form>
      </main>
    </div>
  )
}
