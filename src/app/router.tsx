import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth } from './RequireAuth'

// Cada tela é um chunk próprio: o login não baixa o código do painel.
const AppShell = lazy(() => import('@/components/layout/AppShell'))
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const EmBrevePage = lazy(() => import('@/features/placeholder/EmBrevePage'))
const NotFoundPage = lazy(() => import('@/features/placeholder/NotFoundPage'))
const PacientesPage = lazy(() => import('@/features/pacientes/PacientesPage'))
const PacienteFormPage = lazy(() => import('@/features/pacientes/PacienteFormPage'))
const PacienteFichaPage = lazy(() => import('@/features/pacientes/PacienteFichaPage'))
const AtendimentosPage = lazy(() => import('@/features/atendimentos/AtendimentosPage'))
const AtendimentoFormPage = lazy(() => import('@/features/atendimentos/AtendimentoFormPage'))
const AtendimentoPage = lazy(() => import('@/features/atendimentos/AtendimentoPage'))

const clientes = [
  { path: 'clientes', element: <PacientesPage /> },
  { path: 'clientes/novo', element: <PacienteFormPage /> },
  { path: 'clientes/:id', element: <PacienteFichaPage /> },
  { path: 'clientes/:id/editar', element: <PacienteFormPage /> },
  { path: 'atendimentos', element: <AtendimentosPage /> },
  { path: 'atendimentos/novo', element: <AtendimentoFormPage /> },
  { path: 'atendimentos/:id', element: <AtendimentoPage /> },
  { path: 'atendimentos/:id/editar', element: <AtendimentoFormPage /> },
]

const emBreve = ['orcamentos', 'tabela-de-precos', 'configuracoes'].map((path) => ({
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
        children: [{ index: true, element: <Navigate to="/painel" replace /> }, { path: 'painel', element: <DashboardPage /> }, ...clientes, ...emBreve],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
