"use client";

import { Dumbbell, Play } from "lucide-react";
import { Exercise } from "@/lib/types";
import { youtubeThumbnailUrl } from "@/lib/youtube";

interface ExerciseCardProps {
  exercise: Exercise;
  onClick: () => void;
}

export function ExerciseCard({ exercise, onClick }: ExerciseCardProps) {
  const thumbnailUrl = exercise.thumbnail_url || youtubeThumbnailUrl(exercise.video_url);

  return (
    <button
      onClick={onClick}
      className="glass-card overflow-hidden text-left group hover:border-accent/30 transition-all w-full"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-surface/50 overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={exercise.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Dumbbell size={32} className="text-muted/30" />
          </div>
        )}
        {exercise.video_url && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <div className="p-2 rounded-full bg-accent/90 text-white">
              <Play size={16} fill="currentColor" />
            </div>
          </div>
        )}
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-black/60 text-white/80 backdrop-blur-sm">
          {exercise.modality}
        </span>
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="text-sm font-medium text-foreground truncate mb-1.5">
          {exercise.name}
        </h4>
        <div className="flex flex-wrap gap-1">
          {exercise.muscle_groups.map((mg) => (
            <span
              key={mg}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success/80"
            >
              {mg}
            </span>
          ))}
        </div>
        {exercise.default_tracking_fields.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {exercise.default_tracking_fields.map((tf) => (
              <span
                key={tf}
                className="px-1.5 py-0.5 rounded text-[10px] bg-black/5 text-muted/70"
              >
                {tf}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
