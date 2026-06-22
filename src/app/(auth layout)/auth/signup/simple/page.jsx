import { redirect } from 'next/navigation'

export default function SignupSimpleRedirect() {
  redirect('/auth/signup')
}
