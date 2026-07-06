import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const issues = []

const sourceRoots = ['app', 'src']
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx'])

const files = sourceRoots.flatMap((sourceRoot) =>
  walk(path.join(rootDir, sourceRoot)).filter((filePath) =>
    sourceExtensions.has(path.extname(filePath))
  )
)

for (const filePath of files) {
  const relativePath = path.relative(rootDir, filePath)
  const text = fs.readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/)

  checkForbiddenCopy(relativePath, lines)
  checkUnsafeLogging(relativePath, lines)
  checkSecretAssignments(relativePath, lines)
}

checkRenderSideEffects()
checkRecipeDetailHookOrder()

if (issues.length > 0) {
  for (const issue of issues) {
    console.error(`- ${issue}`)
  }

  process.exit(1)
}

console.log('Recipe Dost static QA guards passed')

function walk(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return []
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const output = []

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name)

    if (
      entry.name === 'node_modules' ||
      entry.name === '.expo' ||
      entry.name === '.git'
    ) {
      continue
    }

    if (entry.isDirectory()) {
      output.push(...walk(entryPath))
      continue
    }

    if (entry.isFile()) {
      output.push(entryPath)
    }
  }

  return output
}

function checkForbiddenCopy(relativePath, lines) {
  const forbiddenCopy = [/\bPro\b/, /\bUnlimited\b/, /\bunlimited\b/]

  lines.forEach((line, index) => {
    if (isCommentOnly(line)) {
      return
    }

    for (const pattern of forbiddenCopy) {
      if (pattern.test(line)) {
        addIssue(
          relativePath,
          index,
          `forbidden user-facing copy matched ${pattern}`
        )
      }
    }
  })
}

function checkUnsafeLogging(relativePath, lines) {
  const unsafeLogPatterns = [
    /console\.log\s*\(\s*customerInfo\b/,
    /console\.log\s*\(\s*JSON\.stringify\s*\(\s*customerInfo\b/,
    /console\.log\s*\(\s*purchase\b/,
    /console\.log\s*\(\s*purchaseToken\b/,
    /console\.log\s*\(\s*source_url\b/,
    /console\.log\s*\(\s*sourceUrl\b/,
    /console\.log\s*\(\s*cdn\b/i,
    /console\.log\s*\(\s*worker payload\b/i,
    /console\.log\s*\(\s*rawCustomerInfo\b/,
  ]

  lines.forEach((line, index) => {
    for (const pattern of unsafeLogPatterns) {
      if (pattern.test(line)) {
        addIssue(relativePath, index, 'unsafe sensitive console logging')
      }
    }
  })
}

function checkSecretAssignments(relativePath, lines) {
  const secretAssignmentPattern =
    /\b(REVENUECAT_API_KEY|SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY)\s*=\s*['"][^'"]{12,}['"]/

  lines.forEach((line, index) => {
    if (secretAssignmentPattern.test(line)) {
      addIssue(relativePath, index, 'real-looking secret assignment in source')
    }
  })
}

function checkRenderSideEffects() {
  const targetFiles = [
    'src/providers/revenuecat-provider.tsx',
    'app/(tabs)/settings.tsx',
  ]
  const suspiciousCalls = [
    'syncPremiumEntitlement(',
    'refreshCustomerInfo(',
    'restorePurchases(',
    'Purchases.configure(',
    'Purchases.logIn(',
    'Purchases.getCustomerInfo(',
  ]
  const allowedContextPattern =
    /(useEffect|useCallback|const\s+\w+\s*=\s*(async\s*)?\(|const\s+\w+\s*=\s*useCallback|async function|function\s+\w+)/

  for (const targetFile of targetFiles) {
    const absolutePath = path.join(rootDir, targetFile)

    if (!fs.existsSync(absolutePath)) {
      continue
    }

    const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/)

    lines.forEach((line, index) => {
      if (!suspiciousCalls.some((call) => line.includes(call))) {
        return
      }

      const context = lines
        .slice(Math.max(0, index - 60), index + 1)
        .join('\n')

      if (!allowedContextPattern.test(context)) {
        addIssue(
          targetFile,
          index,
          `possible render-time side effect: ${line.trim()}`
        )
      }
    })
  }
}

function checkRecipeDetailHookOrder() {
  const targetFile = 'app/recipe/[id].tsx'
  const absolutePath = path.join(rootDir, targetFile)

  if (!fs.existsSync(absolutePath)) {
    return
  }

  const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/)
  const startIndex = lines.findIndex((line) =>
    line.includes('export default function SavedRecipeRoute')
  )

  if (startIndex === -1) {
    return
  }

  const endIndex = lines.findIndex(
    (line, index) => index > startIndex && /^function\s+\w+/.test(line)
  )
  const componentLines = lines.slice(
    startIndex,
    endIndex === -1 ? lines.length : endIndex
  )

  const hookPattern =
    /\b(useState|useRef|useEffect|useMemo|useCallback|useFocusEffect|useRootNavigationState|useQuery|useMutation|use[A-Z]\w*)\s*\(/

  let lastHookLine = -1
  let firstEarlyReturnLine = -1
  let braceDepth = 0

  componentLines.forEach((line, index) => {
    const depthBeforeLine = braceDepth

    if (depthBeforeLine === 1 && hookPattern.test(line)) {
      lastHookLine = index
    }

    if (depthBeforeLine !== 1 || firstEarlyReturnLine !== -1) {
      braceDepth += countBraces(line)
      return
    }

    if (/if\s*\(.*\)\s*return\b/.test(line)) {
      firstEarlyReturnLine = index
      braceDepth += countBraces(line)
      return
    }

    if (/if\s*\(.*\)\s*\{?\s*$/.test(line)) {
      const lookahead = componentLines
        .slice(index + 1, Math.min(componentLines.length, index + 5))
        .join('\n')

      if (/\breturn\b/.test(lookahead)) {
        firstEarlyReturnLine = index
      }
    }

    braceDepth += countBraces(line)
  })

  if (firstEarlyReturnLine !== -1 && lastHookLine > firstEarlyReturnLine) {
    addIssue(
      targetFile,
      startIndex + lastHookLine,
      'React hook appears after an early return in SavedRecipeRoute'
    )
  }
}

function isCommentOnly(line) {
  const trimmed = line.trim()

  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*')
  )
}

function countBraces(line) {
  const withoutStrings = line
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""')
    .replace(/`[^`]*`/g, '``')

  return (
    (withoutStrings.match(/\{/g) ?? []).length -
    (withoutStrings.match(/\}/g) ?? []).length
  )
}

function addIssue(relativePath, zeroBasedLine, reason) {
  issues.push(`${relativePath}:${zeroBasedLine + 1} ${reason}`)
}
