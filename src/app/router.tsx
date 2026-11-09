import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth } from './RequireAuth'
import { AppShell } from '@/components/layout/AppShell'

// Cada tela é um chunk próprio: o login não baixa o código do painel.
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const EmBrevePage = lazy(() => import('@/features/placeholder/EmBrevePage'))
const NotFoundPage = lazy(() => import('@/features/placeholder/NotFoundPage'))

const emBreve = ['clientes', 'atendimentos', 'orcamentos', 'tabela-de-precos', 'configuracoes'].map((path) => ({
  path: `${path}/*`,
  element: <EmBrevePage />,
}))

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/esqueci-senha', element: <ForgotPasswordPage /> },
  { path: '/redefinir-senha', element: <ResetPasswordPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [{ index: true, element: <Navigate to="/painel" replace /> }, { path: 'painel', element: <DashboardPage /> }, ...emBreve],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
