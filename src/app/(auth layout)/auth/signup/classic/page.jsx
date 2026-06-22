import { redirect } from 'next/navigation'

export default function SignupClassicRedirect() {
  redirect('/auth/signup')
}
