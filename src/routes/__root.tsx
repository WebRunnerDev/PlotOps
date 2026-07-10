import type { QueryClient } from '@tanstack/react-query'

import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import type { AuthContextValue } from '@/features/auth/model/types'
import { GridPattern } from '@/shared/shadcn'
import { cn } from '@/shared'

export type RouterContext = {
  auth: Pick<AuthContextValue, 'isLoading' | 'user'>
  queryClient: QueryClient
}

function RootLayout() {
  return (
    <>
      <main className="min-h-screen">
        <Outlet />
        <GridPattern
          width={32}
          height={32}
          x={-1}
          y={-1}
          className={cn(
            "stroke-grid/40 -z-50",
            "mask-[radial-gradient(ellipse_at_center,white,transparent_80%)]",
          )}
        />
      </main>
      <TanStackRouterDevtools />
    </>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})
