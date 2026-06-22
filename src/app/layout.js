import { GlobalStateProvider } from '@/context/GolobalStateProvider';
import { PlatformContextProvider } from '@/context/PlatformContext';
import { getInitialPlatformContext } from '@/lib/platformContext.server';
import { ThemeProvider } from '@/layout/theme-provider/theme-provider';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-perfect-scrollbar/dist/css/styles.css';
import '@/styles/scss/style.scss';

// metadata
export const metadata = {
  title: 'Twin Base Studio | Polisplexity',
  description: 'Institutional, municipal, and public digital twin workspace powered by Polisplexity.',
  keywords: ['digital twin', 'municipal twin', '3d city', 'public dashboard', 'polisplexity', 'logical digital twin'],
}

export const dynamic = 'force-dynamic'
export const revalidate = 0


export default function RootLayout({ children }) {
  const initialPlatformContext = getInitialPlatformContext()

  return (
    <html
      lang="en"
      data-bs-theme="dark"
      style={{ '--font-jampack': '"DM Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      <body>
        <ThemeProvider>

          <GlobalStateProvider>
            <PlatformContextProvider initialContext={initialPlatformContext}>
              {children}
            </PlatformContextProvider>
          </GlobalStateProvider>
        </ThemeProvider>

      </body>
    </html>
  )
}
