import re

with open('src/services/realtimeSync.js', 'r') as f:
    content = f.read()

# Fix pushWorkerMetadataLive (inside pushWorkerLive)
content = re.sub(
    r"(groupId:\s*w\.groupId\s*\|\|\s*null,\s*teamRole:\s*w\.teamRole\s*\|\|\s*'Worker',)",
    r"\1\n    wageType: w.wageType || 'standard',",
    content
)

# Fix pullWorkerMetadataLive (local -> cloud)
content = re.sub(
    r"(groupId:\s*w\.groupId\s*\|\|\s*null,\s*teamRole:\s*w\.teamRole\s*\|\|\s*'Worker',)",
    r"\1\n            wageType: w.wageType || 'standard',",
    content
)

# Fix pullWorkerMetadataLive (cloud -> local)
target_cloud_to_local = """          if (meta.teamRole && w.teamRole !== meta.teamRole) {
            updates.teamRole = meta.teamRole;
            needsUpdate = true;
          }"""
replacement_cloud_to_local = """          if (meta.teamRole && w.teamRole !== meta.teamRole) {
            updates.teamRole = meta.teamRole;
            needsUpdate = true;
          }
          if (meta.wageType && w.wageType !== meta.wageType) {
            updates.wageType = meta.wageType;
            needsUpdate = true;
          }"""
content = content.replace(target_cloud_to_local, replacement_cloud_to_local)

# Fix reconcileCloudIntoLocal
target_reconcile = """          teamRole: (localIsNewer && localW?.teamRole)
            ? localW.teamRole
            : (meta.teamRole || localW?.teamRole || 'Worker'),"""
replacement_reconcile = """          teamRole: (localIsNewer && localW?.teamRole)
            ? localW.teamRole
            : (meta.teamRole || localW?.teamRole || 'Worker'),
          wageType: (localIsNewer && localW?.wageType)
            ? localW.wageType
            : (meta.wageType || localW?.wageType || 'standard'),"""
content = content.replace(target_reconcile, replacement_reconcile)

with open('src/services/realtimeSync.js', 'w') as f:
    f.write(content)

with open('src/services/syncService.js', 'r') as f:
    sync_content = f.read()

# Fix syncService.js workers.put
target_sync_put = """          role: w.role,
          dailyRate: Number(w.daily_rate) || 0,"""
replacement_sync_put = """          role: w.role,
          wageType: 'standard', // Will be merged immediately by pullWorkerMetadataLive
          dailyRate: Number(w.daily_rate) || 0,"""
sync_content = sync_content.replace(target_sync_put, replacement_sync_put)

with open('src/services/syncService.js', 'w') as f:
    f.write(sync_content)

print("Patch applied")
