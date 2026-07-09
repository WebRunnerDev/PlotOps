import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(main)/home')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(main)/home"!</div>
}
