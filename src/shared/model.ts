export type ArtifactKind = 'markdown' | 'html' | 'image';
export interface ArtifactVersion {
  id: string;
  content: string;
  label: string;
  createdAt: string;
  parentId: string | null;
}
export interface Artifact {
  id: string;
  title: string;
  kind: ArtifactKind;
  x: number;
  y: number;
  activeVersionId: string;
  versions: ArtifactVersion[];
}
export interface Annotation {
  id: string;
  artifactId: string;
  versionId: string;
  selector: string;
  quote: string;
  text: string;
  createdAt: string;
}
export interface Board {
  schemaVersion: 1;
  sessionId: string;
  revision: number;
  artifacts: Artifact[];
  annotations: Annotation[];
}
export class CanvasError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; this.name = 'CanvasError'; }
}
export function activeVersion(artifact: Artifact): ArtifactVersion {
  const version = artifact.versions.find(item => item.id === artifact.activeVersionId);
  if (!version) throw new CanvasError('invalid-version', '找不到这个成果版本。');
  return version;
}
