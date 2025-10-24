/**
 * Validadores brasileiros para CPF, CNPJ, CEP, telefone
 */

export function validateCPF(cpf: string): boolean {
  // Remove non-numeric characters
  cpf = cpf.replace(/\D/g, '')
  
  // Check if it has 11 digits
  if (cpf.length !== 11) return false
  
  // Check for known invalid patterns
  if (/^(\d)\1{10}$/.test(cpf)) return false
  
  // Validate first check digit
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i)
  }
  let remainder = 11 - (sum % 11)
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cpf.charAt(9))) return false
  
  // Validate second check digit
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i)
  }
  remainder = 11 - (sum % 11)
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cpf.charAt(10))) return false
  
  return true
}

export function validateCNPJ(cnpj: string): boolean {
  // Remove non-numeric characters
  cnpj = cnpj.replace(/\D/g, '')
  
  // Check if it has 14 digits
  if (cnpj.length !== 14) return false
  
  // Check for known invalid patterns
  if (/^(\d)\1{13}$/.test(cnpj)) return false
  
  // Validate first check digit
  let sum = 0
  let weight = 2
  for (let i = 11; i >= 0; i--) {
    sum += parseInt(cnpj.charAt(i)) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  let remainder = sum % 11
  if (remainder < 2) remainder = 0
  else remainder = 11 - remainder
  if (remainder !== parseInt(cnpj.charAt(12))) return false
  
  // Validate second check digit
  sum = 0
  weight = 2
  for (let i = 12; i >= 0; i--) {
    sum += parseInt(cnpj.charAt(i)) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  remainder = sum % 11
  if (remainder < 2) remainder = 0
  else remainder = 11 - remainder
  if (remainder !== parseInt(cnpj.charAt(13))) return false
  
  return true
}

export function validateCPFCNPJ(cpfCnpj: string): boolean {
  const digits = cpfCnpj.replace(/\D/g, '')
  
  if (digits.length === 11) {
    return validateCPF(digits)
  } else if (digits.length === 14) {
    return validateCNPJ(digits)
  }
  
  return false
}

export function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '')
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

export function formatCPFCNPJ(cpfCnpj: string): string {
  const digits = cpfCnpj.replace(/\D/g, '')
  
  if (digits.length === 11) {
    return formatCPF(digits)
  } else if (digits.length === 14) {
    return formatCNPJ(digits)
  }
  
  return cpfCnpj
}

export function validateCEP(cep: string): boolean {
  const digits = cep.replace(/\D/g, '')
  return digits.length === 8
}

export function formatCEP(cep: string): string {
  const digits = cep.replace(/\D/g, '')
  return digits.replace(/(\d{5})(\d{3})/, '$1-$2')
}

export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  // Brazilian phone: 10 digits (landline) or 11 digits (mobile)
  return digits.length === 10 || digits.length === 11
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  
  if (digits.length === 10) {
    // Landline: (XX) XXXX-XXXX
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  } else if (digits.length === 11) {
    // Mobile: (XX) XXXXX-XXXX
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  
  return phone
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function parseBrazilianCurrency(value: string): number {
  // Remove currency symbols and convert Brazilian format to number
  return parseFloat(
    value
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
  )
}

export function formatBrazilianCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

export function validateBrazilianAddress(address: {
  street?: string
  number?: string
  city?: string
  state?: string
  cep?: string
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!address.street || address.street.trim().length < 5) {
    errors.push('Endereço deve ter pelo menos 5 caracteres')
  }
  
  if (!address.number || address.number.trim().length === 0) {
    errors.push('Número é obrigatório')
  }
  
  if (!address.city || address.city.trim().length < 2) {
    errors.push('Cidade deve ter pelo menos 2 caracteres')
  }
  
  if (!address.state || address.state.length !== 2) {
    errors.push('Estado deve ter 2 caracteres (ex: SP, RJ)')
  }
  
  if (!address.cep || !validateCEP(address.cep)) {
    errors.push('CEP deve ter 8 dígitos')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Brazilian states
export const BRAZILIAN_STATES = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' }
]