"use client";

import React, { useState, useMemo } from "react";
import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  MapPin,
  Loader2,
  ClipboardCheck,
  AlertCircle,
} from "lucide-react";
import { Asset, AuditSession, AuditVerification, User } from "@/shared/types";
import { canStartAudit } from "@/backend/lib/permissions";

interface AuditProps {
  onBack?: () => void;
  currentUser: User;
  assets: Asset[];
}

const Audit: React.FC<AuditProps> = ({ onBack, currentUser, assets }) => {
  const [currentAuditSession, setCurrentAuditSession] = useState<AuditSession | null>(null);
  const [auditVerifications, setAuditVerifications] = useState<Map<string, AuditVerification>>(new Map());
  const [sessionCount, setSessionCount] = useState(0);
  const [isCompletingAudit, setIsCompletingAudit] = useState(false);
  const [auditLocationFilter, setAuditLocationFilter] = useState<string>("All");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const availableLocations = useMemo(() => {
    const locs = new Set<string>();
    assets.forEach((a) => a.location?.trim() && locs.add(a.location.trim()));
    return ["All", ...Array.from(locs).sort()];
  }, [assets]);

  const canStart = canStartAudit(currentUser.role);

  const handleStartAudit = () => {
    if (!currentUser) {
      setNotification({ message: "User session required.", type: "error" });
      return;
    }
    if (!canStart) {
      setNotification({ message: "Insufficient permissions. Only Auditors can start audit sessions.", type: "error" });
      return;
    }

    const safeAssets = Array.isArray(assets) ? assets : [];
    const filteredByLocation =
      auditLocationFilter === "All" ? safeAssets : safeAssets.filter((a) => a.location === auditLocationFilter);

    const nextCount = sessionCount + 1;
    setSessionCount(nextCount);
    const sessionId = `AUD-${new Date().getFullYear()}-${String(nextCount).padStart(3, "0")}`;
    const newSession: AuditSession = {
      id: sessionId,
      auditor: currentUser.name,
      auditorId: currentUser.id,
      startDate: new Date().toISOString(),
      status: "In Progress",
      location: auditLocationFilter !== "All" ? auditLocationFilter : undefined,
      totalAssets: filteredByLocation.length,
      verifiedAssets: 0,
      notFoundAssets: 0,
    };

    setCurrentAuditSession(newSession);
    setAuditVerifications(new Map());
    setNotification({ message: `Audit session ${sessionId} started.`, type: "success" });
  };

  const handleVerifyAsset = (asset: Asset, status: "Verified" | "Not Found" | "Damaged", notes?: string) => {
    if (!currentAuditSession || !currentUser) return;

    const verification: AuditVerification = {
      id: `VER-${Date.now()}`,
      auditSessionId: currentAuditSession.id,
      assetId: asset.id,
      assetProductId: asset.productId,
      assetName: asset.name,
      status,
      verifiedBy: currentUser.name,
      verificationDate: new Date().toISOString(),
      notes,
      locationMatch: true,
      conditionMatch: true,
    };

    const newMap = new Map(auditVerifications);
    newMap.set(asset.id, verification);
    setAuditVerifications(newMap);

    setCurrentAuditSession({
      ...currentAuditSession,
      verifiedAssets: status === "Verified" ? currentAuditSession.verifiedAssets + 1 : currentAuditSession.verifiedAssets,
      notFoundAssets: status === "Not Found" ? currentAuditSession.notFoundAssets + 1 : currentAuditSession.notFoundAssets,
    });
  };

  const handleCompleteAudit = () => {
    if (!currentAuditSession) return;
    setIsCompletingAudit(true);

    const completedSession: AuditSession = {
      ...currentAuditSession,
      endDate: new Date().toISOString(),
      status: "Completed",
    };

    setNotification({
      message: `Audit ${completedSession.id} completed! Verified: ${completedSession.verifiedAssets}, Not Found: ${completedSession.notFoundAssets}`,
      type: "success",
    });
    setCurrentAuditSession(null);
    setAuditVerifications(new Map());
    setIsCompletingAudit(false);
  };

  const handleCancelAudit = () => {
    setCurrentAuditSession(null);
    setAuditVerifications(new Map());
    setNotification({ message: "Audit cancelled.", type: "error" });
  };

  const assetsToVerify = currentAuditSession
    ? assets.filter(
        (a) =>
          !currentAuditSession.location || a.location === currentAuditSession.location
      )
    : [];

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center text-sm text-slate-500 hover:text-qet-600 mb-6 transition-colors"
        >
          <ArrowLeft size={16} className="mr-1" />
          Back to Dashboard
        </button>
      )}

      <div className="flex justify-between items-start mb-8">
        <div className="flex items-start gap-4">
          <img
            src="./qet-logo-transparent.png"
            alt="QET Logo"
            className="h-12 w-auto object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Physical Asset Audit</h1>
            <p className="text-slate-500">Conduct physical verification and update condition status.</p>
          </div>
        </div>
      </div>

      {notification && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center gap-2 ${
            notification.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {!currentAuditSession ? (
        /* START AUDIT SECTION */
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity size={22} className="text-blue-600" />
            Start Audit Session
          </h2>

          {!canStart ? (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 font-medium">Insufficient permissions</p>
              <p className="text-sm text-amber-700 mt-1">
                Only users with the Auditor role can start audit sessions.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Location (optional)</label>
                <select
                  value={auditLocationFilter}
                  onChange={(e) => setAuditLocationFilter(e.target.value)}
                  className="w-full max-w-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                >
                  {availableLocations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc === "All" ? "All Locations" : loc}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Filter assets by location. Select All Locations to include the full inventory.
                </p>
              </div>
              <p className="text-sm text-slate-600">
                {auditLocationFilter === "All"
                  ? `${assets.length} assets will be included in this audit.`
                  : `${assets.filter((a) => a.location === auditLocationFilter).length} assets at ${auditLocationFilter} will be included.`}
              </p>
              <button
                onClick={handleStartAudit}
                className="px-6 py-3 bg-qet-600 text-white rounded-lg font-bold hover:bg-qet-700 transition-colors flex items-center gap-2 shadow-md"
              >
                <Activity size={20} />
                Start Audit Session
              </button>
            </div>
          )}
        </div>
      ) : (
        /* AUDIT IN PROGRESS */
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-qet-600 to-qet-500 text-white p-6 rounded-xl shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Activity size={24} /> Audit in Progress
                </h3>
                <p className="text-blue-100 text-sm mt-1">Session: {currentAuditSession.id}</p>
                <p className="text-blue-100 text-sm">Auditor: {currentAuditSession.auditor}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">
                  {currentAuditSession.verifiedAssets + currentAuditSession.notFoundAssets}/
                  {currentAuditSession.totalAssets}
                </div>
                <div className="text-blue-100 text-sm">Assets Processed</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                <p className="text-xs text-blue-100">Verified</p>
                <p className="text-lg font-bold">{currentAuditSession.verifiedAssets}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                <p className="text-xs text-blue-100">Not Found</p>
                <p className="text-lg font-bold">{currentAuditSession.notFoundAssets}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                <p className="text-xs text-blue-100">Pending</p>
                <p className="text-lg font-bold">
                  {currentAuditSession.totalAssets -
                    currentAuditSession.verifiedAssets -
                    currentAuditSession.notFoundAssets}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Assets to Verify</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelAudit}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm font-medium"
                >
                  Cancel Audit
                </button>
                <button
                  onClick={handleCompleteAudit}
                  disabled={isCompletingAudit}
                  className="px-4 py-2 bg-qet-600 text-white rounded-lg hover:bg-qet-700 text-sm font-bold flex items-center gap-2"
                >
                  {isCompletingAudit && <Loader2 size={16} className="animate-spin" />}
                  Complete Audit
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
              {assetsToVerify.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No assets to verify for this location.</div>
              ) : (
                assetsToVerify.map((asset) => {
                  const verification = auditVerifications.get(asset.id);
                  const isVerified = verification?.status === "Verified";
                  const isNotFound = verification?.status === "Not Found";
                  const isDamaged = verification?.status === "Damaged";

                  return (
                    <div
                      key={asset.id}
                      className={`p-4 transition-all ${
                        isVerified
                          ? "bg-green-50 border-l-4 border-green-500"
                          : isNotFound
                          ? "bg-red-50 border-l-4 border-red-500"
                          : isDamaged
                          ? "bg-amber-50 border-l-4 border-amber-500"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-slate-800">{asset.name}</h4>
                          <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                            <span className="font-mono">{asset.productId}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <MapPin size={12} /> {asset.location}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {verification ? (
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${
                                isVerified ? "bg-green-100 text-green-700" : isNotFound ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {verification.status}
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleVerifyAsset(asset, "Verified")}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-bold"
                              >
                                ✓ Verified
                              </button>
                              <button
                                onClick={() => {
                                  const notes = prompt("Notes (optional):");
                                  handleVerifyAsset(asset, "Not Found", notes || undefined);
                                }}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-bold"
                              >
                                ✗ Not Found
                              </button>
                              <button
                                onClick={() => {
                                  const notes = prompt("Describe the damage:");
                                  if (notes) handleVerifyAsset(asset, "Damaged", notes);
                                }}
                                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-xs font-bold"
                              >
                                ⚠ Damaged
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {verification?.notes && (
                        <p className="mt-2 text-xs text-slate-600 pl-0">
                          <span className="font-semibold">Notes:</span> {verification.notes}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Audit;
