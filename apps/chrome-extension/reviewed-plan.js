/* Review snapshot binding only. The Windows host independently authorizes execution. */
"use strict";
(function(root) {
  const fingerprint = value => typeof value === "string" && /^plan-v1:[A-F0-9]{64}$/.test(value);
  function snapshot(taskId,jobId,reply) {
    if(reply?.jobId!==jobId || reply.status!=="awaiting_approval" ||
        !fingerprint(reply.reviewFingerprint)) return null;
    return Object.freeze({taskId,jobId,reviewFingerprint:reply.reviewFingerprint});
  }
  function approvalArgs(review,taskId,jobId) {
    if(!review || review.taskId!==taskId || review.jobId!==jobId ||
        !fingerprint(review.reviewFingerprint))
      throw new Error("Refresh and review the exact selected plan before approving");
    return {approved:true,reviewFingerprint:review.reviewFingerprint};
  }
  root.TheOrgReviewedPlan=Object.freeze({snapshot,approvalArgs});
})(globalThis);
