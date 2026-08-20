// Display-only thresholds for the super-admin console (see
// docs/SAAS_ARCHITECTURE.md section 10.2, adapted: renamed FREE->starter
// since there is no free tier in Zeev's rental/purchase business model).
// Never enforced against tenant users' actions — M1's requirement was
// "alert Zeev", not "block the tenant". Enforcing quotas at write time
// would mean touching every create-mutation across the app; out of scope.
export const PLAN_LIMITS = {
  starter: { users: 3, projects: 10 },
  pro: { users: 15, projects: 50 },
  enterprise: { users: Infinity, projects: Infinity },
};

export const THRESHOLD_WARNING_RATIO = 0.8;

export function isApproachingLimit(usageValue, limitValue) {
  if (!Number.isFinite(limitValue)) return false;
  return usageValue >= limitValue * THRESHOLD_WARNING_RATIO;
}
