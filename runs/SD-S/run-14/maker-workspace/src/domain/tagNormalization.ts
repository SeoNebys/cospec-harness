export function comparisonKey(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase()
}

export function normalizeTags(values: string[]): string[] {
  const seen = new Set<string>()
  return values.reduce<string[]>((result, value) => {
    const label = value.trim().normalize('NFKC')
    const key = comparisonKey(label)
    if (key && !seen.has(key)) {
      seen.add(key)
      result.push(label)
    }
    return result
  }, [])
}

export function parseTags(value: string): string[] {
  return normalizeTags(value.split(','))
}
