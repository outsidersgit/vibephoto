export type ModelGender = 'male' | 'female' | 'unknown'

export function getModelGender(modelClass: string | null | undefined): ModelGender {
  if (!modelClass) return 'unknown'

  const classUpper = modelClass.toUpperCase()
  const classLower = modelClass.toLowerCase()

  // Check for specific model class codes first
  if (classUpper === 'WOMAN' || classUpper === 'GIRL') {
    return 'female'
  }

  if (classUpper === 'MAN' || classUpper === 'BOY') {
    return 'male'
  }

  // Check for female indicators in text
  const femaleKeywords = [
    'woman', 'women', 'girl', 'girls', 'female', 'mulher', 'mulheres',
    'menina', 'meninas', 'feminino', 'lady', 'ladies'
  ]

  // Check for male indicators in text
  const maleKeywords = [
    'man', 'men', 'boy', 'boys', 'male', 'homem', 'homens',
    'menino', 'meninos', 'masculino', 'gentleman', 'guy'
  ]

  // Check female keywords
  for (const keyword of femaleKeywords) {
    if (classLower.includes(keyword)) {
      return 'female'
    }
  }

  // Check male keywords
  for (const keyword of maleKeywords) {
    if (classLower.includes(keyword)) {
      return 'male'
    }
  }

  return 'unknown'
}

export function getGenderPrefix(gender: ModelGender): string {
  switch (gender) {
    case 'female':
      return 'Mulher bonita, '
    case 'male':
      return 'Homem bonito, '
    default:
      return 'Pessoa, '
  }
}

export function getGenderPromptSuggestions(gender: ModelGender): string[] {
  switch (gender) {
    case 'female':
      return [
        'retrato profissional de negócios',
        'vestido elegante de noite',
        'roupa casual de verão',
        'retrato artístico com iluminação suave',
        'headshot profissional confiante',
        'fotografia de moda estilosa',
        'retrato de beleza natural',
        'ensaio fotográfico glamouroso'
      ]
    case 'male':
      return [
        'retrato profissional de negócios',
        'jaqueta jeans casual',
        'terno formal com gravata',
        'headshot confiante com iluminação forte',
        'roupas esportivas atléticas',
        'retrato rústico ao ar livre',
        'fotografia de moda moderna',
        'foto executiva de negócios'
      ]
    default:
      return [
        'retrato profissional',
        'roupa casual',
        'fotografia artística',
        'headshot confiante',
        'foto de moda estilosa',
        'retrato moderno',
        'iluminação criativa',
        'ensaio fotográfico profissional'
      ]
  }
}