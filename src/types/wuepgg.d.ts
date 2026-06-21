declare module 'wuepgg' {
  import type { ComponentType } from 'react';

  export interface GenomeHubProps {
    storeConfig: {
      storeId: string;
      enablePersistence?: boolean;
    };
    genomeName: string;
    viewRegion: string | null | undefined;
    tracks: Array<Record<string, unknown>>;
    chromosomes?: unknown;
    showGenomeNavigator?: boolean;
    showNavBar?: boolean;
    showToolBar?: boolean;
    showDisclosure?: boolean;
    width?: number;
    height?: number;
    windowWidth?: number;
    darkMode?: boolean;
    onSessionUpdate?: (data: unknown) => void;
  }

  export const GenomeHub: ComponentType<GenomeHubProps>;
}
