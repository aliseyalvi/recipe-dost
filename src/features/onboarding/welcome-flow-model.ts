export const WELCOME_COMPLETION_HREF = '/home' as const

export const welcomeSlides = [
  {
    id: 'brand_intro',
    eyebrow: 'Your culinary companion',
    title: 'Cook with confidence.',
    description:
      'Save inspiration, get clear recipes, and bring calm to every meal.',
    hero: 'intro',
  },
  {
    id: 'save_anywhere',
    eyebrow: 'From link to recipe',
    title: 'Save recipes from anywhere.',
    description:
      'Paste or share a food link. Recipe Dost turns it into a clean, useful recipe card.',
    hero: 'save',
  },
  {
    id: 'ai_guidance',
    eyebrow: 'Helpful, not complicated',
    title: 'Let AI do the busywork.',
    description:
      'Get organized ingredients, clear steps, and practical cooking guidance.',
    hero: 'ai',
  },
  {
    id: 'grocery_lists',
    eyebrow: 'A calmer way to shop',
    title: 'Shop without the scramble.',
    description:
      'Turn every recipe into a tidy grocery list you can check off as you go.',
    hero: 'grocery',
  },
  {
    id: 'ready_to_cook',
    eyebrow: 'Made for your kitchen',
    title: 'Ready to cook?',
    description:
      'Start building a recipe library that feels like yours.',
    hero: 'ready',
  },
] as const

export type WelcomeSlide = (typeof welcomeSlides)[number]
export type WelcomeHero = WelcomeSlide['hero']

export function getAppEntryHref(
  remoteOnboardingCompleted: boolean | null | undefined,
  localOnboardingCompleted: boolean
) {
  return remoteOnboardingCompleted && localOnboardingCompleted
    ? ('/home' as const)
    : ('/welcome' as const)
}

export function getWelcomePrimaryAction(stepIndex: number) {
  const safeIndex = Math.max(0, Math.min(stepIndex, welcomeSlides.length - 1))

  if (safeIndex === welcomeSlides.length - 1) {
    return {
      kind: 'complete' as const,
    }
  }

  return {
    kind: 'advance' as const,
    nextStep: safeIndex + 1,
  }
}
