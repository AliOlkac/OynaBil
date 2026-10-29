import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { GameProps } from "./types";

/** Oyun ekranları ayrı parçalar hâlinde yüklenir; kurulum ekranı oyun kodunu indirmez. */
export const GAME_SCREENS: Record<string, LazyExoticComponent<ComponentType<GameProps>>> = {
  "bilgi-yarismasi": lazy(() => import("./bilgi-yarismasi/Game")),
  "halat-cekme": lazy(() => import("./halat-cekme/Game")),
};
