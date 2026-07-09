import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(main)/about')({
  component: AboutPage,
})

function AboutPage() {
  return (
    <div className="flex flex-col gap-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">About</h1>
      <p className="text-muted-foreground">
        This project uses file-based routing with TanStack Router.
      </p>
    </div>
  )
}
