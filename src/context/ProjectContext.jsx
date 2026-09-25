import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateProjectId, ensureDefaultProjectExists, DEFAULT_PROJECT_ID } from '../db/db';
import { supabase, pullProjectsLive, pushProjectLive, deleteProjectLive } from '../services/realtimeSync';
import { useAuth } from './AuthContext';

const ACTIVE_PROJECT_KEY = 'karsync_active_project_id';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id || user?.userId || 'default_user';

  const [activeProjectId, setActiveProjectId] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_PROJECT_KEY) || DEFAULT_PROJECT_ID;
    } catch {
      return DEFAULT_PROJECT_ID;
    }
  });

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isProjectSettingsModalOpen, setIsProjectSettingsModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);

  const [dateFilter, setDateFilter] = useState({
    mode: 'monthly', // 'monthly' | 'unsettled_only'
    month: new Date().toISOString().substring(0, 7)
  });

  const [profileWorkerId, setProfileWorkerId] = useState(null);
  const openWorkerProfile = (workerId) => {
    if (workerId) setProfileWorkerId(workerId);
  };
  const closeWorkerProfile = () => {
    setProfileWorkerId(null);
  };

  const openProjectSettings = (projectId = null) => {
    setEditingProjectId(projectId || activeProjectId || DEFAULT_PROJECT_ID);
    setIsProjectSettingsModalOpen(true);
  };

  // Live query all projects from Dexie
  const allProjects = useLiveQuery(async () => {
    try {
      const list = await db.projects.toArray();
      return list || [];
    } catch (err) {
      console.warn('Error querying projects from Dexie:', err);
      return [];
    }
  }, [], []);

  // Ensure default project exists on startup or when user signs in
  useEffect(() => {
    let isMounted = true;
    async function initProjects() {
      try {
        await ensureDefaultProjectExists(userId);
      } catch (err) {
        console.warn('Init projects warning:', err);
      }
    }
    initProjects();
    return () => { isMounted = false; };
  }, [userId]);

  // Pull initial projects on startup once
  useEffect(() => {
    let isMounted = true;
    if (navigator.onLine) {
      pullProjectsLive().catch(() => {});
    }
    return () => { isMounted = false; };
  }, []);

  // Filter active, archived, and trash projects
  const activeProjects = useMemo(() => {
    return allProjects.filter((p) => !p.deletedAt && p.status !== 'archived' && !p.isArchived);
  }, [allProjects]);

  const archivedProjects = useMemo(() => {
    return allProjects.filter((p) => !p.deletedAt && (p.status === 'archived' || p.isArchived));
  }, [allProjects]);

  const trashProjects = useMemo(() => {
    return allProjects.filter((p) => !!p.deletedAt);
  }, [allProjects]);

  // Current active project
  const currentProject = useMemo(() => {
    if (!allProjects || allProjects.length === 0) {
      return {
        id: DEFAULT_PROJECT_ID,
        userId: userId,
        name: 'پروژه مرکزی (کارگاه)',
        currency: 'IQD',
        standardWorkHours: 8,
        overtimeMultiplier: 1.0,
        status: 'active'
      };
    }

    const found = allProjects.find((p) => p.id === activeProjectId && !p.deletedAt);
    if (found) return found;

    // Fallback to first active project
    if (activeProjects.length > 0) return activeProjects[0];

    return allProjects.find((p) => !p.deletedAt) || allProjects[0];
  }, [allProjects, activeProjectId, activeProjects, userId]);

  // Keep activeProjectId in sync if currentProject changes
  useEffect(() => {
    if (currentProject && currentProject.id !== activeProjectId) {
      setActiveProjectId(currentProject.id);
      try {
        localStorage.setItem(ACTIVE_PROJECT_KEY, currentProject.id);
      } catch (_) {}
    }
  }, [currentProject, activeProjectId]);

  // Switch project handler
  const switchProject = (projectId) => {
    if (!projectId) return;
    setActiveProjectId(projectId);
    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
    } catch (_) {}
  };

  // Create new project
  const createProject = async ({
    name,
    currency = 'IQD',
    standardWorkHours = 8,
    overtimeMultiplier = 1.0,
    notes = ''
  }) => {
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      throw new Error('Project name is required');
    }

    const newProject = {
      id: generateProjectId(),
      userId: userId,
      name: trimmedName,
      currency: currency || 'IQD',
      standardWorkHours: Number(standardWorkHours) || 8,
      overtimeMultiplier: Number(overtimeMultiplier) || 1.0,
      status: 'active',
      notes: notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save to Dexie
    await db.projects.put(newProject);
    switchProject(newProject.id);

    // Push to Supabase if online
    if (navigator.onLine) {
      pushProjectLive(newProject).catch((err) => {
        console.warn('Could not sync new project to Supabase:', err);
      });
    }

    return newProject;
  };

  // Update existing project
  const updateProject = async (projectId, updates) => {
    const existing = await db.projects.get(projectId);
    if (!existing) throw new Error('Project not found');

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await db.projects.put(updated);

    if (navigator.onLine) {
      pushProjectLive(updated).catch((err) => {
        console.warn('Could not sync project update to Supabase:', err);
      });
    }

    return updated;
  };

  // Archive project
  const archiveProject = async (projectId) => {
    return updateProject(projectId, { status: 'archived', isArchived: true });
  };

  // Unarchive project
  const unarchiveProject = async (projectId) => {
    return updateProject(projectId, { status: 'active', isArchived: false });
  };

  // Soft-delete project (move to trash)
  const softDeleteProject = async (projectId) => {
    if (projectId === DEFAULT_PROJECT_ID) {
      throw new Error('Cannot delete default project');
    }
    const updated = await updateProject(projectId, { deletedAt: new Date().toISOString() });
    if (activeProjectId === projectId) {
      const fallback = activeProjects.find((p) => p.id !== projectId)?.id || DEFAULT_PROJECT_ID;
      switchProject(fallback);
    }
    return updated;
  };

  // Restore project from trash
  const restoreProject = async (projectId) => {
    return updateProject(projectId, { deletedAt: null });
  };

  // Permanent Delete project
  const deleteProject = async (projectId) => {
    if (projectId === DEFAULT_PROJECT_ID) {
      throw new Error('Cannot delete default project');
    }

    await db.projects.delete(projectId);
    await db.projectSections.where('projectId').equals(projectId).delete();

    // If active was deleted, switch to default
    if (activeProjectId === projectId) {
      switchProject(DEFAULT_PROJECT_ID);
    }

    if (navigator.onLine) {
      deleteProjectLive(projectId).catch((err) => {
        console.warn('Could not sync project delete to Supabase:', err);
      });
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projects: allProjects,
        activeProjects,
        archivedProjects,
        trashProjects,
        currentProject,
        switchProject,
        createProject,
        updateProject,
        archiveProject,
        unarchiveProject,
        softDeleteProject,
        restoreProject,
        deleteProject,
        isNewProjectModalOpen,
        setIsNewProjectModalOpen,
        isProjectSettingsModalOpen,
        setIsProjectSettingsModalOpen,
        editingProjectId,
        setEditingProjectId,
        openProjectSettings,
        dateFilter,
        setDateFilter,
        profileWorkerId,
        openWorkerProfile,
        closeWorkerProfile
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
