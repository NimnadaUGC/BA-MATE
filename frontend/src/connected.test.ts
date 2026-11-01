import { describe, expect, it } from 'vitest';
import { diagramEmbeddingNeedsRefresh, eligibleForDocumentSync, freshState, migrateWorkspace } from './store';
import { projectReferences } from './references';
import { repository } from './store';
import JSZip from 'jszip';

describe('connected workspace domain behavior',()=>{
  it('migrates older string conversation context without losing identifiers',()=>{
    const old=freshState() as unknown as Record<string,unknown>;delete old.schemaVersion;
    const project=(old.projects as any[])[0];project.conversations[0].context=['SRC-01','FR-01'];delete project.documentSyncProposals;
    const migrated=migrateWorkspace(old);expect(migrated.schemaVersion).toBe(8);expect(migrated.projects[0].conversations[0].context.map(x=>x.id)).toEqual(['SRC-01','FR-01']);expect(migrated.projects[0].documentSyncProposals).toEqual([]);expect(migrated.telemetryEvents).toEqual([]);expect(migrated.stageFeedback).toEqual([]);expect(migrated.researchParticipation).toMatchObject({enrollment:{status:'not-enrolled'},queue:[]});
  });
  it('allows only approved requirements and stories into controlled documents',()=>{
    const project=freshState().projects[0];expect(eligibleForDocumentSync(project,['FR-01','NFR-01','US-01']).map(x=>x.id)).toEqual(['FR-01','US-01']);
  });
  it('exposes typed, versioned references for conversations',()=>{
    const refs=projectReferences(freshState().projects[0]);expect(refs.find(x=>x.id==='FR-01')).toMatchObject({type:'Requirement',version:4,route:'artifacts'});expect(refs.find(x=>x.id==='DGM-01')).toMatchObject({type:'Diagram',version:3,route:'diagrams'});
  });
  it('detects when a version-pinned diagram requires review',()=>{
    const project=freshState().projects[0];expect(diagramEmbeddingNeedsRefresh(project,'DGM-01',2)).toBe(true);expect(diagramEmbeddingNeedsRefresh(project,'DGM-01',3)).toBe(false);
  });
  it('includes connected records in portable project ZIP exports',async()=>{
    const blob=await repository.exportProject(freshState().projects[0]);const zip=await JSZip.loadAsync(await blob.arrayBuffer());
    const data=JSON.parse(await zip.file('ba-mate-project.json')!.async('string'));
    expect(data.project.clarifications).toEqual(freshState().projects[0].clarifications);
    expect(data.project.audit).toEqual(freshState().projects[0].audit);
    expect(data.project.members).toEqual(freshState().projects[0].members);

  });
});
