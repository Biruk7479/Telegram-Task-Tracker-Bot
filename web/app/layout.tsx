import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import StylePicker from '@/components/StylePicker'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Lizen · Zen & Lily',
  description: 'Track your productivity with gamification',
}

// Applied before the first paint so the chosen card style (and dark mode,
// which the pages save) never flashes in late.
const boot = `try{var d=document.documentElement;d.dataset.surface=localStorage.getItem('surfaceStyle')||'blur';if(localStorage.getItem('darkMode')==='true')d.classList.add('dark')}catch(e){}`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-surface="blur" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body className={inter.className}>
        <div className="backdrop-layer" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {children}
        <StylePicker />
      </body>
    </html>
  )
}
