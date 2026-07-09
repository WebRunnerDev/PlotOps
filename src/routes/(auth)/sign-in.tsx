import { createFileRoute } from '@tanstack/react-router'
import { LoginForm } from '@/features/auth'

export const Route = createFileRoute('/(auth)/sign-in')({
    component: SignInPage,
})

function SignInPage() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <LoginForm />
        </div>
    )
}