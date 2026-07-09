import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { QueryClient } from '@tanstack/react-query'
import type { AuthContextValue } from '@/features/auth/model/types'

export type RouterContext = {
  queryClient: QueryClient
  auth: Pick<AuthContextValue, 'user' | 'isLoading'>
}

function RootLayout() {
  return (
    <>
      <main className="mx-auto max-w-5xl p-4">
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})
