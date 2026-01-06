/**
 * Note Cluster Entity
 * 관련 노트들의 클러스터를 나타내는 도메인 엔티티
 */

export interface ClusterMember {
  /** 노트 ID */
  noteId: string;
  /** 노트 경로 */
  notePath: string;
  /** 노트 제목 */
  title: string;
  /** 클러스터 중심과의 유사도 (0.0 ~ 1.0) */
  similarity: number;
}

export interface NoteCluster {
  /** 고유 ID */
  id: string;
  /** 클러스터 이름 (태그명, AI 생성, 또는 사용자 지정) */
  name: string;
  /** 클러스터 멤버 노트들 */
  members: ClusterMember[];
  /** 클러스터 중심 벡터 (임베딩 평균) */
  centroidVector?: number[];
  /** 클러스터 응집도 (0.0 ~ 1.0, 멤버 간 평균 유사도) */
  coherenceScore: number;
  /** 클러스터 생성 방식 */
  source: 'tag' | 'folder' | 'similarity' | 'manual';
  /** 생성 시간 */
  createdAt: Date;
}

export function createNoteCluster(
  name: string,
  members: ClusterMember[],
  source: NoteCluster['source'],
  coherenceScore: number = 0,
  centroidVector?: number[]
): NoteCluster {
  return {
    id: `cluster_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name,
    members,
    centroidVector,
    coherenceScore,
    source,
    createdAt: new Date(),
  };
}

/**
 * 클러스터 멤버들의 노트 ID 목록 반환
 */
export function getClusterNoteIds(cluster: NoteCluster): string[] {
  return cluster.members.map((m) => m.noteId);
}
