'use client'

import Link from 'next/link'
import { Mail, FileText, Cookie, HelpCircle, Shield } from 'lucide-react'
import { VibePhotoLogo } from '@/components/ui/vibephoto-logo'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        {/* Desktop: 4 colunas (Brand + 3 colunas) | Mobile: 3 colunas lado a lado */}
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-6 md:gap-8">
          {/* Brand - Desktop: primeira coluna, Mobile: escondido */}
          <div className="hidden md:block">
            <div className="mb-2 sm:mb-4">
              <VibePhotoLogo size="md" layout="horizontal" variant="monochrome" showText={true} />
            </div>
            <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-4">
              Transforme suas selfies em fotos profissionais com nossa tecnologia de IA avançada.
            </p>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
              <Mail className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              <a href="mailto:suporte@vibephoto.app" className="hover:text-purple-600 transition-colors break-all sm:break-normal">
                suporte@vibephoto.app
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2 sm:mb-4 text-xs sm:text-sm">Produto</h3>
            <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
              <li>
                <Link href="/dashboard" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/models" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Modelos
                </Link>
              </li>
              <li>
                <Link href="/generate" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Gerar Fotos
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Galeria
                </Link>
              </li>
              <li>
                <Link href="/packages" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Pacotes
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2 sm:mb-4 text-xs sm:text-sm">Suporte</h3>
            <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
              <li>
                <Link 
                  href="/legal/faq" 
                  className="text-gray-600 hover:text-purple-600 transition-colors flex items-center gap-2"
                >
                  <HelpCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                  FAQ
                </Link>
              </li>
              <li>
                <a href="mailto:suporte@vibephoto.app" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Entre em Contato
                </a>
              </li>
              <li>
                <Link href="/billing" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Minha Assinatura
                </Link>
              </li>
              <li>
                <Link href="mailto:dpo@vibephoto.com" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Exercer Direitos LGPD
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2 sm:mb-4 text-xs sm:text-sm">Legal & Privacidade</h3>
            <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
              <li>
                <Link 
                  href="/legal/terms" 
                  className="text-gray-600 hover:text-purple-600 transition-colors flex items-center gap-2"
                >
                  <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link 
                  href="/legal/privacy" 
                  className="text-gray-600 hover:text-purple-600 transition-colors flex items-center gap-2"
                >
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link 
                  href="/legal/cookies" 
                  className="text-gray-600 hover:text-purple-600 transition-colors flex items-center gap-2"
                >
                  <Cookie className="w-3 h-3 sm:w-4 sm:h-4" />
                  Política de Cookies
                </Link>
              </li>
              <li>
                <button 
                  onClick={() => {
                    // Trigger cookie preference modal
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('ensaio_fotos_consent')
                      window.location.reload()
                    }
                  }}
                  className="text-gray-600 hover:text-purple-600 transition-colors text-left"
                >
                  Gerenciar Cookies
                </button>
              </li>
            </ul>

            {/* Privacy Badge */}
            <div className="mt-4 sm:mt-6">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-gray-900 to-gray-700 text-white px-3 py-2 rounded-lg shadow-md">
                <Shield className="w-4 h-4 flex-shrink-0" />
                <div className="text-[10px] sm:text-xs font-medium leading-tight">
                  <div className="font-semibold">Privacidade & Segurança</div>
                  <div className="opacity-90">Nível Executivo</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Brand and Email - Mobile only */}
        <div className="border-t border-gray-200 mt-4 sm:mt-8 pt-4 sm:pt-8 md:hidden">
          <div className="mb-4">
            <VibePhotoLogo size="md" layout="horizontal" variant="monochrome" showText={true} />
          </div>
          <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4">
            Transforme suas selfies em fotos profissionais com nossa tecnologia de IA avançada.
          </p>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
            <Mail className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
            <a href="mailto:suporte@vibephoto.app" className="hover:text-purple-600 transition-colors break-all sm:break-normal">
              suporte@vibephoto.app
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-200 mt-4 sm:mt-8 pt-4 sm:pt-8 text-center">
          <div className="text-xs sm:text-sm text-gray-500">
            © {currentYear} VibePhoto™. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </footer>
  )
}