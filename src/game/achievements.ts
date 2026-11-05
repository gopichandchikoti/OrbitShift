import {
  chapterCleared,
  chapterPerfect,
  completedCount,
  isCompleted,
  totalShards,
  totalStars,
  type Progress,
} from '../storage/progress-model';
import { CHAPTERS, LEVEL_COUNT } from './levels/chapters';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  earned: (progress: Progress) => boolean;
}

const chapterAchievements: Achievement[] = CHAPTERS.map((chapter) => ({
  id: `chapter-${chapter.id}`,
  title: `${chapter.name} cleared`,
  description: `Complete all 10 levels of chapter ${chapter.id}, ${chapter.name}.`,
  earned: (progress) => chapterCleared(progress, chapter.id),
}));

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'liftoff',
    title: 'Liftoff',
    description: 'Complete the first level.',
    earned: (progress) => isCompleted(progress, 1),
  },
  ...chapterAchievements,
  {
    id: 'three-stars',
    title: 'Clean Burn',
    description: 'Earn three stars on any level.',
    earned: (progress) => Object.values(progress.levels).some((record) => record.stars === 3),
  },
  {
    id: 'stars-30',
    title: 'Constellation',
    description: 'Collect 30 stars in total.',
    earned: (progress) => totalStars(progress) >= 30,
  },
  {
    id: 'stars-100',
    title: 'Night Sky',
    description: 'Collect 100 stars in total.',
    earned: (progress) => totalStars(progress) >= 100,
  },
  {
    id: 'shards-25',
    title: 'Prospector',
    description: 'Collect 25 energy shards.',
    earned: (progress) => totalShards(progress) >= 25,
  },
  {
    id: 'shards-100',
    title: 'Shard Hoard',
    description: 'Collect 100 energy shards.',
    earned: (progress) => totalShards(progress) >= 100,
  },
  {
    id: 'perfect-chapter',
    title: 'Polished',
    description: 'Earn three stars on every level of one chapter.',
    earned: (progress) => CHAPTERS.some((chapter) => chapterPerfect(progress, chapter.id)),
  },
  {
    id: 'persistent',
    title: 'One More Try',
    description: 'Restart a level 25 times.',
    earned: (progress) => progress.stats.restarts >= 25,
  },
  {
    id: 'full-orbit',
    title: 'Full Orbit',
    description: 'Complete all 120 levels.',
    earned: (progress) => completedCount(progress) >= LEVEL_COUNT,
  },
];

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id);
}

/** Ids of achievements the progress now satisfies that it has not recorded yet. */
export function newlyEarned(progress: Progress): string[] {
  return ACHIEVEMENTS.filter((a) => progress.achievements[a.id] === undefined && a.earned(progress)).map((a) => a.id);
}
