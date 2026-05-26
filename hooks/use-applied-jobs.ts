'use client'

import { useCallback, useEffect, useState } from 'react'

import {
  addAppliedJob,
  findAppliedJob,
  loadAppliedJobs,
  removeAppliedJob,
  type AppliedJobRecord,
} from '@/lib/jobs/applied-jobs'
import type { JobListing } from '@/lib/jobs/types'

const HIDE_APPLIED_STORAGE_KEY = 'ats4cv-hide-applied-jobs'

function loadHideAppliedPreference(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(HIDE_APPLIED_STORAGE_KEY) === 'true'
}

export function useAppliedJobs() {
  const [appliedJobs, setAppliedJobs] = useState<AppliedJobRecord[]>([])
  const [hideApplied, setHideAppliedState] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setAppliedJobs(loadAppliedJobs())
    setHideAppliedState(loadHideAppliedPreference())
    setReady(true)

    function syncFromStorage(event: StorageEvent) {
      if (event.key === null || event.key === 'ats4cv-applied-jobs') {
        setAppliedJobs(loadAppliedJobs())
      }
      if (event.key === null || event.key === HIDE_APPLIED_STORAGE_KEY) {
        setHideAppliedState(loadHideAppliedPreference())
      }
    }

    window.addEventListener('storage', syncFromStorage)
    return () => window.removeEventListener('storage', syncFromStorage)
  }, [])

  const setHideApplied = useCallback((value: boolean) => {
    setHideAppliedState(value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(HIDE_APPLIED_STORAGE_KEY, String(value))
    }
  }, [])

  const markApplied = useCallback((job: JobListing) => {
    setAppliedJobs((current) => addAppliedJob(job, current))
  }, [])

  const unmarkApplied = useCallback((job: JobListing) => {
    setAppliedJobs((current) => removeAppliedJob(job, current))
  }, [])

  const getAppliedRecord = useCallback(
    (job: JobListing) => findAppliedJob(job, appliedJobs),
    [appliedJobs]
  )

  const isApplied = useCallback(
    (job: JobListing) => findAppliedJob(job, appliedJobs) !== undefined,
    [appliedJobs]
  )

  return {
    appliedJobs,
    hideApplied,
    setHideApplied,
    markApplied,
    unmarkApplied,
    getAppliedRecord,
    isApplied,
    ready,
  }
}
