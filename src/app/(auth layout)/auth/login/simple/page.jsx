import { redirect } from 'next/navigation'

export default function LoginSimpleRedirect() {
  redirect('/auth/login')
}
