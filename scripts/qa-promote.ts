import { execSync } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'

type VercelDeploymentMeta = {
  githubCommitSha?: string
}

type VercelDeployment = {
  url: string
  target?: string | null
  state?: string
  meta?: VercelDeploymentMeta
}

type VercelListResponse = {
  deployments?: VercelDeployment[]
}

const WAIT_POLL_MS = 15_000
const WAIT_TIMEOUT_MS = 10 * 60_000

function run(command: string): string {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()
}

function parseArgs() {
  const args = process.argv.slice(2)
  return {
    waitForHead: args.includes('--wait-for-head'),
  }
}

function listDeployments(): VercelDeployment[] {
  const raw = run('npx vercel list -F json -y')
  const json = JSON.parse(raw) as VercelListResponse
  return json.deployments ?? []
}

function deploymentUrl(deployment: VercelDeployment): string {
  return deployment.url.startsWith('http') ? deployment.url : `https://${deployment.url}`
}

async function waitForHeadDeployment(headSha: string): Promise<VercelDeployment> {
  const short = headSha.slice(0, 7)
  const deadline = Date.now() + WAIT_TIMEOUT_MS

  while (Date.now() < deadline) {
    const deployments = listDeployments()
    const ready = deployments.find(
      (d) => d.meta?.githubCommitSha === headSha && d.state === 'READY',
    )
    if (ready?.url) {
      console.log(`Deployment READY for ${short}: ${deploymentUrl(ready)}`)
      return ready
    }

    const inProgress = deployments.find(
      (d) =>
        d.meta?.githubCommitSha === headSha &&
        d.state &&
        d.state !== 'READY' &&
        d.state !== 'ERROR' &&
        d.state !== 'CANCELED',
    )
    if (inProgress) {
      console.log(`Deployment ${inProgress.state} for commit ${short}...`)
    } else {
      console.log(`Waiting for Vercel deployment for commit ${short}...`)
    }

    await setTimeout(WAIT_POLL_MS)
  }

  throw new Error(
    `Timed out after ${WAIT_TIMEOUT_MS / 60_000}m waiting for READY deployment for ${headSha}.`,
  )
}

function getLatestReadyDeployment(): VercelDeployment {
  const raw = run('npx vercel list --status READY -F json -y')
  const json = JSON.parse(raw) as VercelListResponse
  const latest = json.deployments?.[0]

  if (!latest?.url) {
    throw new Error('No READY Vercel deployment found to promote.')
  }

  return latest
}

async function main() {
  const { waitForHead } = parseArgs()
  const deployment = waitForHead
    ? await waitForHeadDeployment(run('git rev-parse HEAD'))
    : getLatestReadyDeployment()

  const url = deploymentUrl(deployment)
  const target = deployment.target ?? 'preview'

  if (target === 'production') {
    console.log(`Deployment is already production: ${url}`)
    return
  }

  console.log(`Promoting ${url} to production...`)
  execSync(`npx vercel promote ${url} -y --timeout 3m`, { stdio: 'inherit' })
  console.log('Promotion complete.')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
})
