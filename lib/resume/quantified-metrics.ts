/** Detects numbers, percentages, currency, and scale indicators in prose. */
export const QUANTIFIED_METRIC_PATTERN =
  /\b\d[\d,]*(?:\.\d+)?(?:%|\+|\s*(?:hours?|hrs|days?|weeks?|months?|years?|users?|teams?|people|projects?|releases?|tickets?|systems?|applications?|pipelines?))|\$\d[\d,]*|\d+\s*(?:million|billion|m\b|k\b)|\d+x\b/i
