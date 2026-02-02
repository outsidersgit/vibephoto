'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Sparkles, User, Settings, LogOut, CreditCard, Camera, ImageIcon, Users, Package, Crown, History, UserCircle, MessageSquare, Coins, Plus, Receipt, List, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useLogout } from '@/hooks/useLogout'
import { VibePhotoLogo } from '@/components/ui/vibephoto-logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PackageSelectorModal } from '@/components/credits/package-selector-modal'
import { useCreditBalance } from '@/hooks/useCredits'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'

interface PremiumNavigationProps {
  className?: string
}

export function PremiumNavigation({ className }: PremiumNavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showPackageSelector, setShowPackageSelector] = useState(false)
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const { data: session, status, update: updateSession } = useSession()
  const { logout } = useLogout()
  
  // 🔒 CRITICAL: Maintain previous session state during updates to prevent flash
  // When updateSession() is called, status temporarily becomes 'loading', causing UI flash
  const [stableSession, setStableSession] = useState(session)
  const [stableStatus, setStableStatus] = useState(status)
  
  // Update stable session only when we have a valid authenticated session
  useEffect(() => {
    if (status === 'authenticated' && session) {
      setStableSession(session)
      setStableStatus('authenticated')
    } else if (status === 'unauthenticated') {
      // Only clear if truly unauthenticated (not just loading)
      setStableSession(null)
      setStableStatus('unauthenticated')
    }
    // Don't update during 'loading' state to prevent flash
  }, [session, status])
  
  // Use stable session/status for UI rendering to prevent flash
  const displaySession = stableSession
  const displayStatus = stableStatus
  
  // Performance: Usar React Query para cache de créditos (Sprint 2 - Navegação Rápida)
  // CRITICAL: Só buscar créditos se há sessão válida
  const { data: balance } = useCreditBalance()
  const creditsBalance = (displayStatus === 'authenticated' && displaySession?.user) ? (balance?.totalCredits || null) : null

  // CRITICAL: Listener SSE para invalidar queries quando créditos são atualizados
  // CRITICAL: Handler deve forçar refetch imediato para atualizar badge
  useRealtimeUpdates({
    onCreditsUpdate: (creditsUsed, creditsLimit, action) => {
      console.log('🔄 [PremiumNavigation] Créditos atualizados via SSE - invalidando queries e forçando refetch', { creditsUsed, creditsLimit, action })
      // CRITICAL: Invalidar queries e forçar refetch imediato
      queryClient.invalidateQueries({ queryKey: ['credits'] })
      // CRITICAL: Refetch imediato para atualizar badge sem esperar
      queryClient.refetchQueries({ queryKey: ['credits', 'balance'] })
      updateSession()
    },
    onUserUpdate: (updatedFields) => {
      // CRITICAL: Admin atualizou usuário (plano, status, etc.) - atualizar sessão e invalidar queries
      console.log('🔄 [PremiumNavigation] Usuário atualizado via admin - atualizando sessão e queries', updatedFields)
      queryClient.invalidateQueries({ queryKey: ['credits'] })
      queryClient.invalidateQueries({ queryKey: ['user'] })
      updateSession() // CRITICAL: Atualizar sessão para refletir mudanças de plano/status
    },
  })

  // Helper: Check if user has active subscription access
  const hasActiveAccess = () => {
    if (!displaySession?.user) return false

    const user = displaySession.user as any

    // Debug log apenas em desenvolvimento (Sprint 2 - Limpar Console)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 PremiumNavigation Access Check:', {
        subscriptionStatus: user.subscriptionStatus,
        plan: user.plan,
        hasAccess: user.subscriptionStatus === 'ACTIVE'
      })
    }

    // STRICT: Only allow access if subscriptionStatus is ACTIVE
    return user.subscriptionStatus === 'ACTIVE'
  }

  const handlePackageSelector = () => {
    setShowPackageSelector(true)
  }

  const handlePurchaseSuccess = () => {
    // CRITICAL: Invalidar queries após compra bem-sucedida
    console.log('🔄 [PremiumNavigation] Invalidando queries após compra')
    queryClient.invalidateQueries({ queryKey: ['credits'] })
    queryClient.invalidateQueries({ queryKey: ['user'] })
    
    // Atualizar sessão para refletir mudanças
    updateSession()
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navigationItems = hasActiveAccess() ? [
    { name: 'Modelos', href: '/models', icon: <Users className="w-4 h-4" /> },
    { name: 'Gerar', href: '/generate', icon: <Camera className="w-4 h-4" /> },
    { name: 'Studio IA', href: '/editor', icon: <Wand2 className="w-4 h-4" /> },
    { name: 'Galeria', href: '/gallery', icon: <ImageIcon className="w-4 h-4" /> },
    { name: 'Pacotes', href: '/packages', icon: <Package className="w-4 h-4" /> },
    { name: 'Créditos', href: '/credits', icon: <Coins className="w-4 h-4" /> },
  ] : []

  // Helper: Check if current path matches the nav item
  const isActivePath = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/')
  }

  return (
    <motion.header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        {
          'bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg': isScrolled,
          'bg-transparent': !isScrolled,
        },
        className
      )}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href="/" className="flex items-center space-x-2">
              <VibePhotoLogo size="md" showText={true} />
            </Link>
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navigationItems.map((item) => {
              const isActive = isActivePath(item.href)
              return (
                <motion.div
                  key={item.name}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative"
                >
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-2 font-medium transition-all duration-200 relative",
                      isActive
                        ? "text-slate-900"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {item.icon}
                    <span>{item.name}</span>

                    {/* Active indicator - animated underline */}
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-[#667EEA] to-[#764BA2] rounded-full"
                        initial={false}
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30
                        }}
                      />
                    )}
                  </Link>
                </motion.div>
              )
            })}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center space-x-4">
            {displaySession && displayStatus === 'authenticated' ? (
              <div className="flex items-center space-x-3">
                {hasActiveAccess() && (
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="flex items-center px-3 py-1.5 rounded-lg bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600 shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    <span className="text-xs font-medium text-slate-200 uppercase" style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}>
                      {displaySession.user?.plan || 'STARTER'}
                    </span>
                  </motion.div>
                )}

                {hasActiveAccess() && creditsBalance !== null && (
                  <div className="relative group">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      className="group relative flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-transparent shadow-sm hover:shadow-lg hover:bg-blue-50 transition-all duration-200 cursor-pointer"
                      style={{
                        background: 'linear-gradient(white, white) padding-box, linear-gradient(135deg, #667EEA, #764BA2) border-box',
                        border: '1px solid transparent'
                      }}
                      title="Clique para adicionar créditos"
                    >
                      <Coins className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-600 transition-colors" />
                      <span className="text-xs font-semibold text-gray-700 group-hover:text-blue-700 transition-colors" style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}>
                        {creditsBalance.toLocaleString()}
                      </span>
                      <Plus className="w-3 h-3 text-green-600 opacity-100 ml-1" />
                    </motion.button>

                    {/* Dropdown Menu */}
                    <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-lg shadow-2xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      <button
                        onClick={handlePackageSelector}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors rounded-lg"
                        style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}
                      >
                        <div className="flex items-center">
                          <Plus className="w-3.5 h-3.5 mr-2.5 text-green-600" />
                          <span className="font-medium text-sm text-gray-900">Adicionar Créditos</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="relative group">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center space-x-2 p-2 rounded-full hover:bg-slate-100 transition-colors"
                  >
                    {displaySession.user?.image ? (
                      <img 
                        src={displaySession.user.image} 
                        alt="Avatar" 
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#667EEA] to-[#764BA2] flex items-center justify-center text-white font-semibold text-sm shadow-lg">
                        {displaySession.user?.name?.[0] || displaySession.user?.email?.[0] || 'U'}
                      </div>
                    )}
                  </motion.button>
                  
                  {/* Dropdown Menu */}
                  <div className="absolute right-0 top-full mt-2 w-64 bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl shadow-2xl border border-slate-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="p-4 border-b border-gray-700">
                      <p className="text-base font-semibold text-white leading-tight" style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}>{displaySession.user?.name}</p>
                      <p className="text-sm text-gray-300 leading-tight" style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}>{displaySession.user?.email}</p>
                    </div>
                    <nav className="p-2">
                      {hasActiveAccess() ? (
                        <>
                          <Link href="/billing" className="flex items-center space-x-3 px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors" style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}>
                            <CreditCard className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-200 font-medium text-sm">Minha Assinatura</span>
                          </Link>
                          <Link href="/account/history" className="flex items-center space-x-3 px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors" style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}>
                            <History className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-200 font-medium text-sm">Histórico de Pagamentos</span>
                          </Link>
                          <Link href="/account/orders" className="flex items-center space-x-3 px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors" style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}>
                            <List className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-200 font-medium text-sm">Ordens</span>
                          </Link>
                          <Link href="/profile" className="flex items-center space-x-3 px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors" style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}>
                            <UserCircle className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-200 font-medium text-sm">Perfil</span>
                          </Link>
                          <Link href="/support" className="flex items-center space-x-3 px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors" style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}>
                            <MessageSquare className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-200 font-medium text-sm">Fale Conosco</span>
                          </Link>
                          <div className="border-t border-gray-700 my-2"></div>
                        </>
                      ) : (
                        <div className="px-4 py-3">
                          <p className="text-sm text-gray-300 mb-3" style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}>
                            Assine para acessar todas as funcionalidades
                          </p>
                          <Link href="/pricing" className="block w-full">
                            <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-2">
                              Ver Planos
                            </Button>
                          </Link>
                          <div className="border-t border-gray-700 my-3"></div>
                        </div>
                      )}
                      <button
                        onClick={() => logout()}
                        className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg hover:bg-red-900/20 transition-colors text-left"
                        style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}
                      >
                        <LogOut className="w-4 h-4 text-red-400" />
                        <span className="text-red-400 font-medium text-sm">Sair</span>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="ghost" asChild>
                    <Link href="/auth/signin">Entrar</Link>
                  </Button>
                </motion.div>
                
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button 
                    className="bg-gray-900 hover:bg-gray-800 text-white font-semibold px-6 py-2" 
                    asChild
                  >
                    <Link href="/auth/signup">
                      Acessar Agora
                    </Link>
                  </Button>
                </motion.div>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <motion.button
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            whileTap={{ scale: 0.95 }}
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-slate-600" />
            ) : (
              <Menu className="w-6 h-6 text-slate-600" />
            )}
          </motion.button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden bg-white/95 backdrop-blur-lg border-t border-white/20 max-h-[calc(100vh-80px)] overflow-y-auto"
          >
            <div className="px-4 py-4 space-y-3">
              {/* Navigation Items */}
              {navigationItems.map((item, index) => {
                const isActive = isActivePath(item.href)
                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors relative text-sm",
                        isActive
                          ? "bg-gradient-to-r from-purple-50 to-blue-50 text-slate-900 border border-purple-200"
                          : "hover:bg-slate-100 text-slate-700"
                      )}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.icon}
                      <span className="font-medium">{item.name}</span>
                      {isActive && (
                        <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#667EEA] to-[#764BA2]" />
                      )}
                    </Link>
                  </motion.div>
                )
              })}

                {/* Mobile Actions */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  {displaySession && displayStatus === 'authenticated' ? (
                  <>
                    <div className="px-3 py-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                      <p className="text-sm font-semibold text-slate-900">{displaySession.user?.name}</p>
                      {hasActiveAccess() && (
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-purple-600">{displaySession.user?.plan || 'STARTER'} Plan</p>
                          {creditsBalance !== null && (
                            <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-gray-50 border border-transparent"
                                 style={{
                                   background: 'linear-gradient(white, white) padding-box, linear-gradient(135deg, #667EEA, #764BA2) border-box',
                                   border: '1px solid transparent'
                                 }}>
                              <Coins className="w-3 h-3 text-gray-600" />
                              <span className="text-xs font-semibold text-gray-700">
                                {creditsBalance.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {hasActiveAccess() ? (
                      <>
                        <Link href="/billing" className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-sm" onClick={() => setIsMobileMenuOpen(false)}>
                          <CreditCard className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-slate-700">Minha Assinatura</span>
                        </Link>
                        <Link href="/account/history" className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-sm" onClick={() => setIsMobileMenuOpen(false)}>
                          <History className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-slate-700">Histórico de Pagamentos</span>
                        </Link>
                        <Link href="/account/orders" className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-sm" onClick={() => setIsMobileMenuOpen(false)}>
                          <List className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-slate-700">Ordens</span>
                        </Link>
                        <Link href="/profile" className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-sm" onClick={() => setIsMobileMenuOpen(false)}>
                          <UserCircle className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-slate-700">Perfil</span>
                        </Link>
                        <Link href="/support" className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-sm" onClick={() => setIsMobileMenuOpen(false)}>
                          <MessageSquare className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-slate-700">Fale Conosco</span>
                        </Link>
                      </>
                    ) : (
                      <div className="px-3 py-2 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                        <p className="text-xs text-slate-700 mb-2 font-medium">
                          Assine para acessar todas as funcionalidades
                        </p>
                        <Link href="/pricing" className="block w-full" onClick={() => setIsMobileMenuOpen(false)}>
                          <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-1.5 text-sm">
                            Ver Planos
                          </Button>
                        </Link>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false)
                        logout()
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors text-left text-sm"
                    >
                      <LogOut className="w-4 h-4 text-red-500" />
                      <span className="font-medium text-red-600">Sair</span>
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <Button variant="ghost" className="w-full justify-start" asChild>
                      <Link href="/auth/signin" onClick={() => setIsMobileMenuOpen(false)}>Entrar</Link>
                    </Button>
                    <Button className="w-full bg-gray-900 hover:bg-gray-800" asChild>
                      <Link href="/auth/signup" onClick={() => setIsMobileMenuOpen(false)}>
                        Acessar Agora
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Package Selector Modal */}
      <PackageSelectorModal
        isOpen={showPackageSelector}
        onClose={() => setShowPackageSelector(false)}
        onSuccess={handlePurchaseSuccess}
      />
    </motion.header>
  )
}