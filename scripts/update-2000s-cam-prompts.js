const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function update2000sCamPrompts() {
  try {
    console.log('🔍 Procurando pacote 2000s-cam...')
    
    const pkg = await prisma.photoPackage.findFirst({
      where: {
        OR: [
          { id: '2000s-cam' },
          { name: { contains: '2000s cam', mode: 'insensitive' } },
          { name: { contains: '2000s Cam', mode: 'insensitive' } }
        ]
      }
    })

    if (!pkg) {
      console.error('❌ Pacote 2000s-cam não encontrado!')
      console.log('📦 Listando todos os pacotes disponíveis:')
      const allPackages = await prisma.photoPackage.findMany({
        select: { id: true, name: true, category: true }
      })
      allPackages.forEach(p => console.log(`  - ${p.id}: ${p.name} (${p.category})`))
      return
    }

    console.log(`✅ Pacote encontrado: ${pkg.name} (${pkg.id})`)

    const prompts = [
      {
        text: "A stylish individual sitting at a round outdoor café table at dusk, holding a small espresso cup with faint steam rising, sunglasses resting beside the cup. The subject wears early 2000s urban fashion — black blazer over a cropped top, mini skirt, and white sneakers — illuminated by the distinct flash of a compact digital camera. The background shows an empty boulevard with glowing street lamps, cars slightly blurred in motion, and pastel twilight sky gradients of pink and blue. The image includes a yellow digital timestamp overlay in the bottom-right corner displaying '12 JUN 2001 | 19:44', and a small battery icon indicator typical of early 2000s digital cameras. The photo has mild chromatic noise, flat shadows, and reflective textures on the table surface. Composition is clean and cinematic, with realistic lens flare from the flash and soft reflections from nearby glass and metal surfaces. The tone conveys calm confidence and nostalgic evening ambiance. camera: 35mm compact digital, on-camera flash, ISO 320 lighting: dusk ambient + direct flash color_grade: warm highlights, cool twilight shadows, nostalgic digital tint composition: centered portrait, eye-level framing, timestamp overlay in bottom-right corner depth: foreground table and coffee cup → middle ground subject → background city lights mood: calm, confident, nostalgic evening style: early 2000s compact digital camera realism textures: reflective metal, smooth plastic, faint chromatic noise, timestamp and battery overlay rendered authentically",
        style: "photographic"
      },
      {
        text: "A confident individual in a tailored vintage blue suit stands beside a glowing jukebox in a crowded nightclub, embodying the vibrant energy of early 2000s nightlife. The compact digital camera flash creates sharp frontal lighting, emphasizing reflective surfaces and colorful highlights on the jukebox chrome. The crowd behind dances under dim disco lights and a silver mirror ball scattering small reflections across the floor. The image includes a digital timestamp overlay '01.01.2003 | 23:57' with a red battery icon, softly glowing over a slightly grainy image texture. The composition captures nostalgic charm, realistic shadows, and lens softness typical of early 2000s point-and-shoot cameras, with mild vignetting and color fringing at the edges. The tone feels cinematic, retro, and playful, celebrating Y2K nightlife aesthetics. camera: compact digital, 28mm, ISO 400, flash enabled lighting: mixed club ambient + direct camera flash color_grade: blue-magenta tint with high contrast and saturated highlights composition: centered full-body framing, timestamp overlay in corner depth: foreground jukebox → subject → blurred dancing crowd mood: energetic, confident, retro club atmosphere style: Y2K nightlife captured through early 2000s digital lens textures: glowing jukebox chrome, reflective suit fabric, disco light speckles, timestamp and red battery overlay",
        style: "cinematic"
      },
      {
        text: "An individual stands under an orange streetlight in an empty parking lot at night, wearing a Y2K-inspired street outfit with a casual jacket and sneakers. The flash of a compact digital camera lights the subject against a deep blue night sky, creating stark contrast and reflective gleam on wet asphalt. The timestamp '06 FEB 2002 | 22:16' appears in yellow pixelated digits at the bottom corner, along with a blinking red battery icon. The air carries faint haze from cold weather, headlights blur in the distance, and the pavement mirrors the orange glow of street lamps. Mild vignetting, high ISO noise, and subtle flash bloom reinforce the early-2000s compact camera look. The scene feels cinematic yet nostalgic — the stillness of night paired with a low-tech digital texture. camera: 28mm compact lens, ISO 800, direct flash lighting: night scene illuminated by sodium vapor streetlights + camera flash color_grade: warm orange glow, cool blue shadows, desaturated tones composition: full-body portrait with timestamp overlay depth: wet pavement reflections in foreground → subject → soft horizon with cars and poles mood: introspective, cinematic, nostalgic style: early 2000s digital compact night photography textures: wet asphalt, light halos, visible grain, timestamp and red battery overlay",
        style: "cinematic"
      },
      {
        text: "A small group of friends laughing inside a dimly lit room decorated with string lights and retro posters. The shot captures spontaneous movement under the burst of a compact camera flash, producing overexposed highlights and mild color bleed. The timestamp '28 NOV 2001 | 21:09' in yellow digits and a low-battery icon appear in the lower corner. The walls have a warm tint from tungsten bulbs, and reflections from plastic cups and glass bottles shimmer slightly. The image has chromatic noise, shallow depth, and uneven exposure — perfectly matching the authentic 'party photo' look from early 2000s digital cameras. The atmosphere is candid, warm, and nostalgic, frozen in time like an old photo memory. camera: handheld compact, flash on, ISO 500 lighting: tungsten interior light + flash color_grade: warm tones, soft saturation, minor overexposure composition: mid-shot candid framing, timestamp overlay depth: cluttered foreground → people in middle → blurred background mood: carefree, friendly, nostalgic realism style: early 2000s digital snapshot with timestamp artifact textures: reflective glass, plastic surfaces, flash glare, visible noise, timestamp and battery overlay",
        style: "photographic"
      }
    ]

    console.log(`📝 Atualizando pacote com ${prompts.length} prompts...`)

    const updated = await prisma.photoPackage.update({
      where: { id: pkg.id },
      data: {
        prompts: prompts
      }
    })

    console.log('✅ Pacote atualizado com sucesso!')
    console.log(`📊 ID: ${updated.id}`)
    console.log(`📦 Nome: ${updated.name}`)
    console.log(`🎯 Prompts cadastrados: ${(updated.prompts as any[]).length}`)
    
    // Print each prompt
    (updated.prompts as any[]).forEach((p, i) => {
      console.log(`\n   Prompt ${i + 1}:`)
      console.log(`   - Texto: ${p.text.substring(0, 100)}...`)
      console.log(`   - Estilo: ${p.style || 'photographic'}`)
    })

  } catch (error) {
    console.error('❌ Erro ao atualizar pacote:', error)
  } finally {
    await prisma.$disconnect()
  }
}

update2000sCamPrompts()

