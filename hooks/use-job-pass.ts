'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { hashJobDescription } from '@/lib/billing/job-description-hash.client'
import {
  formatJobPassExpiry,
  getJobPass,
  loadJobPasses,
  saveJobPass,
  type StoredJobPass,
} from '@/lib/billing/job-pass-storage'
import { decodePremiumAccessPayloadClient } from '@/lib/billing/premium-access'

interface JobPassCheckoutResult {
  accessToken: string
  jobDescriptionHash: string
  expiresAt: number
  unlockedAt: number
}

export function useJobPass(jobDescription: string) {
  const [jobDescriptionHash, setJobDescriptionHash] = useState('')
  const [passOverride, setPassOverride] = useState<StoredJobPass | null>(null)
  const [checkoutEnabled, setCheckoutEnabled] = useState<boolean | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false

    void hashJobDescription(jobDescription).then((hash) => {
      if (!cancelled) {
        setJobDescriptionHash(hash)
        setPassOverride(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [jobDescription])

  const storedPass = useMemo(
    () => passOverride ?? (jobDescriptionHash ? getJobPass(jobDescriptionHash) : null),
    [passOverride, jobDescriptionHash]
  )

  useEffect(() => {
    if (!storedPass?.expiresAt) return

    const msUntilExpiry = storedPass.expiresAt - Date.now()
    if (msUntilExpiry <= 0) return

    const timeout = window.setTimeout(() => setNow(Date.now()), msUntilExpiry)
    return () => window.clearTimeout(timeout)
  }, [storedPass?.expiresAt])

  useEffect(() => {
    void fetch('/api/checkout/square')
      .then((response) => response.json())
      .then((data: { enabled?: boolean }) => {
        setCheckoutEnabled(Boolean(data.enabled))
      })
      .catch(() => {
        setCheckoutEnabled(false)
      })
  }, [])

  const unlock = useCallback((result: JobPassCheckoutResult) => {
    const pass: StoredJobPass = {
      jobDescriptionHash: result.jobDescriptionHash,
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
      unlockedAt: result.unlockedAt,
    }
    saveJobPass(pass)
    setPassOverride(pass)
  }, [])

  const tokenMatchesRole = useMemo(() => {
    if (!storedPass || !jobDescriptionHash) return false
    if (storedPass.jobDescriptionHash !== jobDescriptionHash) return false

    const payload = decodePremiumAccessPayloadClient(storedPass.accessToken)
    return payload?.jobDescriptionHash === jobDescriptionHash
  }, [storedPass, jobDescriptionHash])

  const isUnlocked =
    checkoutEnabled === false ||
    Boolean(
      storedPass &&
        tokenMatchesRole &&
        storedPass.expiresAt > now &&
        jobDescriptionHash === storedPass.jobDescriptionHash
    )

  const passExpiresAt = isUnlocked ? storedPass?.expiresAt ?? null : null
  const passExpiryLabel = passExpiresAt ? formatJobPassExpiry(passExpiresAt) : null

  return {
    jobDescriptionHash,
    accessToken: isUnlocked ? storedPass?.accessToken ?? null : null,
    checkoutEnabled,
    isUnlocked,
    passExpiresAt,
    passExpiryLabel,
    unlock,
    refreshPasses: () =>
      setPassOverride(jobDescriptionHash ? getJobPass(jobDescriptionHash) : null),
    allPasses: loadJobPasses(),
  }
}

/** @deprecated Use useJobPass */
export function usePremiumAccess() {
  return useJobPass('')
}
