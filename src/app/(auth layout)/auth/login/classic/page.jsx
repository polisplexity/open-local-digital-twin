import { redirect } from 'next/navigation'

export default function LoginClassicRedirect() {
  redirect('/auth/login')
}
