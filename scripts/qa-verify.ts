import { execSync } from 'node:child_process'

function parseArgs() {
  const args = process.argv.slice(2)
  const reviewerIndex = args.indexOf('--reviewer')
  const reviewer =
    reviewerIndex >= 0 && args[reviewerIndex + 1] ? args[reviewerIndex + 1] : 'unknown'
  const approveAll = args.includes('--approve-all')
  const full = args.includes('--full')

  return { reviewer, approveAll, full }
}

function runCheck(command: string) {
  console.log(`\n>> ${command}`)
  execSync(command, { stdio: 'inherit' })
}

function main() {
  const { reviewer, approveAll, full } = parseArgs()

  console.log(
    `Running QA verification (reviewer: ${reviewer}, approve-all: ${approveAll}, full: ${full})`,
  )

  const checks = ['npm run lint', 'npm run smoke:parse-brad', 'npm run smoke:schema-validation']

  for (const check of checks) {
    runCheck(check)
  }

  console.log(`\nQA verification passed${approveAll ? ' with all checks auto-approved' : ''}.`)
  console.log(`Signed off by: ${reviewer}`)
}

main()
