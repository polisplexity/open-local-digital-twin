import AdminRegistryPageClient from '@/components/twin-module/AdminRegistryPageClient'
import { getInitialCityRegistry } from '@/lib/platformContext.server'

export default function AdminPage() {
  const initialRegistry = getInitialCityRegistry()

  return <AdminRegistryPageClient initialRegistry={initialRegistry} />
}

