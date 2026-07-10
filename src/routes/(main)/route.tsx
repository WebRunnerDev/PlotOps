import { createFileRoute } from '@tanstack/react-router'
import { MainLayoutWidget } from '@/widgets/main-layout/ui/main-layout'

export const Route = createFileRoute('/(main)')({
  component: RouteComponent,
})

function RouteComponent() {
  return <MainLayoutWidget />
}
