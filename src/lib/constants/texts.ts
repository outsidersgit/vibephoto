// Textos e constantes em português brasileiro para toda a aplicação

export const TEXTS = {
  // Navigation
  nav: {
    dashboard: 'Dashboard',
    models: 'Modelos',
    generate: 'Gerar',
    gallery: 'Galeria',
    packages: 'Pacotes',
    billing: 'Cobrança',
    settings: 'Configurações',
    logout: 'Sair'
  },

  // Plans
  plans: {
    free: {
      name: 'GRATUITO',
      description: 'Perfeito para experimentar a geração de fotos com IA',
      features: [
        '1 modelo de IA',
        '10 créditos por dia',
        'Resolução básica'
      ]
    },
    premium: {
      name: 'PREMIUM',
      price: 'R$ 269,00',
      description: 'Ótimo para criadores de conteúdo e profissionais',
      features: [
        '3 modelos de IA por mês',
        '200 créditos por mês',
        'Alta resolução'
      ]
    },
    gold: {
      name: 'GOLD',
      price: 'R$ 449,00',
      description: 'Para agências e usuários avançados',
      features: [
        '10 modelos de IA por mês',
        '1000 créditos por mês',
        'Máxima resolução'
      ]
    }
  },

  // Auth
  auth: {
    signIn: 'Entrar',
    signUp: 'Cadastrar',
    signOut: 'Sair',
    email: 'Email',
    password: 'Senha',
    confirmPassword: 'Confirmar Senha',
    firstName: 'Nome',
    lastName: 'Sobrenome',
    forgotPassword: 'Esqueceu sua senha?',
    dontHaveAccount: 'Não tem uma conta?',
    alreadyHaveAccount: 'Já tem uma conta?',
    continueWithGoogle: 'Continuar com Google',
    continueWithGitHub: 'Continuar com GitHub',
    orContinueWith: 'Ou continue com',
    welcomeBack: 'Bem-vindo de Volta',
    createAccount: 'Criar Conta',
    enterCredentials: 'Digite suas credenciais para acessar sua conta',
    createNewAccount: 'Crie uma nova conta para começar'
  },

  // Common actions
  actions: {
    save: 'Salvar',
    cancel: 'Cancelar',
    delete: 'Excluir',
    edit: 'Editar',
    create: 'Criar',
    update: 'Atualizar',
    upload: 'Enviar',
    download: 'Baixar',
    view: 'Ver',
    close: 'Fechar',
    continue: 'Continuar',
    back: 'Voltar',
    next: 'Próximo',
    finish: 'Finalizar',
    startFreeTrial: 'Iniciar Teste Grátis',
    upgrade: 'Fazer Upgrade',
    currentPlan: 'Plano Atual',
    mostPopular: 'Mais Popular'
  },

  // Error messages
  errors: {
    general: 'Ocorreu um erro. Tente novamente.',
    invalidCredentials: 'Email ou senha inválidos',
    networkError: 'Erro de conexão. Verifique sua internet.',
    sessionExpired: 'Sua sessão expirou. Faça login novamente.',
    uploadFailed: 'Falha no upload. Tente novamente.',
    insufficientCredits: 'Créditos insuficientes.',
    planRequired: 'Upgrade de plano necessário.',
    fileTooBig: 'Arquivo muito grande.',
    invalidFileType: 'Tipo de arquivo inválido.',
    required: 'Este campo é obrigatório.',
    emailInvalid: 'Email inválido.',
    passwordTooShort: 'Senha deve ter no mínimo 8 caracteres.',
    passwordsDontMatch: 'As senhas não coincidem.'
  },

  // Success messages
  success: {
    saved: 'Salvo com sucesso!',
    updated: 'Atualizado com sucesso!',
    created: 'Criado com sucesso!',
    deleted: 'Excluído com sucesso!',
    uploaded: 'Upload realizado com sucesso!',
    emailSent: 'Email enviado com sucesso!',
    planUpgraded: 'Plano atualizado com sucesso!',
    paymentProcessed: 'Pagamento processado com sucesso!'
  },

  // Payment methods
  payment: {
    pix: 'PIX',
    pixDescription: 'Pagamento instantâneo',
    creditCard: 'Cartão de Crédito',
    creditCardDescription: 'Até 12x sem juros',
    boleto: 'Boleto',
    boletoDescription: 'Boleto bancário',
    bankTransfer: 'Transferência',
    bankTransferDescription: 'TED/DOC',
    paymentMethods: 'Formas de Pagamento',
    paymentMethodsDescription: 'Aceitamos múltiplas formas de pagamento para sua conveniência'
  },

  // Status
  status: {
    active: 'ATIVO',
    inactive: 'INATIVO',
    pending: 'PENDENTE',
    processing: 'PROCESSANDO',
    completed: 'CONCLUÍDO',
    failed: 'FALHOU',
    cancelled: 'CANCELADO'
  },

  // Time periods
  time: {
    day: 'dia',
    week: 'semana',
    month: 'mês',
    year: 'ano',
    forever: 'Para sempre',
    perDay: 'por dia',
    perMonth: 'por mês',
    daily: 'Diário',
    monthly: 'Mensal',
    yearly: 'Anual'
  },

  // Units
  units: {
    credits: 'créditos',
    creditsUsed: 'créditos usados',
    models: 'modelos',
    generations: 'gerações',
    photos: 'fotos',
    images: 'imagens'
  }
} as const

export default TEXTS